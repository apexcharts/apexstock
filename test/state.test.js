// @vitest-environment jsdom
//
// Tests for the state serialization backbone: ApexStock#getState / setState /
// migrateState and the underlying StateSerializer. Covers round-trip identity,
// reconcile-on-apply, param restoration, migration, and toolbar resync.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import ApexStock from "../src/ApexStock.js";
import StateSerializer from "../src/core/StateSerializer.js";

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

describe("StateSerializer.migrate", () => {
  it("returns a valid empty v2 state for null/garbage", () => {
    const s = StateSerializer.migrate(null);
    expect(s).toEqual({
      version: 2,
      theme: { mode: "light" },
      chartType: "candlestick",
      indicators: [],
      drawings: [],
      zoom: null,
    });
    expect(StateSerializer.migrate(42).version).toBe(2);
  });

  it("backfills a missing version, upgrades to v2, and preserves fields", () => {
    const s = StateSerializer.migrate({
      theme: { mode: "dark" },
      chartType: "line",
      indicators: [{ key: "rsi", params: { period: 9 } }],
      zoom: { minX: 1, maxX: 2 },
    });
    expect(s.version).toBe(2);
    expect(s.theme.mode).toBe("dark");
    expect(s.indicators[0]).toEqual({ key: "rsi", params: { period: 9 } });
    expect(s.drawings).toEqual([]); // v1 -> v2 backfill
  });
});

describe("ApexStock#getState", () => {
  let inst;
  beforeEach(() => {
    installApexChartsMock();
    inst = makeInstance();
  });
  afterEach(() => {
    document.body.innerHTML = "";
    delete global.ApexCharts;
  });

  it("captures a v2 shape with theme, chartType, indicators, drawings, zoom", () => {
    const s = inst.getState();
    expect(s.version).toBe(ApexStock.STATE_VERSION);
    expect(s.theme).toEqual({ mode: "light" });
    expect(s.chartType).toBe("candlestick");
    expect(s.indicators).toEqual([]);
    expect(s.drawings).toEqual([]);
    expect(s.zoom).toEqual({ minX: 0, maxX: 59 });
  });

  it("captures active indicators with their params", () => {
    inst.updateIndicator("moving average"); // overlay -> params {}
    inst.updateIndicator("rsi"); // oscillator -> default period 14
    const s = inst.getState();
    const byKey = Object.fromEntries(s.indicators.map((i) => [i.key, i.params]));
    expect(Object.keys(byKey).sort()).toEqual(["moving average", "rsi"]);
    expect(byKey["moving average"]).toEqual({});
    expect(byKey["rsi"]).toEqual({ period: 14 });
  });

  it("is JSON-serializable (no functions)", () => {
    inst.updateIndicator("rsi");
    const s = inst.getState();
    const round = JSON.parse(JSON.stringify(s));
    expect(round).toEqual(s);
  });
});

describe("ApexStock#setState (integration)", () => {
  let inst;
  beforeEach(() => {
    installApexChartsMock();
    inst = makeInstance();
    inst.render();
  });
  afterEach(() => {
    document.body.innerHTML = "";
    delete global.ApexCharts;
  });

  it("round-trips indicators + params into a fresh instance", () => {
    // Configure a custom RSI period, then add MA + RSI.
    inst.oscillatorSettings.indicatorParams.rsi = { period: 21 };
    inst.updateIndicator("moving average");
    inst.updateIndicator("rsi");
    const state = JSON.parse(JSON.stringify(inst.getState()));

    const inst2 = makeInstance();
    inst2.render();
    const ret = inst2.setState(state);

    expect(ret).toBe(inst2); // chainable
    expect(!!inst2.indicatorChartMap["moving average"]).toBe(true);
    expect(!!inst2.indicatorChartMap["rsi"]).toBe(true);
    expect(inst2.oscillatorSettings.indicatorParams.rsi.period).toBe(21);
    expect(inst2.activeOscillator).toBe("rsi");
  });

  it("reconciles to exactly the state's indicator set", () => {
    inst.updateIndicator("rsi"); // start with RSI active
    expect(!!inst.indicatorChartMap["rsi"]).toBe(true);

    // Apply a state that has only Moving Average.
    inst.setState({
      version: 1,
      theme: { mode: "light" },
      chartType: "candlestick",
      indicators: [{ key: "moving average", params: {} }],
      zoom: null,
    });

    expect(!!inst.indicatorChartMap["rsi"]).toBe(false);
    expect(!!inst.indicatorChartMap["moving average"]).toBe(true);
    expect(inst.activeOscillator).toBeNull();
  });

  it("syncs the toolbar dropdown selection to the restored state", () => {
    inst.setState({
      version: 1,
      theme: { mode: "light" },
      chartType: "candlestick",
      indicators: [{ key: "rsi", params: { period: 14 } }],
      zoom: null,
    });

    const rsiOpt = inst.primaryToolbar.querySelector(
      '.apexstock-custom-option[data-value="rsi"]'
    );
    expect(rsiOpt.classList.contains("selected")).toBe(true);
    expect(rsiOpt.getAttribute("aria-selected")).toBe("true");

    const maOpt = inst.primaryToolbar.querySelector(
      '.apexstock-custom-option[data-value="moving average"]'
    );
    expect(maOpt.classList.contains("selected")).toBe(false);
  });

  it("setState(getState()) is a no-op on the active set", () => {
    inst.updateIndicator("moving average");
    inst.updateIndicator("macd");
    const before = JSON.parse(JSON.stringify(inst.getState()));
    inst.setState(before);
    const after = inst.getState();
    expect(after.indicators.map((i) => i.key).sort()).toEqual(
      before.indicators.map((i) => i.key).sort()
    );
  });
});

describe("StateSerializer.apply (unit, fake ctx)", () => {
  function fakeCtx() {
    return {
      _theme: "light",
      indicatorChartMap: {},
      oscillatorSettings: { indicatorParams: {} },
      chartSwitch: {
        currentType: "candlestick",
        changeChartType: vi.fn(function (t) {
          this.currentType = t;
        }),
      },
      calls: { updateTheme: [], add: [], remove: [], zoom: [], sync: 0 },
      getTheme() {
        return this._theme;
      },
      updateTheme(m) {
        this._theme = m;
        this.calls.updateTheme.push(m);
      },
      updateIndicator(k) {
        this.indicatorChartMap[k] = true;
        this.calls.add.push(k);
      },
      removeIndicator(k) {
        delete this.indicatorChartMap[k];
        this.calls.remove.push(k);
      },
      _syncIndicatorSelectionUI() {
        this.calls.sync++;
      },
      applyZoomToAllCharts(z) {
        this.calls.zoom.push(z);
      },
    };
  }

  it("applies theme, chart type, indicators, params, zoom in order", () => {
    const ctx = fakeCtx();
    ctx.indicatorChartMap["macd"] = true; // pre-existing, not in desired

    StateSerializer.apply(ctx, {
      version: 1,
      theme: { mode: "dark" },
      chartType: "line",
      indicators: [{ key: "rsi", params: { period: 21 } }],
      zoom: { minX: 5, maxX: 40 },
    });

    expect(ctx.calls.updateTheme).toEqual(["dark"]);
    expect(ctx.chartSwitch.changeChartType).toHaveBeenCalledWith("line");
    expect(ctx.calls.remove).toContain("macd"); // reconciled away
    expect(ctx.calls.add).toContain("rsi");
    expect(ctx.oscillatorSettings.indicatorParams.rsi).toEqual({ period: 21 });
    expect(ctx.calls.sync).toBe(1);
    expect(ctx.calls.zoom).toEqual([{ minX: 5, maxX: 40 }]);
    expect(ctx.indicatorChartMap).toEqual({ rsi: true });
  });

  it("does not switch theme or chart type when unchanged", () => {
    const ctx = fakeCtx();
    StateSerializer.apply(ctx, {
      version: 1,
      theme: { mode: "light" },
      chartType: "candlestick",
      indicators: [],
      zoom: null,
    });
    expect(ctx.calls.updateTheme).toEqual([]);
    expect(ctx.chartSwitch.changeChartType).not.toHaveBeenCalled();
    expect(ctx.calls.zoom).toEqual([]);
  });

  it("ignores a null/garbage state without throwing", () => {
    const ctx = fakeCtx();
    expect(() => StateSerializer.apply(ctx, null)).not.toThrow();
    expect(ctx.calls.add).toEqual([]);
  });
});
