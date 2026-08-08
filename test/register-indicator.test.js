// @vitest-environment jsdom
//
// Tests for ApexStock.registerIndicator — custom indicators without forking.
// Registration mutates a module-level registry; Vitest isolates modules per
// test file, so these registrations do not leak to other suites. Within this
// file, each test uses a distinct key.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import ApexStock from "../src/ApexStock.js";
import IndicatorHandlers from "../src/indicators/IndicatorHandlers.js";
import IndicatorStep from "../src/indicators/IndicatorStep.js";

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

describe("ApexStock.registerIndicator — validation", () => {
  beforeEach(() => installApexChartsMock());
  afterEach(() => {
    document.body.innerHTML = "";
    delete global.ApexCharts;
  });

  it("throws without a name or definition", () => {
    expect(() => ApexStock.registerIndicator("", { type: "overlay", calc() {} })).toThrow();
    expect(() => ApexStock.registerIndicator("x", null)).toThrow();
  });

  it("throws when a declarative def lacks type or calc", () => {
    expect(() => ApexStock.registerIndicator("no-type", { calc() {} })).toThrow(
      /type/
    );
    expect(() =>
      ApexStock.registerIndicator("no-calc", { type: "overlay" })
    ).toThrow(/calc/);
  });

  it("refuses to clobber a built-in without overwrite", () => {
    expect(() =>
      ApexStock.registerIndicator("rsi", { type: "oscillator", calc: () => [] })
    ).toThrow(/built-in/);
  });

  it("allows overwrite: true", () => {
    ApexStock.registerIndicator("dup", { type: "overlay", calc: () => [] });
    expect(() =>
      ApexStock.registerIndicator("dup", { type: "overlay", calc: () => [] })
    ).toThrow(/already registered/);
    expect(() =>
      ApexStock.registerIndicator("dup", {
        type: "overlay",
        calc: () => [],
        overwrite: true,
      })
    ).not.toThrow();
  });
});

describe("ApexStock.registerIndicator — declarative overlay", () => {
  beforeEach(() => installApexChartsMock());
  afterEach(() => {
    document.body.innerHTML = "";
    delete global.ApexCharts;
  });

  it("adds a single-line overlay to the main chart and lists it as an overlay", () => {
    ApexStock.registerIndicator("close line", {
      type: "overlay",
      calc: (series) => series.map((b) => b.y[3]),
      colors: ["#123456"],
    });

    // Appears in the registry-derived overlay set (so it shows in the dropdown).
    expect(IndicatorHandlers.getDefaultConfig().overlays["close line"]).toEqual({
      enabled: true,
    });

    const inst = makeInstance();
    inst.updateIndicator("close line");

    // Display name mirrors the dropdown convention (each word title-cased).
    const added = inst.chart.w.config.series.find((s) => s.name === "Close Line");
    expect(added).toBeTruthy();
    expect(added.color).toBe("#123456");
    expect(added.data).toHaveLength(60);
    expect(added.data[0]).toEqual({ x: inst.series[0].x, y: inst.series[0].y[3] });
    expect(!!inst.indicatorChartMap["close line"]).toBe(true);
  });

  it("supports a named multi-line map result", () => {
    ApexStock.registerIndicator("bands", {
      type: "overlay",
      calc: (series) => ({
        Hi: series.map((b) => b.y[1]),
        Lo: series.map((b) => b.y[2]),
      }),
    });
    const inst = makeInstance();
    inst.updateIndicator("bands");
    const names = inst.chart.w.config.series.map((s) => s.name);
    expect(names).toContain("Hi");
    expect(names).toContain("Lo");
  });
});

describe("ApexStock.registerIndicator — declarative oscillator", () => {
  beforeEach(() => installApexChartsMock());
  afterEach(() => {
    document.body.innerHTML = "";
    delete global.ApexCharts;
  });

  it("creates a pane, captures params, and round-trips via getState", () => {
    ApexStock.registerIndicator("myosc", {
      type: "oscillator",
      defaultParams: { period: 7 },
      yaxis: { min: 0, max: 100 },
      calc: (series, params) => series.map(() => params.period), // trivial, uses param
    });

    expect(IndicatorHandlers.getDefaultConfig().oscillators["myosc"]).toEqual({
      enabled: true,
    });

    const inst = makeInstance();
    // Custom default params surfaced into OscillatorSettings.
    expect(inst.oscillatorSettings.getIndicatorParams("myosc")).toEqual({
      period: 7,
    });

    inst.updateIndicator("myosc");
    const pane = inst.indicatorChartMap["myosc"];
    expect(pane && typeof pane !== "boolean").toBe(true);
    // The pane's series carries the computed values (period = 7).
    expect(pane.w.config.series[0].data[0].y).toBe(7);

    const state = inst.getState();
    const entry = state.indicators.find((i) => i.key === "myosc");
    expect(entry).toEqual({ key: "myosc", params: { period: 7 } });
  });
});

describe("ApexStock.registerIndicator — advanced passthrough", () => {
  beforeEach(() => installApexChartsMock());
  afterEach(() => {
    document.body.innerHTML = "";
    delete global.ApexCharts;
  });

  it("uses a raw build() verbatim", () => {
    const build = vi.fn((context) => ({
      replaceNames: ["Raw"],
      series: [{ name: "Raw", type: "line", data: [{ x: context.series[0].x, y: 1 }] }],
    }));
    ApexStock.registerIndicator("raw one", { kind: "overlay", build });
    const inst = makeInstance();
    inst.updateIndicator("raw one");
    expect(build).toHaveBeenCalled();
    expect(inst.chart.w.config.series.some((s) => s.name === "Raw")).toBe(true);
  });
});

describe("ApexStock.registerIndicator — streaming", () => {
  beforeEach(() => installApexChartsMock());
  afterEach(() => {
    document.body.innerHTML = "";
    delete global.ApexCharts;
  });

  it("streams a custom overlay incrementally via a stream twin", () => {
    ApexStock.registerIndicator("echo", {
      type: "overlay",
      label: "Echo",
      calc: (series) => series.map((b) => b.y[3]),
      stream: {
        seed: () => ({}),
        step: (state, series) => ({
          value: series[series.length - 1].y[3],
          state,
        }),
        render: (v, x) => [{ name: "Echo", point: { x, y: v } }],
      },
    });

    expect(IndicatorStep.isStreamable("echo")).toBe(true);

    const inst = makeInstance();
    inst.render();
    inst.updateIndicator("echo");
    // Seeded into the streaming state map.
    expect(inst._indicatorState["echo"]).toBeTruthy();

    const nextX = inst.series[inst.series.length - 1].x + 86400000;
    inst.appendData({ x: nextX, y: [50, 55, 48, 52], v: 10 });

    const echo = inst.chart.w.config.series.find((s) => s.name === "Echo");
    expect(echo.data[echo.data.length - 1]).toEqual({ x: nextX, y: 52 });
  });

  it("keeps a non-streamable custom overlay exact on appendData (full recompute)", () => {
    ApexStock.registerIndicator("closeonly", {
      type: "overlay",
      label: "CloseOnly",
      calc: (series) => series.map((b) => b.y[3]),
    });
    expect(IndicatorStep.isStreamable("closeonly")).toBe(false);
    expect(IndicatorHandlers.isCustomRegistered("closeonly")).toBe(true);

    const inst = makeInstance();
    inst.render();
    inst.updateIndicator("closeonly");

    const nextX = inst.series[inst.series.length - 1].x + 86400000;
    inst.appendData({ x: nextX, y: [50, 55, 48, 52], v: 10 });

    const line = inst.chart.w.config.series.find((s) => s.name === "CloseOnly");
    // Recomputed over the full (now 61-bar) series, last value = new close.
    expect(line.data).toHaveLength(61);
    expect(line.data[line.data.length - 1].y).toBe(52);
  });
});

describe("IndicatorStep.register — validation", () => {
  it("skips an incomplete stepper with a warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    IndicatorStep.register("bad", { seed: () => ({}) }); // missing step/render
    expect(IndicatorStep.isStreamable("bad")).toBe(false);
    warn.mockRestore();
  });
});
