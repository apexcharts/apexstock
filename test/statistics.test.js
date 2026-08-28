import { describe, it, expect, vi, afterEach } from "vitest";
import Statistics from "../src/analysis/Statistics.js";
import Utils from "../src/utils/Utils.js";
import { ohlc, dailyOhlc, drawdownSeries, EPOCH } from "./fixtures.js";

const DAY = 86400000;

afterEach(() => {
  vi.restoreAllMocks();
});

/** A rising daily series long enough to annualize: 100 -> 110 over exactly 365 days. */
function yearSeries() {
  const closes = [];
  for (let i = 0; i <= 365; i++) closes.push(100 + (10 * i) / 365);
  return dailyOhlc(closes);
}

describe("Statistics.resolveIndex", () => {
  const series = dailyOhlc([10, 11, 12, 13, 14]);

  it("reads a valid integer index as an index", () => {
    expect(Statistics.resolveIndex(series, 0)).toBe(0);
    expect(Statistics.resolveIndex(series, 3)).toBe(3);
  });

  it("reads an out-of-range number as an x value, nearest bar", () => {
    expect(Statistics.resolveIndex(series, EPOCH + 2 * DAY)).toBe(2);
    // Between bars 1 and 2, slightly closer to 2.
    expect(Statistics.resolveIndex(series, EPOCH + 1.6 * DAY)).toBe(2);
  });

  it("clamps an x value past either end to the nearest bar", () => {
    expect(Statistics.resolveIndex(series, EPOCH - 100 * DAY)).toBe(0);
    expect(Statistics.resolveIndex(series, EPOCH + 100 * DAY)).toBe(4);
  });

  it("resolves a Date and a date string by x", () => {
    expect(Statistics.resolveIndex(series, new Date(EPOCH + 3 * DAY))).toBe(3);
    expect(Statistics.resolveIndex(series, "2024-01-03T00:00:00Z")).toBe(2);
  });

  it('honors an explicit by: "x" for a number that is also a valid index', () => {
    const cats = ohlc([10, 11, 12, 13, 14]); // x values are 1..5
    expect(Statistics.resolveIndex(cats, 3, { by: "index" })).toBe(3);
    expect(Statistics.resolveIndex(cats, 3, { by: "x" })).toBe(2); // x=3 is bar 2
  });

  it("warns when a number is ambiguous, and reads it as an index", () => {
    const cats = ohlc([10, 11, 12, 13, 14]); // x values are 1..5
    const warnings = [];
    expect(Statistics.resolveIndex(cats, 3, {}, warnings)).toBe(3);
    expect(warnings.join(" ")).toMatch(/both a valid bar index and an x value/);
  });

  it('coerces a numeric string under by: "index"', () => {
    expect(Statistics.resolveIndex(series, "3", { by: "index" })).toBe(3);
    expect(Statistics.resolveIndex(series, 99, { by: "index" })).toBe(4); // clamped
    expect(Statistics.resolveIndex(series, "nope", { by: "index" })).toBe(-1);
  });

  it("returns -1 for an empty series or an unparseable reference", () => {
    expect(Statistics.resolveIndex([], 0)).toBe(-1);
    expect(Statistics.resolveIndex(series, "not a date")).toBe(-1);
  });
});

describe("Statistics.returns", () => {
  it("computes simple returns in percent, with a null first bar", () => {
    const { values, mode } = Statistics.returns(ohlc([100, 110, 99]), {
      mode: "simple",
    });
    expect(mode).toBe("simple");
    expect(values[0]).toBeNull();
    expect(values[1]).toBeCloseTo(10, 10);
    expect(values[2]).toBeCloseTo(-10, 10);
  });

  it("computes log returns in percent and defaults to them", () => {
    const { values, mode } = Statistics.returns(ohlc([100, 110]));
    expect(mode).toBe("log");
    expect(values[1]).toBeCloseTo(Math.log(1.1) * 100, 10);
  });

  it("emits points aligned to the series x values", () => {
    const series = dailyOhlc([100, 110]);
    const { points } = Statistics.returns(series);
    expect(points[0]).toEqual({ x: series[0].x, y: null });
    expect(points[1].x).toBe(series[1].x);
  });

  it("nulls a return whose previous close is missing or non-positive", () => {
    const { values } = Statistics.returns(ohlc([0, 110, 120]));
    expect(values[1]).toBeNull(); // previous close is 0
    expect(values[2]).toBeCloseTo(Math.log(120 / 110) * 100, 10);
  });

  it("memoizes per series identity, mode, and source", () => {
    const series = ohlc([100, 110]);
    expect(Statistics.returns(series)).toBe(Statistics.returns(series));
    expect(Statistics.returns(series, { mode: "simple" })).not.toBe(
      Statistics.returns(series)
    );
    const before = Statistics.returns(series);
    Statistics.invalidate(series);
    expect(Statistics.returns(series)).not.toBe(before);
  });
});

describe("Statistics.inferPeriodsPerYear", () => {
  it("infers 252 for daily bars, including weekend gaps", () => {
    // Mon..Fri then a 3-day jump, so the median spacing is still one day.
    const series = dailyOhlc([1, 2, 3, 4, 5, 6, 7]);
    series[5].x = series[4].x + 3 * DAY;
    series[6].x = series[5].x + DAY;
    const out = Statistics.inferPeriodsPerYear(series);
    expect(out.periodsPerYear).toBe(252);
    expect(out.label).toBe("daily");
  });

  it("infers 52 for weekly and 12 for monthly bars", () => {
    expect(
      Statistics.inferPeriodsPerYear(dailyOhlc([1, 2, 3], { stepMs: 7 * DAY }))
        .periodsPerYear
    ).toBe(52);
    expect(
      Statistics.inferPeriodsPerYear(dailyOhlc([1, 2, 3], { stepMs: 30 * DAY }))
        .periodsPerYear
    ).toBe(12);
  });

  it("refuses to guess for intraday bars", () => {
    const out = Statistics.inferPeriodsPerYear(
      dailyOhlc([1, 2, 3], { stepMs: 60000 })
    );
    expect(out.periodsPerYear).toBeNull();
    expect(out.label).toBe("intraday");
  });

  it("reports unknown when there is no usable spacing", () => {
    expect(Statistics.inferPeriodsPerYear([]).periodsPerYear).toBeNull();
    expect(Statistics.inferPeriodsPerYear(ohlc([1])).label).toBe("unknown");
  });
});

describe("Statistics.volatility", () => {
  it("is exactly zero for a constant compounding rate", () => {
    // Two identical log returns -> no dispersion.
    const vol = Statistics.volatility(ohlc([100, 110, 121]), 0, 2);
    expect(vol.stdev).toBeCloseTo(0, 10);
  });

  it("matches a hand-computed sample standard deviation", () => {
    // Log returns: +ln(1.1), -ln(1.1) (in percent). Mean 0, so the sample
    // stdev over 2 observations is |r| * sqrt(2).
    const r = Math.log(1.1) * 100;
    const vol = Statistics.volatility(ohlc([100, 110, 100]), 0, 2);
    expect(vol.stdev).toBeCloseTo(r * Math.SQRT2, 10);
  });

  it("uses only the returns inside the range, never reaching back before it", () => {
    // Bars 2..4 of a series whose earlier bars are far more volatile.
    const series = ohlc([100, 200, 100, 110, 121]);
    const inside = Statistics.volatility(series, 2, 4);
    expect(inside.stdev).toBeCloseTo(0, 10); // 100 -> 110 -> 121 is constant
  });

  it("annualizes by sqrt(periodsPerYear) and reports the convention", () => {
    const vol = Statistics.volatility(dailyOhlc([100, 110, 100]), 0, 2, {
      periodsPerYear: 252,
    });
    expect(vol.periodsPerYear).toBe(252);
    expect(vol.inferred).toBe(false);
    expect(vol.annualized).toBeCloseTo(vol.stdev * Math.sqrt(252), 10);
  });

  it("infers the convention from daily spacing and says it inferred it", () => {
    const warnings = [];
    const vol = Statistics.volatility(
      dailyOhlc([100, 110, 100]),
      0,
      2,
      {},
      warnings
    );
    expect(vol.periodsPerYear).toBe(252);
    expect(vol.inferred).toBe(true);
    expect(warnings.join(" ")).toMatch(/periodsPerYear inferred as 252/);
  });

  it("omits the annualized figure for intraday data and explains why", () => {
    const warnings = [];
    const vol = Statistics.volatility(
      dailyOhlc([100, 110, 100], { stepMs: 60000 }),
      0,
      2,
      {},
      warnings
    );
    expect(vol.stdev).toBeGreaterThan(0);
    expect(vol.annualized).toBeNull();
    expect(warnings.join(" ")).toMatch(/cannot infer a periods-per-year/);
  });

  it("returns null when the range holds fewer than two returns", () => {
    const warnings = [];
    expect(
      Statistics.volatility(ohlc([100, 110]), 0, 1, {}, warnings)
    ).toBeNull();
    expect(warnings.join(" ")).toMatch(/at least two returns/);
  });
});

describe("Statistics.annualize", () => {
  it("compounds a total return over the calendar span", () => {
    // +21% over 730 days is (1.21 ^ (365/730)) - 1 = 10% a year.
    expect(Statistics.annualize(21, 730).return).toBeCloseTo(10, 10);
    expect(Statistics.annualize(21, 730).basis).toBe("calendar");
  });

  it("is the identity over exactly one year", () => {
    expect(Statistics.annualize(10, 365).return).toBeCloseTo(10, 10);
  });

  it("refuses to extrapolate a span under the minimum", () => {
    const warnings = [];
    expect(Statistics.annualize(5, 3, {}, warnings)).toBeNull();
    expect(warnings.join(" ")).toMatch(/under the 30-day minimum/);
  });

  it("honors a custom minimum", () => {
    expect(Statistics.annualize(5, 3, { minAnnualizeDays: 1 })).not.toBeNull();
  });

  it("refuses a zero or negative span, and a total loss, and says why", () => {
    const spanWarnings = [];
    expect(Statistics.annualize(5, 0, {}, spanWarnings)).toBeNull();
    expect(Statistics.annualize(5, null)).toBeNull();
    expect(spanWarnings.join(" ")).toMatch(/no measurable time span/);

    const lossWarnings = [];
    expect(Statistics.annualize(-100, 365, {}, lossWarnings)).toBeNull();
    expect(Statistics.annualize(-120, 365)).toBeNull();
    expect(lossWarnings.join(" ")).toMatch(/cannot be compounded/);
  });
});

describe("Statistics.rangeStats", () => {
  const series = drawdownSeries(); // 100 110 120 90 80 95 121 115, daily

  it("reports the anchors and the change between them", () => {
    const st = Statistics.rangeStats(series, 0, 7);
    expect(st.from).toEqual({ index: 0, x: series[0].x, value: 100 });
    expect(st.to).toEqual({ index: 7, x: series[7].x, value: 115 });
    expect(st.change.absolute).toBe(15);
    expect(st.change.percent).toBeCloseTo(15, 10);
  });

  it("matches the brief's worked example", () => {
    // 142 -> 171 is +29 and +20.42%.
    const s = dailyOhlc([142, 150, 160, 171]);
    const st = Statistics.rangeStats(s, 0, 3);
    expect(st.change.absolute).toBe(29);
    expect(st.change.percent).toBeCloseTo(20.42, 2);
    expect(st.bars).toBe(4);
  });

  it("counts bars inclusively and calls them bars", () => {
    expect(Statistics.rangeStats(series, 0, 7).bars).toBe(8);
    expect(Statistics.rangeStats(series, 3, 3).bars).toBe(1);
  });

  it("classifies each bar as up, down, or flat against the previous one", () => {
    const st = Statistics.rangeStats(series, 0, 7);
    // 110>100, 120>110, 90<120, 80<90, 95>80, 121>95, 115<121
    expect(st.upBars).toBe(4);
    expect(st.downBars).toBe(3);
    expect(st.flatBars).toBe(0);
    expect(st.upBars + st.downBars + st.flatBars).toBe(st.bars - 1);
  });

  it("counts an unchanged close as a flat bar", () => {
    const st = Statistics.rangeStats(dailyOhlc([100, 100, 105, 105, 99]), 0, 4);
    expect(st.flatBars).toBe(2);
    expect(st.upBars).toBe(1);
    expect(st.downBars).toBe(1);
  });

  it("measures the calendar span from the x values", () => {
    const st = Statistics.rangeStats(series, 0, 7);
    expect(st.spanMs).toBe(7 * DAY);
    expect(st.calendarDays).toBeCloseTo(7, 10);
  });

  it("takes the high and low from the true bar extremes, not the closes", () => {
    const s = dailyOhlc([100, 105], { highs: [200, 106], lows: [99, 5] });
    const st = Statistics.rangeStats(s, 0, 1);
    expect(st.high).toEqual({ value: 200, index: 0, x: s[0].x });
    expect(st.low).toEqual({ value: 5, index: 1, x: s[1].x });
  });

  it("averages the close and the volume, and totals the volume", () => {
    const st = Statistics.rangeStats(series, 0, 7);
    expect(st.average.close).toBeCloseTo(831 / 8, 10);
    expect(st.average.volume).toBe(100); // the fixture default
    expect(st.total.volume).toBe(800);
  });

  it("omits the volume figures, with a warning, when no bar carries one", () => {
    const s = dailyOhlc([100, 110]).map(({ x, y }) => ({ x, y }));
    const st = Statistics.rangeStats(s, 0, 1);
    expect(st.average.volume).toBeNull();
    expect(st.total.volume).toBeNull();
    expect(st.warnings.join(" ")).toMatch(/no bar in the range carries a/);
  });

  it("annualizes a year-long range and refuses a short one", () => {
    const st = Statistics.rangeStats(yearSeries(), 0, 365);
    expect(st.calendarDays).toBeCloseTo(365, 10);
    expect(st.annualized.return).toBeCloseTo(10, 6);

    const short = Statistics.rangeStats(series, 0, 7);
    expect(short.annualized).toBeNull();
    expect(short.warnings.join(" ")).toMatch(/under the 30-day minimum/);
  });

  it("computes the drawdown within the range, resetting the peak at the start", () => {
    const full = Statistics.rangeStats(series, 0, 7);
    expect(full.drawdown.max).toBeCloseTo(((80 - 120) / 120) * 100, 10);
    expect(full.drawdown.peak.index).toBe(2);
    expect(full.drawdown.trough.index).toBe(4);
    expect(full.drawdown.recovery.index).toBe(6);
    expect(full.drawdown.barsToTrough).toBe(2);
    expect(full.drawdown.barsToRecovery).toBe(2);
    expect(full.drawdown.barsUnderwater).toBe(4);
    expect(full.drawdown.recovered).toBe(true);

    // A window starting at bar 3 cannot see the 120 peak that preceded it.
    const windowed = Statistics.rangeStats(series, 3, 7);
    expect(windowed.drawdown.max).toBeCloseTo(((80 - 90) / 90) * 100, 10);
  });

  it("reports a zero drawdown, not null, for a range that only rose", () => {
    const st = Statistics.rangeStats(series, 0, 2);
    expect(st.drawdown.max).toBe(0);
    expect(st.drawdown.peak).toBeNull();
    expect(st.drawdown.recovered).toBe(true);
  });

  it("flags an unrecovered drawdown", () => {
    const st = Statistics.rangeStats(dailyOhlc([100, 120, 80]), 0, 2);
    expect(st.drawdown.recovered).toBe(false);
    expect(st.drawdown.recovery).toBeNull();
    expect(st.drawdown.barsToRecovery).toBeNull();
  });

  it("accepts the endpoints in either order", () => {
    expect(Statistics.rangeStats(series, 7, 0)).toEqual(
      Statistics.rangeStats(series, 0, 7)
    );
  });

  it("accepts timestamps, Dates, and date strings as endpoints", () => {
    const byIndex = Statistics.rangeStats(series, 0, 7);
    expect(Statistics.rangeStats(series, series[0].x, series[7].x)).toEqual(
      byIndex
    );
    expect(
      Statistics.rangeStats(
        series,
        new Date(series[0].x),
        new Date(series[7].x)
      )
    ).toEqual(byIndex);
    expect(
      Statistics.rangeStats(
        series,
        "2024-01-01T00:00:00Z",
        "2024-01-08T00:00:00Z"
      )
    ).toEqual(byIndex);
  });

  it("reads the configured source field", () => {
    const s = dailyOhlc([100, 110], { opens: [50, 60] });
    const st = Statistics.rangeStats(s, 0, 1, { source: "open" });
    expect(st.from.value).toBe(50);
    expect(st.to.value).toBe(60);
    expect(st.basis.source).toBe("open");
  });

  it("reports the drawdown basis it used", () => {
    expect(Statistics.rangeStats(series, 0, 7).basis.drawdown).toBe("close");
    expect(
      Statistics.rangeStats(series, 0, 7, { drawdownBasis: "intrabar" }).basis
        .drawdown
    ).toBe("intrabar");
  });

  it("returns null for an empty series, and warns", () => {
    const warn = vi.spyOn(Utils, "warn").mockImplementation(() => {});
    expect(Statistics.rangeStats([], 0, 1)).toBeNull();
    expect(warn).not.toHaveBeenCalled(); // empty series is not a caller error
    expect(Statistics.rangeStats(series, "nope", 3)).toBeNull();
    expect(warn).toHaveBeenCalled();
  });

  it("returns null when the endpoints have no usable value", () => {
    const warn = vi.spyOn(Utils, "warn").mockImplementation(() => {});
    const s = [{ x: EPOCH, y: [NaN, NaN, NaN, NaN] }];
    expect(Statistics.rangeStats(s, 0, 0)).toBeNull();
    expect(warn).toHaveBeenCalled();
  });

  it("leaves percent null, with a warning, when the range starts at zero", () => {
    const st = Statistics.rangeStats(dailyOhlc([0, 10]), 0, 1);
    expect(st.change.absolute).toBe(10);
    expect(st.change.percent).toBeNull();
    expect(st.annualized).toBeNull();
    expect(st.warnings.join(" ")).toMatch(/starts at zero/);
  });

  it("handles a single-bar range without dividing by zero", () => {
    const st = Statistics.rangeStats(series, 4, 4);
    expect(st.bars).toBe(1);
    expect(st.change).toEqual({ absolute: 0, percent: 0 });
    expect(st.spanMs).toBe(0);
    expect(st.volatility).toBeNull();
    expect(st.upBars).toBe(0);
  });
});

describe("Statistics namespace re-exports", () => {
  it("exposes drawdown, align, rebase, relative, and baseline", () => {
    const series = drawdownSeries();
    expect(Statistics.drawdown(series).max).toBeLessThan(0);

    const aligned = Statistics.align({ A: series });
    expect(aligned.x).toHaveLength(series.length);
    expect(Statistics.rebase(aligned).columns.A[0]).toBe(0);
    expect(Statistics.baseline(aligned).index).toBe(0);
    expect(Statistics.relative(aligned, "A", "A").values[3]).toBeCloseTo(0, 10);
  });
});
