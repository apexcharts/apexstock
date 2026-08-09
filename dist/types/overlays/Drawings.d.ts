export default class Drawings {
    /** @param {import("../ApexStock.js").default} ctx */
    constructor(ctx: import("../ApexStock.js").default);
    ctx: import("../ApexStock.js").default;
    /** @type {Array<{element:(SVGElement|null), data:object}>} */
    _pending: Array<{
        element: (SVGElement | null);
        data: object;
    }>;
    _counter: number;
    /** The live drawing layer, or null before render(). */
    _layer(): import("../tools/drawing/DrawingTools").default;
    /** The authoritative element-store array ({element,data}), in place. */
    _store(): any[];
    /** Repaint the overlay from the current data (no-op before render). */
    _redraw(): void;
    _emit(name: any, payload: any): void;
    /** Default stroke color from the theme (falls back to a neutral accent). */
    _defaultColor(): any;
    /** Coerce an x value to axis space (epoch ms for date-like input). */
    _coerceX(x: any): any;
    /** The primary OHLC series ({x, y:[o,h,l,c]}), or an empty array. */
    _series(): import("../types.js").Series;
    /**
     * Snap a data-space point to bar values. With a numeric x, the point moves to
     * the nearest bar's x and its y snaps to that bar's chosen OHLC value; with no
     * x (a price-only point), y snaps to the nearest matching value across all
     * bars.
     * @param {{x:(number|null), y:number}} pt
     * @param {"ohlc"|"open"|"high"|"low"|"close"} mode
     * @param {import("../types.js").Series} series
     * @returns {{x:(number|null), y:number}}
     */
    _snapPoint(pt: {
        x: (number | null);
        y: number;
    }, mode: "ohlc" | "open" | "high" | "low" | "close", series: import("../types.js").Series): {
        x: (number | null);
        y: number;
    };
    /** Validate + normalize a user config into an internal `data`, or null. */
    _normalize(config: any): any;
    /** Public-facing copy of an internal element `data`. */
    _public(data: any): {
        id: any;
        type: any;
        color: any;
        width: any;
        dashArray: any;
        locked: boolean;
        visible: boolean;
        meta: any;
    };
    /**
     * Add (or replace, if `id` already exists) a data-space drawing.
     * @param {DrawingConfig} config
     * @returns {string|null} the drawing id, or null on invalid input.
     */
    add(config: DrawingConfig): string | null;
    /**
     * Patch an existing drawing (merges into its public config).
     * @param {string} id
     * @param {Partial<DrawingConfig>} [patch]
     * @returns {boolean} false if no such drawing.
     */
    update(id: string, patch?: Partial<DrawingConfig>): boolean;
    /**
     * Remove a drawing by id.
     * @param {string} id
     * @returns {boolean} false if no such drawing.
     */
    remove(id: string): boolean;
    /** Remove every drawing (mouse-drawn included). */
    clear(): void;
    /**
     * @param {string} id
     * @returns {object|null} a copy of the drawing config, or null.
     */
    get(id: string): object | null;
    /** @returns {object[]} copies of all drawing configs (mouse-drawn included). */
    getAll(): object[];
    /**
     * Flush any drawings buffered before render() into the now-live layer.
     * Called by {@link ApexStock#render} after the drawing tools are created.
     */
    reapply(): void;
    /**
     * Lossless plain-JSON snapshot of every drawing, for state serialization.
     * Un-serializable entries (e.g. a captured tooltip DOM) are skipped.
     * @returns {object[]}
     */
    _serialize(): object[];
    /**
     * Replace all drawings with a serialized list (from {@link _serialize}).
     * @param {object[]} list
     */
    _restore(list: object[]): void;
    /** Remove all drawings and drop state. */
    destroy(): void;
}
/**
 * Programmatic, data-space drawing API — a public facade over the drawing
 * layer's element model ({@link DrawingTools}). Where {@link Annotations}
 * mirrors declarative marks into native ApexCharts annotations, this manager
 * drives the freehand/anchored SVG overlay: it creates, edits, queries, and
 * serializes drawings whose geometry lives in *data* space ({@link  * https://en.wikipedia.org/wiki/Cartesian_coordinate_system price/time}), so
 * they re-project through {@link CoordinateConverter} on every zoom/pan/resize
 * exactly like a mouse-drawn shape.
 *
 * Because every drawing (mouse-drawn or programmatic) is stored the same way in
 * `drawingTools.elements`, this is also the single source of truth for
 * serialization: {@link ApexStock#getState} captures the whole set and
 * {@link ApexStock#setState} restores it.
 *
 * Public types (input `type`, plus the aliases each accepts):
 * - `trendline` (alias `line`)      — a segment between two `{x, y}` points.
 * - `ray`                           — a half-line from point 0 through point 1,
 *                                     extended to the grid edge.
 * - `horizontalLine` (alias `hline`)— a price level spanning the full width.
 * - `verticalLine` (alias `vline`)  — a time marker spanning the full height.
 * - `rectangle` (alias `zone`)      — a filled box between two corner points.
 * - `fibRetracement` / `fibExtension` — Fibonacci level lines between two
 *                                     anchor points, each labeled with its ratio.
 * - `measure`                         — a box between two points, labeled with
 *                                     the price change, percent change, and bar
 *                                     count (green up, red down).
 *
 * `getDrawings()` additionally reports mouse-drawn `brush`/`highlighter`/
 * `circle`/`ellipse`/`text` shapes (read-only round-trip via state).
 */
export type DrawingConfig = {
    type: "trendline" | "line" | "ray" | "horizontalLine" | "hline" | "verticalLine" | "vline" | "rectangle" | "zone" | "fibRetracement" | "fibExtension" | "measure";
    /**
     * - Stable id; auto-generated ("draw-N") when omitted.
     */
    id?: string;
    /**
     * - Data-space
     * anchors. trendline, ray, rectangle, fib, and measure need two;
     * horizontalLine uses `y` of the first; verticalLine uses `x` of the first.
     */
    points?: Array<{
        x: (number | string | Date);
        y: number;
    }>;
    /**
     * - Snap each point to
     * bar values: `true` (nearest OHLC value) or a specific field of the nearest bar.
     */
    snap?: boolean | "open" | "high" | "low" | "close";
    /**
     * - Fibonacci ratios (fib* only); defaults to the
     * standard retracement/extension set.
     */
    levels?: number[];
    /**
     * - Draw ratio labels (fib* only).
     */
    showLabels?: boolean;
    /**
     * - Measure box tint when the move is up.
     */
    upColor?: string;
    /**
     * - Measure box tint when the move is down.
     */
    downColor?: string;
    /**
     * - Draw the measure label (measure only).
     */
    showLabel?: boolean;
    /**
     * - Stroke color; defaults from the theme.
     */
    color?: string;
    /**
     * - Stroke width.
     */
    width?: number;
    /**
     * - Fill color (rectangle); defaults to `color`.
     */
    fill?: string;
    /**
     * - Fill opacity (rectangle).
     */
    fillOpacity?: number;
    /**
     * - Stroke dash pattern for line types.
     */
    dashArray?: number | number[];
    /**
     * - When true the drawing is not selectable
     * or draggable in the UI (still visible and serialized).
     */
    locked?: boolean;
    /**
     * - When false the drawing is not rendered
     * (still serialized, so it round-trips through state).
     */
    visible?: boolean;
    /**
     * - Arbitrary consumer payload, returned by get()/getAll().
     */
    meta?: any;
};
