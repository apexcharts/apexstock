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
      addXaxisAnnotation: vi.fn(),
      addPointAnnotation: vi.fn(),
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
      eventMarkers: [],
      annotations: [],
      priceLines: [],
      priceScale: null,
      comparison: null,
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
    expect(s.eventMarkers).toEqual([]); // v1 -> v2 backfill
    expect(s.annotations).toEqual([]); // v1 -> v2 backfill
    expect(s.priceLines).toEqual([]); // v1 -> v2 backfill
    expect(s.priceScale).toBeNull(); // v1 -> v2 backfill (default linear)
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
    expect(s.theme).toEqual({ mode: "light", preset: null });
    expect(s.chartType).toBe("candlestick");
    expect(s.indicators).toEqual([]);
    expect(s.drawings).toEqual([]);
    expect(s.eventMarkers).toEqual([]);
    expect(s.annotations).toEqual([]);
    expect(s.priceLines).toEqual([]);
    expect(s.priceScale).toBeNull();
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

  it("round-trips event markers into a fresh instance", () => {
    inst.addEventMarker({ x: 5, type: "earnings", label: "Q1" });
    inst.addEventMarker({ x: 40, type: "dividend", meta: { amount: 0.24 } });
    const state = JSON.parse(JSON.stringify(inst.getState()));
    expect(state.eventMarkers).toHaveLength(2);

    const inst2 = makeInstance();
    inst2.render();
    inst2.setState(state);

    const restored = inst2.getEventMarkers();
    expect(restored).toHaveLength(2);
    expect(restored.find((m) => m.type === "earnings")).toMatchObject({
      x: 5,
      label: "Q1",
    });
    expect(restored.find((m) => m.type === "dividend").meta).toEqual({
      amount: 0.24,
    });
  });

  it("round-trips annotations into a fresh instance", () => {
    inst.addAnnotation({ type: "yLine", y: 42, label: "support" });
    inst.addAnnotation({ type: "xLine", x: ohlcData()[5].x, label: "event" });
    const state = JSON.parse(JSON.stringify(inst.getState()));
    expect(state.annotations).toHaveLength(2);

    const inst2 = makeInstance();
    inst2.render();
    inst2.setState(state);

    const restored = inst2.getAnnotations();
    expect(restored).toHaveLength(2);
    expect(restored.find((a) => a.type === "yLine")).toMatchObject({
      y: 42,
      label: "support",
    });
    expect(restored.find((a) => a.type === "xLine").label).toBe("event");
  });

  it("round-trips price lines (declarative config; callbacks dropped)", () => {
    inst.addPriceLine({
      price: 100,
      type: "stop-loss",
      draggable: true,
      onCross: () => {},
    });
    inst.addPriceLine({ price: 120, type: "take-profit", label: "target" });
    const state = JSON.parse(JSON.stringify(inst.getState()));
    expect(state.priceLines).toHaveLength(2);
    // Callbacks are not serialized.
    expect(JSON.stringify(state.priceLines)).not.toContain("onCross");

    const inst2 = makeInstance();
    inst2.render();
    inst2.setState(state);

    const lines = inst2.getPriceLines();
    expect(lines).toHaveLength(2);
    const sl = lines.find((l) => l.type === "stop-loss");
    expect(sl).toMatchObject({ price: 100, draggable: true });
    expect(lines.find((l) => l.type === "take-profit")).toMatchObject({
      price: 120,
      label: "target",
    });
  });

  it("round-trips the price-scale mode into a fresh instance", () => {
    inst.setPriceScale("logarithmic", { logBase: 2 });
    const state = JSON.parse(JSON.stringify(inst.getState()));
    expect(state.priceScale).toEqual({
      mode: "logarithmic",
      base: null,
      logBase: 2,
      indexBase: 100,
    });

    const inst2 = makeInstance();
    inst2.render();
    inst2.setState(state);

    expect(inst2.getPriceScale()).toEqual({
      mode: "logarithmic",
      base: null,
      logBase: 2,
      indexBase: 100,
    });
  });

  it("restores a linear price scale when the state has none", () => {
    inst.setPriceScale("percent");
    expect(inst.getPriceScale().mode).toBe("percent");
    // A state with no priceScale (e.g. captured before v2) resets to linear.
    inst.setState({ version: 2, theme: { mode: "light" }, chartType: "candlestick" });
    expect(inst.getPriceScale().mode).toBe("linear");
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

describe("state: comparison", () => {
  let inst;
  beforeEach(() => {
    installApexChartsMock();
    inst = makeInstance();
  });
  afterEach(() => {
    document.body.innerHTML = "";
    delete global.ApexCharts;
  });

  /** A peer instrument over the primary's x values. */
  const peer = (base) => ohlcData().map((p, i) => ({ x: p.x, y: base + i }));

  it("captures nothing for a chart with no comparison", () => {
    expect(inst.getState().comparison).toBeNull();
  });

  it("captures the mode, benchmark, policy, and instrument identity", () => {
    inst.addComparison({ name: "PEER", data: peer(50), color: "#abcdef" });
    inst.setComparisonBenchmark("PEER");
    inst.setComparisonMode("relative");
    inst.setComparisonOptions({ baseline: "own", join: "intersection" });

    const cmp = inst.getState().comparison;
    expect(cmp.mode).toBe("relative");
    expect(cmp.benchmark).toBe("PEER");
    expect(cmp.options.baseline).toBe("own");
    expect(cmp.options.join).toBe("intersection");
    expect(cmp.instruments).toEqual([{ name: "PEER", color: "#abcdef" }]);
    // The data is the consumer's: state carries identity, not bars.
    expect(Object.keys(cmp.instruments[0])).toEqual(["name", "color"]);
    expect(JSON.stringify(cmp)).not.toContain('"data"');
  });

  it("captures a configured mode even with no instruments added", () => {
    inst.setComparisonMode("indexed");
    const cmp = inst.getState().comparison;
    expect(cmp.mode).toBe("indexed");
    expect(cmp.instruments).toEqual([]);
  });

  it("round-trips through JSON and keeps instruments whose data is loaded", () => {
    inst.addComparison({ name: "PEER", data: peer(50) });
    inst.setComparisonMode("indexed");
    const state = JSON.parse(JSON.stringify(inst.getState()));

    const needed = [];
    inst.on("comparisonRestoreNeeded", (p) => needed.push(p));
    inst.setComparisonMode("percent"); // drift away from the saved state
    inst.setState(state);

    expect(inst.getComparisonMode()).toBe("indexed");
    expect(inst.getComparisons().map((i) => i.name)).toEqual(["PEER"]);
    // The data never left, so nothing has to be re-supplied.
    expect(needed).toEqual([]);
  });

  it("asks for the data of instruments it cannot keep", () => {
    inst.addComparison({ name: "PEER", data: peer(50), color: "#abcdef" });
    inst.addComparison({ name: "PEER2", data: peer(200) });
    const state = JSON.parse(JSON.stringify(inst.getState()));

    // A fresh chart: same saved state, none of the data.
    const other = makeInstance();
    const needed = [];
    other.on("comparisonRestoreNeeded", (p) => needed.push(p));
    other.setState(state);

    expect(needed).toHaveLength(1);
    expect(needed[0].names).toEqual(["PEER", "PEER2"]);
    expect(other.getComparisons()).toEqual([]);
    // The setup survived even though the data did not.
    expect(other.getComparisonMode()).toBe(inst.getComparisonMode());
  });

  it("brings a re-supplied instrument back in its remembered color", () => {
    inst.addComparison({ name: "PEER", data: peer(50), color: "#abcdef" });
    const state = JSON.parse(JSON.stringify(inst.getState()));

    const other = makeInstance();
    other.on("comparisonRestoreNeeded", ({ names }) => {
      names.forEach((name) => other.addComparison({ name, data: peer(50) }));
    });
    other.setState(state);

    expect(other.getComparisons()).toEqual([
      { name: "PEER", color: "#abcdef", points: 60 },
    ]);
  });

  it("keeps a benchmark whose instrument has not come back yet", () => {
    inst.addComparison({ name: "PEER", data: peer(50) });
    inst.setComparisonBenchmark("PEER");
    inst.setComparisonMode("relative");
    const state = JSON.parse(JSON.stringify(inst.getState()));

    const other = makeInstance();
    other.setState(state);
    // The role is remembered by name; the primary fills in until the data lands.
    expect(other.getComparisonBenchmark()).toBe("PEER");
    other.addComparison({ name: "PEER", data: peer(50) });
    expect(other.comparison._derive().benchmark).toBe("PEER");
  });

  it("a null comparison in state clears a live comparison", () => {
    const empty = JSON.parse(JSON.stringify(inst.getState()));
    expect(empty.comparison).toBeNull();

    inst.addComparison({ name: "PEER", data: peer(50) });
    inst.setComparisonMode("indexed");
    inst.setState(empty);

    expect(inst.getComparisons()).toEqual([]);
    expect(inst.getComparisonMode()).toBe("percent"); // back to the default
    expect(inst.getComparisonBenchmark()).toBe("__primary__");
  });

  it("migrates a v1/v2 state with no comparison key", () => {
    const v1 = {
      version: 1,
      theme: { mode: "light" },
      chartType: "candlestick",
      indicators: [],
      zoom: null,
    };
    expect(StateSerializer.migrate(v1).comparison).toBeNull();
    inst.addComparison({ name: "PEER", data: peer(50) });
    inst.setState(v1);
    expect(inst.getComparisons()).toEqual([]);
  });

  it("ignores a garbage comparison key", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const state = inst.getState();
    inst.setState({ ...state, comparison: { mode: "sideways", options: 7 } });
    expect(inst.getComparisonMode()).toBe("percent");
    expect(inst.getComparisonOptions().join).toBe("union");
    inst.setState({ ...state, comparison: "nonsense" });
    expect(inst.getComparisons()).toEqual([]);
    warn.mockRestore();
  });
});
