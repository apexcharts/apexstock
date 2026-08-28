/**
 * Drawdown: how far below its own running peak an instrument has fallen, and
 * for how long.
 *
 * Drawdown is the risk half of a performance chart. A price line answers "what
 * did it return"; a drawdown line answers "what did holding it feel like", which
 * is the question a professional actually has to answer for a client. It is
 * expressed as a percentage at or below zero: zero means "at an all-time high
 * for this window", `-27.4` means "27.4% below the highest point so far".
 *
 * Two bases, because the honest number depends on what you are measuring:
 * - `"close"` (default): the running peak and the current level both come from
 *   the close. This is the standard reported figure for daily series.
 * - `"intrabar"`: the peak comes from the high and the level from the low, so
 *   the worst point *inside* each bar counts. Strictly more conservative, and
 *   the right basis for a stop-loss or margin question.
 *
 * The window matters: {@link Drawdown.compute} runs the peak over the whole
 * series, while {@link Drawdown.range} resets the peak at the start of the
 * selected range, because "max drawdown over this selection" must not be
 * contaminated by a peak that happened before the user's selection began.
 *
 * Episodes are the drawdown periods themselves, each with the three durations
 * that get confused with one another kept separate and named:
 * - `barsToTrough`: peak to trough (how long the decline lasted).
 * - `barsToRecovery`: trough back to the old peak (how long the recovery took).
 * - `barsUnderwater`: peak to recovery, the whole episode. For an episode that
 *   has not recovered, this runs to the end of the data and `ongoing` is true.
 *
 * All values are returned unrounded; the presentation layer formats.
 *
 * @typedef {Object} DrawdownAnchor
 * @property {number} index
 * @property {number|string|Date} x
 * @property {number} value - The price at that anchor.
 *
 * @typedef {Object} DrawdownEpisode
 * @property {DrawdownAnchor} peak - The high-water mark the decline started from.
 * @property {DrawdownAnchor} trough - The lowest point of the episode.
 * @property {DrawdownAnchor|null} recovery - Where the old peak was regained,
 *   or null while still underwater.
 * @property {number} depth - Percent below the peak at the trough (negative).
 * @property {number} barsToTrough
 * @property {number|null} barsToRecovery
 * @property {number} barsUnderwater
 * @property {boolean} ongoing - True when the episode never recovered.
 *
 * @typedef {Object} DrawdownResult
 * @property {Array<number|null>} values - Percent drawdown per bar (<= 0),
 *   index-aligned to the whole series; null outside the computed range and for
 *   unusable bars.
 * @property {Array<{x:*, y:number|null}>} points - The same values as chart
 *   points, covering the computed range only (so a windowed result plots as a
 *   window, while a whole-series result plots as the whole series).
 * @property {number|null} max - The deepest drawdown (most negative), or null.
 * @property {number} maxEpisodeIndex - Index into `episodes` of the deepest, or -1.
 * @property {number|null} current - Drawdown at the last bar.
 * @property {DrawdownEpisode[]} episodes
 * @property {"close"|"intrabar"} basis
 */

/** Per-series memo, keyed on series identity then basis. Mirrors Indicators._cache. */
const CACHE = new WeakMap();

const CLOSE = 3;
const HIGH = 1;
const LOW = 2;

/** Finite-number read of an OHLC field, or NaN. */
function field(bar, idx) {
  const y = bar && bar.y;
  if (!Array.isArray(y)) return NaN;
  const v = Number(y[idx]);
  return Number.isFinite(v) ? v : NaN;
}

export default class Drawdown {
  /**
   * Drop cached drawdowns for `series`. Needed because the `appendData()` path
   * mutates the series array in place rather than swapping in a new one, so
   * identity alone would keep serving a stale, shorter result.
   * @param {*} series
   * @returns {void}
   */
  static invalidate(series) {
    if (series && typeof series === "object") CACHE.delete(series);
  }

  /**
   * The two fields a basis reads: the one that sets (and regains) the peak, and
   * the one the drawdown is measured at. `"close"` measures close against a
   * close peak; `"intrabar"` measures the low against a high peak.
   * @param {"close"|"intrabar"} basis
   * @private
   */
  static _fields(basis) {
    return basis === "intrabar"
      ? { peak: HIGH, level: LOW }
      : { peak: CLOSE, level: CLOSE };
  }

  /**
   * Drawdown over the whole series.
   * @param {import("../types.js").Series} series
   * @param {{basis?: "close"|"intrabar"}} [opts]
   * @returns {DrawdownResult}
   */
  static compute(series, opts = {}) {
    const basis = opts.basis === "intrabar" ? "intrabar" : "close";
    const cached = Drawdown._cacheGet(series, basis);
    if (cached !== undefined) return cached;
    const result = Drawdown._compute(
      series,
      0,
      (series || []).length - 1,
      basis
    );
    return Drawdown._cacheSet(series, basis, result);
  }

  /**
   * Drawdown over a closed index range, with the running peak **reset at
   * `from`** so the figure describes the selection and nothing before it.
   * Not memoized (the range varies continuously as a user drags).
   * @param {import("../types.js").Series} series
   * @param {number} from - Inclusive start index.
   * @param {number} to - Inclusive end index.
   * @param {{basis?: "close"|"intrabar"}} [opts]
   * @returns {DrawdownResult}
   */
  static range(series, from, to, opts = {}) {
    const basis = opts.basis === "intrabar" ? "intrabar" : "close";
    return Drawdown._compute(series, from, to, basis);
  }

  /**
   * The single summary an interactive readout needs: the deepest episode over a
   * range, flattened. Returns null when the range holds no drawdown at all
   * (a monotonically rising selection), which callers report as "none".
   * @param {import("../types.js").Series} series
   * @param {number} from
   * @param {number} to
   * @param {{basis?: "close"|"intrabar"}} [opts]
   * @returns {(DrawdownEpisode & {max:number})|null}
   */
  static worst(series, from, to, opts = {}) {
    const res = Drawdown.range(series, from, to, opts);
    if (res.maxEpisodeIndex === -1) return null;
    return { ...res.episodes[res.maxEpisodeIndex], max: res.max };
  }

  /**
   * @param {import("../types.js").Series} series
   * @param {number} from
   * @param {number} to
   * @param {"close"|"intrabar"} basis
   * @returns {DrawdownResult}
   * @private
   */
  static _compute(series, from, to, basis) {
    const s = Array.isArray(series) ? series : [];
    // A non-finite bound means "the whole series" rather than silently
    // collapsing to bar 0, which `NaN | 0` would have done.
    const a = Number.isFinite(from) ? Math.trunc(from) : 0;
    const b = Number.isFinite(to) ? Math.trunc(to) : s.length - 1;
    const lo = Math.max(0, Math.min(a, b));
    const hi = Math.min(s.length - 1, Math.max(a, b));
    const f = Drawdown._fields(basis);

    const values = new Array(s.length).fill(null);
    const points = [];
    /** @type {DrawdownEpisode[]} */
    const episodes = [];

    let peakValue = NaN;
    let peakIndex = -1;
    /** The episode being accumulated, or null when at a high-water mark. */
    let open = null;
    let max = null;
    let maxEpisodeIndex = -1;
    let current = null;

    for (let i = lo; i <= hi; i++) {
      const bar = s[i];
      const peakCandidate = field(bar, f.peak);
      const level = field(bar, f.level);

      if (!Number.isFinite(level) || !Number.isFinite(peakCandidate)) {
        points.push({ x: bar ? bar.x : undefined, y: null });
        continue;
      }

      // A new high-water mark closes any open episode first.
      if (!Number.isFinite(peakValue) || peakCandidate >= peakValue) {
        if (open) {
          open.recovery = { index: i, x: bar.x, value: peakCandidate };
          open.barsToRecovery = i - open.trough.index;
          open.barsUnderwater = i - open.peak.index;
          open.ongoing = false;
          open = null;
        }
        peakValue = Math.max(
          Number.isFinite(peakValue) ? peakValue : -Infinity,
          peakCandidate
        );
        peakIndex = i;
      }

      const dd = peakValue ? ((level - peakValue) / peakValue) * 100 : 0;
      const value = dd > 0 ? 0 : dd;
      values[i] = value;
      points.push({ x: bar.x, y: value });
      current = value;

      if (value < 0) {
        if (!open) {
          const peakBar = s[peakIndex] || bar;
          open = {
            peak: { index: peakIndex, x: peakBar.x, value: peakValue },
            trough: { index: i, x: bar.x, value: level },
            recovery: null,
            depth: value,
            barsToTrough: i - peakIndex,
            barsToRecovery: null,
            barsUnderwater: i - peakIndex,
            ongoing: true,
          };
          episodes.push(open);
        } else if (value < open.depth) {
          open.depth = value;
          open.trough = { index: i, x: bar.x, value: level };
          open.barsToTrough = i - open.peak.index;
        }
        if (open.ongoing) open.barsUnderwater = i - open.peak.index;

        if (max === null || value < max) {
          max = value;
          maxEpisodeIndex = episodes.length - 1;
        }
      }
    }

    return {
      values,
      points,
      max,
      maxEpisodeIndex,
      current,
      episodes,
      basis,
    };
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
