export default class Drawdown {
    /**
     * Drop cached drawdowns for `series`. Needed because the `appendData()` path
     * mutates the series array in place rather than swapping in a new one, so
     * identity alone would keep serving a stale, shorter result.
     * @param {*} series
     * @returns {void}
     */
    static invalidate(series: any): void;
    /**
     * The two fields a basis reads: the one that sets (and regains) the peak, and
     * the one the drawdown is measured at. `"close"` measures close against a
     * close peak; `"intrabar"` measures the low against a high peak.
     * @param {"close"|"intrabar"} basis
     * @private
     */
    private static _fields;
    /**
     * Drawdown over the whole series.
     * @param {import("../types.js").Series} series
     * @param {{basis?: "close"|"intrabar"}} [opts]
     * @returns {DrawdownResult}
     */
    static compute(series: import("../types.js").Series, opts?: {
        basis?: "close" | "intrabar";
    }): DrawdownResult;
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
    static range(series: import("../types.js").Series, from: number, to: number, opts?: {
        basis?: "close" | "intrabar";
    }): DrawdownResult;
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
    static worst(series: import("../types.js").Series, from: number, to: number, opts?: {
        basis?: "close" | "intrabar";
    }): (DrawdownEpisode & {
        max: number;
    }) | null;
    /**
     * @param {import("../types.js").Series} series
     * @param {number} from
     * @param {number} to
     * @param {"close"|"intrabar"} basis
     * @returns {DrawdownResult}
     * @private
     */
    private static _compute;
    /** @private */
    private static _cacheGet;
    /** @private */
    private static _cacheSet;
}
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
 */
export type DrawdownAnchor = {
    index: number;
    x: number | string | Date;
    /**
     * - The price at that anchor.
     */
    value: number;
};
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
 */
export type DrawdownEpisode = {
    /**
     * - The high-water mark the decline started from.
     */
    peak: DrawdownAnchor;
    /**
     * - The lowest point of the episode.
     */
    trough: DrawdownAnchor;
    /**
     * - Where the old peak was regained,
     * or null while still underwater.
     */
    recovery: DrawdownAnchor | null;
    /**
     * - Percent below the peak at the trough (negative).
     */
    depth: number;
    barsToTrough: number;
    barsToRecovery: number | null;
    barsUnderwater: number;
    /**
     * - True when the episode never recovered.
     */
    ongoing: boolean;
};
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
 */
export type DrawdownResult = {
    /**
     * - Percent drawdown per bar (<= 0),
     * index-aligned to the whole series; null outside the computed range and for
     * unusable bars.
     */
    values: Array<number | null>;
    /**
     * - The same values as chart
     * points, covering the computed range only (so a windowed result plots as a
     * window, while a whole-series result plots as the whole series).
     */
    points: Array<{
        x: any;
        y: number | null;
    }>;
    /**
     * - The deepest drawdown (most negative), or null.
     */
    max: number | null;
    /**
     * - Index into `episodes` of the deepest, or -1.
     */
    maxEpisodeIndex: number;
    /**
     * - Drawdown at the last bar.
     */
    current: number | null;
    episodes: DrawdownEpisode[];
    basis: "close" | "intrabar";
};
