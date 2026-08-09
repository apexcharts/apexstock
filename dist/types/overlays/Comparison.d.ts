export default class Comparison {
    /** @param {import("../ApexStock.js").default} ctx */
    constructor(ctx: import("../ApexStock.js").default);
    ctx: import("../ApexStock.js").default;
    /** @type {Object.<string, {name:string, data:{x:*,close:number}[], color:string}>} */
    items: {
        [x: string]: {
            name: string;
            data: {
                x: any;
                close: number;
            }[];
            color: string;
        };
    };
    mode: string;
    _counter: number;
    /** Names currently rendered as comparison series (to filter on reapply). */
    _rendered: Set<any>;
    /** @returns {boolean} true if any comparison instrument is present. */
    isActive(): boolean;
    /** @returns {"absolute"|"percent"} */
    getMode(): "absolute" | "percent";
    /** Set the normalization mode and re-render. */
    setMode(mode: any): void;
    /** Extract the close value from a point ({x,y:[o,h,l,c]} | {x,y:number} | {x,close}). */
    _close(p: any): any;
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
    /** Compute a comparison line's points for the current mode. */
    _line(item: any): any;
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
    /** Remove all comparison series + restore the single axis, and drop state. */
    destroy(): void;
}
/**
 * Comparison mode: overlay one or more additional instruments (e.g. AAPL vs
 * MSFT vs SPY) on the main chart as line series, to compare their movement
 * against the primary symbol and each other.
 *
 * Because compared instruments rarely share the primary's price scale, they are
 * plotted on a dedicated **secondary y-axis**. Two normalization modes:
 * - `"absolute"` — raw close prices (secondary axis shows price).
 * - `"percent"`  — indexed performance: each instrument as % change from its
 *   first data point (secondary axis shows %). This is the "who's up more"
 *   view; it is the default.
 *
 * The primary candlestick and any indicators keep the primary y-axis untouched.
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
     * - Points; OHLC arrays use the close.
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
