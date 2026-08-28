// @vitest-environment jsdom
//
// The drawdown pane (phase 4 of the analysis workspace): an analysis view that
// rides the existing oscillator-pane machinery rather than a new pane system, so
// it inherits pane creation, the shared x-axis and zoom, height apportioning,
// getState/setState, getDataAt, and the appendData path.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import ApexStock from "../src/ApexStock.js";
import IndicatorHandlers from "../src/indicators/IndicatorHandlers.js";
import Drawdown from "../src/analysis/Drawdown.js";
import Utils from "../src/utils/Utils.js";
import LayoutManager from "../src/core/LayoutManager.js";
import { drawdownSeries, dailyOhlc } from "./fixtures.js";

function installApexChartsMock() {
  global.ApexCharts = vi.fn(function (el, opts) {
    const inst = {
      el,
      options: opts,
      w: {
        globals: { chartID: "chart", dataPoints: 8, minX: 0, maxX: 7 },
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

function makeInstance(extra) {
  const parent = document.createElement("div");
  const container = document.createElement("div");
  parent.appendChild(container);
  document.body.appendChild(parent);
  return new ApexStock(container, {
    chart: { height: 500 },
    theme: { mode: "light" },
    series: [{ name: "Price", data: drawdownSeries() }],
    ...(extra || {}),
  });
}

/** The options the pane's ApexCharts instance was constructed with. */
const paneOptions = (inst) => inst.indicatorChartMap.drawdown.options;

describe("drawdown pane: the registry entry", () => {
  let inst;
  beforeEach(() => {
    installApexChartsMock();
    inst = makeInstance();
  });
  afterEach(() => {
    document.body.innerHTML = "";
    delete global.ApexCharts;
  });

  it("is an oscillator in the analysis group", () => {
    expect(IndicatorHandlers.groupOf("drawdown")).toBe("analysis");
    expect(IndicatorHandlers.groupOf("rsi")).toBeNull();
    expect(inst.isOverlay("drawdown")).toBe(false);
    expect(Object.keys(inst.oscillators)).toContain("drawdown");
  });

  it("builds an area pane whose values are the engine's, truncated", () => {
    inst.updateIndicator("drawdown");
    const opts = paneOptions(inst);

    expect(opts.chart.type).toBe("area");
    expect(opts.series[0].name).toBe("Drawdown");

    const expected = Drawdown.compute(inst.series, { basis: "close" }).values;
    expect(opts.series[0].data.map((p) => p.y)).toEqual(
      expected.map((v) => (v == null ? null : Utils.truncateNumber(v)))
    );
    // The series is aligned to the bars, x for x.
    expect(opts.series[0].data.map((p) => p.x)).toEqual(
      inst.series.map((b) => b.x)
    );
  });

  it("pins the top of the axis at zero and labels it as a percentage", () => {
    inst.updateIndicator("drawdown");
    const yaxis = paneOptions(inst).yaxis;
    // A drawdown is never positive, so zero is the top by definition.
    expect(yaxis.max).toBe(0);
    expect(yaxis.labels.formatter(-12.345)).toBe("-12.3%");
  });

  it("labels the deepest drawdown on the pane", () => {
    inst.updateIndicator("drawdown");
    const pane = inst.indicatorChartMap.drawdown;
    // Added dynamically (not baked into the options) so it can be re-asserted
    // when the series grows.
    expect(paneOptions(inst).annotations).toBeUndefined();
    expect(pane.addYaxisAnnotation).toHaveBeenCalledTimes(1);
    const anno = pane.addYaxisAnnotation.mock.calls[0][0];
    // Closes 100 110 120 90 80 ...: 80 against a 120 peak is -33.33%.
    expect(anno.y).toBeCloseTo(-33.33, 2);
    expect(anno.label.text).toBe("max -33.33%");
    expect(anno.id).toBe("apexstock-drawdown-max");
  });

  it("omits the label for a series that never falls", () => {
    const rising = makeInstance({
      series: [{ name: "Price", data: dailyOhlc([1, 2, 3, 4]) }],
    });
    rising.updateIndicator("drawdown");
    const pane = rising.indicatorChartMap.drawdown;
    expect(pane.addYaxisAnnotation).not.toHaveBeenCalled();
    // Still removed first, so a previous label cannot survive a rebuild.
    expect(pane.removeAnnotation).toHaveBeenCalledWith(
      "apexstock-drawdown-max"
    );
  });

  it("takes its basis from the chart's analysis convention", () => {
    const intra = makeInstance({ analysis: { drawdownBasis: "intrabar" } });
    intra.updateIndicator("drawdown");
    const expected = Drawdown.compute(intra.series, {
      basis: "intrabar",
    }).values;
    expect(paneOptions(intra).series[0].data.map((p) => p.y)).toEqual(
      expected.map((v) => (v == null ? null : Utils.truncateNumber(v)))
    );
    // The pane and the range statistics cannot disagree: same basis, one source.
    expect(intra.getDrawdown().basis).toBe("intrabar");
  });

  it("creates no settings control (its basis is not a number input)", () => {
    inst.updateIndicator("drawdown");
    const control = inst.oscillatorSettings.createSettingsControl(
      "drawdown",
      inst.indicatorContainer
    );
    expect(control).toBeNull();
  });

  it("toggles off like any other pane", () => {
    inst.updateIndicator("drawdown");
    expect(inst.indicatorContainer.children.length).toBe(1);
    inst.updateIndicator("drawdown");
    expect(!!inst.indicatorChartMap.drawdown).toBe(false);
    expect(inst.indicatorContainer.children.length).toBe(0);
  });

  it("reports its value through getDataAt, like any pane", () => {
    inst.updateIndicator("drawdown");
    // Give the mocked pane the globals a real ApexCharts pane would have.
    const data = paneOptions(inst).series[0].data;
    inst.indicatorChartMap.drawdown.w.globals.seriesNames = ["Drawdown"];
    inst.indicatorChartMap.drawdown.w.globals.series = [data.map((p) => p.y)];

    const readout = inst.getDataAt(4); // close 80, the trough
    const row = readout.indicators.find((i) => i.pane === "drawdown");
    expect(row.name).toBe("Drawdown");
    expect(row.value).toBeCloseTo(-33.33, 2);
  });
});

describe("drawdown pane: layout", () => {
  let inst;
  beforeEach(() => {
    installApexChartsMock();
    inst = makeInstance();
  });
  afterEach(() => {
    document.body.innerHTML = "";
    delete global.ApexCharts;
  });

  const paneHeights = (i) =>
    Array.from(i.indicatorContainer.children).map((d) =>
      parseInt(d.style.height, 10)
    );
  const area = (i) => parseInt(i.indicatorContainer.style.height, 10);

  it("gives the drawdown pane more room than a bounded oscillator", () => {
    expect(IndicatorHandlers.heightRatioOf("drawdown")).toBe(1.4);
    expect(IndicatorHandlers.heightRatioOf("rsi")).toBeNull();

    inst.updateIndicator("rsi");
    inst.updateIndicator("drawdown");
    const [rsi, dd] = paneHeights(inst);
    expect(dd).toBeGreaterThan(rsi);
    // Exactly a 1 : 1.4 split of the indicator area (integer pixels, so the
    // contract is the distribution, not the raw quotient).
    expect([rsi, dd]).toEqual(
      LayoutManager.distribute(area(inst), 2, [1, 1.4])
    );
  });

  it("honors the `panes` construction option", () => {
    const wide = makeInstance({ panes: { drawdown: { heightRatio: 4 } } });
    wide.updateIndicator("rsi");
    wide.updateIndicator("drawdown");
    const [rsi, dd] = paneHeights(wide);
    expect([rsi, dd]).toEqual(LayoutManager.distribute(area(wide), 2, [1, 4]));
    // The option is an ApexStock one: it must not leak into the chart config.
    expect(wide.mainChartOptions.panes).toBeUndefined();
  });

  it("setPaneHeightRatio re-apportions at runtime, and null restores the default", () => {
    inst.updateIndicator("rsi");
    inst.updateIndicator("drawdown");

    inst.setPaneHeightRatio("drawdown", 3);
    expect(inst.getPaneHeightRatios()).toEqual({
      drawdown: { heightRatio: 3 },
    });
    expect(paneHeights(inst)).toEqual(
      LayoutManager.distribute(area(inst), 2, [1, 3])
    );

    inst.setPaneHeightRatio("drawdown", null);
    expect(inst.getPaneHeightRatios()).toEqual({});
    // Back to the registry default.
    expect(paneHeights(inst)).toEqual(
      LayoutManager.distribute(area(inst), 2, [1, 1.4])
    );
  });

  it("rejects a non-positive ratio", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    inst.setPaneHeightRatio("drawdown", 0);
    inst.setPaneHeightRatio("drawdown", -1);
    inst.setPaneHeightRatio("drawdown", "wide");
    expect(inst.getPaneHeightRatios()).toEqual({});
    expect(warn).toHaveBeenCalledTimes(3);
    warn.mockRestore();
  });

  it("keeps the panes filling the indicator area exactly", () => {
    inst.updateIndicator("rsi");
    inst.updateIndicator("drawdown");
    inst.updateIndicator("macd");
    const total = paneHeights(inst).reduce((a, b) => a + b, 0);
    expect(total).toBe(parseInt(inst.indicatorContainer.style.height, 10));
  });
});

describe("drawdown pane: state", () => {
  let inst;
  beforeEach(() => {
    installApexChartsMock();
    inst = makeInstance();
  });
  afterEach(() => {
    document.body.innerHTML = "";
    delete global.ApexCharts;
  });

  it("round-trips the pane and its basis", () => {
    const intra = makeInstance({ analysis: { drawdownBasis: "intrabar" } });
    intra.updateIndicator("drawdown");
    const state = JSON.parse(JSON.stringify(intra.getState()));
    expect(state.indicators).toEqual([
      { key: "drawdown", params: { basis: "intrabar" } },
    ]);

    intra.removeIndicator("drawdown");
    intra.setState(state);
    expect(!!intra.indicatorChartMap.drawdown).toBe(true);
    expect(intra.oscillatorSettings.getIndicatorParams("drawdown")).toEqual({
      basis: "intrabar",
    });
  });

  it("captures pane height ratios only when they were set", () => {
    expect(inst.getState().panes).toBeNull();
    inst.setPaneHeightRatio("drawdown", 2.5);
    expect(inst.getState().panes).toEqual({ drawdown: { heightRatio: 2.5 } });
  });

  it("restores and clears pane height ratios", () => {
    inst.updateIndicator("drawdown");
    inst.setPaneHeightRatio("drawdown", 2.5);
    const withRatio = JSON.parse(JSON.stringify(inst.getState()));

    inst.setPaneHeightRatio("drawdown", null);
    inst.setState(withRatio);
    expect(inst.getPaneHeightRatios()).toEqual({
      drawdown: { heightRatio: 2.5 },
    });

    // A state with no pane layout resets to the defaults.
    inst.setState({ ...withRatio, panes: null });
    expect(inst.getPaneHeightRatios()).toEqual({});
  });

  it("ignores a garbage panes key", () => {
    inst.setState({
      ...inst.getState(),
      panes: { drawdown: { heightRatio: 0 } },
    });
    expect(inst.getPaneHeightRatios()).toEqual({});
    inst.setState({ ...inst.getState(), panes: "nonsense" });
    expect(inst.getPaneHeightRatios()).toEqual({});
  });
});

describe("drawdown pane: the dropdown", () => {
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

  it("renders an Analysis heading above the analysis panes", () => {
    const options = inst.chartEl.parentNode.querySelectorAll(
      ".apexstock-custom-options > *"
    );
    const nodes = Array.from(options);
    const headings = nodes.filter((n) =>
      n.classList.contains("apexstock-custom-option-group")
    );
    expect(headings).toHaveLength(1);
    expect(headings[0].innerText).toBe("Analysis");

    // The heading sits immediately before the drawdown option...
    const i = nodes.indexOf(headings[0]);
    expect(nodes[i + 1].dataset.value).toBe("drawdown");
    // ...and is not an option itself, so it cannot be selected or focused.
    expect(headings[0].dataset.value).toBeUndefined();
    expect(headings[0].getAttribute("role")).toBe("presentation");
  });

  it("still exposes every indicator as a selectable option", () => {
    const values = Array.from(
      inst.chartEl.parentNode.querySelectorAll(".apexstock-custom-option")
    ).map((o) => o.dataset.value);
    expect(values).toContain("drawdown");
    expect(values).toContain("rsi");
    expect(values).toContain("moving average");
  });
});
