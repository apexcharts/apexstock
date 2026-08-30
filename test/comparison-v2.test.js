// @vitest-environment jsdom
//
// Comparison v2: alignment across instruments with different calendars, the
// baseline policies, the indexed / relative / ratio modes, the benchmark role,
// and the leaderboard (`getComparisonStats`).
//
// The numbers are chosen so every assertion is checkable by hand. On the shared
// grid (10 daily bars from EPOCH), the common baseline lands on index 3, which
// is where BBB lists:
//
//   idx      0    1    2    3    4    5    6    7    8    9
//   Price  100  100  100  100  110  120  130  140  150  200   idx3 -> +100%
//   AAA     40   44   48   50   55   60   65   70   75  110   idx3 -> +120%
//   BBB      -    -    -  200  210  220  230  240  250  300   idx3 -> +50%
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import ApexStock from "../src/ApexStock.js";
import { dailyOhlc, EPOCH } from "./fixtures.js";

const DAY = 86400000;
const at = (i) => EPOCH + i * DAY;

const PRICE = [100, 100, 100, 100, 110, 120, 130, 140, 150, 200];
const AAA = [40, 44, 48, 50, 55, 60, 65, 70, 75, 110];
const BBB = [200, 210, 220, 230, 240, 250, 300]; // days 3..9

/** Scalar line points, the shape a consumer usually passes for a peer. */
const line = (closes, startDay = 0) =>
  closes.map((c, i) => ({ x: at(startDay + i), y: c }));

function installApexChartsMock() {
  global.ApexCharts = vi.fn(function (el, opts) {
    const inst = {
      el,
      options: opts,
      w: {
        globals: { chartID: "chart", dataPoints: 10, minX: at(0), maxX: at(9) },
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
      updateOptions: vi.fn(function (o) {
        if (o && o.yaxis !== undefined) inst.w.config.yaxis = o.yaxis;
      }),
      addYaxisAnnotation: vi.fn(),
      removeAnnotation: vi.fn(),
      zoomX: vi.fn(),
    };
    return inst;
  });
}

/**
 * Chart instances are created without render(), so XAxis' "wait for the
 * graphical element" retry never resolves against the mock and would keep
 * rescheduling itself into later test files. Fake timers keep that polling out
 * of the way; nothing asserted here is asynchronous.
 */
function useQuietTimers() {
  vi.useFakeTimers();
}

function makeInstance(analysis) {
  const parent = document.createElement("div");
  const container = document.createElement("div");
  parent.appendChild(container);
  document.body.appendChild(parent);
  return new ApexStock(container, {
    chart: { height: 500 },
    theme: { mode: "light" },
    series: [{ name: "Price", data: dailyOhlc(PRICE) }],
    ...(analysis ? { analysis } : {}),
  });
}

/** The plotted points of one comparison line. */
const lineOf = (inst, name) => {
  const s = inst.chart.w.config.series.find((x) => x.name === name);
  return s ? s.data : null;
};

/** The plotted y of one line at a given day, by x (lines differ in length). */
const yAt = (inst, name, day) => {
  const pts = lineOf(inst, name) || [];
  const p = pts.find((q) => q.x === at(day));
  return p ? p.y : undefined;
};

/** A row from the leaderboard by name. */
const rowOf = (rows, name) => rows.find((r) => r.name === name);

describe("comparison v2: alignment and baselines", () => {
  let inst;
  beforeEach(() => {
    installApexChartsMock();
    useQuietTimers();
    inst = makeInstance();
  });
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
    delete global.ApexCharts;
  });

  it('rebases every instrument at the first shared x under baseline: "common"', () => {
    inst.addComparison({ name: "AAA", data: line(AAA) });
    inst.addComparison({ name: "BBB", data: line(BBB, 3) });

    const rows = inst.getComparisonStats();
    // All three measured from index 3 (the day BBB lists), not from their own
    // first point.
    expect(rowOf(rows, "Price").from).toBe(at(3));
    expect(rowOf(rows, "AAA").from).toBe(at(3));
    expect(rowOf(rows, "BBB").from).toBe(at(3));
    expect(rowOf(rows, "AAA").change.percent).toBeCloseTo(120, 10);
    expect(rowOf(rows, "BBB").change.percent).toBeCloseTo(50, 10);
    expect(rowOf(rows, "Price").change.percent).toBeCloseTo(100, 10);
  });

  it('baseline: "own" reproduces the pre-0.5.0 numbers exactly', () => {
    inst.setComparisonOptions({ baseline: "own" });
    inst.addComparison({ name: "AAA", data: line(AAA) });
    inst.addComparison({ name: "BBB", data: line(BBB, 3) });

    // Each line starts at 0% at its own first point, wherever that falls.
    expect(lineOf(inst, "AAA")[0]).toEqual({ x: at(0), y: 0 });
    expect(lineOf(inst, "BBB")[0]).toEqual({ x: at(3), y: 0 });

    const rows = inst.getComparisonStats();
    expect(rowOf(rows, "AAA").from).toBe(at(0));
    expect(rowOf(rows, "AAA").change.percent).toBeCloseTo(175, 10); // 40 -> 110
    expect(rowOf(rows, "BBB").change.percent).toBeCloseTo(50, 10);
  });

  it("plots the pre-baseline history as negative percent under a shared baseline", () => {
    inst.addComparison({ name: "AAA", data: line(AAA) });
    inst.addComparison({ name: "BBB", data: line(BBB, 3) });
    const pts = lineOf(inst, "AAA");
    expect(pts[0]).toEqual({ x: at(0), y: -20 }); // 40 against a 50 baseline
    expect(pts[3]).toEqual({ x: at(3), y: 0 });
    expect(pts[9].y).toBeCloseTo(120, 2);
  });

  it("accepts an explicit x value as the baseline", () => {
    inst.setComparisonOptions({ baseline: at(4) });
    inst.addComparison({ name: "AAA", data: line(AAA) });
    // 55 at index 4 becomes the zero point: 110/55 - 1 = +100%.
    expect(lineOf(inst, "AAA")[4].y).toBe(0);
    expect(lineOf(inst, "AAA")[9].y).toBeCloseTo(100, 2);
    expect(inst.getComparisonOptions().baseline).toBe(at(4));
  });

  it('carries a hole forward under fill: "hold" and counts it in coverage', () => {
    const holed = line(AAA).filter((_, i) => i !== 5);
    inst.addComparison({ name: "CCC", data: holed });
    const row = rowOf(inst.getComparisonStats(), "CCC");
    expect(row.coverage.bars).toBe(10); // the hole is filled on the grid
    expect(row.coverage.filled).toBe(1);
    // A carried-forward value is math only: it is never plotted.
    expect(lineOf(inst, "CCC")).toHaveLength(9);
    expect(lineOf(inst, "CCC").some((p) => p.x === at(5))).toBe(false);
  });

  it('leaves a hole null under fill: "gap"', () => {
    const holed = line(AAA).filter((_, i) => i !== 5);
    inst.setComparisonOptions({ fill: "gap" });
    inst.addComparison({ name: "CCC", data: holed });
    const row = rowOf(inst.getComparisonStats(), "CCC");
    expect(row.coverage.bars).toBe(9);
    expect(row.coverage.filled).toBe(0);
  });

  it('fill: "drop" trims the grid to x values every instrument has', () => {
    inst.setComparisonOptions({ fill: "drop" });
    inst.addComparison({ name: "AAA", data: line(AAA) });
    inst.addComparison({ name: "BBB", data: line(BBB, 3) });
    // BBB lists on day 3, so days 0-2 are dropped for everyone.
    expect(lineOf(inst, "AAA")).toHaveLength(7);
    expect(lineOf(inst, "AAA")[0].x).toBe(at(3));
    expect(rowOf(inst.getComparisonStats(), "Price").bars).toBe(7);
  });

  it('join: "primary" resamples onto the primary bars and plots the filled grid', () => {
    // A weekly peer on a daily chart: two observations, eight held bars.
    const weekly = [
      { x: at(0), y: 10 },
      { x: at(7), y: 20 },
    ];
    inst.setComparisonOptions({ join: "primary", mode: "absolute" });
    inst.setComparisonMode("absolute");
    inst.addComparison({ name: "WKY", data: weekly });
    // resample defaults to true for this join, so every primary bar gets a value.
    expect(lineOf(inst, "WKY")).toHaveLength(10);
    expect(lineOf(inst, "WKY")[6].y).toBe(10); // held
    expect(lineOf(inst, "WKY")[7].y).toBe(20); // observed
    expect(inst.getComparisonOptions().resample).toBeNull();
  });

  it("plots observations only when resample is explicitly off", () => {
    const weekly = [
      { x: at(0), y: 10 },
      { x: at(7), y: 20 },
    ];
    inst.setComparisonMode("absolute");
    inst.setComparisonOptions({ join: "primary", resample: false });
    inst.addComparison({ name: "WKY", data: weekly });
    expect(lineOf(inst, "WKY")).toHaveLength(2);
  });

  it('join: "intersection" keeps only shared x values', () => {
    inst.setComparisonOptions({ join: "intersection" });
    inst.addComparison({ name: "BBB", data: line(BBB, 3) });
    expect(lineOf(inst, "BBB")).toHaveLength(7);
    expect(rowOf(inst.getComparisonStats(), "Price").bars).toBe(7);
  });

  it("reports the baseline policy actually applied, not the one requested", () => {
    // X ends before Y starts, so no x value has data for both and a shared
    // baseline is impossible; each instrument falls back to its own.
    const inst2 = makeInstance();
    // `hold` would carry XXX's last value forward and make day 8 a shared
    // baseline (from a stale value); `gap` leaves the real hole in place.
    inst2.setComparisonOptions({ fill: "gap" });
    inst2.addComparison({
      name: "XXX",
      data: [
        { x: at(0), y: 10 },
        { x: at(1), y: 11 },
      ],
    });
    inst2.addComparison({
      name: "YYY",
      data: [
        { x: at(8), y: 20 },
        { x: at(9), y: 22 },
      ],
    });
    const seen = [];
    inst2.on("comparisonChange", (p) => seen.push(p));
    inst2.setComparisonMode("indexed");
    expect(seen[0].baseline).toBe("own");
    expect(seen[0].warnings.join(" ")).toMatch(/no x value has data for every/);
  });

  it("keeps the primary out of the instrument list but inside the math", () => {
    inst.addComparison({ name: "AAA", data: line(AAA) });
    // Not a comparison instrument...
    expect(inst.getComparisons().map((i) => i.name)).toEqual(["AAA"]);
    // ...but it is a leaderboard row, and it anchors the shared baseline.
    const rows = inst.getComparisonStats();
    expect(rows.map((r) => r.name)).toEqual(["Price", "AAA"]);
    expect(rowOf(rows, "Price").primary).toBe(true);
    expect(rowOf(rows, "Price").color).toBeNull();
  });

  it("refuses an instrument named like the primary series", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(inst.addComparison({ name: "Price", data: line(AAA) })).toBeNull();
    expect(
      inst.addComparison({ name: "__primary__", data: line(AAA) })
    ).toBeNull();
    expect(inst.getComparisons()).toHaveLength(0);
    warn.mockRestore();
  });

  it("ignores unknown option values instead of silently changing the math", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    inst.setComparisonOptions({ join: "nonsense", baseline: "yesterday" });
    expect(inst.getComparisonOptions().join).toBe("union");
    expect(inst.getComparisonOptions().baseline).toBe("common");
    inst.setComparisonMode("sideways");
    expect(inst.getComparisonMode()).toBe("percent");
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("comparison v2: modes and the benchmark role", () => {
  let inst;
  beforeEach(() => {
    installApexChartsMock();
    useQuietTimers();
    inst = makeInstance();
    inst.addComparison({ name: "AAA", data: line(AAA) });
    inst.addComparison({ name: "BBB", data: line(BBB, 3) });
  });
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
    delete global.ApexCharts;
  });

  it('indexed mode puts the baseline at indexBase ("100 = starting value")', () => {
    inst.setComparisonMode("indexed");
    expect(yAt(inst, "AAA", 3)).toBe(100);
    expect(yAt(inst, "AAA", 9)).toBeCloseTo(220, 2); // 110/50 * 100
    expect(inst.chart.w.config.yaxis[1].title.text).toBe("index (100)");
  });

  it("honors a custom indexBase", () => {
    inst.setComparisonOptions({ indexBase: 1 });
    inst.setComparisonMode("indexed");
    expect(yAt(inst, "AAA", 3)).toBe(1);
    expect(yAt(inst, "AAA", 9)).toBeCloseTo(2.2, 2);
  });

  it("relative mode against the primary shows excess return in points", () => {
    inst.setComparisonMode("relative");
    expect(inst.getComparisonBenchmark()).toBe("__primary__");
    // AAA +120% vs Price +100% -> +20 points; BBB +50% -> -50 points.
    expect(yAt(inst, "AAA", 9)).toBeCloseTo(20, 2);
    expect(yAt(inst, "BBB", 9)).toBeCloseTo(-50, 2);
    expect(yAt(inst, "AAA", 3)).toBe(0); // both flat at the baseline
    expect(inst.chart.w.config.yaxis[1].title.text).toBe("excess %");
  });

  it("relative mode against an added instrument makes it the flat zero line", () => {
    inst.setComparisonBenchmark("BBB");
    inst.setComparisonMode("relative");
    // The benchmark's spread against itself is zero everywhere: the reference.
    expect(lineOf(inst, "BBB").every((p) => p.y === 0)).toBe(true);
    expect(yAt(inst, "AAA", 9)).toBeCloseTo(70, 2); // 120 - 50
    const rows = inst.getComparisonStats();
    expect(rowOf(rows, "AAA").relative).toBeCloseTo(70, 10);
    expect(rowOf(rows, "Price").relative).toBeCloseTo(50, 10);
    expect(rowOf(rows, "BBB").relative).toBe(0);
    expect(rowOf(rows, "BBB").benchmark).toBe(true);
  });

  it("ratio mode rebases the quotient to indexBase", () => {
    inst.setComparisonMode("ratio");
    // (110/200) / (50/100) * 100 = 110: AAA outgrew the primary by 10%.
    expect(yAt(inst, "AAA", 3)).toBe(100);
    expect(yAt(inst, "AAA", 9)).toBeCloseTo(110, 2);
    expect(inst.chart.w.config.yaxis[1].title.text).toBe("ratio (100)");
  });

  it("ratio mode can report the raw quotient", () => {
    inst.setComparisonOptions({ rebaseRatio: false });
    inst.setComparisonMode("ratio");
    expect(yAt(inst, "AAA", 3)).toBe(0.5); // 50/100
    expect(yAt(inst, "AAA", 9)).toBeCloseTo(0.55, 4); // 110/200
  });

  it("hands the benchmark role back to the primary when its instrument is removed", () => {
    inst.setComparisonBenchmark("BBB");
    inst.setComparisonMode("relative");
    inst.removeComparison("BBB");
    expect(inst.getComparisonBenchmark()).toBe("__primary__");
    // Back to vs Price, and the shared baseline moved with BBB: without the
    // late listing, day 0 is the first x everyone has, so AAA is +175% and
    // Price +100% -> a 75-point spread.
    expect(yAt(inst, "AAA", 9)).toBeCloseTo(75, 2);
  });

  it("refuses a benchmark that is not an added instrument", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    inst.setComparisonBenchmark("SPY");
    expect(inst.getComparisonBenchmark()).toBe("__primary__");
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("switches modes without breaking the bound/unbound axis invariant", () => {
    // Simulate an active indicator overlay. Injecting the series directly keeps
    // this a test of the axis-binding rule rather than of the indicator stack.
    inst.chart.w.config.series = [
      ...inst.chart.w.config.series.filter((s) => s.name === "Price"),
      { name: "SMA 20", type: "line", data: [] },
      ...inst.chart.w.config.series.filter((s) => s.name !== "Price"),
    ];
    inst.comparison._rendered = new Set(["AAA", "BBB"]);
    inst.setComparisonMode("indexed");

    const yaxis = inst.chart.w.config.yaxis;
    expect(yaxis).toHaveLength(2);
    // Every series is bound to exactly one axis: price + overlay on the
    // primary, comparisons on the secondary.
    expect(yaxis[0].seriesName).toEqual(["Price", "SMA 20"]);
    expect(yaxis[1].seriesName).toEqual(["AAA", "BBB"]);
    const bound = [...yaxis[0].seriesName, ...yaxis[1].seriesName];
    expect(inst.chart.w.config.series.map((s) => s.name).sort()).toEqual(
      bound.sort()
    );
  });
});

describe("comparison v2: the leaderboard", () => {
  let inst;
  beforeEach(() => {
    installApexChartsMock();
    useQuietTimers();
    inst = makeInstance();
    inst.addComparison({ name: "AAA", data: line(AAA) });
    inst.addComparison({ name: "BBB", data: line(BBB, 3) });
  });
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
    delete global.ApexCharts;
  });

  it("ranks by performance, best first", () => {
    const rows = inst.getComparisonStats();
    expect(rowOf(rows, "AAA").rank).toBe(1); // +120%
    expect(rowOf(rows, "Price").rank).toBe(2); // +100%
    expect(rowOf(rows, "BBB").rank).toBe(3); // +50%
  });

  it("reports the absolute change, the high, and the low over the window", () => {
    const row = rowOf(inst.getComparisonStats(), "AAA");
    expect(row.start).toBe(50);
    expect(row.end).toBe(110);
    expect(row.change.absolute).toBe(60);
    expect(row.high).toEqual({ value: 110, x: at(9) });
    expect(row.low).toEqual({ value: 50, x: at(3) });
    expect(row.bars).toBe(7); // index 3..9 inclusive
  });

  it("reports volatility and the worst drawdown per instrument", () => {
    const inst2 = makeInstance();
    // 100 -> 120 -> 90 -> 121: a 25% drawdown that recovers on the last bar.
    inst2.addComparison({
      name: "DDD",
      data: line([100, 110, 120, 90, 100, 110, 121, 121, 121, 121]),
    });
    const row = rowOf(inst2.getComparisonStats(), "DDD");
    expect(row.drawdown.max).toBeCloseTo(-25, 10); // 90 against a 120 peak
    expect(row.drawdown.recovered).toBe(true);
    expect(row.drawdown.barsToTrough).toBe(1);
    expect(row.volatility.stdev).toBeGreaterThan(0);
    expect(row.volatility.periodsPerYear).toBe(252); // daily grid
  });

  it("scopes the window when from/to are given", () => {
    const rows = inst.getComparisonStats({ from: at(4), to: at(6) });
    const row = rowOf(rows, "AAA");
    expect(row.from).toBe(at(4));
    expect(row.to).toBe(at(6));
    expect(row.start).toBe(55);
    expect(row.end).toBe(65);
    expect(row.bars).toBe(3);
  });

  it("returns an empty array with no instruments added", () => {
    const bare = makeInstance();
    expect(bare.getComparisonStats()).toEqual([]);
  });

  it("annualizes volatility on the instrument's own bar spacing, not the grid's", () => {
    // A weekly peer on a daily grid must not be annualized as if it had 252
    // bars a year.
    const weekly = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => ({
      x: EPOCH + i * 7 * DAY,
      y: 100 + i * (i % 2 ? 3 : -1),
    }));
    const inst2 = makeInstance();
    inst2.addComparison({ name: "WKY", data: weekly });
    const row = rowOf(inst2.getComparisonStats(), "WKY");
    expect(row.volatility.periodsPerYear).toBe(52);
  });
});

describe("comparison v2: visible baseline and events", () => {
  let inst;
  beforeEach(() => {
    installApexChartsMock();
    useQuietTimers();
    inst = makeInstance();
  });
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
    delete global.ApexCharts;
  });

  it("rebases to the left edge of the visible window and follows the zoom", () => {
    inst.setComparisonOptions({ baseline: "visible" });
    inst.addComparison({ name: "AAA", data: line(AAA) });
    // Before any zoom the full range is visible, so the baseline is the first bar.
    expect(lineOf(inst, "AAA")[0].y).toBe(0);

    inst._emitter.emit("rangeChange", {
      min: at(4),
      max: at(9),
      source: "zoom",
    });
    // 55 at index 4 is now the zero point.
    expect(lineOf(inst, "AAA")[4].y).toBe(0);
    expect(lineOf(inst, "AAA")[9].y).toBeCloseTo(100, 2);
    expect(lineOf(inst, "AAA")[0].y).toBeCloseTo(-27.27, 2); // 40/55 - 1
  });

  it("does not loop on the echo of its own rebase", () => {
    inst.setComparisonOptions({ baseline: "visible" });
    inst.addComparison({ name: "AAA", data: line(AAA) });
    const spy = vi.spyOn(inst.comparison, "reapply");

    inst._emitter.emit("rangeChange", {
      min: at(4),
      max: at(9),
      source: "zoom",
    });
    expect(spy).toHaveBeenCalledTimes(1);
    // The same range again is an echo, not a new window.
    inst._emitter.emit("rangeChange", {
      min: at(4),
      max: at(9),
      source: "zoom",
    });
    expect(spy).toHaveBeenCalledTimes(1);
    // A different window is a real change.
    inst._emitter.emit("rangeChange", {
      min: at(6),
      max: at(9),
      source: "pan",
    });
    expect(spy).toHaveBeenCalledTimes(2);
    spy.mockRestore();
  });

  it("only subscribes to rangeChange while the visible baseline needs it", () => {
    expect(inst._emitter.listenerCount("rangeChange")).toBe(0);
    inst.addComparison({ name: "AAA", data: line(AAA) });
    expect(inst._emitter.listenerCount("rangeChange")).toBe(0);

    inst.setComparisonOptions({ baseline: "visible" });
    expect(inst._emitter.listenerCount("rangeChange")).toBe(1);
    // Idempotent: a second patch does not stack subscriptions.
    inst.setComparisonOptions({ baseline: "visible", indexBase: 50 });
    expect(inst._emitter.listenerCount("rangeChange")).toBe(1);

    inst.setComparisonOptions({ baseline: "common" });
    expect(inst._emitter.listenerCount("rangeChange")).toBe(0);
  });

  it("drops the subscription when the last instrument goes", () => {
    inst.setComparisonOptions({ baseline: "visible" });
    inst.addComparison({ name: "AAA", data: line(AAA) });
    expect(inst._emitter.listenerCount("rangeChange")).toBe(1);
    inst.clearComparisons();
    expect(inst._emitter.listenerCount("rangeChange")).toBe(0);
  });

  it("emits comparisonChange with the recomputed leaderboard", () => {
    const seen = [];
    inst.on("comparisonChange", (p) => seen.push(p));

    inst.addComparison({ name: "AAA", data: line(AAA) });
    expect(seen).toHaveLength(1);
    expect(seen[0].reason).toBe("add");
    expect(seen[0].instruments).toEqual(["AAA"]);
    expect(rowOf(seen[0].stats, "AAA").change.percent).toBeCloseTo(175, 10);

    inst.setComparisonMode("indexed");
    expect(seen[1].reason).toBe("mode");
    expect(seen[1].mode).toBe("indexed");

    inst.setComparisonOptions({ baseline: "own" });
    expect(seen[2].reason).toBe("options");
    expect(seen[2].baseline).toBe("own");

    inst.removeComparison("AAA");
    expect(seen[3].reason).toBe("remove");
    expect(seen[3].stats).toEqual([]);
  });

  it("does not build the leaderboard when nothing is subscribed", () => {
    const spy = vi.spyOn(inst.comparison, "getStats");
    inst.addComparison({ name: "AAA", data: line(AAA) });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("reuses one alignment across reapplies and drops it on a data change", () => {
    inst.addComparison({ name: "AAA", data: line(AAA) });
    const first = inst.comparison._derive();
    inst.comparison.reapply();
    expect(inst.comparison._derive()).toBe(first); // memoized
    inst.comparison.invalidate();
    expect(inst.comparison._derive()).not.toBe(first);
  });
});

describe("comparison v2: the visible window survives a rebase", () => {
  let inst;
  beforeEach(() => {
    installApexChartsMock();
    useQuietTimers();
    inst = makeInstance();
  });
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
    delete global.ApexCharts;
  });

  /** Put the chart in a state where `[from, to]` is on screen out of `extent`. */
  const showing = (from, to, extent = [at(0), at(9)]) => {
    const g = inst.chart.w.globals;
    g.minX = from;
    g.maxX = to;
    g.initialMinX = extent[0];
    g.initialMaxX = extent[1];
  };

  it("puts a zoomed window back after the series update drops it", () => {
    showing(at(4), at(7));
    inst.addComparison({ name: "AAA", data: line(AAA) });
    expect(inst.chart.zoomX).toHaveBeenCalledWith(at(4), at(7));
  });

  it("leaves an unzoomed chart alone", () => {
    showing(at(0), at(9));
    inst.addComparison({ name: "AAA", data: line(AAA) });
    // Pinning here would clip an instrument whose history reaches further back
    // than the primary's, which is exactly the view that should widen.
    expect(inst.chart.zoomX).not.toHaveBeenCalled();
  });

  it("restores through zoomX, never as an xaxis in updateOptions", () => {
    // ApexCharts remembers an explicit `xaxis` from an update as `lastXAxis`
    // and re-applies it to a LATER one, so a window pinned that way comes back
    // and overrides a setVisibleRange() made in between.
    showing(at(4), at(7));
    inst.addComparison({ name: "AAA", data: line(AAA) });
    inst.chart.updateOptions.mock.calls.forEach(([o]) => {
      expect(o.xaxis).toBeUndefined();
    });
  });

  it("carries the indicator panes with it, which updateSeries cannot reach", () => {
    showing(at(4), at(7));
    const pane = { zoomX: vi.fn() };
    inst.indicatorChartMap.rsi = pane;
    inst.addComparison({ name: "AAA", data: line(AAA) });
    expect(pane.zoomX).toHaveBeenCalledWith(at(4), at(7));
    delete inst.indicatorChartMap.rsi;
  });

  it("does not undo the very zoom that triggered a visible-baseline rebase", () => {
    inst.setComparisonOptions({ baseline: "visible" });
    inst.addComparison({ name: "AAA", data: line(AAA) });
    inst.chart.zoomX.mockClear();

    // The gesture: the chart is now showing days 4..9, and says so.
    showing(at(4), at(9));
    inst._emitter.emit("rangeChange", {
      min: at(4),
      max: at(9),
      source: "zoom",
    });

    // Rebased to the new left edge, and still showing the window that caused it.
    expect(lineOf(inst, "AAA")[4].y).toBe(0);
    expect(inst.chart.zoomX).toHaveBeenCalledWith(at(4), at(9));
  });
});

describe("comparison v2: rendering contracts and guards", () => {
  let inst;
  beforeEach(() => {
    installApexChartsMock();
    useQuietTimers();
    inst = makeInstance();
  });
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
    delete global.ApexCharts;
  });

  it("labels the secondary axis for the active mode", () => {
    inst.addComparison({ name: "AAA", data: line(AAA) });
    const fmt = () => inst.chart.w.config.yaxis[1].labels.formatter;
    expect(inst.chart.w.config.yaxis[1].title.text).toBe("\u0394 %");
    expect(fmt()(12.345)).toBe("12.3%");
    inst.setComparisonMode("absolute");
    expect(inst.chart.w.config.yaxis[1].title.text).toBe("price");
    expect(fmt()(12.345)).toBe("12.35");
    inst.setComparisonMode("indexed");
    expect(fmt()(112.345)).toBe("112.3");
    inst.setComparisonMode("relative");
    expect(fmt()(-7.89)).toBe("-7.9%");
    inst.setComparisonMode("ratio");
    expect(fmt()(103.45)).toBe("103.5");
  });

  it("suspend() collapses to one axis so series can be added or removed", () => {
    inst.addComparison({ name: "AAA", data: line(AAA) });
    expect(inst.chart.w.config.yaxis).toHaveLength(2);
    inst.comparison.suspend();
    expect(Array.isArray(inst.chart.w.config.yaxis)).toBe(false);
    expect(inst.comparison._rendered.size).toBe(0);
    // Idempotent: nothing rendered, nothing to collapse.
    inst.comparison.suspend();
    expect(Array.isArray(inst.chart.w.config.yaxis)).toBe(false);
  });

  it('resolves the primary series by position, not by the name "Price"', () => {
    const parent = document.createElement("div");
    const container = document.createElement("div");
    parent.appendChild(container);
    document.body.appendChild(parent);
    const renamed = new ApexStock(container, {
      chart: { height: 300 },
      series: [{ name: "AAPL", data: dailyOhlc(PRICE) }],
    });
    expect(renamed.comparison._primaryName()).toBe("AAPL");
    // Before render (and after destroy) the live config is not there to read.
    renamed.chart = null;
    expect(renamed.comparison._primaryName()).toBe("AAPL");
  });

  it("skips malformed points instead of rejecting the instrument", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    inst.setComparisonMode("absolute");
    inst.addComparison({
      name: "AAA",
      data: [
        { x: at(0), y: 10 },
        null,
        { x: "not-a-date", y: 11 },
        { x: at(1) },
        { x: at(2), y: 12 },
      ],
    });
    expect(lineOf(inst, "AAA").map((p) => p.y)).toEqual([10, 12]);
    warn.mockRestore();
  });

  it("says so when nothing lands on the shared grid", () => {
    // Timestamps half a day off the primary's bars, resampling refused: there
    // is no observation to plot.
    const offset = PRICE.map((c, i) => ({ x: at(i) + DAY / 2, y: c / 2 }));
    inst.setComparisonOptions({ join: "primary", resample: false });
    inst.addComparison({ name: "OFF", data: offset });
    expect(lineOf(inst, "OFF")).toEqual([]);
    expect(inst.comparison._derive().warnings.join(" ")).toMatch(
      /no observation on the shared grid/
    );
  });

  it("keeps a benchmark named in options until its instrument arrives", () => {
    const parent = document.createElement("div");
    const container = document.createElement("div");
    parent.appendChild(container);
    document.body.appendChild(parent);
    const cfg = new ApexStock(container, {
      chart: { height: 300 },
      series: [{ name: "Price", data: dailyOhlc(PRICE) }],
      analysis: { comparison: { mode: "relative", benchmark: "BBB" } },
    });
    expect(cfg.getComparisonMode()).toBe("relative");
    expect(cfg.getComparisonBenchmark()).toBe("BBB");

    cfg.addComparison({ name: "AAA", data: line(AAA) });
    // BBB is not there yet: fall back to the primary, and say so.
    expect(cfg.comparison._derive().warnings.join(" ")).toMatch(
      /benchmark "BBB" is not an added instrument/
    );
    // A mode that does not need a benchmark keeps the setting and stays quiet.
    cfg.setComparisonMode("percent");
    expect(cfg.comparison._derive().benchmark).toBe("Price");
    expect(cfg.comparison._derive().warnings.join(" ")).not.toMatch(
      /benchmark/
    );
    cfg.setComparisonMode("relative");

    cfg.addComparison({ name: "BBB", data: line(BBB, 3) });
    expect(cfg.comparison._derive().benchmark).toBe("BBB");
    expect(yAt(cfg, "AAA", 9)).toBeCloseTo(70, 2); // 120 - 50
  });

  it("does not re-enter when a rebase makes the chart report a new range", () => {
    inst.setComparisonOptions({ baseline: "visible" });
    inst.addComparison({ name: "AAA", data: line(AAA) });
    const spy = vi.spyOn(inst.comparison, "reapply");
    // ApexCharts can settle a new x-range while updating series, which comes
    // back as a rangeChange mid-rebase. The re-entrancy guard drops it.
    const update = inst.chart.updateSeries;
    inst.chart.updateSeries = (series) => {
      update(series);
      inst._emitter.emit("rangeChange", {
        min: at(7),
        max: at(9),
        source: "zoom",
      });
    };
    inst._emitter.emit("rangeChange", {
      min: at(4),
      max: at(9),
      source: "zoom",
    });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(yAt(inst, "AAA", 4)).toBe(0); // the requested window, not the echo
    spy.mockRestore();
  });

  it("ignores no-op mutations", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const seen = [];
    inst.on("comparisonChange", (p) => seen.push(p));
    inst.addComparison({ name: "AAA", data: line(AAA) });
    inst.setComparisonMode("percent"); // already the mode
    inst.setComparisonBenchmark("__primary__"); // already the benchmark
    inst.setComparisonOptions({ join: "union" }); // already the value
    inst.setComparisonOptions(null);
    inst.setComparisonOptions({ indexBase: 0 }); // rejected: unusable
    expect(seen).toHaveLength(1);
    expect(inst.getComparisonOptions().indexBase).toBe(100);
    expect(inst.removeComparison("nope")).toBe(false);
    inst.clearComparisons();
    inst.clearComparisons(); // already empty
    expect(seen.map((p) => p.reason)).toEqual(["add", "clear"]);
    warn.mockRestore();
  });

  it("reapplies the benchmark change immediately in relative mode", () => {
    inst.addComparison({ name: "AAA", data: line(AAA) });
    inst.addComparison({ name: "BBB", data: line(BBB, 3) });
    inst.setComparisonMode("relative");
    inst.setComparisonBenchmark("BBB");
    expect(yAt(inst, "AAA", 9)).toBeCloseTo(70, 2);
  });

  it("falls back to the full window for an unparseable from/to", () => {
    inst.addComparison({ name: "AAA", data: line(AAA) });
    const rows = inst.getComparisonStats({ from: "not-a-date" });
    expect(rowOf(rows, "AAA").from).toBe(at(0));
  });

  it("clamps a window past the data and snaps `to` back to a real bar", () => {
    inst.addComparison({ name: "AAA", data: line(AAA) });
    const wide = rowOf(
      inst.getComparisonStats({ from: at(-5), to: at(20) }),
      "AAA"
    );
    expect(wide.from).toBe(at(0));
    expect(wide.to).toBe(at(9));
    // Mid-bar endpoints resolve inward: `to` never reaches past the requested x.
    const mid = rowOf(
      inst.getComparisonStats({ from: at(2) + DAY / 2, to: at(6) + DAY / 2 }),
      "AAA"
    );
    expect(mid.from).toBe(at(3));
    expect(mid.to).toBe(at(6));
  });
});
