// @vitest-environment jsdom
//
// Characterization tests for IndicatorHandlers. These pin the *observable*
// behavior of updateIndicator/removeIndicator (what gets pushed to the chart
// via updateSeries / annotations / new oscillator charts) so the registry
// refactor can be verified to preserve behavior. They assert shapes, not
// numeric correctness (that lives in indicators.test.js).
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import ApexStock from "../src/ApexStock.js";
import IndicatorHandlers from "../src/indicators/IndicatorHandlers.js";

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

describe("accessibility (after render)", () => {
  beforeEach(() => installApexChartsMock());
  afterEach(() => {
    document.body.innerHTML = "";
    delete global.ApexCharts;
  });

  it("labels the interactive controls", () => {
    const inst = makeInstance();
    inst.render();

    const zoomIn = document.querySelector(".apexstock-zoom-in");
    expect(zoomIn.getAttribute("aria-label")).toBe("Zoom in");
    expect(document.querySelector(".apexstock-zoom-out").getAttribute("aria-label")).toBe(
      "Zoom out"
    );

    const toolbar = document.querySelector('[role="toolbar"]');
    expect(toolbar.getAttribute("aria-label")).toBe("Drawing tools");
    const toolButtons = toolbar.querySelectorAll("button.apexstock-drawing-tool");
    expect(toolButtons.length).toBeGreaterThan(0);
    toolButtons.forEach((b) => expect(b.getAttribute("aria-label")).toBeTruthy());

    const trigger = document.querySelector(".apexstock-custom-select-trigger");
    expect(trigger.getAttribute("role")).toBe("button");
    expect(trigger.getAttribute("aria-haspopup")).toBe("listbox");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    const listbox = document.querySelector('[role="listbox"]');
    expect(listbox).toBeTruthy();
    expect(
      listbox.querySelectorAll('[role="option"]').length
    ).toBeGreaterThan(0);
  });
});

describe("IndicatorHandlers.getDefaultConfig (registry-derived)", () => {
  beforeEach(() => installApexChartsMock());
  afterEach(() => {
    document.body.innerHTML = "";
    delete global.ApexCharts;
  });

  it("exposes the expected overlay and oscillator key sets", () => {
    const inst = makeInstance();
    expect(new Set(Object.keys(inst.overlays))).toEqual(
      new Set([
        "moving average",
        "bollinger bands",
        "exponential moving average",
        "fibonacci retracements",
        "linear regression",
        "ichimoku cloud indicator",
      ])
    );
    expect(new Set(Object.keys(inst.oscillators))).toEqual(
      new Set([
        "rsi",
        "macd",
        "volumes",
        "price volume trend",
        "stochastic oscillator",
        "standard deviation indicator",
        "average directional index",
        "chaikin oscillator",
        "commodity channel index",
        "trend strength index",
        "accelerator oscillator",
        "bollinger bands %b",
        "bollinger bands width",
      ])
    );
    // Each entry defaults to enabled.
    expect(inst.overlays["moving average"]).toEqual({ enabled: true });
  });

  it("classifies overlays (incl. fibonacci) vs oscillators via isOverlay()", () => {
    const inst = makeInstance();
    expect(inst.isOverlay("moving average")).toBe(true);
    expect(inst.isOverlay("bollinger bands")).toBe(true);
    expect(inst.isOverlay("fibonacci retracements")).toBe(true);
    expect(inst.isOverlay("rsi")).toBe(false);
    expect(inst.isOverlay("macd")).toBe(false);
  });
});

describe("ApexStock.update — indicator restoration", () => {
  beforeEach(() => installApexChartsMock());
  afterEach(() => {
    document.body.innerHTML = "";
    delete global.ApexCharts;
  });

  it("re-applies active overlays after a data update without throwing", () => {
    const inst = makeInstance();
    inst.updateIndicator("moving average");
    expect(inst.indicatorChartMap["moving average"]).toBe(true);

    const newData = ohlcData(70);
    expect(() => inst.update({ series: [{ name: "Price", data: newData }] })).not.toThrow();

    // The overlay is restored and the internal series matches the new data.
    // (update() normalizes incoming series, so this is a cleaned copy, not the
    // same array reference — assert by value.)
    expect(inst.indicatorChartMap["moving average"]).toBe(true);
    expect(inst.series).toEqual(newData);
    const series = inst.chart.updateSeries.mock.calls.at(-1)[0];
    expect(series.find((s) => s.name === "Moving Average")).toBeTruthy();
  });

  it("does NOT rebuild indicators on an option-only update (no series/theme change)", () => {
    const inst = makeInstance();
    inst.updateIndicator("moving average");
    const updateSeriesCallsBefore = inst.chart.updateSeries.mock.calls.length;

    // An update that changes neither series nor theme must not churn indicators.
    inst.update({ title: { text: "Hello" } });

    expect(inst.chart.updateSeries.mock.calls.length).toBe(
      updateSeriesCallsBefore
    );
    expect(inst.indicatorChartMap["moving average"]).toBe(true);
  });

  it("updateTheme(newTheme) does not throw after render (zoom-control guard)", () => {
    const inst = makeInstance();
    inst.render();
    inst.updateIndicator("moving average");
    expect(() => inst.updateTheme("dark")).not.toThrow();
    expect(inst.theme).toBe("dark");
  });

  it("rebuilds indicators on a theme-only update", () => {
    const inst = makeInstance();
    inst.updateIndicator("moving average");
    const before = inst.chart.updateSeries.mock.calls.length;
    inst.update({ theme: { mode: "dark" } });
    // refreshIndicators ran (remove + re-add => at least one more updateSeries).
    expect(inst.chart.updateSeries.mock.calls.length).toBeGreaterThan(before);
    expect(inst.indicatorChartMap["moving average"]).toBe(true);
  });
});

describe("IndicatorHandlers.resolveIndicatorConfig (pure, lifted from ctor)", () => {
  it("defaults to every registry indicator when no `indicators` option is given", () => {
    const { overlays, oscillators, indicators } =
      IndicatorHandlers.resolveIndicatorConfig(undefined);
    // Fibonacci (registry kind "custom") groups with overlays, not oscillators.
    expect(overlays["fibonacci retracements"]).toEqual({ enabled: true });
    expect(overlays["moving average"]).toEqual({ enabled: true });
    expect(oscillators["rsi"]).toEqual({ enabled: true });
    expect(oscillators["fibonacci retracements"]).toBeUndefined();
    // The merged map is the union of both.
    expect(indicators["rsi"]).toEqual({ enabled: true });
    expect(indicators["fibonacci retracements"]).toEqual({ enabled: true });
  });

  it("object input becomes the indicators map and copies config into the matching map", () => {
    const userCfg = {
      rsi: { enabled: true, chartOptions: { stroke: { width: 3 } } },
      "moving average": { enabled: false },
      "made up indicator": { enabled: true },
    };
    const { overlays, oscillators, indicators } =
      IndicatorHandlers.resolveIndicatorConfig(userCfg);

    // The indicators map is the user's object verbatim (chartOptions preserved,
    // so the oscillator builders can read context.indicators.rsi.chartOptions).
    expect(indicators).toBe(userCfg);
    expect(oscillators["rsi"].chartOptions).toEqual({ stroke: { width: 3 } });
    expect(overlays["moving average"]).toEqual({ enabled: false });
    // Unknown keys live only in the merged map, not in overlays/oscillators.
    expect(overlays["made up indicator"]).toBeUndefined();
    expect(oscillators["made up indicator"]).toBeUndefined();
  });

  it("array input enables each named indicator (case-insensitive)", () => {
    const { overlays, oscillators, indicators } =
      IndicatorHandlers.resolveIndicatorConfig(["RSI", "Moving Average"]);
    expect(indicators).toEqual({
      rsi: { enabled: true },
      "moving average": { enabled: true },
    });
    expect(oscillators["rsi"]).toEqual({ enabled: true });
    expect(overlays["moving average"]).toEqual({ enabled: true });
  });

  it("the constructor produces the same maps as the resolver", () => {
    installApexChartsMock();
    const inst = makeInstance();
    const resolved = IndicatorHandlers.resolveIndicatorConfig(undefined);
    expect(new Set(Object.keys(inst.overlays))).toEqual(
      new Set(Object.keys(resolved.overlays))
    );
    expect(new Set(Object.keys(inst.oscillators))).toEqual(
      new Set(Object.keys(resolved.oscillators))
    );
    expect(inst.isOverlay("fibonacci retracements")).toBe(true);
    document.body.innerHTML = "";
    delete global.ApexCharts;
  });
});

describe("ApexStock.update — in-place indicator refresh (series-only)", () => {
  let instances;
  beforeEach(() => {
    instances = installApexChartsMock();
  });
  afterEach(() => {
    document.body.innerHTML = "";
    delete global.ApexCharts;
  });

  it("updates an oscillator pane in place on a series change (no recreate)", () => {
    const inst = makeInstance();
    inst.updateIndicator("rsi");
    const pane = inst.indicatorChartMap["rsi"];
    const before = instances.length; // main + rsi pane
    pane.updateSeries.mockClear();

    inst.update({ series: [{ name: "Price", data: ohlcData(80) }] });

    // Same pane instance, not torn down, no new ApexCharts created.
    expect(inst.indicatorChartMap["rsi"]).toBe(pane);
    expect(pane.destroy).not.toHaveBeenCalled();
    expect(instances.length).toBe(before);
    // Its data was refreshed in place to the new length.
    expect(pane.updateSeries).toHaveBeenCalled();
    const data = pane.updateSeries.mock.calls.at(-1)[0][0].data;
    expect(data).toHaveLength(80);
  });

  it("updates an overlay in place on a series change (no new chart)", () => {
    const inst = makeInstance();
    inst.updateIndicator("moving average");
    const before = instances.length; // overlay adds no pane -> just the main chart

    inst.update({ series: [{ name: "Price", data: ohlcData(75) }] });

    expect(instances.length).toBe(before);
    const series = inst.chart.updateSeries.mock.calls.at(-1)[0];
    const ma = series.find((s) => s.name === "Moving Average");
    expect(ma).toBeTruthy();
    expect(ma.data).toHaveLength(75);
  });

  it("a theme change still rebuilds the oscillator pane (full path)", () => {
    const inst = makeInstance();
    inst.updateIndicator("rsi");
    const pane = inst.indicatorChartMap["rsi"];

    inst.update({ theme: { mode: "dark" } });

    // The theme path tears the pane down and recreates it.
    expect(pane.destroy).toHaveBeenCalled();
    expect(inst.indicatorChartMap["rsi"]).not.toBe(pane);
  });

  it("re-seeds streaming state after an in-place series refresh", () => {
    const inst = makeInstance();
    inst.updateIndicator("moving average");
    inst.update({ series: [{ name: "Price", data: ohlcData(90) }] });
    // The streaming state for the active indicator tracks the new series length.
    const entry = inst._indicatorState["moving average"];
    expect(entry).toBeTruthy();
    expect(entry.len).toBe(90);
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
