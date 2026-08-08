// @vitest-environment jsdom
//
// VWAP indicator: cumulative volume-weighted average price as a main-chart
// overlay. Covers the math (hlc3 + close sources), the rendered line, params
// via updateIndicator, introspection, and getState round-trip.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Indicators from "../src/indicators/Indicators.js";
import ApexStock from "../src/ApexStock.js";

function bars() {
  // Simple, hand-verifiable OHLCV.
  return [
    { x: 1, y: [10, 12, 8, 10], v: 100 }, // hlc3 = (12+8+10)/3 = 10
    { x: 2, y: [10, 22, 8, 20], v: 300 }, // hlc3 = (22+8+20)/3 = 16.666...
    { x: 3, y: [20, 30, 20, 30], v: 600 }, // hlc3 = (30+20+30)/3 = 26.666...
  ];
}

describe("Indicators.calculateVWAP", () => {
  it("computes cumulative hlc3-weighted VWAP", () => {
    const v = Indicators.calculateVWAP(bars(), "hlc3");
    // bar0: 10
    expect(v[0]).toBeCloseTo(10, 2);
    // bar1: (10*100 + 16.6667*300) / (100+300) = (1000 + 5000)/400 = 15
    expect(v[1]).toBeCloseTo(15, 2);
    // bar2: (6000 + 26.6667*600) / (400+600) = (6000 + 16000)/1000 = 22
    expect(v[2]).toBeCloseTo(22, 2);
  });

  it("supports a close source", () => {
    const v = Indicators.calculateVWAP(bars(), "close");
    // closes 10,20,30 weighted by 100,300,600
    expect(v[0]).toBeCloseTo(10, 2);
    expect(v[1]).toBeCloseTo((10 * 100 + 20 * 300) / 400, 2); // 17.5
    expect(v[2]).toBeCloseTo((7000 + 30 * 600) / 1000, 2); // 25
  });

  it("falls back to price while cumulative volume is zero", () => {
    const novol = [
      { x: 1, y: [10, 12, 8, 10] },
      { x: 2, y: [10, 22, 8, 20] },
    ];
    const v = Indicators.calculateVWAP(novol, "close");
    expect(v[0]).toBeCloseTo(10, 2);
    expect(v[1]).toBeCloseTo(20, 2); // still no volume -> uses the close
  });
});

function installApexChartsMock() {
  global.ApexCharts = vi.fn(function (el, opts) {
    const inst = {
      el,
      options: opts,
      w: { globals: {}, config: { chart: { type: "candlestick" }, series: (opts && opts.series) || [], yaxis: [{}], annotations: {} } },
      render: vi.fn(),
      destroy: vi.fn(),
      addEventListener: vi.fn(),
      updateSeries: vi.fn(function (s) { inst.w.config.series = s; }),
      updateOptions: vi.fn(),
      zoomX: vi.fn(),
    };
    return inst;
  });
}

function makeInstance(data) {
  const parent = document.createElement("div");
  const container = document.createElement("div");
  parent.appendChild(container);
  document.body.appendChild(parent);
  return new ApexStock(container, {
    chart: { height: 400 },
    theme: { mode: "light" },
    series: [{ name: "Price", data: data || bars() }],
  });
}

describe("ApexStock VWAP overlay", () => {
  let inst;
  beforeEach(() => {
    installApexChartsMock();
    inst = makeInstance();
  });
  afterEach(() => {
    document.body.innerHTML = "";
    delete global.ApexCharts;
  });

  it("adds a VWAP line with the computed values and marks it active", () => {
    inst.updateIndicator("vwap");
    const series = inst.chart.updateSeries.mock.calls.at(-1)[0];
    const vwap = series.find((s) => s.name === "VWAP");
    expect(vwap).toBeTruthy();
    expect(vwap.type).toBe("line");
    expect(vwap.data.map((p) => p.y)).toEqual([10, 15, 22]);
    expect(inst.indicatorChartMap.vwap).toBe(true);
  });

  it("recomputes when the source param changes to close", () => {
    inst.updateIndicator("vwap", { source: "close" });
    const series = inst.chart.updateSeries.mock.calls.at(-1)[0];
    const vwap = series.find((s) => s.name === "VWAP");
    expect(vwap.data[1].y).toBeCloseTo(17.5, 2);
    expect(vwap.data[2].y).toBeCloseTo(25, 2);
  });

  it("is introspectable with an uppercase label", () => {
    const info = inst.getIndicator("vwap");
    expect(info).toBeTruthy();
    expect(info.label).toBe("VWAP");
    expect(info.type).toBe("overlay");
    expect(info.builtin).toBe(true);
    expect(inst.listIndicators().some((i) => i.key === "vwap")).toBe(true);
  });

  it("round-trips through getState/setState", () => {
    inst.updateIndicator("vwap");
    const state = inst.getState();
    const other = makeInstance();
    other.setState(state);
    expect(other.indicatorChartMap.vwap).toBe(true);
  });

  it("streams exactly via appendData (matches a full recompute)", () => {
    const seed = bars();
    inst.updateIndicator("vwap");
    const next = { x: 4, y: [30, 40, 28, 38], v: 200 };
    inst.appendData(next, { commit: true });
    const series = inst.chart.updateSeries.mock.calls.at(-1)[0];
    const vwap = series.find((s) => s.name === "VWAP");
    const full = Indicators.calculateVWAP([...seed, next], "hlc3");
    expect(vwap.data.at(-1).y).toBeCloseTo(full.at(-1), 2);
  });
});
