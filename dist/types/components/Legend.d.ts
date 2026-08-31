export default class Legend {
    /** @param {import("../ApexStock.js").default} ctx */
    constructor(ctx: import("../ApexStock.js").default);
    ctx: import("../ApexStock.js").default;
    opts: {
        show: boolean;
        position: any;
        showVolume: boolean;
        showChange: boolean;
        showIndicators: boolean;
    };
    _el: HTMLDivElement;
    _unsubs: any[];
    _visible: boolean;
    _dark(): boolean;
    _upColor(): "#26A69A" | "#00B746";
    _downColor(): "#EF5350" | "#EF403C";
    /** Compact volume format (1.2M, 3.4K). */
    _fmtVol(v: any): string;
    _fmt(v: any): string;
    /**
     * Height of the x-axis strip along the bottom of the host. Measured live so a
     * re-laid-out axis is honoured (the panel is rebuilt on every {@link reapply},
     * so this is re-read rather than baked in), falling back to the height the
     * layout reserves for the strip.
     * @returns {number}
     * @private
     */
    private _axisStripHeight;
    _ensureEl(): HTMLDivElement;
    _o: HTMLElement;
    _h: HTMLElement;
    _l: HTMLElement;
    _c: HTMLElement;
    _chg: HTMLSpanElement;
    _vol: HTMLDivElement;
    _ind: HTMLDivElement;
    _title: HTMLDivElement;
    /** Remove the panel and forget the child refs (rebuilt on next show). */
    _removeEl(): void;
    /** Main-chart overlay indicator values at `idx`, read defensively. */
    _indicatorRows(idx: any): any[];
    /**
     * Render the panel for a crosshair payload (or, when null, the latest bar).
     * @param {object|null} payload - A `crosshairMove` event payload, or null.
     */
    _render(payload: object | null): void;
    /**
     * Show the legend (optionally patching its options), subscribe to the
     * crosshair, and render the latest bar.
     * @param {LegendOptions} [opts]
     */
    show(opts?: LegendOptions): void;
    /** Hide the legend and unsubscribe from the event bus. */
    hide(): void;
    /** Toggle visibility. @returns {boolean} the new visibility. */
    toggle(): boolean;
    /** @returns {boolean} whether the legend is currently shown. */
    isVisible(): boolean;
    /**
     * Re-establish the legend after a (re-)render. Shows it if enabled by option
     * or a prior `show()`, and repaints from the latest bar. Called by
     * {@link ApexStock#render} and after `update()`/theme changes.
     */
    reapply(): void;
    /** Remove the panel, unsubscribe, and drop state. */
    destroy(): void;
}
/**
 * On-chart data legend (a.k.a. data window): a small panel pinned in a corner of
 * the price chart that reads out the instrument's OHLC, volume, and change at the
 * crosshair, plus the value of each main-chart overlay indicator. It tracks the
 * pointer via the public `crosshairMove` event and falls back to the latest bar
 * when the pointer is not over the plot.
 *
 * Opt-in: enabled via `options.legend = { show: true, ... }` at construction, or
 * imperatively with {@link ApexStock#showLegend} / `hideLegend` / `toggleLegend`.
 * The panel is `pointer-events:none`, so it never intercepts chart interaction,
 * and it subscribes to the event bus only while visible (so a chart that never
 * shows the legend keeps the bus's no-listener fast path).
 */
export type LegendOptions = {
    /**
     * - Show the legend.
     */
    show?: boolean;
    position?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
    /**
     * - Include a volume row.
     */
    showVolume?: boolean;
    /**
     * - Include the change vs the previous close.
     */
    showChange?: boolean;
    /**
     * - Include main-chart overlay indicator values.
     */
    showIndicators?: boolean;
};
