export default class PriceScale {
    /** @param {import("../ApexStock.js").default} ctx */
    constructor(ctx: import("../ApexStock.js").default);
    ctx: import("../ApexStock.js").default;
    mode: string;
    /** Explicit baseline for percent/indexed; null => first data point's close. */
    base: number;
    logBase: number;
    indexBase: number;
    /** Once true, reapply() asserts on every rebuild (else it no-ops). */
    _touched: boolean;
    /** Baseline resolved from data, recomputed on each reapply. */
    _base: any;
    _fmt: (v: any) => any;
    /** Merge a partial `{ mode, base, logBase, indexBase }` into the config. */
    _assign(opts: any): void;
    /** @returns {"linear"|"logarithmic"|"percent"|"indexed"} */
    getMode(): "linear" | "logarithmic" | "percent" | "indexed";
    /** @returns {{mode:string, base:number|null, logBase:number, indexBase:number}} */
    get(): {
        mode: string;
        base: number | null;
        logBase: number;
        indexBase: number;
    };
    /**
     * Set the scale mode (and optional knobs) and re-render the axis.
     * @param {"linear"|"logarithmic"|"percent"|"indexed"} mode
     * @param {{base?:number|null, logBase?:number, indexBase?:number}} [opts]
     * @returns {void}
     */
    setMode(mode: "linear" | "logarithmic" | "percent" | "indexed", opts?: {
        base?: number | null;
        logBase?: number;
        indexBase?: number;
    }): void;
    /** Resolve the baseline for percent/indexed from the current series. */
    _computeBase(): any;
    /** Axis label formatter for the active mode. Reads live `this._base`. */
    _format(v: any): any;
    /** The non-label part of the primary-axis patch (scaling only). */
    _axisPatch(): {
        logarithmic: boolean;
    };
    /**
     * Re-assert the primary-axis scale on the live chart. No-op until the scale
     * has been touched. Preserves any secondary (comparison) axes by rewriting
     * only index 0 of the live y-axis array.
     * @returns {void}
     */
    reapply(): void;
    /**
     * JSON snapshot for state serialization, or null when the scale was never
     * touched (a null in state means "default linear scale").
     * @returns {{mode:string, base:number|null, logBase:number, indexBase:number}|null}
     */
    _serialize(): {
        mode: string;
        base: number | null;
        logBase: number;
        indexBase: number;
    } | null;
    /**
     * Restore from a snapshot. A null/absent snapshot resets to the default
     * linear scale (re-asserting only if a non-default scale is currently live,
     * so a prior percent/log formatter is cleared).
     * @param {object|null} state
     * @returns {void}
     */
    _restore(state: object | null): void;
    /** Drop state (chart teardown handles the axis itself). */
    destroy(): void;
}
