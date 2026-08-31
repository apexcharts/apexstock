export default class Measurement {
    /**
     * The spanned anchors and their delta. Takes whatever coordinate pair the box
     * is drawn at (`{y1, y2}`), so callers pass the resolved geometry rather than
     * the raw element data whenever the two can differ.
     * @private
     */
    private static _selection;
    /** Public-facing copy of a resolved measurement. @private */
    private static _public;
    /** @param {import("../ApexStock.js").default} ctx */
    constructor(ctx: import("../ApexStock.js").default);
    ctx: import("../ApexStock.js").default;
    /** id -> { i0, i1, stats, selection, lines } @type {Map<string, object>} */
    _cache: Map<string, object>;
    /** ids whose resolved range changed and still owe a `rangeMeasured`. */
    _pending: Set<any>;
    /** The measurement the panel is currently showing. */
    _activeId: any;
    _flushHandle: number;
    _boundFlush: () => void;
    /** The `analysis.measure` sub-config, merged over the analysis defaults. */
    _cfg(): {
        snap: boolean | "open" | "high" | "low" | "close";
        label?: Function;
    };
    /** Options for the statistics engine (analysis defaults minus UI keys). */
    _statOpts(): {
        /**
         * - Which OHLC field
         * the anchors, the change, and the averages read.
         */
        source?: "close" | "open" | "high" | "low";
        /**
         * - `"intrabar"` measures
         * each bar's low against the running high (the conservative figure).
         */
        drawdownBasis?: "close" | "intrabar";
        /**
         * - Annualization convention.
         */
        periodsPerYear?: number;
        /**
         * - Below this span an annualized
         * return is omitted rather than extrapolated.
         */
        minAnnualizeDays?: number;
        /**
         * - How a bare number endpoint is read.
         */
        by?: "auto" | "index" | "x";
        /**
         * Measurement tool config. `snap` pulls the box's anchors onto the bar values
         * (`true` means the close); `label(stats, { selection, drawing })` replaces the
         * on-chart readout lines.
         */
        measure?: {
            snap?: boolean | "open" | "high" | "low" | "close";
            label?: Function;
        };
        /**
         * The on-chart analysis panel. Automatic by default (it appears while a
         * measurement exists); `false` opts out entirely for headless use.
         */
        panel?: boolean | import("../components/AnalysisPanel").AnalysisPanelOptions;
        /**
         * Multi-instrument comparison: alignment, baseline, mode, and the benchmark
         * role. See {@link ComparisonOptions}.
         */
        comparison?: import("../types").ComparisonOptions & {
            mode?: import("../types").ComparisonMode;
            benchmark?: string;
        };
    };
    /** The live drawing layer, or null before render(). */
    _layer(): import("../tools/drawing/DrawingTools").default;
    /** The authoritative drawing store (live layer, else the buffered set). */
    _store(): any[];
    /**
     * Resolve a measure drawing's record into bars, statistics, and the label.
     * Cached on `(id, fromIndex, toIndex)`, so a pan or zoom that leaves the
     * anchors alone is free.
     *
     * @param {object} data - The internal measure element record (`x1,y1,x2,y2`).
     * @returns {{id:string, i0:number, i1:number, stats:object, selection:object,
     *   geometry:{x1:number,y1:number,x2:number,y2:number}, lines:string[]}|null}
     *   null when the series cannot resolve the anchors (the caller then falls
     *   back to plain geometry).
     */
    resolve(data: object): {
        id: string;
        i0: number;
        i1: number;
        stats: object;
        selection: object;
        geometry: {
            x1: number;
            y1: number;
            x2: number;
            y2: number;
        };
        lines: string[];
    } | null;
    /** Store a resolved measurement, bounding the cache. @private */
    private _remember;
    /**
     * The coordinates the box is actually drawn at: the raw anchors, or the bar
     * values when `snap` is on.
     * @private
     */
    private _geometry;
    /**
     * The on-chart label's lines. Leads with the selection delta (what the box's
     * height shows), then the duration. Override wholesale with
     * `analysis.measure.label(stats, extra) -> string | string[]`.
     * @private
     */
    private _lines;
    /** Queue a flush on the next frame. @private */
    private _scheduleFlush;
    /** True while a create drag or a move drag is in flight. @private */
    private _dragging;
    /**
     * Emit `rangeMeasured` for every measurement whose range settled since the
     * last flush. Re-arms itself while a drag is still in flight, so one drag
     * produces one event rather than one per frame.
     * @param {"drag"|"api"|"coreRuler"} [source="drag"]
     * @returns {void}
     */
    flush(source?: "drag" | "api" | "coreRuler"): void;
    /** @private */
    private _emit;
    /** Hand a resolved measurement to the panel, if there is one. @private */
    private _paint;
    /** Tell the panel there is nothing to show. @private */
    private _clearPanel;
    /**
     * Create a measurement over a bar range programmatically. It is a real
     * `measure` drawing, so it renders, drags, reprojects on zoom, and persists
     * through `getState()` / `setState()` like a hand-drawn one.
     *
     * @param {number|string|Date} from
     * @param {number|string|Date} to
     * @param {object} [opts] - Passed to `addDrawing` (color, upColor, downColor,
     *   fillOpacity, showLabel, locked, meta, ...), plus statistics overrides.
     * @returns {{id:string, stats:object}|null} null when the endpoints cannot be
     *   resolved or there is no data.
     */
    measure(from: number | string | Date, to: number | string | Date, opts?: object): {
        id: string;
        stats: object;
    } | null;
    /**
     * @param {string} id
     * @returns {MeasurementInfo|null}
     */
    get(id: string): MeasurementInfo | null;
    /**
     * Every measurement currently on the chart, in drawing order.
     * @returns {MeasurementInfo[]}
     */
    getAll(): MeasurementInfo[];
    /**
     * Remove one measurement, or every measurement when `id` is omitted. Other
     * drawing types are never touched.
     * @param {string} [id]
     * @returns {number} how many measurements were removed.
     */
    clear(id?: string): number;
    /**
     * ApexCharts (>= 6.0.0) ships its own measure ruler as an opt-in feature
     * bundle (`import "apexcharts/features/measure"` plus
     * `chart: { measure: { enabled: true } }`). It owns a good gesture (a glass
     * pane that keeps the drag away from zoom/pan) but its numbers are purely
     * geometric: `dx`, `dy`, `percentChange`, `slope` between two anchors, with no
     * view of the high, low, volume, volatility, or drawdown across the span.
     *
     * So ApexStock does not depend on it, and does not replace its own measure
     * drawing with it (the core ruler's pins live on the chart instance, outside
     * ApexStock's state, so they would not survive `getState()`/`setState()`).
     * Instead, when a consumer has enabled it, ApexStock feeds it the same
     * financial readout via `chart.measure.label` and re-emits its `measured`
     * event on the ApexStock bus, so both gestures produce one consistent result.
     *
     * @param {{from:{x:number,y:number}, to:{x:number,y:number}}} payload
     * @returns {string[]} the readout lines, or a geometric fallback.
     */
    labelForCoreRuler(payload: {
        from: {
            x: number;
            y: number;
        };
        to: {
            x: number;
            y: number;
        };
    }): string[];
    /**
     * Re-emit the core ruler's `measured` as ApexStock's `rangeMeasured`, with the
     * full region statistics attached.
     * @param {object} payload - The core `measured` payload.
     * @returns {void}
     */
    onCoreMeasured(payload: object): void;
    /** Statistics for a core-ruler payload's two x positions. @private */
    private _fromCoreRuler;
    /**
     * Invalidate the resolved cache after the series or the chart was rebuilt, so
     * the next redraw recomputes against the new data. Cheap: the drawings
     * themselves are owned by the drawing layer, which reapplies separately.
     * @returns {void}
     */
    reapply(): void;
    /** Drop all state and any queued flush. @returns {void} */
    destroy(): void;
}
/**
 * Measurement: the analysis layer behind the `measure` drawing tool.
 *
 * A measure drawing is two data-space anchors, so it already answers "how far
 * apart are these two points". This manager makes it answer the question an
 * analyst actually asks: **what happened over this stretch of the instrument**.
 * It turns each measure drawing into a full {@link Statistics.rangeStats}
 * readout (change, duration, true high and low, averages, volatility, drawdown)
 * and feeds both the on-chart label and the {@link  ../components/AnalysisPanel.js} * AnalysisPanel}.
 *
 * ## Two numbers, both named
 *
 * A measurement carries two changes, and conflating them would be the easy
 * mistake here:
 *
 * - **selection**: the delta between the two `y` values the box spans, read
 *   from the coordinates it is drawn at (the dragged anchors, or the bar values
 *   they snap to). This is what the box's height shows, and it is the right
 *   number when someone measures a swing from one bar's low to another's high.
 * - **change**: the delta between the instrument's closes at the two bars the
 *   selection spans. This is the number every other statistic is consistent
 *   with (the averages, the volatility, the drawdown), because those are
 *   properties of the series, not of where the pointer went.
 *
 * Both are reported, separately labelled. The on-chart label leads with the
 * selection (the pre-existing behavior, and what the box geometry shows) and the
 * panel shows both. With `analysis.measure.snap` the anchors are pulled onto the
 * bar values, at which point the two agree by construction.
 *
 * ## Why the render path drives it
 *
 * `DrawingTools.redrawElements()` is the single funnel every measure change
 * flows through: the create drag, a move drag, a delete, a zoom, a pan, a
 * resize, a theme rebuild, and a `setState` restore all end there. So
 * {@link resolve} is called from the render path and does the caching, and
 * change detection is keyed on `(id, fromIndex, toIndex)` so panning a chart
 * with a measurement on it recomputes nothing and emits nothing.
 *
 * `rangeMeasured` fires on a **settled** change, not per frame: the flush waits
 * while a drag is in flight (`DrawingTools.isDrawing` /
 * `ElementInteractionManager.isMoving`) so one drag produces one event.
 */
export type MeasurementInfo = {
    /**
     * - The measure drawing's id.
     */
    id: string;
    /**
     * - The left bar.
     */
    from: {
        index: number;
        x: any;
        value: number;
    };
    /**
     * - The right bar.
     */
    to: {
        index: number;
        x: any;
        value: number;
    };
    /**
     *   The dragged anchors and their delta.
     */
    selection: {
        from: number;
        to: number;
        absolute: number;
        percent: number | null;
    };
    /**
     * - The region statistics.
     */
    stats: import("./Statistics.js").RangeStats;
};
