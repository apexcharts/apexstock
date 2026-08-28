// @vitest-environment jsdom
//
// The analysis engine's public wiring: the `ApexStock.stats` static namespace
// (usable with no chart), the `getRangeStats` / `getDrawdown` instance methods,
// the `analysis` construction option, and memo invalidation on append.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import ApexStock from "../src/ApexStock.js";
import { dailyOhlc, drawdownSeries } from "./fixtures.js";

const DAY = 86400000;

function makeContainer() {
  const parent = document.createElement("div");
  const container = document.createElement("div");
  parent.appendChild(container);
  document.body.appendChild(parent);
  return container;
}

/**
 * An ApexCharts mock whose zoom globals track the data it was constructed with,
 * so `getVisibleRange()` and the `appendData()` path have something real to
 * read (the same shape `append-data.test.js` installs).
 */
function stub() {
  const instances = [];
  global.ApexCharts = vi.fn(function (el, opts) {
    const data =
      (opts && opts.series && opts.series[0] && opts.series[0].data) || [];
    const inst = {
      el,
      w: {
        globals: {
          chartID: "test-chart",
          dataPoints: data.length,
          minX: data.length ? data[0].x : 0,
          maxX: data.length ? data[data.length - 1].x : 0,
        },
        config: {
          chart: { type: "candlestick" },
          series: (opts && opts.series) || [],
          yaxis: [{}],
          annotations: {},
        },
      },
      render: vi.fn().mockResolvedValue(undefined),
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
    instances.push(inst);
    return inst;
  });
  return instances;
}

/** A chart over the designed drawdown fixture (100 110 120 90 80 95 121 115). */
function makeChart(analysis) {
  return new ApexStock(makeContainer(), {
    chart: { height: 400 },
    series: [{ name: "Price", data: drawdownSeries() }],
    ...(analysis ? { analysis } : {}),
  });
}

describe("ApexStock.stats (no chart required)", () => {
  it("exposes the whole pure engine as one namespace", () => {
    for (const fn of [
      "rangeStats",
      "returns",
      "volatility",
      "annualize",
      "inferPeriodsPerYear",
      "resolveIndex",
      "drawdown",
      "drawdownRange",
      "worstDrawdown",
      "align",
      "baseline",
      "rebase",
      "relative",
    ]) {
      expect(typeof ApexStock.stats[fn]).toBe("function");
    }
  });

  it("computes range statistics with no DOM and no chart instance", () => {
    const st = ApexStock.stats.rangeStats(
      dailyOhlc([142, 150, 160, 171]),
      0,
      3
    );
    expect(st.change.absolute).toBe(29);
    expect(st.change.percent).toBeCloseTo(20.42, 2);
    expect(st.bars).toBe(4);
  });

  it("computes a drawdown and an alignment with no chart instance", () => {
    expect(ApexStock.stats.drawdown(drawdownSeries()).max).toBeCloseTo(
      ((80 - 120) / 120) * 100,
      10
    );
    const aligned = ApexStock.stats.align({
      A: dailyOhlc([10, 11]),
      B: dailyOhlc([20, 22]),
    });
    expect(aligned.x).toHaveLength(2);
    expect(ApexStock.stats.rebase(aligned).columns.B[1]).toBeCloseTo(10, 10);
  });
});

describe("getRangeStats / getDrawdown", () => {
  beforeEach(() => {
    stub();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    delete global.ApexCharts;
    vi.restoreAllMocks();
  });

  it("reads the instance's own series", () => {
    const chart = makeChart();
    const st = chart.getRangeStats(0, 7);
    expect(st.from.value).toBe(100);
    expect(st.to.value).toBe(115);
    expect(st.bars).toBe(8);
    expect(st.drawdown.max).toBeCloseTo(((80 - 120) / 120) * 100, 10);
  });

  it("accepts dates and timestamps, matching the index form", () => {
    const chart = makeChart();
    const byIndex = chart.getRangeStats(0, 7);
    expect(chart.getRangeStats(chart.series[0].x, chart.series[7].x)).toEqual(
      byIndex
    );
    expect(
      chart.getRangeStats(new Date(chart.series[0].x), "2024-01-08")
    ).toEqual(byIndex);
  });

  it("pairs with getVisibleRange to measure the visible window", () => {
    const chart = makeChart();
    const range = chart.getVisibleRange();
    expect(range).not.toBeNull();
    const st = chart.getRangeStats(range.min, range.max);
    expect(st.from.index).toBe(0);
    expect(st.to.index).toBe(7);
  });

  it("returns the whole-series drawdown with its episodes", () => {
    const dd = makeChart().getDrawdown();
    expect(dd.episodes).toHaveLength(2);
    expect(dd.episodes[0].recovery.index).toBe(6);
    expect(dd.episodes[1].ongoing).toBe(true);
    expect(dd.current).toBeCloseTo(((115 - 121) / 121) * 100, 10);
  });

  it("returns null from getRangeStats when the series is empty", () => {
    const chart = makeChart();
    chart.series = [];
    expect(chart.getRangeStats(0, 1)).toBeNull();
  });
});

describe("the `analysis` construction option", () => {
  beforeEach(() => {
    stub();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    delete global.ApexCharts;
  });

  it("is stored on the instance and applied as the default", () => {
    const chart = makeChart({ drawdownBasis: "intrabar", periodsPerYear: 365 });
    expect(chart.analysisOptions).toEqual({
      drawdownBasis: "intrabar",
      periodsPerYear: 365,
    });
    const st = chart.getRangeStats(0, 7);
    expect(st.basis.drawdown).toBe("intrabar");
    expect(st.volatility.periodsPerYear).toBe(365);
    expect(st.volatility.inferred).toBe(false);
  });

  it("is overridable per call", () => {
    const chart = makeChart({ drawdownBasis: "intrabar" });
    expect(
      chart.getRangeStats(0, 7, { drawdownBasis: "close" }).basis.drawdown
    ).toBe("close");
  });

  it("lowers the annualization floor when asked", () => {
    const chart = makeChart();
    expect(chart.getRangeStats(0, 7).annualized).toBeNull(); // 7 days < 30
    expect(
      chart.getRangeStats(0, 7, { minAnnualizeDays: 1 }).annualized.return
    ).toBeGreaterThan(0);
  });

  it("never reaches the ApexCharts config", () => {
    const chart = makeChart({ periodsPerYear: 252 });
    expect(chart.mainChartOptions.analysis).toBeUndefined();
    expect(chart.getDrawdown().basis).toBe("close");
  });

  it("defaults to an empty option set", () => {
    expect(makeChart().analysisOptions).toEqual({});
  });
});

describe("memo invalidation on append", () => {
  beforeEach(() => {
    stub();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    delete global.ApexCharts;
  });

  it("reflects an appended bar instead of serving the stale memo", () => {
    const chart = makeChart();
    // Warm the memo, then append a bar that deepens the open drawdown.
    expect(chart.getDrawdown().values).toHaveLength(8);
    const lastX = chart.series[7].x;

    chart.appendData({ x: lastX + DAY, y: [115, 115, 90, 90], v: 100 });

    const dd = chart.getDrawdown();
    expect(dd.values).toHaveLength(9);
    // 90 against the 121 peak, so the open episode is now the deeper one.
    expect(dd.current).toBeCloseTo(((90 - 121) / 121) * 100, 10);
    expect(chart.getRangeStats(0, 8).bars).toBe(9);
  });
});
