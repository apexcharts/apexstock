export default class Comparison {
    /**
     * Validate a patch against a base, warning about (and ignoring) bad values so
     * one typo cannot silently change what the numbers mean.
     * @param {import("../types.js").ComparisonOptions} base
     * @param {Object} patch
     * @returns {import("../types.js").ComparisonOptions}
     * @private
     */
    private static _normalizeOptions;
    /**
     * The window on screen, but only when the chart is actually zoomed into one:
     * null when it is showing its whole extent.
     *
     * Read this BEFORE `updateSeries()`, which clears `xaxis.min`/`max` and
     * refits to the data extent. Without putting it back, every rebase snapped a
     * zoomed chart to its full history. That is worst under `baseline: "visible"`,
     * where the zoom is what triggers the rebase: the gesture undid itself, and
     * the leaderboard (which reads the remembered window, not the chart) was left
     * describing a range the chart was no longer showing. It also desynced the
     * indicator panes, which are separate charts `updateSeries` does not reach.
     *
     * The zoom test is `minX`/`maxX` against `initialMinX`/`initialMaxX`, the data
     * extent, which zooming does not touch. An unzoomed chart must be left alone:
     * an instrument reaching further back than the primary widens the extent, and
     * restoring a window that merely equalled the old one would hide exactly the
     * history the caller just supplied.
     *
     * @param {import("../ApexStock.js").default} ctx
     * @returns {{minX:number, maxX:number}|null}
     * @private
     */
    private static _zoomedWindow;
    /** @param {import("../ApexStock.js").default} ctx */
    constructor(ctx: import("../ApexStock.js").default);
    ctx: import("../ApexStock.js").default;
    /** @type {Object.<string, {name:string, data:{x:*,y:number|number[]}[], color:string}>} */
    items: {
        [x: string]: {
            name: string;
            data: {
                x: any;
                y: number | number[];
            }[];
            color: string;
        };
    };
    /** @type {import("../types.js").ComparisonMode} */
    mode: import("../types.js").ComparisonMode;
    /** Benchmark instrument name, or the {@link PRIMARY} sentinel. */
    benchmark: string;
    /** @type {import("../types.js").ComparisonOptions} */
    options: import("../types.js").ComparisonOptions;
    _counter: number;
    /** Names currently rendered as comparison series (to filter on reapply). */
    _rendered: Set<any>;
    /** Memoized alignment + derived columns, keyed by {@link _cacheKey}. */
    _derived: {
        primary: string;
        benchmark: string;
        aligned: import("../analysis/Align").AlignResult;
        baseline: {
            policy: string;
            index: number | null;
            perInstrument: {
                [x: string]: number;
            };
            warnings: string[];
        };
        columns: {};
        plot: {};
        obs: {};
        warnings: string[];
    };
    _derivedKey: string;
    /** Bumped whenever the instrument set or the primary's data changes. */
    _dataVersion: number;
    /** Left edge of the visible window, for `baseline: "visible"`. */
    _visibleFrom: any;
    /** Re-entrancy guard for the visible-baseline rebase. */
    _rebasing: boolean;
    _rangeUnsub: () => void;
    /** name -> color remembered from a restored state, see {@link _restore}. */
    _restoredColors: {};
    /** @returns {boolean} true if any comparison instrument is present. */
    isActive(): boolean;
    /** @returns {import("../types.js").ComparisonMode} */
    getMode(): import("../types.js").ComparisonMode;
    /**
     * Set the normalization mode and re-render.
     * @param {import("../types.js").ComparisonMode} mode
     */
    setMode(mode: import("../types.js").ComparisonMode): void;
    /** @returns {string} the benchmark name, or `"__primary__"`. */
    getBenchmark(): string;
    /**
     * Set the benchmark instrument for `relative` and `ratio` mode. The benchmark
     * is a role: pass the name of any added instrument, or `"__primary__"` for
     * the chart's own symbol. No symbol is special-cased.
     * @param {string} name
     */
    setBenchmark(name: string): void;
    /** @returns {import("../types.js").ComparisonOptions} a copy of the alignment options. */
    getOptions(): import("../types.js").ComparisonOptions;
    /**
     * Patch the alignment / baseline options and re-render.
     * @param {import("../types.js").ComparisonOptions} patch
     */
    setOptions(patch: import("../types.js").ComparisonOptions): void;
    /**
     * Add (or replace, if `name` exists) a comparison instrument.
     * @param {ComparisonConfig} config
     * @returns {string|null} the instrument name, or null on invalid input.
     */
    add(config: ComparisonConfig): string | null;
    /**
     * Remove a comparison instrument.
     * @param {string} name
     * @returns {boolean} false if no such instrument.
     */
    remove(name: string): boolean;
    /** Remove every comparison instrument (restores the single price axis). */
    clear(): void;
    /** @returns {object[]} copies of the comparison configs (mode-normalized values are not included). */
    getAll(): object[];
    /**
     * Drop the memoized alignment. Called on every mutation, and by ApexStock
     * when the primary series changes (`appendData`, `update`), because the
     * primary is one of the aligned instruments.
     * @returns {void}
     */
    invalidate(): void;
    /** @private */
    private _invalidate;
    /**
     * The primary series' name, by POSITION (index 0), never by the literal
     * "Price": consumers rename it. Same rule as ChartSwitch.
     * @returns {string}
     * @private
     */
    private _primaryName;
    /**
     * Resolve the benchmark role to an instrument name.
     * @returns {string|null} null when the configured name is gone.
     * @private
     */
    private _benchmarkName;
    /** @returns {boolean} true when the current mode needs a benchmark. @private */
    private _needsBenchmark;
    /** @private */
    private _cacheKey;
    /**
     * Align every instrument (primary included) and derive the display column for
     * the current mode. Memoized: one alignment per mutation, reused by every
     * reapply, every stats call, and every theme rebuild.
     * @returns {{primary:string, benchmark:string, aligned:import("../analysis/Align.js").AlignResult, baseline:object, columns:Object.<string,Array<number|null>>, plot:Object.<string,{i:number,x:number}[]>, obs:Object.<string,{i:number,x:number,v:number}[]>, warnings:string[]}|null}
     * @private
     */
    private _derive;
    /** The visible window's left edge, for `baseline: "visible"`. @private */
    private _resolveVisibleFrom;
    /**
     * Per-instrument performance rows for the current mode and baseline: the
     * leaderboard, already computed, so a consumer never has to recompute it.
     *
     * The window runs from the baseline to the last observation, so with
     * `baseline: "visible"` the rows follow the zoom. Pass `from`/`to` as x values
     * to scope it explicitly instead.
     *
     * Every row is derived from `source` (close by default) for *every*
     * instrument, primary included, so the rows are comparable with each other.
     * {@link ApexStock#getRangeStats} is the OHLC-aware path for the primary.
     *
     * @param {{from?:number|Date|string, to?:number|Date|string}} [opts]
     * @returns {import("../types.js").ComparisonRow[]} empty when no instrument is added.
     */
    getStats(opts?: {
        from?: number | Date | string;
        to?: number | Date | string;
    }): import("../types.js").ComparisonRow[];
    /**
     * Resolve an x value (timestamp, Date, or parseable string) to a grid index.
     * An endpoint between two bars resolves inward, so a window never claims data
     * outside what was asked for: `from` snaps forward to the next bar, `to` snaps
     * back to the previous one.
     * @param {number[]} grid
     * @param {*} ref
     * @param {number} fallback - Used when `ref` is absent or unparseable.
     * @param {"forward"|"back"} dir
     * @returns {number}
     * @private
     */
    private _gridIndex;
    /** Compute a comparison line's points for the current mode. @private */
    private _line;
    /** Axis title + label formatter for the current mode. @private */
    private _axisMeta;
    /** A fresh single-axis config matching the primary (used to collapse axes). */
    _singleAxis(): any;
    /** The secondary axis config for the comparison lines. */
    _cmpAxis(names: any): {
        opposite: boolean;
        seriesName: any;
        labels: {
            style: {
                colors: string;
            };
            formatter: (v: any) => string;
        };
        title: {
            text: string;
            style: {
                color: string;
                fontSize: string;
            };
        };
    };
    /**
     * Collapse to a single y-axis (dropping the multi-axis binding) so a caller
     * can safely add/remove main-chart series without ApexCharts' bound/unbound
     * mismatch throwing. The comparison lines remain (temporarily on the shared
     * axis) until the next {@link reapply}. No-op when inactive.
     */
    suspend(): void;
    /**
     * Rebuild the comparison series and y-axes from the live chart state.
     * Idempotent. Reads the current main-chart series (price + overlays) so
     * indicator changes are picked up automatically.
     */
    reapply(): void;
    /**
     * Subscribe to `rangeChange` only while `baseline: "visible"` is in effect and
     * something is actually plotted. The subscription is deliberately conditional:
     * ApexStock skips emitting `rangeChange` entirely when nothing listens, and a
     * baseline that does not follow the zoom has no reason to pay for it.
     * @private
     */
    private _bindRange;
    /** @private */
    private _unbindRange;
    /**
     * Rebase to the new left edge. Echoes are suppressed the same two ways
     * ChartSync documents: a re-entrancy flag for the synchronous case, and value
     * comparison for the asynchronous one (ApexCharts emits `zoomed`/`scrolled`
     * out of band, so the flag alone would not be enough).
     * @param {{min:number}} payload
     * @private
     */
    private _onRangeChange;
    /**
     * JSON snapshot for state serialization, or null when comparison was never
     * configured (a null in state means "no comparison").
     *
     * **Instrument data is deliberately not captured.** It is supplied by the
     * consumer, runs to thousands of bars per instrument, and would be stale the
     * moment it was written. What state carries is each instrument's *identity*
     * and styling, plus the mode, benchmark, and alignment policy;
     * {@link _restore} then reports which instruments need their data supplied
     * again. Same division of labour as the price lines' interactive callbacks,
     * which are also re-bound by the consumer after a restore.
     *
     * @returns {import("../types.js").ComparisonState|null}
     */
    _serialize(): import("../types.js").ComparisonState | null;
    /**
     * Restore from a snapshot. Replace-the-set semantics, with one concession to
     * the data contract: an instrument whose data is **already loaded** is kept
     * (re-ordered and re-colored to match the state) rather than dropped and
     * demanded back, so an in-app save/restore costs no round trip. Whatever is
     * left over is reported through `comparisonRestoreNeeded` with the names the
     * consumer has to re-supply, and remembered by color for when they do.
     *
     * A null snapshot means "no comparison": everything is dropped and the
     * options return to their defaults.
     *
     * @param {import("../types.js").ComparisonState|null} state
     * @returns {void}
     */
    _restore(state: import("../types.js").ComparisonState | null): void;
    /**
     * Emit on the ApexStock bus, if there is one.
     * @param {string} name
     * @param {*} payload
     * @private
     */
    private _emit;
    /**
     * Emit `comparisonChange` with the fresh leaderboard attached. Skipped
     * entirely when nothing is subscribed, because building the rows is real work
     * (the `_emitPointerEvent` precedent).
     * @param {import("../types.js").ComparisonChangeEvent["reason"]} reason
     * @private
     */
    private _emitChange;
    /** Remove all comparison series + restore the single axis, and drop state. */
    destroy(): void;
}
/**
 * Comparison mode: overlay one or more additional instruments (e.g. AAPL vs
 * MSFT vs SPY) on the main chart as line series, to compare their movement
 * against the primary symbol and each other.
 *
 * Because compared instruments rarely share the primary's price scale, they are
 * plotted on a dedicated **secondary y-axis**.
 *
 * ## Alignment: why this manager does not just plot each array as given
 *
 * Instruments do not share a calendar. A newer listing starts later, exchanges
 * keep different holidays, and a data feed can simply be missing a day. So
 * every instrument (the primary included) goes through {@link Align.align},
 * which samples them all onto one shared x grid and reports per-instrument
 * `coverage`. Two policies control it:
 *
 * - `join`: `"union"` (default, keep every x any instrument has), `"primary"`
 *   (resample onto the primary's bars), `"intersection"` (only shared x values).
 * - `fill`: `"hold"` (default, carry the last observation across a hole),
 *   `"gap"` (leave it null), `"drop"` (remove x values not everyone has).
 *
 * A carried-forward value is used for the *math* (baselines, statistics) but is
 * **not plotted** by default, so a line never shows a bar its instrument does
 * not have. Set `resample: true` to plot the filled grid instead (the default
 * when `join: "primary"`, which exists precisely to resample).
 *
 * ## Baseline: what "0%" means
 *
 * `baseline: "common"` (the default) rebases every instrument at the first x
 * where *all* of them, primary included, have data. That is the only policy
 * under which lines with different start dates are actually comparable, and it
 * is why the primary participates: the chart's window is anchored on it.
 * `"own"` (each instrument's own first point) is the pre-0.5.0 behavior, kept
 * for compatibility. `"visible"` rebases to the left edge of the visible window
 * and follows the zoom. A number is an explicit x value.
 *
 * ## Modes
 *
 * - `"absolute"`: raw values (secondary axis shows price).
 * - `"percent"`: percent change from the baseline. The default.
 * - `"indexed"`: the baseline reads `indexBase` (default 100), i.e. the
 *   "100 = starting value" view.
 * - `"relative"`: `percentChange(asset) - percentChange(benchmark)`, in
 *   percentage points. Zero means "kept pace".
 * - `"ratio"`: `asset / benchmark`, rebased so the baseline reads `indexBase`.
 *
 * The last two need a benchmark, which is a **role**, not a ticker: it is any
 * added instrument by name, or `"__primary__"` (the default) for the chart's
 * own symbol. Nothing in ApexStock hard-codes a benchmark symbol.
 *
 * ## Axis binding
 *
 * ApexCharts v5 requires that when there are multiple y-axes, EVERY series is
 * bound to one via `seriesName` (a mix of bound/unbound throws). So while
 * comparisons are active the manager rebinds all main-chart series (price +
 * indicator overlays) to the primary axis and the comparison lines to the
 * secondary axis, rebuilding both on every {@link reapply}. Operations that
 * add/remove main-chart series mid-flight (indicator toggle, chart-type switch)
 * call {@link suspend} first to collapse back to a single axis, then reapply.
 */
export type ComparisonConfig = {
    /**
     * - Unique instrument name (also the series/legend label).
     */
    name: string;
    /**
     * - Points; OHLC arrays use `source`.
     */
    data: Array<{
        x: any;
        y: number | number[];
    }>;
    /**
     * - Line color; defaults from a palette.
     */
    color?: string;
};
