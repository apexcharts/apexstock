// @vitest-environment jsdom
//
// Leak/teardown tests for destroy(): the underlying ApexCharts instances are
// destroyed, all window/document listeners the chart added are removed, the
// shared stylesheet is dropped, the event bus is cleared, and destroy() is
// idempotent. Guards against the classic "chart leaks on SPA route change" bug.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import ApexStock from "../src/ApexStock.js";

function ohlcData(n = 40) {
  return Array.from({ length: n }, (_, i) => ({
    x: new Date(2020, 0, i + 1).getTime(),
    y: [10 + i, 12 + i, 9 + i, 11 + i],
    v: 1000 + i,
  }));
}

const created = [];
function installApexChartsMock() {
  created.length = 0;
  global.ApexCharts = vi.fn(function (el, opts) {
    const inst = {
      el,
      options: opts,
      w: { globals: { chartID: (opts && opts.chart && opts.chart.id) || "chart" }, config: { chart: { type: "candlestick" }, series: (opts && opts.series) || [], yaxis: [{}], annotations: {} } },
      render: vi.fn(),
      destroy: vi.fn(),
      addEventListener: vi.fn(),
      updateSeries: vi.fn(),
      updateOptions: vi.fn(),
      zoomX: vi.fn(),
    };
    created.push(inst);
    return inst;
  });
}

function makeInstance() {
  const parent = document.createElement("div");
  const container = document.createElement("div");
  parent.appendChild(container);
  document.body.appendChild(parent);
  return new ApexStock(container, {
    chart: { height: 500 },
    theme: { mode: "light" },
    series: [{ name: "Price", data: ohlcData() }],
  });
}

/** Wrap addEventListener/removeEventListener on a target to track live listeners. */
function trackListeners(target) {
  let seq = 0;
  const live = new Map(); // key -> `${type}`
  const idOf = (h) => {
    if (!h.__lid) {
      try {
        Object.defineProperty(h, "__lid", { value: ++seq, enumerable: false });
      } catch {
        return "anon" + ++seq;
      }
    }
    return h.__lid;
  };
  const key = (t, h) => `${t}#${idOf(h)}`;
  const add = target.addEventListener.bind(target);
  const rem = target.removeEventListener.bind(target);
  vi.spyOn(target, "addEventListener").mockImplementation((t, h, o) => {
    if (typeof h === "function") live.set(key(t, h), t);
    return add(t, h, o);
  });
  vi.spyOn(target, "removeEventListener").mockImplementation((t, h, o) => {
    if (typeof h === "function") live.delete(key(t, h));
    return rem(t, h, o);
  });
  return live;
}

describe("destroy() teardown", () => {
  beforeEach(() => installApexChartsMock());
  afterEach(() => {
    document.body.innerHTML = "";
    delete global.ApexCharts;
    vi.restoreAllMocks();
  });

  it("destroys the main chart + oscillator panes and clears the map", () => {
    const inst = makeInstance();
    inst.render();
    inst.updateIndicator("rsi"); // adds an oscillator pane
    const main = inst.chart;
    const panes = Object.values(inst.indicatorChartMap);
    expect(panes.length).toBeGreaterThan(0);

    inst.destroy();
    expect(main.destroy).toHaveBeenCalledTimes(1);
    panes.forEach((p) => expect(p.destroy).toHaveBeenCalledTimes(1));
    expect(Object.keys(inst.indicatorChartMap)).toHaveLength(0);
    expect(inst.chart).toBeNull();
  });

  it("clears all event subscriptions", () => {
    const inst = makeInstance();
    inst.render();
    const handler = vi.fn();
    inst.on("rangeChange", handler);
    inst.destroy();
    inst.emit("rangeChange", { min: 0, max: 1, source: "zoom" });
    expect(handler).not.toHaveBeenCalled();
    expect(inst._emitter.listenerCount("rangeChange")).toBe(0);
  });

  it("is idempotent (safe to call twice, and before render)", () => {
    const a = makeInstance();
    expect(() => a.destroy()).not.toThrow(); // before render()
    const b = makeInstance();
    b.render();
    b.destroy();
    const mainDestroyCalls = b.chart; // now null; capture happened inside
    expect(() => b.destroy()).not.toThrow(); // second call
    // The main chart's destroy fired exactly once despite two destroy() calls.
    expect(created.filter((c) => c.destroy.mock.calls.length > 1)).toHaveLength(0);
    void mainDestroyCalls;
  });

  it("removes every window/document listener it added (net zero)", () => {
    const winLive = trackListeners(window);
    const docLive = trackListeners(document);

    const inst = makeInstance();
    inst.render();
    inst.updateIndicator("rsi");
    inst.updateIndicator("moving average");
    // Something must have been registered, or the test proves nothing.
    expect(winLive.size + docLive.size).toBeGreaterThan(0);

    inst.destroy();
    expect([...winLive.entries()]).toEqual([]);
    expect([...docLive.entries()]).toEqual([]);
  });

  it("does not accumulate listeners across repeated mount/unmount", () => {
    const winLive = trackListeners(window);
    const docLive = trackListeners(document);
    for (let i = 0; i < 5; i++) {
      const inst = makeInstance();
      inst.render();
      inst.updateIndicator("rsi");
      inst.destroy();
    }
    expect(winLive.size).toBe(0);
    expect(docLive.size).toBe(0);
  });

  it("removes the shared stylesheet when the last instance is destroyed", () => {
    const a = makeInstance();
    a.render();
    const b = makeInstance();
    b.render();
    expect(document.getElementById("apexstock-css")).not.toBeNull();

    a.destroy(); // still one instance left -> style stays
    expect(document.getElementById("apexstock-css")).not.toBeNull();
    b.destroy(); // last one -> style removed
    expect(document.getElementById("apexstock-css")).toBeNull();
  });
});
