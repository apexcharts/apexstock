// @vitest-environment jsdom
//
// Tests for ApexStock#listIndicators / getIndicator — indicator introspection.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import ApexStock from "../src/ApexStock.js";

function ohlcData(n = 60) {
  return Array.from({ length: n }, (_, i) => ({
    x: new Date(2020, 0, i + 1).getTime(),
    y: [10 + i, 12 + i, 9 + i, 11 + i],
    v: 1000 + i,
  }));
}

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

describe("ApexStock#listIndicators / getIndicator", () => {
  let inst;
  beforeEach(() => {
    installApexChartsMock();
    inst = makeInstance();
  });
  afterEach(() => {
    document.body.innerHTML = "";
    delete global.ApexCharts;
  });

  it("lists built-in indicators with correct metadata", () => {
    const all = inst.listIndicators();
    const byKey = Object.fromEntries(all.map((i) => [i.key, i]));

    expect(byKey["rsi"]).toMatchObject({
      key: "rsi",
      label: "RSI",
      type: "oscillator",
      kind: "oscillator",
      builtin: true,
      streamable: true,
      active: false,
    });
    expect(byKey["rsi"].params).toEqual({ period: 14 });

    expect(byKey["moving average"]).toMatchObject({
      type: "overlay",
      kind: "overlay",
      builtin: true,
      streamable: true,
    });

    // Fibonacci is a "custom" (annotation) kind, grouped under overlays, no twin.
    expect(byKey["fibonacci retracements"]).toMatchObject({
      kind: "custom",
      type: "overlay",
      streamable: false,
    });
  });

  it("reflects active state per instance", () => {
    expect(inst.getIndicator("rsi").active).toBe(false);
    inst.updateIndicator("rsi");
    expect(inst.getIndicator("rsi").active).toBe(true);
    inst.removeIndicator("rsi");
    expect(inst.getIndicator("rsi").active).toBe(false);
  });

  it("getIndicator is case-insensitive and returns null for unknown keys", () => {
    expect(inst.getIndicator("RSI").key).toBe("rsi");
    expect(inst.getIndicator("not a real indicator")).toBeNull();
  });

  it("returns {} params for indicators with no configurable params", () => {
    expect(inst.getIndicator("moving average").params).toEqual({});
  });

  it("includes custom-registered indicators (builtin: false)", () => {
    ApexStock.registerIndicator("mystoch", {
      type: "oscillator",
      defaultParams: { period: 9 },
      calc: (series) => series.map((b) => b.y[3]),
      stream: {
        seed: () => ({}),
        step: (s, series) => ({ value: series[series.length - 1].y[3], state: s }),
        render: (v, x) => [{ name: "Mystoch", point: { x, y: v } }],
      },
    });

    const inst2 = makeInstance();
    const info = inst2.getIndicator("mystoch");
    expect(info).toMatchObject({
      key: "mystoch",
      type: "oscillator",
      builtin: false,
      streamable: true,
    });
    expect(info.params).toEqual({ period: 9 });

    // And it shows up in the full list.
    expect(inst2.listIndicators().some((i) => i.key === "mystoch")).toBe(true);
  });
});
