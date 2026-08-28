import Utils from "../utils/Utils";
import Drawdown from "./Drawdown";
import Align from "./Align";

/**
 * Statistics: window statistics over an OHLC(V) series.
 *
 * This is the engine behind every number ApexStock's analysis surfaces show.
 * It is pure (no DOM, no chart) and memoized on series identity exactly like
 * {@link ../indicators/Indicators.js Indicators}, so it can be used headlessly:
 * `ApexStock.stats.rangeStats(series, from, to)` works in Node with no chart at
 * all, which is how a server-rendered report or a test would use it.
 *
 * ## Two contracts worth reading before using the output
 *
 * **1. Values are unrounded.** Statistics are returned as plain numbers with no
 * formatting and no rounding, so they stay faithful; the presentation layer
 * formats. (Same contract as {@link ../core/DataReadout.js DataReadout}, and
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
 *
 * @typedef {Object} RangeAnchor
 * @property {number} index - Bar index.
 * @property {number|string|Date} x - The bar's x value.
 * @property {number} value - The price at the anchor (per `basis.source`).
 *
 * @typedef {Object} Extreme
 * @property {number} value
 * @property {number} index
 * @property {number|string|Date} x
 *
 * @typedef {Object} VolatilityResult
 * @property {number} stdev - Sample standard deviation of per-bar log returns,
 *   in percent.
 * @property {number|null} annualized - `stdev * sqrt(periodsPerYear)`, or null
 *   when no periods-per-year convention is available.
 * @property {number|null} periodsPerYear
 * @property {boolean} inferred - True when `periodsPerYear` was inferred from
 *   the bar spacing rather than supplied.
 *
 * @typedef {Object} RangeDrawdown
 * @property {number|null} max - Deepest drawdown in the range, in percent (<= 0).
 * @property {RangeAnchor|null} peak
 * @property {RangeAnchor|null} trough
 * @property {RangeAnchor|null} recovery - Null while still underwater.
 * @property {number|null} barsToTrough - Peak to trough (the decline).
 * @property {number|null} barsToRecovery - Trough back to the old peak.
 * @property {number|null} barsUnderwater - Peak to recovery (whole episode).
 * @property {boolean} recovered
 *
 * @typedef {Object} RangeStats
 * @property {RangeAnchor} from
 * @property {RangeAnchor} to
 * @property {{absolute:number, percent:number}} change
 * @property {number} bars - Inclusive bar count. Bars, not trading sessions.
 * @property {number} upBars - Bars that closed above the previous bar.
 * @property {number} downBars
 * @property {number} flatBars
 * @property {number|null} spanMs - `to.x - from.x` when x is numeric.
 * @property {number|null} calendarDays - `spanMs` in days.
 * @property {{return:number, basis:"calendar"}|null} annualized
 * @property {Extreme|null} high - True high over the range (from `y[1]`).
 * @property {Extreme|null} low - True low over the range (from `y[2]`).
 * @property {{close:number|null, volume:number|null}} average
 * @property {{volume:number|null}} total
 * @property {VolatilityResult|null} volatility
 * @property {RangeDrawdown} drawdown
 * @property {{source:string, drawdown:string}} basis
 * @property {string[]} warnings
 */

/** Per-series memo, keyed on series identity then a method+params string. */
const CACHE = new WeakMap();

const FIELD_INDEX = { open: 0, high: 1, low: 2, close: 3 };

const DAY_MS = 86400000;
const DEFAULT_MIN_ANNUALIZE_DAYS = 30;

/** Trading days, weeks, and months per year: the conventional divisors. */
const DAILY_PERIODS = 252;
const WEEKLY_PERIODS = 52;
const MONTHLY_PERIODS = 12;

/** Finite read of an OHLC field, or NaN. */
function field(bar, name) {
  const y = bar && bar.y;
  if (!Array.isArray(y)) return NaN;
  const v = Number(y[FIELD_INDEX[name] != null ? FIELD_INDEX[name] : 3]);
  return Number.isFinite(v) ? v : NaN;
}

/** Numeric x, or null for a category axis. */
function axisX(bar) {
  const x = bar ? bar.x : null;
  if (typeof x === "number") return Number.isFinite(x) ? x : null;
  if (x == null) return null;
  const t = new Date(x).getTime();
  return Number.isNaN(t) ? null : t;
}

/** The median of a numeric array (does not mutate the input). */
function median(values) {
  if (!values.length) return NaN;
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export default class Statistics {
  /**
   * Drop cached statistics for `series`. Required because the `appendData()`
   * path mutates the series array in place, so identity alone would keep
   * serving a stale result. Also clears the drawdown memo for the same series.
   * @param {*} series
   * @returns {void}
   */
  static invalidate(series) {
    if (series && typeof series === "object") CACHE.delete(series);
    Drawdown.invalidate(series);
  }

  /* ------------------------------------------------------------------ *
   * Index resolution
   * ------------------------------------------------------------------ */

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
  static resolveIndex(series, ref, opts = {}, warnings) {
    const s = Array.isArray(series) ? series : [];
    if (!s.length) return -1;
    const by = opts.by || "auto";
    const clamp = (i) => Math.max(0, Math.min(s.length - 1, i));

    if (typeof ref === "number" && Number.isFinite(ref)) {
      const isIndex = Number.isInteger(ref) && ref >= 0 && ref < s.length;
      if (by === "index") return clamp(Math.round(ref));
      if (by === "auto" && isIndex) {
        if (warnings && s.some((bar) => axisX(bar) === ref)) {
          warnings.push(
            `resolveIndex: ${ref} is both a valid bar index and an x value; read as an index. Pass { by: "x" } to resolve it as an x value.`
          );
        }
        return ref;
      }
      return Statistics._nearestByX(s, ref);
    }

    if (by === "index") {
      const n = Number(ref);
      return Number.isFinite(n) ? clamp(Math.round(n)) : -1;
    }

    const t = ref instanceof Date ? ref.getTime() : new Date(ref).getTime();
    if (Number.isNaN(t)) return -1;
    return Statistics._nearestByX(s, t);
  }

  /**
   * Nearest bar to an x value. Nearest, never interpolated: every statistic is
   * anchored to a bar that actually exists.
   * @param {import("../types.js").Series} s
   * @param {number} target
   * @returns {number}
   * @private
   */
  static _nearestByX(s, target) {
    let best = -1;
    let bestDist = Infinity;
    for (let i = 0; i < s.length; i++) {
      const x = axisX(s[i]);
      if (x === null) continue;
      const d = Math.abs(x - target);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    return best;
  }

  /* ------------------------------------------------------------------ *
   * Returns, volatility, annualization
   * ------------------------------------------------------------------ */

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
  static returns(series, opts = {}) {
    const mode = opts.mode === "simple" ? "simple" : "log";
    const source = FIELD_INDEX[opts.source] != null ? opts.source : "close";
    const key = `returns:${mode}:${source}`;
    const cached = Statistics._cacheGet(series, key);
    if (cached !== undefined) return cached;

    const s = Array.isArray(series) ? series : [];
    const values = new Array(s.length).fill(null);
    const points = [];
    for (let i = 0; i < s.length; i++) {
      const cur = field(s[i], source);
      const prev = i > 0 ? field(s[i - 1], source) : NaN;
      let r = null;
      if (i > 0 && Number.isFinite(cur) && Number.isFinite(prev) && prev > 0) {
        r =
          mode === "log" ? Math.log(cur / prev) * 100 : (cur / prev - 1) * 100;
      }
      values[i] = r;
      points.push({ x: s[i] ? s[i].x : undefined, y: r });
    }
    return Statistics._cacheSet(series, key, { mode, source, values, points });
  }

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
  static inferPeriodsPerYear(series) {
    const s = Array.isArray(series) ? series : [];
    const gaps = [];
    for (let i = 1; i < s.length; i++) {
      const a = axisX(s[i - 1]);
      const b = axisX(s[i]);
      if (a === null || b === null) continue;
      const d = b - a;
      if (d > 0) gaps.push(d);
    }
    if (!gaps.length) {
      return { periodsPerYear: null, spacingMs: null, label: "unknown" };
    }
    const spacingMs = median(gaps);
    if (spacingMs >= 25 * DAY_MS) {
      return { periodsPerYear: MONTHLY_PERIODS, spacingMs, label: "monthly" };
    }
    if (spacingMs >= 6 * DAY_MS) {
      return { periodsPerYear: WEEKLY_PERIODS, spacingMs, label: "weekly" };
    }
    // A daily series steps 1 day midweek and 3 over a weekend, so the median
    // lands on 1 day; anything from ~20h up is treated as daily.
    if (spacingMs >= 20 * 3600000) {
      return { periodsPerYear: DAILY_PERIODS, spacingMs, label: "daily" };
    }
    return { periodsPerYear: null, spacingMs, label: "intraday" };
  }

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
  static volatility(series, from, to, opts = {}, warnings) {
    const s = Array.isArray(series) ? series : [];
    const lo = Math.max(0, Math.min(from, to));
    const hi = Math.min(s.length - 1, Math.max(from, to));
    const { values } = Statistics.returns(series, {
      mode: "log",
      source: opts.source,
    });

    const sample = [];
    for (let i = lo + 1; i <= hi; i++) {
      if (values[i] != null) sample.push(values[i]);
    }
    if (sample.length < 2) {
      if (warnings) {
        warnings.push(
          "volatility: needs at least two returns inside the range; not computed."
        );
      }
      return null;
    }

    const mean = sample.reduce((a, b) => a + b, 0) / sample.length;
    const variance =
      sample.reduce((acc, v) => acc + (v - mean) * (v - mean), 0) /
      (sample.length - 1);
    const stdev = Math.sqrt(variance);

    let periodsPerYear;
    let inferred = false;
    if (Number.isFinite(+opts.periodsPerYear) && +opts.periodsPerYear > 0) {
      periodsPerYear = +opts.periodsPerYear;
    } else {
      const guess = Statistics.inferPeriodsPerYear(series);
      periodsPerYear = guess.periodsPerYear;
      inferred = periodsPerYear !== null;
      if (warnings) {
        if (inferred) {
          warnings.push(
            `volatility: periodsPerYear inferred as ${periodsPerYear} from ${guess.label} bar spacing. Pass \`periodsPerYear\` to set the convention explicitly.`
          );
        } else {
          warnings.push(
            `volatility: cannot infer a periods-per-year convention for ${guess.label} bar spacing, so the annualized figure is omitted. Pass \`periodsPerYear\`.`
          );
        }
      }
    }

    return {
      stdev,
      annualized:
        periodsPerYear === null ? null : stdev * Math.sqrt(periodsPerYear),
      periodsPerYear,
      inferred,
    };
  }

  /**
   * Annualize a total percent return over a calendar span.
   * @param {number} totalPercent - e.g. 20.4 for +20.4%.
   * @param {number} calendarDays
   * @param {{minAnnualizeDays?:number}} [opts]
   * @param {string[]} [warnings]
   * @returns {{return:number, basis:"calendar"}|null}
   */
  static annualize(totalPercent, calendarDays, opts = {}, warnings) {
    const min = Number.isFinite(+opts.minAnnualizeDays)
      ? +opts.minAnnualizeDays
      : DEFAULT_MIN_ANNUALIZE_DAYS;
    if (!Number.isFinite(calendarDays) || calendarDays <= 0) {
      if (warnings) {
        warnings.push(
          "annualized: the range has no measurable time span (a category x axis, or a zero-length range), so it is omitted."
        );
      }
      return null;
    }
    if (calendarDays < min) {
      if (warnings) {
        warnings.push(
          `annualized: the range spans ${
            Math.round(calendarDays * 10) / 10
          } days, under the ${min}-day minimum; extrapolating it to a yearly figure would be misleading, so it is omitted.`
        );
      }
      return null;
    }
    const growth = 1 + totalPercent / 100;
    if (growth <= 0) {
      if (warnings) {
        warnings.push(
          "annualized: the range ends at or below zero, which cannot be compounded, so it is omitted."
        );
      }
      return null;
    }
    return {
      return: (Math.pow(growth, 365 / calendarDays) - 1) * 100,
      basis: "calendar",
    };
  }

  /* ------------------------------------------------------------------ *
   * The range readout
   * ------------------------------------------------------------------ */

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
  static rangeStats(series, from, to, opts = {}) {
    const s = Array.isArray(series) ? series : [];
    if (!s.length) return null;

    const warnings = [];
    const source = FIELD_INDEX[opts.source] != null ? opts.source : "close";
    const drawdownBasis =
      opts.drawdownBasis === "intrabar" ? "intrabar" : "close";
    const by = opts.by || "auto";

    let i0 = Statistics.resolveIndex(series, from, { by }, warnings);
    let i1 = Statistics.resolveIndex(series, to, { by }, warnings);
    if (i0 === -1 || i1 === -1) {
      Utils.warn(
        "rangeStats: could not resolve the range endpoints to bars in this series."
      );
      return null;
    }
    if (i0 > i1) {
      const t = i0;
      i0 = i1;
      i1 = t;
    }

    const fromBar = s[i0];
    const toBar = s[i1];
    const fromValue = field(fromBar, source);
    const toValue = field(toBar, source);
    if (!Number.isFinite(fromValue) || !Number.isFinite(toValue)) {
      Utils.warn(
        `rangeStats: the range endpoints have no usable "${source}" value.`
      );
      return null;
    }

    const absolute = toValue - fromValue;
    const percent = fromValue !== 0 ? (absolute / fromValue) * 100 : null;
    if (percent === null) {
      warnings.push(
        "change.percent: the range starts at zero, so a percentage change is undefined."
      );
    }

    // ---- Duration ----
    const bars = i1 - i0 + 1;
    const fromX = axisX(fromBar);
    const toX = axisX(toBar);
    const spanMs = fromX !== null && toX !== null ? toX - fromX : null;
    const calendarDays = spanMs !== null ? spanMs / DAY_MS : null;

    // ---- Extremes, averages, direction ----
    let high = null;
    let low = null;
    let closeSum = 0;
    let closeCount = 0;
    let volumeSum = 0;
    let volumeCount = 0;
    let upBars = 0;
    let downBars = 0;
    let flatBars = 0;

    for (let i = i0; i <= i1; i++) {
      const bar = s[i];
      const h = field(bar, "high");
      const l = field(bar, "low");
      if (Number.isFinite(h) && (high === null || h > high.value)) {
        high = { value: h, index: i, x: bar.x };
      }
      if (Number.isFinite(l) && (low === null || l < low.value)) {
        low = { value: l, index: i, x: bar.x };
      }
      const v = field(bar, source);
      if (Number.isFinite(v)) {
        closeSum += v;
        closeCount++;
      }
      const vol = bar && bar.v != null ? Number(bar.v) : NaN;
      if (Number.isFinite(vol)) {
        volumeSum += vol;
        volumeCount++;
      }
      if (i > i0) {
        const prev = field(s[i - 1], source);
        if (Number.isFinite(v) && Number.isFinite(prev)) {
          if (v > prev) upBars++;
          else if (v < prev) downBars++;
          else flatBars++;
        }
      }
    }

    if (!volumeCount) {
      warnings.push(
        "volume: no bar in the range carries a `v`, so the volume figures are omitted."
      );
    }

    // ---- Annualized return ----
    const annualized =
      percent === null
        ? null
        : Statistics.annualize(percent, calendarDays, opts, warnings);

    // ---- Volatility ----
    const volatility = Statistics.volatility(
      series,
      i0,
      i1,
      { periodsPerYear: opts.periodsPerYear, source },
      warnings
    );

    // ---- Drawdown, with the peak reset at the start of the range ----
    const dd = Drawdown.range(series, i0, i1, { basis: drawdownBasis });
    const worst =
      dd.maxEpisodeIndex === -1 ? null : dd.episodes[dd.maxEpisodeIndex];
    const drawdown = worst
      ? {
          max: dd.max,
          peak: worst.peak,
          trough: worst.trough,
          recovery: worst.recovery,
          barsToTrough: worst.barsToTrough,
          barsToRecovery: worst.barsToRecovery,
          barsUnderwater: worst.barsUnderwater,
          recovered: !worst.ongoing,
        }
      : {
          max: 0,
          peak: null,
          trough: null,
          recovery: null,
          barsToTrough: null,
          barsToRecovery: null,
          barsUnderwater: null,
          recovered: true,
        };

    return {
      from: { index: i0, x: fromBar.x, value: fromValue },
      to: { index: i1, x: toBar.x, value: toValue },
      change: { absolute, percent },
      bars,
      upBars,
      downBars,
      flatBars,
      spanMs,
      calendarDays,
      annualized,
      high,
      low,
      average: {
        close: closeCount ? closeSum / closeCount : null,
        volume: volumeCount ? volumeSum / volumeCount : null,
      },
      total: { volume: volumeCount ? volumeSum : null },
      volatility,
      drawdown,
      basis: { source, drawdown: drawdownBasis },
      warnings,
    };
  }

  /* ------------------------------------------------------------------ *
   * Re-exports, so consumers reach one namespace
   * ------------------------------------------------------------------ */

  /** @see Drawdown.compute */
  static drawdown(series, opts) {
    return Drawdown.compute(series, opts);
  }

  /** @see Align.align */
  static align(instruments, opts) {
    return Align.align(instruments, opts);
  }

  /** @see Align.rebase */
  static rebase(aligned, opts) {
    return Align.rebase(aligned, opts);
  }

  /** @see Align.relative */
  static relative(aligned, name, benchmark, opts) {
    return Align.relative(aligned, name, benchmark, opts);
  }

  /** @see Align.baseline */
  static baseline(aligned, policy, opts) {
    return Align.baseline(aligned, policy, opts);
  }

  /** @private */
  static _cacheGet(series, key) {
    if (!series || typeof series !== "object") return undefined;
    const per = CACHE.get(series);
    return per ? per.get(key) : undefined;
  }

  /** @private */
  static _cacheSet(series, key, value) {
    if (series && typeof series === "object") {
      let per = CACHE.get(series);
      if (!per) {
        per = new Map();
        CACHE.set(series, per);
      }
      per.set(key, value);
    }
    return value;
  }
}
