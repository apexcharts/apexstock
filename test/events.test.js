// @vitest-environment jsdom
//
// Wiring tests for the public event API (ApexStock#on/off/once/emit) and the
// four built-in events: crosshairMove, click, rangeChange, indicatorToggle.
// These assert that the emitter is wired to the right internal hooks; the
// emitter's own semantics are covered in event-emitter.test.js.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import ApexStock from "../src/ApexStock.js";

function ohlcData(n = 60) {
  return Array.from({ length: n }, (_, i) => ({
    x: new Date(2020, 0, i + 1).getTime(),
    y: [10 + i, 12 + i, 9 + i, 11 + i],
    v: 1000 + i,
  }));
}

/** A capturing ApexCharts mock (mirrors indicator-handlers.test.js). */
function installApexChartsMock() {
  global.ApexCharts = vi.fn(function (el, opts) {
    const inst = {
      el,
      options: opts,
      w: {
        globals: { chartID: "chart", dataPoints: 60, minX: 0, maxX: 59 },
        config: {
          chart: { type: "candlestick" },
          series: (opts && opts.series) || [],
          yaxis: [{}],
          annotations: {},
        },
      },
      render: vi.fn(),
      destroy: vi.fn(),
      addEventListener: vi.fn(),
      updateSeries: vi.fn(function (s) {
        inst.w.config.series = s;
      }),
      updateOptions: vi.fn(),
      removeAnnotation: vi.fn(),
      addYaxisAnnotation: vi.fn(),
      zoomX: vi.fn(),
    };
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

describe("ApexStock event API", () => {
  let inst;
  beforeEach(() => {
    installApexChartsMock();
    inst = makeInstance();
  });
  afterEach(() => {
    document.body.innerHTML = "";
    delete global.ApexCharts;
  });

  it("on() subscribes and returns an unsubscribe handle", () => {
    const cb = vi.fn();
    const off = inst.on("custom", cb);
    inst.emit("custom", 42);
    expect(cb).toHaveBeenCalledWith(42);
    off();
    inst.emit("custom", 43);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("once() fires a single time", () => {
    const cb = vi.fn();
    inst.once("custom", cb);
    inst.emit("custom");
    inst.emit("custom");
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("emits indicatorToggle {active:true} then {active:false} on toggle", () => {
    const events = [];
    inst.on("indicatorToggle", (e) => events.push(e));
    inst.updateIndicator("moving average"); // add
    inst.updateIndicator("moving average"); // toggle off
    expect(events).toEqual([
      { key: "moving average", active: true },
      { key: "moving average", active: false },
    ]);
  });

  it("emits indicatorToggle exactly once per add for an oscillator", () => {
    const cb = vi.fn();
    inst.on("indicatorToggle", cb);
    inst.updateIndicator("rsi");
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith({ key: "rsi", active: true });
  });

  it("removeIndicator on an inactive indicator does not emit", () => {
    const cb = vi.fn();
    inst.on("indicatorToggle", cb);
    inst.removeIndicator("rsi");
    expect(cb).not.toHaveBeenCalled();
  });

  it("emits rangeChange with source 'zoom' from handleZoom", () => {
    const cb = vi.fn();
    inst.on("rangeChange", cb);
    const ctx = { w: { config: { series: [{ data: inst.series }] } } };
    const min = inst.series[5].x;
    const max = inst.series[40].x;
    inst.handleZoom(ctx, { xaxis: { min, max } });
    expect(cb).toHaveBeenCalledTimes(1);
    const payload = cb.mock.calls[0][0];
    expect(payload.source).toBe("zoom");
    expect(payload.min).toBe(min);
    expect(payload.max).toBe(max);
  });

  it("emits rangeChange with source 'pan' from handleScroll", () => {
    const cb = vi.fn();
    inst.on("rangeChange", cb);
    const ctx = { w: { config: { series: [{ data: inst.series }] } } };
    inst.handleScroll(ctx, {
      xaxis: { min: inst.series[1].x, max: inst.series[10].x },
    });
    expect(cb).toHaveBeenCalledWith(
      expect.objectContaining({ source: "pan" })
    );
  });

  it("emits rangeChange with source 'reset' from handleBeforeResetZoom", async () => {
    const cb = vi.fn();
    inst.on("rangeChange", cb);
    inst.handleBeforeResetZoom({}, {});
    await new Promise((r) => setTimeout(r, 5));
    expect(cb).toHaveBeenCalledWith(
      expect.objectContaining({ source: "reset" })
    );
  });

  it("emits crosshairMove with OHLC of the hovered candle", () => {
    const cb = vi.fn();
    inst.on("crosshairMove", cb);
    inst.mainChartOptions.chart.events.mouseMove(
      { type: "mousemove" },
      {},
      { dataPointIndex: 3, seriesIndex: 0 }
    );
    expect(cb).toHaveBeenCalledTimes(1);
    const p = cb.mock.calls[0][0];
    expect(p.dataPointIndex).toBe(3);
    expect(p.x).toBe(inst.series[3].x);
    expect(p.ohlc).toEqual({ open: 13, high: 15, low: 12, close: 14 });
    expect(p.volume).toBe(1003);
  });

  it("emits click with null OHLC when not over a candle", () => {
    const cb = vi.fn();
    inst.on("click", cb);
    inst.mainChartOptions.chart.events.click(
      { type: "click" },
      {},
      { dataPointIndex: -1, seriesIndex: -1 }
    );
    expect(cb).toHaveBeenCalledTimes(1);
    const p = cb.mock.calls[0][0];
    expect(p.dataPointIndex).toBe(-1);
    expect(p.x).toBeNull();
    expect(p.ohlc).toBeNull();
    expect(p.volume).toBeNull();
    expect(p.seriesIndex).toBe(0);
  });

  it("destroy() clears all subscriptions", () => {
    const cb = vi.fn();
    inst.on("indicatorToggle", cb);
    inst.destroy();
    expect(inst._emitter.listenerCount("indicatorToggle")).toBe(0);
    // A post-destroy internal emit reaches nobody.
    inst.emit("indicatorToggle", { key: "rsi", active: true });
    expect(cb).not.toHaveBeenCalled();
  });
});
