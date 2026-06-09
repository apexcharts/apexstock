// @vitest-environment jsdom
//
// Characterization tests for IndicatorHandlers. These pin the *observable*
// behavior of updateIndicator/removeIndicator (what gets pushed to the chart
// via updateSeries / annotations / new oscillator charts) so the registry
// refactor can be verified to preserve behavior. They assert shapes, not
// numeric correctness (that lives in indicators.test.js).
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import ApexStock from "../src/ApexStock.js";

function ohlcData(n = 60, withVolume = true) {
  return Array.from({ length: n }, (_, i) => ({
    x: new Date(2020, 0, i + 1).getTime(),
    y: [10 + i, 12 + i, 9 + i, 11 + i],
    ...(withVolume ? { v: 1000 + i } : {}),
  }));
}

/** A capturing ApexCharts mock: records calls and reflects updateSeries into w.config. */
function installApexChartsMock() {
  const instances = [];
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
    instances.push(inst);
    return inst;
  });
  return instances;
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

describe("IndicatorHandlers — overlays", () => {
  let instances;
  beforeEach(() => {
    instances = installApexChartsMock();
  });
  afterEach(() => {
    document.body.innerHTML = "";
    delete global.ApexCharts;
  });

  const overlayCases = [
    { key: "moving average", name: "Moving Average", type: "line" },
    { key: "exponential moving average", name: "EMA", type: "line" },
    { key: "linear regression", name: "Linear Regression", type: "line" },
    { key: "bollinger bands", name: "Bollinger Bands", type: "rangeArea" },
  ];

  for (const { key, name, type } of overlayCases) {
    it(`adds the "${name}" series to the main chart and marks it active`, () => {
      const inst = makeInstance();
      const mainChart = inst.chart;
      inst.updateIndicator(key);

      expect(mainChart.updateSeries).toHaveBeenCalled();
      const series = mainChart.updateSeries.mock.calls.at(-1)[0];
      const added = series.find((s) => s.name === name);
      expect(added).toBeTruthy();
      expect(added.type).toBe(type);
      expect(inst.indicatorChartMap[key]).toBe(true);
      // No separate oscillator chart was created (only the main chart exists).
      expect(instances).toHaveLength(1);
    });
  }

  it("ichimoku adds both Tenkan-sen and Kijun-sen line series", () => {
    const inst = makeInstance();
    inst.updateIndicator("ichimoku cloud indicator");
    const series = inst.chart.updateSeries.mock.calls.at(-1)[0];
    expect(series.find((s) => s.name === "Tenkan-sen")).toBeTruthy();
    expect(series.find((s) => s.name === "Kijun-sen")).toBeTruthy();
  });

  it("removeIndicator strips the overlay series and clears the map entry", () => {
    const inst = makeInstance();
    inst.updateIndicator("moving average");
    inst.removeIndicator("moving average");
    const series = inst.chart.updateSeries.mock.calls.at(-1)[0];
    expect(series.find((s) => s.name === "Moving Average")).toBeFalsy();
    expect(inst.indicatorChartMap["moving average"]).toBeUndefined();
  });
});

describe("IndicatorHandlers — fibonacci (annotations)", () => {
  beforeEach(() => installApexChartsMock());
  afterEach(() => {
    document.body.innerHTML = "";
    delete global.ApexCharts;
  });

  it("applies y-axis annotations and stores an updatable map entry", () => {
    const inst = makeInstance();
    inst.updateIndicator("fibonacci retracements");
    const optsCalls = inst.chart.updateOptions.mock.calls;
    const annoCall = optsCalls.find((c) => c[0] && c[0].annotations);
    expect(annoCall).toBeTruthy();
    expect(annoCall[0].annotations.yaxis.length).toBeGreaterThan(0);
    // Stored as an object exposing update() (recomputed on zoom/scroll).
    expect(typeof inst.indicatorChartMap["fibonacci retracements"].update).toBe(
      "function"
    );
  });
});

describe("IndicatorHandlers — oscillators", () => {
  let instances;
  beforeEach(() => {
    instances = installApexChartsMock();
  });
  afterEach(() => {
    document.body.innerHTML = "";
    delete global.ApexCharts;
  });

  it("rsi creates a separate line chart stored as the map instance", () => {
    const inst = makeInstance();
    inst.updateIndicator("rsi");
    // A second ApexCharts (the oscillator pane) was constructed and rendered.
    expect(instances.length).toBeGreaterThanOrEqual(2);
    const oscillator = inst.indicatorChartMap["rsi"];
    expect(oscillator).toBeTruthy();
    expect(oscillator.render).toHaveBeenCalled();
    expect(oscillator.options.chart.type).toBe("line");
    expect(oscillator.options.series[0].name).toBe("RSI");
    // RSI pane is clamped to 0..100.
    expect(oscillator.options.yaxis.min).toBe(0);
    expect(oscillator.options.yaxis.max).toBe(100);
  });

  const simpleOscillators = [
    { key: "price volume trend", first: "PVT" },
    { key: "stochastic oscillator", first: "Stochastic %K" },
    { key: "standard deviation indicator", first: "Std Dev" },
    { key: "average directional index", first: "ADX" },
    { key: "chaikin oscillator", first: "Chaikin Osc" },
    { key: "commodity channel index", first: "CCI" },
    { key: "trend strength index", first: "TSI" },
    { key: "accelerator oscillator", first: "AC" },
    { key: "bollinger bands %b", first: "Bollinger %B" },
    { key: "bollinger bands width", first: "Bollinger Width" },
  ];

  for (const { key, first } of simpleOscillators) {
    it(`"${key}" creates a line oscillator whose first series is "${first}"`, () => {
      const inst = makeInstance();
      inst.updateIndicator(key);
      const osc = inst.indicatorChartMap[key];
      expect(osc).toBeTruthy();
      expect(osc.render).toHaveBeenCalled();
      expect(osc.options.chart.type).toBe("line");
      expect(osc.options.series[0].name).toBe(first);
    });
  }

  it("stochastic also adds the %D series", () => {
    const inst = makeInstance();
    inst.updateIndicator("stochastic oscillator");
    const names = inst.indicatorChartMap[
      "stochastic oscillator"
    ].options.series.map((s) => s.name);
    expect(names).toEqual(["Stochastic %K", "Stochastic %D"]);
  });

  it("removeIndicator destroys the oscillator chart and clears the map entry", () => {
    const inst = makeInstance();
    inst.updateIndicator("rsi");
    const osc = inst.indicatorChartMap["rsi"];
    inst.removeIndicator("rsi");
    expect(osc.destroy).toHaveBeenCalled();
    expect(inst.indicatorChartMap["rsi"]).toBeUndefined();
  });

  it("macd creates a chart with MACD/Signal/Histogram series", () => {
    const inst = makeInstance();
    inst.updateIndicator("macd");
    const oscillator = inst.indicatorChartMap["macd"];
    const names = oscillator.options.series.map((s) => s.name);
    expect(names).toEqual(["MACD", "Signal", "Histogram"]);
  });

  it("volumes warns and creates no chart when there is no volume data", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const parent = document.createElement("div");
    const container = document.createElement("div");
    parent.appendChild(container);
    document.body.appendChild(parent);
    const inst = new ApexStock(container, {
      chart: { height: 500 },
      theme: { mode: "light" },
      series: [{ name: "Price", data: ohlcData(60, false) }],
    });
    const before = global.ApexCharts.mock.calls.length;
    inst.updateIndicator("volumes");
    expect(warn).toHaveBeenCalled();
    expect(global.ApexCharts.mock.calls.length).toBe(before); // no new chart
    expect(inst.indicatorChartMap["volumes"]).toBeUndefined();
    warn.mockRestore();
  });
});
