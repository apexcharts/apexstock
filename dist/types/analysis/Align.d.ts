export default class Align {
    /** @see toAxisX */
    static toAxisX: typeof toAxisX;
    /** @see toValue */
    static toValue: typeof toValue;
    /** @see observations */
    static observations: typeof observations;
    /**
     * Sample every instrument onto one shared x grid.
     *
     * @param {Object.<string, Array<*>>} instruments - name -> points. Points may
     *   be OHLC (`{x, y:[o,h,l,c]}`), scalar (`{x, y}`), or `{x, close}`.
     * @param {Object} [opts]
     * @param {"primary"|"intersection"|"union"} [opts.join="primary"]
     * @param {"hold"|"gap"|"drop"} [opts.fill="hold"]
     * @param {string} [opts.primary] - Primary instrument name (defaults to the
     *   first key). Required in spirit for `join: "primary"`.
     * @param {"close"|"open"|"high"|"low"} [opts.source="close"] - Which OHLC
     *   field to compare on.
     * @returns {AlignResult}
     */
    static align(instruments: {
        [x: string]: any[];
    }, opts?: {
        join?: "primary" | "intersection" | "union";
        fill?: "hold" | "gap" | "drop";
        primary?: string;
        source?: "close" | "open" | "high" | "low";
    }): AlignResult;
    /** Ascending union of every instrument's x values. @private */
    private static _union;
    /** Ascending intersection of every instrument's x values. @private */
    private static _intersection;
    /**
     * Two-pointer walk of ascending observations over an ascending grid.
     * @param {Array<{x:number, v:number}>} points
     * @param {number[]} grid
     * @param {boolean} hold - Carry the last observation forward.
     * @private
     */
    private static _sample;
    /**
     * Recompute coverage after a `drop` pass reindexed the grid. `filled` is
     * always zero here by construction: `drop` samples with hold off, so no value
     * was ever carried forward for the reindexed grid to preserve.
     * @param {Array<number|null>} values
     * @private
     */
    private static _coverageOf;
    /**
     * Resolve the baseline grid index each instrument is measured from.
     *
     * - `"common"` (default): the first grid index where **every** instrument
     *   with data has a value. The only policy under which instruments with
     *   different start dates are actually comparable, which is why it is the
     *   default.
     * - `"own"`: each instrument's own first value (so each line starts at zero
     *   at a different date). Preserved because it is what ApexStock did before.
     * - `"visible"`: `opts.from`, the left edge of the visible window, so the
     *   comparison rebases as the user zooms.
     * - a number: an explicit x value (or grid index), resolved to the nearest
     *   grid point at or after it.
     *
     * @param {AlignResult} aligned
     * @param {"common"|"own"|"visible"|number} [policy="common"]
     * @param {{from?:number}} [opts]
     * @returns {{policy:string, index:number|null, perInstrument:Object.<string,number>, warnings:string[]}}
     */
    static baseline(aligned: AlignResult, policy?: "common" | "own" | "visible" | number, opts?: {
        from?: number;
    }): {
        policy: string;
        index: number | null;
        perInstrument: {
            [x: string]: number;
        };
        warnings: string[];
    };
    /**
     * Rebase aligned columns onto a comparable scale.
     *
     * - `"percent"`: percent change from the baseline (`+18.4` means +18.4%).
     * - `"indexed"`: an index where the baseline equals `indexBase` (default
     *   100), i.e. the "100 = starting value" view.
     * - `"absolute"`: the raw values, untouched (returned for symmetry so a
     *   caller can switch modes without branching).
     *
     * @param {AlignResult} aligned
     * @param {Object} [opts]
     * @param {"percent"|"indexed"|"absolute"} [opts.mode="percent"]
     * @param {"common"|"own"|"visible"|number} [opts.baseline="common"]
     * @param {number} [opts.indexBase=100]
     * @param {number} [opts.from] - Left edge x, for `baseline: "visible"`.
     * @returns {{mode:string, columns:Object.<string,Array<number|null>>, baseline:object, warnings:string[]}}
     */
    static rebase(aligned: AlignResult, opts?: {
        mode?: "percent" | "indexed" | "absolute";
        baseline?: "common" | "own" | "visible" | number;
        indexBase?: number;
        from?: number;
    }): {
        mode: string;
        columns: {
            [x: string]: Array<number | null>;
        };
        baseline: object;
        warnings: string[];
    };
    /**
     * Derive a relative-performance series from two aligned instruments. This is
     * the reusable analytical primitive behind "stock vs benchmark", "stock vs
     * sector", and "asset A vs asset B": the benchmark is a **role**, filled by
     * whichever instrument is named, never a hard-coded symbol.
     *
     * - `"spread"` (default): `percentChange(asset) - percentChange(benchmark)`,
     *   in percentage points. Zero means "kept pace".
     * - `"ratio"`: `asset / benchmark`, optionally rebased so the baseline reads
     *   `indexBase`. A rising line means the asset is outperforming.
     *
     * @param {AlignResult} aligned
     * @param {string} name - The asset.
     * @param {string} benchmark - The benchmark instrument's name.
     * @param {Object} [opts]
     * @param {"spread"|"ratio"} [opts.mode="spread"]
     * @param {"common"|"own"|"visible"|number} [opts.baseline="common"]
     * @param {number} [opts.indexBase=100] - Ratio mode: baseline value.
     * @param {boolean} [opts.rebaseRatio=true] - Ratio mode: rebase to `indexBase`.
     * @param {number} [opts.from]
     * @returns {{mode:string, values:Array<number|null>, warnings:string[]}|null}
     */
    static relative(aligned: AlignResult, name: string, benchmark: string, opts?: {
        mode?: "spread" | "ratio";
        baseline?: "common" | "own" | "visible" | number;
        indexBase?: number;
        rebaseRatio?: boolean;
        from?: number;
    }): {
        mode: string;
        values: Array<number | null>;
        warnings: string[];
    } | null;
}
/**
 * Align: the multi-instrument primitive.
 *
 * Every comparison, benchmark, and relative-performance calculation in
 * ApexStock goes through here, because they all face the same two problems the
 * moment a second instrument appears: the instruments do **not** share a start
 * date, and they do **not** share every date in between (different exchanges,
 * different holidays, listings that begin mid-history, feeds with holes).
 *
 * Alignment resolves both explicitly rather than by accident:
 *
 * - **`join`** picks the x grid every instrument is sampled onto.
 *   - `"primary"` (default): the primary instrument's own x values. Keeps the
 *     price candles authoritative, which is what an overlay comparison wants.
 *   - `"intersection"`: only x values present in *every* instrument. The fair
 *     frame for pairwise statistics (correlation, beta).
 *   - `"union"`: every x seen in any instrument.
 * - **`fill`** decides what a grid point with no observation becomes.
 *   - `"hold"` (default): last observation carried forward. The finance
 *     default: a holiday in one market should not put a hole in the line.
 *   - `"gap"`: `null`, so the rendered line visibly breaks.
 *   - `"drop"`: the grid point is removed entirely, for every instrument. This
 *     is the observed-data-only policy: it never falls back to a held value, so
 *     `join: "union"` with `fill: "drop"` is equivalent to
 *     `join: "intersection"`.
 *
 * One rule overrides `fill` everywhere: a grid point **before** an instrument's
 * first observation is always `null`. Carrying a value backwards would invent
 * history that did not exist, which is the single most misleading thing a
 * comparison chart can do.
 *
 * Values are returned unrounded (see {@link Statistics} for the same contract).
 */
export type AlignCoverage = {
    /**
     * - Grid points where the instrument has a value.
     */
    bars: number;
    /**
     * - How many of those were carried forward, not observed.
     */
    filled: number;
    /**
     * - Grid index of the first observation, or -1.
     */
    firstIndex: number;
    /**
     * - Grid index of the last observation, or -1.
     */
    lastIndex: number;
    /**
     * - Grid indices whose value was carried
     * forward rather than observed. Lets a renderer plot only real observations
     * while still doing its math on the filled grid.
     */
    filledAt: Set<number>;
};
/**
 * Align: the multi-instrument primitive.
 *
 * Every comparison, benchmark, and relative-performance calculation in
 * ApexStock goes through here, because they all face the same two problems the
 * moment a second instrument appears: the instruments do **not** share a start
 * date, and they do **not** share every date in between (different exchanges,
 * different holidays, listings that begin mid-history, feeds with holes).
 *
 * Alignment resolves both explicitly rather than by accident:
 *
 * - **`join`** picks the x grid every instrument is sampled onto.
 *   - `"primary"` (default): the primary instrument's own x values. Keeps the
 *     price candles authoritative, which is what an overlay comparison wants.
 *   - `"intersection"`: only x values present in *every* instrument. The fair
 *     frame for pairwise statistics (correlation, beta).
 *   - `"union"`: every x seen in any instrument.
 * - **`fill`** decides what a grid point with no observation becomes.
 *   - `"hold"` (default): last observation carried forward. The finance
 *     default: a holiday in one market should not put a hole in the line.
 *   - `"gap"`: `null`, so the rendered line visibly breaks.
 *   - `"drop"`: the grid point is removed entirely, for every instrument. This
 *     is the observed-data-only policy: it never falls back to a held value, so
 *     `join: "union"` with `fill: "drop"` is equivalent to
 *     `join: "intersection"`.
 *
 * One rule overrides `fill` everywhere: a grid point **before** an instrument's
 * first observation is always `null`. Carrying a value backwards would invent
 * history that did not exist, which is the single most misleading thing a
 * comparison chart can do.
 *
 * Values are returned unrounded (see {@link Statistics} for the same contract).
 */
export type AlignResult = {
    /**
     * - The shared x grid, ascending.
     */
    x: number[];
    /**
     * - One value array per
     * instrument, each the same length as `x`.
     */
    columns: {
        [x: string]: number[];
    };
    /**
     * - Per-instrument coverage.
     */
    coverage: {
        [x: string]: AlignCoverage;
    };
    /**
     * - Instrument names, in input order.
     */
    names: string[];
    /**
     * - The resolved primary instrument name.
     */
    primary: string | null;
    /**
     * - Assumptions that had to be made.
     */
    warnings: string[];
};
/**
 * Coerce an x value to axis space: epoch ms for date-like input, the number
 * itself for numeric input. Matches the library-wide convention (see
 * `EventMarkers._coerceX`), where a numeric `x` is already axis space.
 * @param {*} x
 * @returns {number|null} null when it cannot be placed on a numeric axis.
 */
declare function toAxisX(x: any): number | null;
/**
 * Extract the comparable scalar from a point. Accepts the shapes ApexStock
 * already passes around: an OHLC point (`y` is an array, whose close is used), a
 * scalar line point (`y` is a number), or `{ close }`.
 * @param {*} p
 * @param {"close"|"open"|"high"|"low"} [source="close"]
 * @returns {number} NaN when there is no usable value.
 */
declare function toValue(p: any, source?: "close" | "open" | "high" | "low"): number;
/**
 * Normalize one instrument's points into ascending `{x, v}` observations,
 * dropping anything unusable and collapsing duplicate x values (last wins).
 * @param {Array<*>} points
 * @param {"close"|"open"|"high"|"low"} source
 * @returns {Array<{x:number, v:number}>}
 */
declare function observations(points: Array<any>, source: "close" | "open" | "high" | "low"): Array<{
    x: number;
    v: number;
}>;
export {};
