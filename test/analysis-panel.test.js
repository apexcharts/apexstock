// @vitest-environment jsdom
//
// AnalysisPanel: the on-chart readout for a measurement's region statistics.
// Covers automatic visibility, the metric rows and their formatting, the
// separately-labelled Change vs Selection, the warnings footnote, explicit
// show/hide, and the theme rebuild.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import ApexStock from "../src/ApexStock.js";
import AnalysisPanel from "../src/components/AnalysisPanel.js";

function installApexChartsMock() {
  global.ApexCharts = vi.fn(function (el, opts) {
    const priceLike =
      (opts && opts.series && opts.series[0] && opts.series[0].data) || [];
    const inst = {
      el,
      w: {
        globals: {
          chartID: "chart",
          dataPoints: priceLike.length,
          minX: priceLike.length ? priceLike[0].x : 0,
          maxX: priceLike.length ? priceLike[priceLike.length - 1].x : 0,
        },
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
      updateSeries: vi.fn(function (next) {
        inst.w.config.series = next;
      }),
      updateOptions: vi.fn(),
      removeAnnotation: vi.fn(),
      addYaxisAnnotation: vi.fn(),
      zoomX: vi.fn(),
    };
    return inst;
  });
}

/** Closes 100..119 over 20 bars, a dip to 105 at bar 23, recovering by bar 29. */
function ohlcData() {
  const closes = [];
  for (let i = 0; i < 20; i++) closes.push(100 + i);
  closes.push(115, 110, 108, 105, 112, 120, 121, 122, 123, 124);
  return closes.map((c, i) => ({
    x: Date.UTC(2024, 0, 1) + i * 86400000,
    y: [c - 1, c + 2, c - 2, c],
    v: 1000000 + i * 1000,
  }));
}

function makeInstance(options = {}) {
  const parent = document.createElement("div");
  const container = document.createElement("div");
  parent.appendChild(container);
  document.body.appendChild(parent);
  const inst = new ApexStock(container, {
    chart: { height: 500 },
    theme: { mode: "light" },
    series: [{ name: "Price", data: ohlcData() }],
    ...options,
  });
  inst.render();
  return inst;
}

const panelEl = () => document.querySelector(".apexstock-analysis-panel");
const metric = (key) =>
  document.querySelector(`.apexstock-analysis-metric[data-metric="${key}"]`);
const metricValue = (key) => {
  const row = metric(key);
  if (!row || row.style.display === "none") return null;
  return row.querySelector(".apexstock-analysis-metric-value").textContent;
};

describe("automatic visibility", () => {
  beforeEach(() => {
    installApexChartsMock();
  });
  afterEach(() => {
    document.body.innerHTML = "";
    delete global.ApexCharts;
  });

  it("stays absent until something is measured", () => {
    const inst = makeInstance();
    expect(panelEl()).toBeNull();
    expect(inst.isAnalysisPanelVisible()).toBe(false);
  });

  it("appears when a measurement is created", () => {
    const inst = makeInstance();
    inst.measureRange(0, 10);
    expect(panelEl()).not.toBeNull();
    expect(inst.isAnalysisPanelVisible()).toBe(true);
  });

  it("goes away when the last measurement is cleared", () => {
    const inst = makeInstance();
    inst.measureRange(0, 10);
    inst.clearMeasurement();
    expect(inst.isAnalysisPanelVisible()).toBe(false);
  });

  it("never appears with analysis.panel: false", () => {
    const inst = makeInstance({ analysis: { panel: false } });
    inst.measureRange(0, 10);
    expect(panelEl()).toBeNull();
    expect(inst.isAnalysisPanelVisible()).toBe(false);
    // The statistics are still available: this is the headless mode.
    expect(inst.getMeasurements()[0].stats.bars).toBe(11);
  });

  it("can be forced open after opting out", () => {
    const inst = makeInstance({ analysis: { panel: false } });
    inst.measureRange(0, 10);
    inst.showAnalysisPanel();
    expect(inst.isAnalysisPanelVisible()).toBe(true);
    expect(metricValue("change")).toContain("+10");
  });

  it("stays hidden after hideAnalysisPanel, even on a new measurement", () => {
    const inst = makeInstance();
    inst.measureRange(0, 10);
    inst.hideAnalysisPanel();
    expect(inst.isAnalysisPanelVisible()).toBe(false);
    inst.measureRange(15, 25);
    expect(inst.isAnalysisPanelVisible()).toBe(false);
  });

  it("honors an explicit show:true, with a placeholder until something is measured", () => {
    const inst = makeInstance({ analysis: { panel: { show: true } } });
    expect(panelEl()).not.toBeNull();
    expect(inst.isAnalysisPanelVisible()).toBe(true);
    expect(
      document.querySelector(".apexstock-analysis-panel-range").textContent
    ).toBe("No selection");

    inst.measureRange(0, 10);
    expect(metricValue("change")).toBe("+10 (+10.00%)");

    // Clearing returns it to the placeholder rather than removing the frame.
    inst.clearMeasurement();
    expect(inst.isAnalysisPanelVisible()).toBe(true);
    expect(metricValue("change")).toBeNull();
    expect(
      document.querySelector(".apexstock-analysis-panel-range").textContent
    ).toBe("No selection");
  });
});

describe("the metric rows", () => {
  let inst;
  beforeEach(() => {
    installApexChartsMock();
    inst = makeInstance();
  });
  afterEach(() => {
    document.body.innerHTML = "";
    delete global.ApexCharts;
  });

  it("shows the dated range and the change", () => {
    inst.measureRange(0, 10);
    expect(
      document.querySelector(".apexstock-analysis-panel-range").textContent
    ).toBe("2024-01-01  to  2024-01-11");
    expect(metricValue("change")).toBe("+10 (+10.00%)");
  });

  it("shows the duration in bars and days", () => {
    inst.measureRange(0, 10);
    expect(metricValue("duration")).toBe("11 bars · 10d");
  });

  it("shows the true high and low, not the closes", () => {
    inst.measureRange(0, 10);
    expect(metricValue("high")).toBe("112"); // bar 10 high
    expect(metricValue("low")).toBe("98"); // bar 0 low
  });

  it("compacts the average volume", () => {
    inst.measureRange(0, 10);
    expect(metricValue("volume")).toMatch(/^1\.0[0-9]M$/);
  });

  it("shows the annualized volatility with its unit", () => {
    inst.measureRange(0, 29);
    expect(metricValue("volatility")).toMatch(/%\s+ann\.$/);
  });

  it("shows the max drawdown with the decline length, and the recovery", () => {
    inst.measureRange(0, 29);
    // Closes peak 119 (bar 19), trough 105 (bar 23), regained by bar 25.
    expect(metricValue("drawdown")).toBe("-11.76% · 4 bars");
    expect(metricValue("recovery")).toBe("2 bars");
  });

  it("says so when a drawdown never recovered", () => {
    inst.measureRange(0, 23);
    expect(metricValue("recovery")).toBe("not recovered");
  });

  it("hides the drawdown durations for a range that only rose", () => {
    inst.measureRange(0, 5);
    expect(metricValue("drawdown")).toBe("0.00%");
    expect(metricValue("recovery")).toBeNull();
  });

  it("omits the annualized return for a short range", () => {
    inst.measureRange(0, 10); // 10 days, under the 30-day floor
    expect(metricValue("annualized")).toBeNull();
  });

  it("shows the annualized return once the chart's floor allows it", () => {
    inst.measureRange(0, 29); // 29 days, under the default 30-day floor
    expect(metricValue("annualized")).toBeNull();

    // The convention is chart-level, not per-measurement, so it is set on the
    // chart's analysis options (see measureRange's contract).
    const inst2 = makeInstance({ analysis: { minAnnualizeDays: 1 } });
    inst2.measureRange(0, 29);
    expect(metricValue("annualized")).toMatch(/%$/);
  });
});

describe("Change vs Selection", () => {
  let inst;
  let data;
  beforeEach(() => {
    installApexChartsMock();
    data = ohlcData();
    inst = makeInstance();
  });
  afterEach(() => {
    document.body.innerHTML = "";
    delete global.ApexCharts;
  });

  it("shows both, separately labelled, when the anchors are off the closes", () => {
    inst.addDrawing({
      type: "measure",
      points: [
        { x: data[0].x, y: data[0].y[2] }, // low 98
        { x: data[10].x, y: data[10].y[1] }, // high 112
      ],
    });
    expect(metricValue("change")).toBe("+10 (+10.00%)"); // close to close
    expect(metricValue("selection")).toContain("+14"); // what was dragged
    expect(metric("selection").textContent).toContain("Selection");
  });

  it("hides Selection when it would just repeat Change", () => {
    inst.measureRange(0, 10); // anchored on the closes
    expect(metricValue("change")).toBe("+10 (+10.00%)");
    expect(metricValue("selection")).toBeNull();
  });
});

describe("configuration", () => {
  beforeEach(() => {
    installApexChartsMock();
  });
  afterEach(() => {
    document.body.innerHTML = "";
    delete global.ApexCharts;
  });

  it("renders only the requested metrics, in order", () => {
    const inst = makeInstance({
      analysis: { panel: { metrics: ["duration", "change"] } },
    });
    inst.measureRange(0, 10);
    const keys = Array.from(
      document.querySelectorAll(".apexstock-analysis-metric")
    ).map((el) => el.getAttribute("data-metric"));
    expect(keys).toEqual(["duration", "change"]);
  });

  it("applies custom formatters", () => {
    const inst = makeInstance({
      analysis: {
        panel: {
          formatters: {
            price: (v) => `$${Number(v).toFixed(3)}`,
            percent: (v) => `${Number(v).toFixed(0)} pct`,
            date: () => "DATE",
            volume: () => "VOL",
          },
        },
      },
    });
    inst.measureRange(0, 10);
    expect(metricValue("change")).toBe("+$10.000 (10 pct)");
    expect(metricValue("volume")).toBe("VOL");
    expect(
      document.querySelector(".apexstock-analysis-panel-range").textContent
    ).toBe("DATE  to  DATE");
  });

  it("places the panel in the requested corner and titles it", () => {
    const inst = makeInstance({
      analysis: { panel: { position: "bottom-left", title: "Selection" } },
    });
    inst.measureRange(0, 10);
    const el = panelEl();
    expect(el.className).toContain("apexstock-analysis-panel-bottom-left");
    expect(el.style.bottom).toBe("8px");
    expect(el.style.left).toBe("10px");
    expect(
      document.querySelector(".apexstock-analysis-panel-title").textContent
    ).toBe("Selection");
  });

  it("hides the title when it is empty", () => {
    const inst = makeInstance({ analysis: { panel: { title: "" } } });
    inst.measureRange(0, 10);
    expect(
      document.querySelector(".apexstock-analysis-panel-title").style.display
    ).toBe("none");
  });

  it("repositions and re-metrics through showAnalysisPanel", () => {
    const inst = makeInstance();
    inst.measureRange(0, 10);
    inst.showAnalysisPanel({ position: "top-left", metrics: ["change"] });
    expect(panelEl().style.left).toBe("10px");
    expect(
      document.querySelectorAll(".apexstock-analysis-metric")
    ).toHaveLength(1);
  });

  it("patches formatters, title, and placeholder through showAnalysisPanel", () => {
    const inst = makeInstance();
    inst.showAnalysisPanel({
      title: "Window",
      placeholder: "Drag to measure",
      formatters: { price: (v) => `[${v}]` },
    });
    expect(
      document.querySelector(".apexstock-analysis-panel-title").textContent
    ).toBe("Window");
    expect(
      document.querySelector(".apexstock-analysis-panel-range").textContent
    ).toBe("Drag to measure");

    inst.measureRange(0, 10);
    expect(metricValue("change")).toBe("+[10] (+10.00%)");
  });

  it("ignores an unknown metric key instead of throwing", () => {
    const inst = makeInstance({
      analysis: { panel: { metrics: ["change", "banana"] } },
    });
    expect(() => inst.measureRange(0, 10)).not.toThrow();
    expect(metricValue("change")).toBeTruthy();
    expect(metricValue("banana")).toBeNull();
  });
});

describe("degenerate readouts", () => {
  let inst;
  beforeEach(() => {
    installApexChartsMock();
    inst = makeInstance();
  });
  afterEach(() => {
    document.body.innerHTML = "";
    delete global.ApexCharts;
  });

  it("hides volatility for a single-bar range", () => {
    inst.measureRange(5, 5);
    expect(metricValue("duration")).toBe("1 bars");
    expect(metricValue("volatility")).toBeNull();
    expect(metricValue("change")).toBe("+0 (+0.00%)");
  });

  it("hides Selection for a reading with no dragged anchors", () => {
    const data = ohlcData();
    // The core ruler in span mode reports x positions without usable y anchors.
    inst.measurement.onCoreMeasured({
      from: { x: data[0].x },
      to: { x: data[10].x },
    });
    expect(metricValue("change")).toBe("+10 (+10.00%)");
    expect(metricValue("selection")).toBeNull();
  });
});

describe("the warnings footnote", () => {
  beforeEach(() => {
    installApexChartsMock();
  });
  afterEach(() => {
    document.body.innerHTML = "";
    delete global.ApexCharts;
  });

  it("surfaces the first assumption, with the full list on the title", () => {
    const inst = makeInstance();
    inst.measureRange(0, 10); // annualization declined + volatility inferred
    const note = document.querySelector(".apexstock-analysis-panel-note");
    expect(note.style.display).not.toBe("none");
    expect(note.textContent.length).toBeGreaterThan(0);
    expect(note.title).toContain("periodsPerYear");
  });

  it("stays hidden when the engine had to assume nothing", () => {
    const inst = makeInstance({
      analysis: { periodsPerYear: 252, minAnnualizeDays: 1 },
    });
    inst.measureRange(0, 29);
    const note = document.querySelector(".apexstock-analysis-panel-note");
    expect(note.style.display).toBe("none");
  });
});

describe("lifecycle", () => {
  beforeEach(() => {
    installApexChartsMock();
  });
  afterEach(() => {
    document.body.innerHTML = "";
    delete global.ApexCharts;
  });

  it("repaints with the new palette after a theme switch", () => {
    const inst = makeInstance();
    inst.measureRange(0, 10);
    const before = panelEl().style.background;
    inst.updateTheme("dark");
    const after = panelEl().style.background;
    expect(after).not.toBe(before);
    expect(metricValue("change")).toBe("+10 (+10.00%)");
  });

  it("removes itself on destroy", () => {
    const inst = makeInstance();
    inst.measureRange(0, 10);
    expect(panelEl()).not.toBeNull();
    inst.destroy();
    expect(panelEl()).toBeNull();
  });

  it("no-ops without a host element", () => {
    const p = new AnalysisPanel({ analysisOptions: {} });
    expect(() => p.showMeasurement(null)).not.toThrow();
    expect(p.isVisible()).toBe(false);
    expect(() => p.reapply()).not.toThrow();
    expect(() => p.destroy()).not.toThrow();
  });
});
