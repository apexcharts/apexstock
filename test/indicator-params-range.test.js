// @vitest-environment jsdom
//
// Tests for programmatic indicator params (updateIndicator(key, params) /
// setIndicatorParams) and the visible-range accessors (getVisibleRange /
// setVisibleRange).
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

describe("programmatic indicator params", () => {
  let inst;
  beforeEach(() => {
    installApexChartsMock();
    inst = makeInstance();
  });
  afterEach(() => {
    document.body.innerHTML = "";
    delete global.ApexCharts;
  });

  it("updateIndicator(key, params) activates an inactive indicator with params", () => {
    inst.updateIndicator("rsi", { period: 21 });
    expect(!!inst.indicatorChartMap["rsi"]).toBe(true);
    expect(inst.oscillatorSettings.getIndicatorParams("rsi")).toEqual({
      period: 21,
    });
    expect(inst.getIndicator("rsi").params).toEqual({ period: 21 });
  });

  it("updates params of an already-active indicator in place (no toggle-off)", () => {
    inst.updateIndicator("rsi"); // active, default period 14
    const toggle = vi.fn();
    inst.on("indicatorToggle", toggle);
    const pane = inst.indicatorChartMap["rsi"];

    inst.updateIndicator("rsi", { period: 9 });

    expect(!!inst.indicatorChartMap["rsi"]).toBe(true); // still active
    expect(inst.indicatorChartMap["rsi"]).toBe(pane); // same pane (no teardown)
    expect(pane.updateSeries).toHaveBeenCalled(); // recomputed in place
    expect(inst.oscillatorSettings.getIndicatorParams("rsi").period).toBe(9);
    expect(toggle).not.toHaveBeenCalled(); // no add/remove event
  });

  it("setIndicatorParams is the explicit alias and is chainable", () => {
    expect(inst.setIndicatorParams("rsi", { period: 7 })).toBe(inst);
    expect(inst.getIndicator("rsi").params.period).toBe(7);
  });

  it("makes overlay periods configurable (moving average)", () => {
    inst.updateIndicator("moving average", { period: 5 });
    expect(!!inst.indicatorChartMap["moving average"]).toBe(true);
    expect(inst.getIndicator("moving average").params).toEqual({ period: 5 });
  });

  it("updateIndicator(key) with no params still toggles", () => {
    inst.updateIndicator("rsi");
    expect(!!inst.indicatorChartMap["rsi"]).toBe(true);
    inst.updateIndicator("rsi");
    expect(!!inst.indicatorChartMap["rsi"]).toBe(false);
  });
});

describe("visible range accessors", () => {
  let inst;
  beforeEach(() => {
    installApexChartsMock();
    inst = makeInstance();
  });
  afterEach(() => {
    document.body.innerHTML = "";
    delete global.ApexCharts;
  });

  it("getVisibleRange returns the current x-window", () => {
    const r = inst.getVisibleRange();
    expect(r).toEqual({
      min: inst.xaxisRange.min,
      max: inst.xaxisRange.max,
    });
    expect(Number.isFinite(r.min) && Number.isFinite(r.max)).toBe(true);
  });

  it("setVisibleRange zooms the main chart and all panes", () => {
    inst.updateIndicator("rsi");
    const pane = inst.indicatorChartMap["rsi"];
    const min = inst.series[10].x;
    const max = inst.series[40].x;

    expect(inst.setVisibleRange(min, max)).toBe(inst);
    expect(inst.chart.zoomX).toHaveBeenCalledWith(min, max);
    expect(pane.zoomX).toHaveBeenCalledWith(min, max);
  });

  it("setVisibleRange rejects an invalid range", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    inst.setVisibleRange(100, 100); // min == max
    expect(inst.chart.zoomX).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
