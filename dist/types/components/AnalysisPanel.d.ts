export default class AnalysisPanel {
    /** The default row set, exposed for consumers composing their own list. */
    static METRICS: string[];
    /** @param {import("../ApexStock.js").default} ctx */
    constructor(ctx: import("../ApexStock.js").default);
    ctx: import("../ApexStock.js").default;
    opts: {
        enabled: boolean;
        show: boolean;
        position: "top-left" | "top-right" | "bottom-left" | "bottom-right";
        metrics: string[];
        formatters: {
            price?: Function;
            percent?: Function;
            volume?: Function;
            date?: Function;
        };
        title: string;
        placeholder: string;
    };
    _el: HTMLDivElement;
    _rows: Map<any, any>;
    /** The last resolved measurement handed in, so reapply can repaint it. */
    _current: {
        stats: object;
        selection: object;
    };
    /** True while the panel is in the DOM and visible. */
    _visible: boolean;
    _dark(): boolean;
    _upColor(): "#26A69A" | "#00B746";
    _downColor(): "#EF5350" | "#EF403C";
    _muted(): "#9aa4b2" | "#667085";
    /** A price, via `formatters.price`, else 2dp. */
    _price(v: any): string;
    /** A percentage with an explicit sign, via `formatters.percent`. */
    _pct(v: any, { sign }?: {
        sign?: boolean;
    }): string;
    /** A volume, via `formatters.volume`, else compacted (1.20M). */
    _vol(v: any): string;
    /** A date, via `formatters.date`, else ISO yyyy-mm-dd (epoch ms x only). */
    _date(x: any): string;
    /** Build (once) and return the panel element, or null with no host. */
    _ensureEl(): HTMLDivElement;
    _title: HTMLDivElement;
    _range: HTMLDivElement;
    _body: HTMLDivElement;
    _note: HTMLDivElement;
    /** Remove the element and forget the child refs (rebuilt on next paint). */
    _removeEl(): void;
    /**
     * Get (creating on first use) the label/value pair for a metric key. Rows are
     * reused across repaints so a drag mutates text rather than rebuilding DOM.
     * @private
     */
    private _row;
    /** Write one metric row, or hide it when there is nothing to say. @private */
    private _set;
    /**
     * Render a resolved measurement.
     * @param {{stats: object, selection: object}} resolved - From
     *   {@link ../analysis/Measurement.js Measurement#resolve}.
     * @returns {void}
     */
    showMeasurement(resolved: {
        stats: object;
        selection: object;
    }): void;
    /**
     * Paint the panel. A null measurement renders the placeholder, which is what
     * an explicitly-shown panel displays before anything has been measured.
     * @private
     */
    private _paint;
    /** Write a single metric by key. @private */
    private _metric;
    /**
     * Force the panel on (optionally patching its options) and repaint the current
     * measurement if there is one.
     * @param {AnalysisPanelOptions} [opts]
     * @returns {void}
     */
    show(opts?: AnalysisPanelOptions): void;
    /** Force the panel off. It stays hidden until `show()` is called again. */
    hide(): void;
    /** @returns {boolean} whether the panel is currently rendered and visible. */
    isVisible(): boolean;
    /**
     * There is nothing to show (the last measurement was cleared). Returns the
     * panel to its resting state without changing the configured mode.
     * @returns {void}
     */
    clear(): void;
    /**
     * Rebuild after a (re-)render or theme change: the palette is baked into
     * inline styles, so the element is discarded and repainted.
     * @returns {void}
     */
    reapply(): void;
    /** Remove the panel and drop state. */
    destroy(): void;
}
/**
 * AnalysisPanel: the readout surface for the analysis layer.
 *
 * Where the {@link Legend} answers "what is this bar", this panel answers "what
 * happened over this stretch". It renders a {@link  * ../analysis/Measurement.js Measurement}'s statistics as a compact,
 * professional block: the dated range, the change, the true high and low, the
 * averages, the volatility, the annualized return, and the deepest drawdown
 * with its decline and recovery durations.
 *
 * It follows the {@link Legend} conventions exactly, because they are the ones
 * the rest of the library settled on: an absolutely positioned block inside
 * `chartEl`, `pointer-events:none` so it never intercepts chart interaction,
 * theme colors baked into inline styles and rebuilt on {@link reapply}, and a
 * stable class on every part so a consumer can restyle it. Each metric row also
 * carries `data-metric="<key>"`, which is what the e2e tests read.
 *
 * Visibility is **automatic by default**: the panel appears when a measurement
 * exists and disappears when the last one is cleared, so a chart nobody has
 * measured on carries no extra chrome. `analysis.panel: false` suppresses it
 * entirely (the headless mode, for apps that render their own side panel from
 * `getRangeStats()`), and `showAnalysisPanel()` / `hideAnalysisPanel()` force it
 * either way.
 *
 * Two numbers are shown deliberately, separately labelled: **Change** is the
 * instrument's close-to-close move over the spanned bars (the number every
 * other statistic here is consistent with), and **Selection** is the delta
 * between the two anchors the user actually dragged. See
 * {@link  ../analysis/Measurement.js Measurement} for why both exist.
 */
export type AnalysisPanelOptions = {
    /**
     * - Force visibility. Omit for the automatic mode.
     */
    show?: boolean;
    /**
     * Defaults to the opposite corner from the legend, so the two never collide.
     */
    position?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
    /**
     * - Which rows to render, in order. See
     * {@link DEFAULT_METRICS}.
     */
    metrics?: string[];
    formatters?: {
        price?: Function;
        percent?: Function;
        volume?: Function;
        date?: Function;
    };
    /**
     * - Panel heading; "" hides it.
     */
    title?: string;
    /**
     * - Shown by an explicitly
     * visible panel before anything has been measured.
     */
    placeholder?: string;
};
