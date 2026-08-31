export default class Statistics {
    /**
     * Drop cached statistics for `series`. Required because the `appendData()`
     * path mutates the series array in place, so identity alone would keep
     * serving a stale result. Also clears the drawdown memo for the same series.
     * @param {*} series
     * @returns {void}
     */
    static invalidate(series: any): void;
    /**
     * Resolve a caller's range endpoint to a bar index.
     *
     * A `Date` or a date string is always resolved by x (nearest bar). A **number
     * is a bar index when it is a valid integer index**, and an x value
     * otherwise, which is unambiguous in practice: epoch-ms timestamps are orders
     * of magnitude larger than any bar count. The one genuinely ambiguous case is
     * a small-integer category axis (x values of `1..N`), where the index reading
     * wins and a warning says so. Pass `by: "index"` or `by: "x"` to remove all
     * doubt.
     *
     * @param {import("../types.js").Series} series
     * @param {number|string|Date} ref
     * @param {{by?: "auto"|"index"|"x"}} [opts]
     * @param {string[]} [warnings] - Collected ambiguity notes, if provided.
     * @returns {number} A clamped bar index, or -1 when the series is empty or
     *   `ref` is unusable.
     */
    static resolveIndex(series: import("../types.js").Series, ref: number | string | Date, opts?: {
        by?: "auto" | "index" | "x";
    }, warnings?: string[]): number;
    /**
     * Nearest bar to an x value. Nearest, never interpolated: every statistic is
     * anchored to a bar that actually exists.
     * @param {import("../types.js").Series} s
     * @param {number} target
     * @returns {number}
     * @private
     */
    private static _nearestByX;
    /**
     * Per-bar returns, index-aligned to the series (index 0 is always null: a
     * return needs a previous bar).
     *
     * `"log"` (the default) is the right basis for volatility, because log
     * returns are additive over time; `"simple"` is the right basis for anything
     * a human reads as "it went up 5%".
     *
     * @param {import("../types.js").Series} series
     * @param {{mode?: "log"|"simple", source?: "close"|"open"|"high"|"low"}} [opts]
     * @returns {{mode:string, source:string, values:Array<number|null>, points:Array<{x:*, y:number|null}>}}
     */
    static returns(series: import("../types.js").Series, opts?: {
        mode?: "log" | "simple";
        source?: "close" | "open" | "high" | "low";
    }): {
        mode: string;
        source: string;
        values: Array<number | null>;
        points: Array<{
            x: any;
            y: number | null;
        }>;
    };
    /**
     * How many bars make up a year, inferred from the median bar spacing.
     *
     * Returns null for intraday spacing on purpose: annualizing an intraday
     * volatility requires knowing the session length (6.5h equity session? 24h
     * crypto?), and guessing would produce a number that looks authoritative and
     * is not. Supply `periodsPerYear` for intraday data.
     *
     * @param {import("../types.js").Series} series
     * @returns {{periodsPerYear:number|null, spacingMs:number|null, label:string}}
     */
    static inferPeriodsPerYear(series: import("../types.js").Series): {
        periodsPerYear: number | null;
        spacingMs: number | null;
        label: string;
    };
    /**
     * Volatility over a closed bar range: the sample standard deviation of the
     * log returns *inside* the range (so a range of N bars uses N-1 returns and
     * never reaches back before `from`).
     *
     * @param {import("../types.js").Series} series
     * @param {number} from - Inclusive start index.
     * @param {number} to - Inclusive end index.
     * @param {{periodsPerYear?:number, source?:string}} [opts]
     * @param {string[]} [warnings]
     * @returns {VolatilityResult|null} null when the range holds fewer than two
     *   usable returns.
     */
    static volatility(series: import("../types.js").Series, from: number, to: number, opts?: {
        periodsPerYear?: number;
        source?: string;
    }, warnings?: string[]): VolatilityResult | null;
    /**
     * Annualize a total percent return over a calendar span.
     * @param {number} totalPercent - e.g. 20.4 for +20.4%.
     * @param {number} calendarDays
     * @param {{minAnnualizeDays?:number}} [opts]
     * @param {string[]} [warnings]
     * @returns {{return:number, basis:"calendar"}|null}
     */
    static annualize(totalPercent: number, calendarDays: number, opts?: {
        minAnnualizeDays?: number;
    }, warnings?: string[]): {
        return: number;
        basis: "calendar";
    } | null;
    /**
     * Every statistic for a selected region of the chart, in one object. This is
     * what the measurement readout renders and what `getRangeStats()` returns.
     *
     * `from` and `to` may be given in either order (they are normalized) as a bar
     * index, an epoch-ms x value, a `Date`, or a date string. See
     * {@link Statistics.resolveIndex} for how a bare number is read.
     *
     * @param {import("../types.js").Series} series
     * @param {number|string|Date} from
     * @param {number|string|Date} to
     * @param {Object} [opts]
     * @param {"close"|"open"|"high"|"low"} [opts.source="close"] - Which field the
     *   anchors, the change, and the averages read.
     * @param {"close"|"intrabar"} [opts.drawdownBasis="close"] - See {@link Drawdown}.
     * @param {number} [opts.periodsPerYear] - Annualization convention for volatility.
     * @param {number} [opts.minAnnualizeDays=30]
     * @param {"auto"|"index"|"x"} [opts.by="auto"] - How to read numeric endpoints.
     * @returns {RangeStats|null} null when the series is empty or the endpoints
     *   cannot be resolved.
     */
    static rangeStats(series: import("../types.js").Series, from: number | string | Date, to: number | string | Date, opts?: {
        source?: "close" | "open" | "high" | "low";
        drawdownBasis?: "close" | "intrabar";
        periodsPerYear?: number;
        minAnnualizeDays?: number;
        by?: "auto" | "index" | "x";
    }): RangeStats | null;
    /** @see Drawdown.compute */
    static drawdown(series: any, opts: any): import("./Drawdown").DrawdownResult;
    /** @see Align.align */
    static align(instruments: any, opts: any): import("./Align").AlignResult;
    /** @see Align.rebase */
    static rebase(aligned: any, opts: any): {
        mode: string;
        columns: {
            [x: string]: number[];
        };
        baseline: object;
        warnings: string[];
    };
    /** @see Align.relative */
    static relative(aligned: any, name: any, benchmark: any, opts: any): {
        mode: string;
        values: Array<number | null>;
        warnings: string[];
    };
    /** @see Align.baseline */
    static baseline(aligned: any, policy: any, opts: any): {
        policy: string;
        index: number | null;
        perInstrument: {
            [x: string]: number;
        };
        warnings: string[];
    };
    /** @private */
    private static _cacheGet;
    /** @private */
    private static _cacheSet;
}
/**
 * Statistics: window statistics over an OHLC(V) series.
 *
 * This is the engine behind every number ApexStock's analysis surfaces show.
 * It is pure (no DOM, no chart) and memoized on series identity exactly like
 * {@link  ../indicators/Indicators.js Indicators}, so it can be used headlessly:
 * `ApexStock.stats.rangeStats(series, from, to)` works in Node with no chart at
 * all, which is how a server-rendered report or a test would use it.
 *
 * ## Two contracts worth reading before using the output
 *
 * **1. Values are unrounded.** Statistics are returned as plain numbers with no
 * formatting and no rounding, so they stay faithful; the presentation layer
 * formats. (Same contract as {@link  ../core/DataReadout.js DataReadout}, and
 * deliberately unlike the indicator math, which truncates to 2dp for display.)
 *
 * **2. Every percent-like value is in percent units.** `change.percent` of
 * `20.42` means +20.42%, `drawdown.max` of `-27.4` means 27.4% below the peak,
 * and `volatility.stdev` is a percentage too. There are no fractions mixed in
 * with percentages anywhere in this module.
 *
 * ## And one about honesty
 *
 * Anything that cannot be computed from the data given is `null`, never `0` and
 * never `NaN`, and every assumption the engine had to make lands in
 * `warnings`. Two cases matter in practice:
 *
 * - **Annualization** needs a real time span. A 3-day move extrapolated to a
 *   yearly figure is a meaningless (and dangerously plausible) number, so
 *   `annualized` is null below `minAnnualizeDays` (default 30).
 * - **Trading sessions.** ApexStock counts *bars*, and calls them bars. A true
 *   trading-session count needs a per-exchange holiday calendar, which this
 *   library does not own and will not guess. Anything that needs a
 *   bars-per-year convention takes `periodsPerYear`, inferred from the bar
 *   spacing when it can be (daily/weekly/monthly) and left null with a warning
 *   when it cannot (intraday, where the answer depends on session length).
 */
export type RangeAnchor = {
    /**
     * - Bar index.
     */
    index: number;
    /**
     * - The bar's x value.
     */
    x: number | string | Date;
    /**
     * - The price at the anchor (per `basis.source`).
     */
    value: number;
};
/**
 * Statistics: window statistics over an OHLC(V) series.
 *
 * This is the engine behind every number ApexStock's analysis surfaces show.
 * It is pure (no DOM, no chart) and memoized on series identity exactly like
 * {@link  ../indicators/Indicators.js Indicators}, so it can be used headlessly:
 * `ApexStock.stats.rangeStats(series, from, to)` works in Node with no chart at
 * all, which is how a server-rendered report or a test would use it.
 *
 * ## Two contracts worth reading before using the output
 *
 * **1. Values are unrounded.** Statistics are returned as plain numbers with no
 * formatting and no rounding, so they stay faithful; the presentation layer
 * formats. (Same contract as {@link  ../core/DataReadout.js DataReadout}, and
 * deliberately unlike the indicator math, which truncates to 2dp for display.)
 *
 * **2. Every percent-like value is in percent units.** `change.percent` of
 * `20.42` means +20.42%, `drawdown.max` of `-27.4` means 27.4% below the peak,
 * and `volatility.stdev` is a percentage too. There are no fractions mixed in
 * with percentages anywhere in this module.
 *
 * ## And one about honesty
 *
 * Anything that cannot be computed from the data given is `null`, never `0` and
 * never `NaN`, and every assumption the engine had to make lands in
 * `warnings`. Two cases matter in practice:
 *
 * - **Annualization** needs a real time span. A 3-day move extrapolated to a
 *   yearly figure is a meaningless (and dangerously plausible) number, so
 *   `annualized` is null below `minAnnualizeDays` (default 30).
 * - **Trading sessions.** ApexStock counts *bars*, and calls them bars. A true
 *   trading-session count needs a per-exchange holiday calendar, which this
 *   library does not own and will not guess. Anything that needs a
 *   bars-per-year convention takes `periodsPerYear`, inferred from the bar
 *   spacing when it can be (daily/weekly/monthly) and left null with a warning
 *   when it cannot (intraday, where the answer depends on session length).
 */
export type Extreme = {
    value: number;
    index: number;
    x: number | string | Date;
};
/**
 * Statistics: window statistics over an OHLC(V) series.
 *
 * This is the engine behind every number ApexStock's analysis surfaces show.
 * It is pure (no DOM, no chart) and memoized on series identity exactly like
 * {@link  ../indicators/Indicators.js Indicators}, so it can be used headlessly:
 * `ApexStock.stats.rangeStats(series, from, to)` works in Node with no chart at
 * all, which is how a server-rendered report or a test would use it.
 *
 * ## Two contracts worth reading before using the output
 *
 * **1. Values are unrounded.** Statistics are returned as plain numbers with no
 * formatting and no rounding, so they stay faithful; the presentation layer
 * formats. (Same contract as {@link  ../core/DataReadout.js DataReadout}, and
 * deliberately unlike the indicator math, which truncates to 2dp for display.)
 *
 * **2. Every percent-like value is in percent units.** `change.percent` of
 * `20.42` means +20.42%, `drawdown.max` of `-27.4` means 27.4% below the peak,
 * and `volatility.stdev` is a percentage too. There are no fractions mixed in
 * with percentages anywhere in this module.
 *
 * ## And one about honesty
 *
 * Anything that cannot be computed from the data given is `null`, never `0` and
 * never `NaN`, and every assumption the engine had to make lands in
 * `warnings`. Two cases matter in practice:
 *
 * - **Annualization** needs a real time span. A 3-day move extrapolated to a
 *   yearly figure is a meaningless (and dangerously plausible) number, so
 *   `annualized` is null below `minAnnualizeDays` (default 30).
 * - **Trading sessions.** ApexStock counts *bars*, and calls them bars. A true
 *   trading-session count needs a per-exchange holiday calendar, which this
 *   library does not own and will not guess. Anything that needs a
 *   bars-per-year convention takes `periodsPerYear`, inferred from the bar
 *   spacing when it can be (daily/weekly/monthly) and left null with a warning
 *   when it cannot (intraday, where the answer depends on session length).
 */
export type VolatilityResult = {
    /**
     * - Sample standard deviation of per-bar log returns,
     * in percent.
     */
    stdev: number;
    /**
     * - `stdev * sqrt(periodsPerYear)`, or null
     * when no periods-per-year convention is available.
     */
    annualized: number | null;
    periodsPerYear: number | null;
    /**
     * - True when `periodsPerYear` was inferred from
     * the bar spacing rather than supplied.
     */
    inferred: boolean;
};
/**
 * Statistics: window statistics over an OHLC(V) series.
 *
 * This is the engine behind every number ApexStock's analysis surfaces show.
 * It is pure (no DOM, no chart) and memoized on series identity exactly like
 * {@link  ../indicators/Indicators.js Indicators}, so it can be used headlessly:
 * `ApexStock.stats.rangeStats(series, from, to)` works in Node with no chart at
 * all, which is how a server-rendered report or a test would use it.
 *
 * ## Two contracts worth reading before using the output
 *
 * **1. Values are unrounded.** Statistics are returned as plain numbers with no
 * formatting and no rounding, so they stay faithful; the presentation layer
 * formats. (Same contract as {@link  ../core/DataReadout.js DataReadout}, and
 * deliberately unlike the indicator math, which truncates to 2dp for display.)
 *
 * **2. Every percent-like value is in percent units.** `change.percent` of
 * `20.42` means +20.42%, `drawdown.max` of `-27.4` means 27.4% below the peak,
 * and `volatility.stdev` is a percentage too. There are no fractions mixed in
 * with percentages anywhere in this module.
 *
 * ## And one about honesty
 *
 * Anything that cannot be computed from the data given is `null`, never `0` and
 * never `NaN`, and every assumption the engine had to make lands in
 * `warnings`. Two cases matter in practice:
 *
 * - **Annualization** needs a real time span. A 3-day move extrapolated to a
 *   yearly figure is a meaningless (and dangerously plausible) number, so
 *   `annualized` is null below `minAnnualizeDays` (default 30).
 * - **Trading sessions.** ApexStock counts *bars*, and calls them bars. A true
 *   trading-session count needs a per-exchange holiday calendar, which this
 *   library does not own and will not guess. Anything that needs a
 *   bars-per-year convention takes `periodsPerYear`, inferred from the bar
 *   spacing when it can be (daily/weekly/monthly) and left null with a warning
 *   when it cannot (intraday, where the answer depends on session length).
 */
export type RangeDrawdown = {
    /**
     * - Deepest drawdown in the range, in percent (<= 0).
     */
    max: number | null;
    peak: RangeAnchor | null;
    trough: RangeAnchor | null;
    /**
     * - Null while still underwater.
     */
    recovery: RangeAnchor | null;
    /**
     * - Peak to trough (the decline).
     */
    barsToTrough: number | null;
    /**
     * - Trough back to the old peak.
     */
    barsToRecovery: number | null;
    /**
     * - Peak to recovery (whole episode).
     */
    barsUnderwater: number | null;
    recovered: boolean;
};
/**
 * Statistics: window statistics over an OHLC(V) series.
 *
 * This is the engine behind every number ApexStock's analysis surfaces show.
 * It is pure (no DOM, no chart) and memoized on series identity exactly like
 * {@link  ../indicators/Indicators.js Indicators}, so it can be used headlessly:
 * `ApexStock.stats.rangeStats(series, from, to)` works in Node with no chart at
 * all, which is how a server-rendered report or a test would use it.
 *
 * ## Two contracts worth reading before using the output
 *
 * **1. Values are unrounded.** Statistics are returned as plain numbers with no
 * formatting and no rounding, so they stay faithful; the presentation layer
 * formats. (Same contract as {@link  ../core/DataReadout.js DataReadout}, and
 * deliberately unlike the indicator math, which truncates to 2dp for display.)
 *
 * **2. Every percent-like value is in percent units.** `change.percent` of
 * `20.42` means +20.42%, `drawdown.max` of `-27.4` means 27.4% below the peak,
 * and `volatility.stdev` is a percentage too. There are no fractions mixed in
 * with percentages anywhere in this module.
 *
 * ## And one about honesty
 *
 * Anything that cannot be computed from the data given is `null`, never `0` and
 * never `NaN`, and every assumption the engine had to make lands in
 * `warnings`. Two cases matter in practice:
 *
 * - **Annualization** needs a real time span. A 3-day move extrapolated to a
 *   yearly figure is a meaningless (and dangerously plausible) number, so
 *   `annualized` is null below `minAnnualizeDays` (default 30).
 * - **Trading sessions.** ApexStock counts *bars*, and calls them bars. A true
 *   trading-session count needs a per-exchange holiday calendar, which this
 *   library does not own and will not guess. Anything that needs a
 *   bars-per-year convention takes `periodsPerYear`, inferred from the bar
 *   spacing when it can be (daily/weekly/monthly) and left null with a warning
 *   when it cannot (intraday, where the answer depends on session length).
 */
export type RangeStats = {
    from: RangeAnchor;
    to: RangeAnchor;
    change: {
        absolute: number;
        percent: number;
    };
    /**
     * - Inclusive bar count. Bars, not trading sessions.
     */
    bars: number;
    /**
     * - Bars that closed above the previous bar.
     */
    upBars: number;
    downBars: number;
    flatBars: number;
    /**
     * - `to.x - from.x` when x is numeric.
     */
    spanMs: number | null;
    /**
     * - `spanMs` in days.
     */
    calendarDays: number | null;
    annualized: {
        return: number;
        basis: "calendar";
    } | null;
    /**
     * - True high over the range (from `y[1]`).
     */
    high: Extreme | null;
    /**
     * - True low over the range (from `y[2]`).
     */
    low: Extreme | null;
    average: {
        close: number | null;
        volume: number | null;
    };
    total: {
        volume: number | null;
    };
    volatility: VolatilityResult | null;
    drawdown: RangeDrawdown;
    basis: {
        source: string;
        drawdown: string;
    };
    warnings: string[];
};
