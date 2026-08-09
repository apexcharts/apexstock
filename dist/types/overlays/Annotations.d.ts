export default class Annotations {
    /** @param {import("../ApexStock.js").default} ctx */
    constructor(ctx: import("../ApexStock.js").default);
    ctx: import("../ApexStock.js").default;
    /** @type {Object.<string, object>} id -> normalized annotation */
    items: {
        [x: string]: any;
    };
    _counter: number;
    /** Default annotation color from the theme (falls back to a neutral accent). */
    _defaultColor(): any;
    /** Coerce an x value to the axis space (epoch ms for date-like input). */
    _coerceX(x: any): any;
    /** Validate + normalize a user config into a stored item, or null if invalid. */
    _normalize(config: any): {
        id: string;
        type: any;
        x: any;
        x2: any;
        y: number;
        y2: number;
        label: any;
        color: any;
        fillColor: any;
        opacity: any;
        textColor: any;
        strokeDashArray: any;
        width: any;
        labelPosition: string;
        marker: any;
        meta: any;
    };
    /** A themed label block shared by line/point annotations (or undefined). */
    _label(item: any, color: any): {
        text: any;
        borderColor: any;
        style: {
            background: any;
            color: any;
            fontSize: string;
        };
    };
    /** Resolve the ApexCharts add method + options for a stored annotation. */
    _resolve(item: any): {
        method: string;
        opts: {
            id: any;
            y: any;
            borderColor: any;
            strokeDashArray: any;
        };
    } | {
        method: string;
        opts: {
            id: any;
            x: any;
            borderColor: any;
            strokeDashArray: any;
        };
    } | {
        method: string;
        opts: {
            id: any;
            x: any;
            y: any;
            marker: any;
        };
    };
    /** Draw one annotation via the resolved ApexCharts method. */
    _apply(item: any): void;
    /** Public-facing copy of an annotation. */
    _public(item: any): {
        id: any;
        type: any;
        x: any;
        x2: any;
        y: any;
        y2: any;
        label: any;
        color: any;
        fillColor: any;
        opacity: any;
        textColor: any;
        strokeDashArray: any;
        width: any;
        labelPosition: any;
        marker: any;
        meta: any;
    };
    /**
     * Add (or replace, if `id` already exists) a data-space annotation.
     * @param {AnnotationConfig} config
     * @returns {string|null} the annotation id, or null on invalid input.
     */
    add(config: AnnotationConfig): string | null;
    /**
     * Patch an existing annotation (merges into its config).
     * @param {string} id
     * @param {Partial<AnnotationConfig>} [patch]
     * @returns {boolean} false if no such annotation.
     */
    update(id: string, patch?: Partial<AnnotationConfig>): boolean;
    /**
     * Remove an annotation.
     * @param {string} id
     * @returns {boolean} false if no such annotation.
     */
    remove(id: string): boolean;
    /** Remove every annotation this manager owns (leaves others intact). */
    clear(): void;
    /**
     * @param {string} id
     * @returns {object|null} a copy of the annotation config, or null.
     */
    get(id: string): object | null;
    /** @returns {object[]} copies of all annotation configs. */
    getAll(): object[];
    /**
     * Re-apply every annotation (removes then re-adds by id). Idempotent, and
     * re-reads theme colors so a theme switch recolors defaults. Called after any
     * chart re-render that may drop or stale dynamic annotations.
     */
    reapply(): void;
    /** Remove all annotations and drop state. */
    destroy(): void;
}
/**
 * Data-space annotations: horizontal/vertical lines, bands, point markers, and
 * text placed at data coordinates (price and time), distinct from the freehand
 * drawing tools (screen space) and the trading price lines
 * ({@link TradingOverlays}, a specialized y-line subset).
 *
 * Each annotation is a declarative config the consumer owns; this manager keeps
 * the source-of-truth map and mirrors it into ApexCharts annotations,
 * re-applying them on every re-render (update / theme / chart-type switch) so
 * they persist. Removal is always by id (never `clearAnnotations()`), so trading
 * price lines and indicator annotations are left untouched.
 *
 * Types:
 * - `yLine`  — horizontal line at `y`.
 * - `yBand`  — horizontal band between `y` and `y2`.
 * - `xLine`  — vertical line at `x` (timestamp/category).
 * - `xBand`  — vertical band between `x` and `x2`.
 * - `point`  — marker at (`x`, `y`), optionally labeled.
 * - `text`   — a label at (`x`, `y`) with no marker.
 */
export type AnnotationConfig = {
    type: "yLine" | "yBand" | "xLine" | "xBand" | "point" | "text";
    /**
     * - Stable id; auto-generated ("anno-N") when omitted.
     */
    id?: string;
    /**
     * - Y (price) for yLine/yBand/point/text.
     */
    y?: number;
    /**
     * - Second Y for yBand.
     */
    y2?: number;
    /**
     * - X (time) for xLine/xBand/point/text.
     */
    x?: number | string | Date;
    /**
     * - Second X for xBand.
     */
    x2?: number | string | Date;
    /**
     * - Label text.
     */
    label?: string;
    /**
     * - Alias for `label` (natural for type "text").
     */
    text?: string;
    /**
     * - Line/marker/label color; defaults from the theme.
     */
    color?: string;
    /**
     * - Band fill (defaults to `color`).
     */
    fillColor?: string;
    /**
     * - Band fill opacity.
     */
    opacity?: number;
    /**
     * - Label text color.
     */
    textColor?: string;
    /**
     * - Line dash length.
     */
    strokeDashArray?: number;
    /**
     * - Line width.
     */
    width?: number;
    /**
     * - Label side for y annotations.
     */
    labelPosition?: "left" | "right";
    /**
     * - Point marker overrides ({ size, shape, fillColor, ... }).
     */
    marker?: object;
    /**
     * - Arbitrary consumer payload, returned by get()/getAll().
     */
    meta?: any;
};
