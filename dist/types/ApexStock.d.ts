/**
 * ApexStock — a financial-charting layer on top of ApexCharts. Renders an OHLC
 * main chart plus technical-indicator panes, drawing tools, and theming.
 */
export default class ApexStock {
    /**
     * Per-scope reference count for the shared `<style id="apexstock-css">` tag.
     * Keyed by the node the style is looked up on (the host `Document` or an
     * enclosing `ShadowRoot`) so the tag is injected once per scope and removed
     * only when the last instance sharing it is destroyed — preventing the
     * stylesheet from leaking into `<head>` across SPA navigation.
     * @type {WeakMap<Document | ShadowRoot, number>}
     */
    static _styleRefs: WeakMap<Document | ShadowRoot, number>;
    /**
     * App-wide fallback ApexCharts constructor, set via
     * {@link ApexStock.setApexCharts}. Used when neither a per-instance
     * `options.ApexCharts` nor a global `window.ApexCharts` is available — the
     * bundler-friendly path for `import ApexCharts from "apexcharts"`.
     * @type {*}
     */
    static _defaultApexCharts: any;
    /**
     * Register the ApexCharts constructor once for all subsequently-created
     * instances, so bundler/framework users don't have to assign
     * `window.ApexCharts` themselves:
     *
     * ```js
     * import ApexCharts from "apexcharts";
     * import ApexStock from "apexstock";
     * ApexStock.setApexCharts(ApexCharts); // once at app startup
     * ```
     *
     * Resolution order per instance: `options.ApexCharts` (constructor) →
     * this default → the `ApexCharts` global. The global path still works
     * unchanged for `<script>`-tag users.
     * @param {*} ctor - The ApexCharts constructor.
     * @returns {void}
     */
    static setApexCharts(ctor: any): void;
    /**
     * Register a license key globally (delegates to apex-commons `LicenseManager`).
     * An invalid, expired, or missing key causes the apex-commons watermark
     * overlay to be shown on the chart.
     * @param {string} key - License key in the form `APEX-{encoded}`.
     * @returns {void}
     */
    static setLicense(key: string): void;
    /**
     * Roll fine-grained OHLC candles up into a coarser time frame (e.g. 1m → 1h,
     * 1h → 1d). Pure helper — pass the result to `new ApexStock(...)` or
     * `update({ series })` to re-render at the chosen interval.
     * @param {import("./types.js").Series} series - OHLC points to aggregate.
     * @param {string} interval - one of {@link ApexStock.INTERVALS}.
     * @returns {import("./types.js").Series} Aggregated candles (new array).
     */
    static aggregateOHLC(series: import("./types.js").Series, interval: string): import("./types.js").Series;
    /**
     * Convert an array of plain objects or tuples into the ApexStock OHLC point
     * shape `{ x, y: [open, high, low, close], v? }`. Field names are resolved by
     * case-insensitive alias (`date/time` -> x, `o` -> open, ...); pass a
     * `mapping` to override. Output is validated and time-sorted.
     * @param {Array<Object|Array>} rows
     * @param {Object.<string,string|number>} [mapping]
     * @returns {import("./types.js").Series}
     */
    static normalize(rows: Array<any | any[]>, mapping?: {
        [x: string]: string | number;
    }): import("./types.js").Series;
    /**
     * Zip parallel column arrays (`{ open:[], high:[], low:[], close:[], ... }`)
     * into an OHLC series. Only `close` is required; missing OHLC columns are
     * derived from it.
     * @param {Object.<string, Array>} columns
     * @returns {import("./types.js").Series}
     */
    static fromArrays(columns: {
        [x: string]: any[];
    }): import("./types.js").Series;
    /**
     * Parse CSV text into an OHLC series. Uses the header row (default) to
     * alias-resolve columns; pass `{ header:false }` for positional data and/or a
     * `mapping` to override.
     * @param {string} text
     * @param {{delimiter?:string, header?:boolean, mapping?:Object.<string,string|number>}} [options]
     * @returns {import("./types.js").Series}
     */
    static fromCSV(text: string, options?: {
        delimiter?: string;
        header?: boolean;
        mapping?: {
            [x: string]: string | number;
        };
    }): import("./types.js").Series;
    /**
     * The pure analysis engine, exposed so the statistics can be computed with no
     * chart at all (a server-side report, a test, a worker):
     *
     * ```js
     * ApexStock.stats.rangeStats(series, "2024-01-02", "2024-03-15");
     * ApexStock.stats.drawdown(series);
     * ApexStock.stats.align({ AAPL, SPY }, { join: "intersection" });
     * ```
     *
     * Two contracts worth knowing: values come back **unrounded** (the consumer
     * formats), and every percent-like value is in **percent units** (`20.42`
     * means +20.42%). Anything the data cannot support is `null`, never `0` or
     * `NaN`, and the assumptions made land in the result's `warnings`.
     *
     * @type {{
     *   rangeStats: typeof Statistics.rangeStats,
     *   returns: typeof Statistics.returns,
     *   volatility: typeof Statistics.volatility,
     *   annualize: typeof Statistics.annualize,
     *   inferPeriodsPerYear: typeof Statistics.inferPeriodsPerYear,
     *   resolveIndex: typeof Statistics.resolveIndex,
     *   drawdown: typeof Drawdown.compute,
     *   drawdownRange: typeof Drawdown.range,
     *   worstDrawdown: typeof Drawdown.worst,
     *   align: typeof Align.align,
     *   baseline: typeof Align.baseline,
     *   rebase: typeof Align.rebase,
     *   relative: typeof Align.relative
     * }}
     */
    static stats: {
        rangeStats: typeof Statistics.rangeStats;
        returns: typeof Statistics.returns;
        volatility: typeof Statistics.volatility;
        annualize: typeof Statistics.annualize;
        inferPeriodsPerYear: typeof Statistics.inferPeriodsPerYear;
        resolveIndex: typeof Statistics.resolveIndex;
        drawdown: typeof Drawdown.compute;
        drawdownRange: typeof Drawdown.range;
        worstDrawdown: typeof Drawdown.worst;
        align: typeof Align.align;
        baseline: typeof Align.baseline;
        rebase: typeof Align.rebase;
        relative: typeof Align.relative;
    };
    /**
     * The time-frame intervals accepted by {@link ApexStock.aggregateOHLC}.
     * @type {string[]}
     */
    static INTERVALS: string[];
    /**
     * The version of the state schema produced by {@link ApexStock#getState}.
     * @type {number}
     */
    static STATE_VERSION: number;
    /**
     * Normalize a (possibly older) state object from {@link ApexStock#getState}
     * to the current schema version. Useful when loading a persisted state before
     * calling {@link ApexStock#setState}; `setState` also migrates internally.
     * @param {*} state
     * @returns {import("./types.js").ApexStockState}
     */
    static migrateState(state: any): import("./types.js").ApexStockState;
    /**
     * Register a custom indicator globally so every ApexStock instance created
     * afterwards can use it via `updateIndicator(key)`, show it in the indicators
     * dropdown, and capture/restore it through `getState`/`setState`. Register
     * once at app startup, before constructing charts. See
     * {@link IndicatorHandlers.register} for the definition shape (declarative
     * `{ type, calc, ... }` or an advanced `{ kind, build/apply/remove }`), plus an
     * optional `stream` twin for incremental `appendData()` updates.
     * @param {string} name - Indicator key (case-insensitive).
     * @param {import("./types.js").IndicatorDefinition} def
     * @returns {string} The normalized (lowercased) key.
     */
    static registerIndicator(name: string, def: import("./types.js").IndicatorDefinition): string;
    /**
     * Register (or override) a named theme preset globally, usable on any instance
     * via `theme: { preset: name }` or `setThemePreset(name)`. A preset builds on
     * a base `mode` ("light" | "dark") and overrides a small set of colors:
     * `{ mode, up, down, grid, axis, background, accent }` (missing keys are
     * backfilled from the base mode).
     * @param {string} name
     * @param {import("./core/ThemePresets.js").ThemePreset} def
     * @returns {object|null} the stored preset def, or null on invalid input.
     */
    static registerTheme(name: string, def: import("./core/ThemePresets.js").ThemePreset): object | null;
    /** @returns {string[]} all known theme preset names (built-in + registered). */
    static getThemePresets(): string[];
    /**
     * Register a custom drawing tool globally so `addDrawing({ type: name, ... })`
     * can create it on any ApexStock instance. The tool supplies a
     * `render(data, helpers)` that returns an SVG element from the drawing's
     * data-space record; the drawing layer then reprojects, drags, and serializes
     * it like a built-in shape. Register once at app startup. A serialized drawing
     * of a custom type re-renders after reload only if the tool is registered
     * again first.
     * @param {string} name - Drawing type (case-insensitive); may not shadow a built-in.
     * @param {import("./tools/drawing/DrawingToolRegistry.js").DrawingToolDefinition} def
     * @returns {boolean} true if registered.
     */
    static registerDrawingTool(name: string, def: import("./tools/drawing/DrawingToolRegistry.js").DrawingToolDefinition): boolean;
    /**
     * Link independent ApexStock instances so pan/zoom mirrors across them and a
     * crosshair on one draws a guide at the same x on the others. Built on the
     * event bus and `setVisibleRange` (not ApexCharts' native `group`), so the
     * charts stay independent and can be unlinked.
     * @param {ApexStock[]} instances - Two or more rendered instances.
     * @param {import("./core/ChartSync.js").SyncOptions} [options]
     * @returns {ChartSync} a handle with `disconnect()`.
     */
    static sync(instances: ApexStock[], options?: import("./core/ChartSync.js").SyncOptions): ChartSync;
    /**
     * @param {HTMLElement} chartEl - The container element where the charts will be rendered.
     * @param {import("./types.js").StockChartOptions} chartOptions - ApexCharts options whose `series[0].data` holds the OHLC points.
     * @param {{ApexCharts?: *}} [options] - Optional injection: pass the imported
     *   ApexCharts constructor as `options.ApexCharts` instead of relying on the
     *   `window.ApexCharts` global (bundler/framework-friendly).
     */
    constructor(chartEl: HTMLElement, chartOptions: import("./types.js").StockChartOptions, options?: {
        ApexCharts?: any;
    });
    /** @type {*} The resolved ApexCharts constructor used for all panes. */
    _ApexCharts: any;
    chartEl: HTMLElement;
    chartOptions: import("./types.js").StockChartOptions;
    analysisOptions: {
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
        panel?: boolean | import("./components/AnalysisPanel").AnalysisPanelOptions;
        /**
         * Multi-instrument comparison: alignment, baseline, mode, and the benchmark
         * role. See {@link ComparisonOptions}.
         */
        comparison?: import("./types.js").ComparisonOptions & {
            mode?: import("./types.js").ComparisonMode;
            benchmark?: string;
        };
    };
    paneOptions: {
        [x: string]: import("./types.js").PaneOptions;
    };
    totalHeight: any;
    Utils: typeof Utils;
    xAxisHeight: number;
    _emitter: EventEmitter;
    /** @type {{min: number, max: number}|null} */
    _liveWindow: {
        min: number;
        max: number;
    } | null;
    _documentClickHandlers: any[];
    groupID: string;
    mainChartId: any;
    mainChartDiv: HTMLDivElement;
    indicatorContainer: HTMLDivElement;
    primaryToolbar: HTMLDivElement;
    primaryToolbarLeft: HTMLDivElement;
    primaryToolbarRight: HTMLDivElement;
    indicatorChartMap: {};
    _indicatorState: {};
    tradingOverlays: TradingOverlays;
    annotations: Annotations;
    comparison: Comparison;
    priceScale: PriceScale;
    toolbar: Toolbar;
    drawings: Drawings;
    eventMarkers: EventMarkers;
    legend: Legend;
    measurement: Measurement;
    analysisPanel: AnalysisPanel;
    FIBLEVELS: number[];
    activeOscillator: any;
    themeManager: ThemeManager;
    theme: any;
    isDarkTheme: boolean;
    colors: any;
    series: import("./types.js").Series;
    SettingsControl: typeof SettingsControl;
    overlays: any;
    oscillators: any;
    indicators: any;
    volumesData: {
        x: string | number | Date;
        y: number;
    }[];
    mainChartOptions: any;
    chart: any;
    oscillatorSettings: OscillatorSettings;
    /**
     * Subscribe to an ApexStock event. Safe to call any time after construction,
     * including before {@link ApexStock#render}.
     *
     * Events:
     * - `crosshairMove` / `click` — pointer over the price chart ({@link import("./types.js").CrosshairEvent}).
     * - `rangeChange` fires when the visible x-range changes via zoom/pan/reset,
     *   once per gesture ({@link import("./types.js").RangeChangeEvent}).
     * - `rangeChanging` fires on every frame of an in-progress zoom/pan, with the
     *   same payload, for overlays that must track the gesture.
     * - `indicatorToggle` — an indicator was added or removed ({@link import("./types.js").IndicatorToggleEvent}).
     *
     * @param {import("./types.js").ApexStockEventName|string} name
     * @param {(payload: *) => void} handler
     * @returns {() => void} An unsubscribe function.
     */
    on(name: import("./types.js").ApexStockEventName | string, handler: (payload: any) => void): () => void;
    /**
     * Unsubscribe from an event. With a handler, removes just that handler;
     * without one, removes all handlers for `name`.
     * @param {import("./types.js").ApexStockEventName|string} name
     * @param {(payload: *) => void} [handler]
     * @returns {void}
     */
    off(name: import("./types.js").ApexStockEventName | string, handler?: (payload: any) => void): void;
    /**
     * Subscribe to an event for a single emission.
     * @param {import("./types.js").ApexStockEventName|string} name
     * @param {(payload: *) => void} handler
     * @returns {() => void} An unsubscribe function.
     */
    once(name: import("./types.js").ApexStockEventName | string, handler: (payload: any) => void): () => void;
    /**
     * Emit a (typically custom) event to subscribers. Built-in events are emitted
     * internally; this is exposed so consumers can bridge their own events through
     * the same bus.
     * @param {string} name
     * @param {*} [payload]
     * @returns {void}
     */
    emit(name: string, payload?: any): void;
    /**
     * Build a {@link import("./types.js").CrosshairEvent} from an ApexCharts
     * pointer event and emit it. Skips all work when nothing is subscribed, since
     * `mouseMove` fires frequently.
     * @param {"crosshairMove"|"click"} name
     * @param {MouseEvent} e - The native DOM event.
     * @param {{dataPointIndex?: number, seriesIndex?: number}} cfg - ApexCharts event config.
     * @returns {void}
     * @private
     */
    private _emitPointerEvent;
    /**
     * Capture the chart's current state as a portable, schema-versioned JSON
     * object: the theme (mode and preset), the active chart type, the active
     * indicators with their params, the drawings (measurements included, since a
     * measurement is a drawing), the event markers, the data-space annotations,
     * the trading price lines, the price-scale mode, the comparison setup, and the
     * visible x-range. The result is plain JSON (no functions), safe to
     * `JSON.stringify` and persist per user/workspace. Restore it with
     * {@link ApexStock#setState}.
     *
     * Two things belong to the consumer and are captured by reference rather than
     * by value: a price line's interactive callbacks (`onCross`/`onMove`/
     * `onRemove`), and a comparison instrument's price data. Both are re-supplied
     * after a restore, the second in response to `comparisonRestoreNeeded`.
     * @returns {import("./types.js").ApexStockState}
     */
    getState(): import("./types.js").ApexStockState;
    /**
     * Restore a state previously produced by {@link ApexStock#getState} (any
     * supported version, migrated internally). Reconciles everything
     * {@link ApexStock#getState} captures. Call after {@link ApexStock#render}.
     *
     * A restored comparison keeps any instrument whose data is still loaded and
     * emits `comparisonRestoreNeeded` with the names whose data is not, so
     * subscribe before calling this if you need to re-supply it:
     *
     * ```js
     * chart.on("comparisonRestoreNeeded", ({ names }) => {
     *   names.forEach((name) => chart.addComparison({ name, data: myCache[name] }));
     * });
     * chart.setState(saved);
     * ```
     * @param {import("./types.js").ApexStockState} state
     * @returns {this}
     */
    setState(state: import("./types.js").ApexStockState): this;
    /**
     * Reflect the current active indicators (`indicatorChartMap`) onto the
     * Indicators toolbar dropdown (selected classes, `aria-selected`, trigger
     * label) and `this.activeOscillator`. Used after a programmatic change (e.g.
     * {@link ApexStock#setState}) so the toolbar UI matches the actual state.
     * No-op before {@link ApexStock#render} builds the dropdown.
     * @returns {void}
     * @private
     */
    private _syncIndicatorSelectionUI;
    /**
     * List every available indicator (built-in + custom) with its metadata and
     * this instance's live state. Useful for building a custom indicator picker.
     * @returns {import("./types.js").IndicatorInfo[]} In registry order.
     */
    listIndicators(): import("./types.js").IndicatorInfo[];
    /**
     * Metadata + live state for a single indicator, or null if unknown.
     * @param {string} key - Indicator key (case-insensitive).
     * @returns {import("./types.js").IndicatorInfo|null}
     */
    getIndicator(key: string): import("./types.js").IndicatorInfo | null;
    /**
     * Decorate registry metadata with this instance's live state (active flag,
     * current params, streaming support).
     * @param {{key: string}} meta - Registry metadata from IndicatorHandlers.
     * @returns {import("./types.js").IndicatorInfo}
     * @private
     */
    private _decorateIndicator;
    /**
     * Drop a present-but-nullish top-level `theme` before handing options to
     * ApexCharts. ApexCharts v5 dereferences `config.theme.mode` unconditionally,
     * and an explicit `theme: undefined` (e.g. `theme: someUnsetVar`) overwrites
     * its default rather than being back-filled — so it would throw. Deleting the
     * key lets ApexCharts apply its own default; a valid `theme` object is left
     * untouched.
     * @param {object} options - A chart-options object, mutated in place.
     * @returns {void}
     */
    sanitizeTheme(options: object): void;
    handleWatermark(): void;
    /**
     * Initialize the xaxis range from the series data
     * @param {boolean} useCurrentZoom - Whether to use current zoom state if available
     */
    initializeXAxisRange(useCurrentZoom?: boolean): void;
    xaxisRange: {
        min: number;
        max: number;
    } | {
        min: number;
        max: number;
    };
    /**
     * Handle before reset zoom event from the chart
     */
    handleBeforeResetZoom(ctx: any, e: any): void;
    /**
     * Resolve a zoom/scroll-event x bound to a timestamp for the custom x-axis.
     *
     * ApexCharts reports `e.xaxis.min/max` in the axis's own value space, and the
     * declared `xaxis.type` is not a reliable discriminator (a category-style
     * candlestick axis can still report `type: "numeric"`). What IS reliable is
     * magnitude: on a category/index axis the bound is a small 1-based data index
     * (≤ the number of points), whereas on a numeric/datetime axis — what
     * numeric-timestamp `x` data produces — it is the x value itself, an epoch-ms
     * timestamp that dwarfs any index. So:
     *   - index-sized bound  -> look up `data[round(val - 1)].x`
     *   - timestamp-sized    -> the bound already IS the timestamp
     * The old code always did the index lookup, which on a numeric axis read past
     * the end of the array, yielded `NaN`, and froze the labels on scroll/zoom.
     *
     * @param {object} ctx - The ApexCharts context.
     * @param {number} val - `e.xaxis.min` or `e.xaxis.max`.
     * @param {number} fallback - Value to keep if resolution fails.
     * @returns {number} Timestamp in ms.
     */
    resolveXToTimestamp(ctx: object, val: number, fallback: number): number;
    /**
     * Handle zoom events from the chart
     * @param {Object} e - The zoom event data
     */
    handleZoom(ctx: any, e: any): void;
    /**
     * Handle scroll events from the chart
     * @param {Object} e - The scroll event data
     */
    handleScroll(ctx: any, e: any): void;
    /**
     * Draw the chrome for the current `xaxisRange`, unless it is already drawn.
     * The single entry point for both the per-frame tracker and the settled
     * zoom/scroll handlers, so a gesture redraws once per frame and not once more
     * when it ends.
     * @returns {boolean} Whether the window had moved (and so a redraw happened).
     * @private
     */
    private _syncRangeChrome;
    /**
     * Re-project everything ApexStock draws *around* the plot onto the current
     * `xaxisRange`: the custom x-axis, the fibonacci pane, and the draggable
     * price-line handles. Cheap (sub-millisecond) and idempotent, so it is safe
     * to call once per animation frame during a gesture.
     * @returns {void}
     * @private
     */
    private _refreshRangeChrome;
    /**
     * Track the visible x-window *per animation frame*, not just when a gesture
     * settles.
     *
     * ApexCharts' `zoomed` callback is deliberately once-per-gesture: a wheel or
     * pinch zoom re-renders the plot every frame but defers `zoomed` until 150ms
     * after the last wheel event. Hanging the chrome off `zoomed` alone therefore
     * froze the x-axis, the event markers and any linked chart for the whole
     * gesture, then snapped them into place afterwards: the candles moved and
     * everything around them lagged behind. (Drag-panning never showed this,
     * because ApexCharts' pan path *does* fire `scrolled` per move.)
     *
     * `updated` does fire per frame, so it is the live signal. It also fires for
     * every other kind of update (new series, a theme rebuild, an append), hence
     * the window comparison: anything that did not move the x-window returns
     * immediately.
     *
     * The settled `rangeChange` event keeps its once-per-gesture semantics for
     * consumers; the per-frame signal is `rangeChanging`.
     *
     * @param {object} chart - An ApexCharts instance to listen on (the main chart
     *   or an oscillator pane; the window is always read from the main chart, so
     *   whichever pane the gesture happened over, the work happens once).
     * @returns {void}
     * @private
     */
    private _trackLiveRangeOn;
    /**
     * Read the main chart's current x-window and, if it moved, re-draw the chrome
     * and emit `rangeChanging`. See {@link ApexStock#_trackLiveRangeOn}.
     * @returns {void}
     * @private
     */
    private _trackLiveRange;
    /**
     * Emit the per-frame `rangeChanging` event. Gated on there being a subscriber,
     * since this runs once per animation frame during a gesture.
     * @param {number} min
     * @param {number} max
     * @returns {void}
     * @private
     */
    private _emitRangeChanging;
    /**
     * Emit the `rangeChange` event from the current `xaxisRange`. No-op when the
     * range is not yet initialized or nothing is subscribed.
     * @param {"zoom"|"pan"|"reset"} source - What triggered the change.
     * @returns {void}
     * @private
     */
    private _emitRangeChange;
    /**
     * Render the main chart and initialize all sub-components (chart-type switch,
     * drawing tools, export, custom x-axis, zoom controls). Call once after
     * construction.
     * @returns {void}
     */
    render(): void;
    chartSwitch: ChartSwitch;
    drawingTools: DrawingTools;
    exporter: Export;
    xaxis: XAxis;
    zoomControls: ZoomControls;
    tradingInteractions: TradingOverlayInteractions;
    /**
     * Inject the shared `<style id="apexstock-css">` into the chart's root — the
     * host document's `<head>`, or the enclosing `ShadowRoot`. Deduped by id so
     * it is added once per scope no matter how many charts mount, and reference-
     * counted (see {@link ApexStock._styleRefs}) so {@link ApexStock#destroy} can
     * remove it once the last chart in that scope is gone. Idempotent per
     * instance.
     * @returns {void}
     */
    _injectStyles(): void;
    _styleScope: Document | Node;
    /**
     * Release this instance's reference to the shared stylesheet and, when no
     * instances remain in the same scope, remove the injected `<style>` so it
     * does not linger in `<head>` after the chart is torn down (e.g. SPA
     * navigation). Idempotent — safe to call more than once.
     * @returns {void}
     */
    _removeStyles(): void;
    /**
     * Apply new options/data to the chart, preserving active indicators, zoom
     * state, theme, and chart type across the update.
     * @param {Partial<import("./types.js").StockChartOptions>} newOptions
     * @returns {void}
     */
    update(newOptions: Partial<import("./types.js").StockChartOptions>): void;
    /**
     * Tear down sub-components and their listeners.
     * @returns {void}
     */
    /**
     * Tear down the chart and release every resource it holds: the underlying
     * ApexCharts instances (main + oscillator panes), all managers (which remove
     * their window/document listeners and observers), the shared stylesheet
     * reference, this instance's own document listeners, and all event
     * subscriptions. Idempotent and safe to call before {@link render} or twice
     * (e.g. React StrictMode double-invoke). Guarantees no listener/DOM leak on
     * SPA unmount.
     * @returns {void}
     */
    destroy(): void;
    _destroyed: boolean;
    randomId(): string;
    addCustomIndicatorDropdowns(): void;
    createIndicatorDropdown(title: any, indicators: any): HTMLDivElement;
    computeHeights(newIndicatorCount: any, weights: any): {
        newMainHeight: number;
        indicatorContainerHeight: number;
        indicatorHeight: number;
        indicatorHeights: number[];
    };
    /**
     * How much of the indicator area one pane should get, relative to the others:
     * the `panes` option first, then the indicator's registry default, then 1.
     * @param {string} key - Indicator key (a pane's `data-indicator`).
     * @returns {number}
     * @private
     */
    private _paneWeight;
    /** The pane weights in DOM order, for {@link computeHeights}. @private */
    private _paneWeights;
    /**
     * Set one pane's share of the indicator area and re-apportion the heights.
     * `heightRatio` is relative, not absolute: two panes at 1 and 2 split the area
     * one-third / two-thirds. Pass null to fall back to the pane's default.
     * @param {string} key - Indicator key (e.g. "drawdown", "rsi").
     * @param {number|null} heightRatio
     * @returns {this}
     */
    setPaneHeightRatio(key: string, heightRatio: number | null): this;
    /**
     * The configured pane height ratios (only the ones that differ from their
     * defaults), as captured by `getState()`.
     * @returns {Object.<string, {heightRatio: number}>}
     */
    getPaneHeightRatios(): {
        [x: string]: {
            heightRatio: number;
        };
    };
    updateAllChartHeights(): void;
    isOverlay(indicatorKey: any): boolean;
    /**
     * Get the current visible x-axis range to apply to new charts.
     * @returns {import("./types.js").ZoomState|null} `{minX, maxX}`, or null if the chart is not yet rendered.
     */
    getCurrentZoomState(): import("./types.js").ZoomState | null;
    /**
     * Tear down and rebuild the given indicators so they reflect new data or
     * theme colors. The teardown is required because {@link updateIndicator}
     * toggles: calling it on an already-active indicator would remove it.
     * @param {string[]} indicatorKeys - Keys of currently active indicators.
     * @returns {void}
     */
    refreshIndicators(indicatorKeys: string[]): void;
    /**
     * Refresh the given indicators' DATA over the current series without tearing
     * anything down: overlays are rebuilt onto the main chart, oscillator panes are
     * updated in place (no destroy/recreate/render), and fibonacci re-evaluates.
     * This is the fast path for {@link update} on a series-only change; it preserves
     * zoom and re-seeds the streaming state from the new data. Any indicator that
     * cannot be updated in place (e.g. a builder that opted out) falls back to a
     * full {@link updateIndicator} rebuild.
     * @param {string[]} indicatorKeys - Keys of currently active indicators.
     * @returns {void}
     */
    refreshIndicatorsInPlace(indicatorKeys: string[]): void;
    /**
     * Seed (or re-seed) the incremental streaming state for one indicator from the
     * current `this.series`, bypassing the memoized full-compute cache. No-op for
     * indicators without a streaming twin (ichimoku, fibonacci, volumes), whose
     * stale state (if any) is dropped.
     * @param {string} indicatorKey - Registry indicator key (any casing).
     * @returns {void}
     */
    seedIndicatorState(indicatorKey: string): void;
    /**
     * Drop the streaming state for one indicator (on removal/toggle-off).
     * @param {string} indicatorKey - Registry indicator key (any casing).
     * @returns {void}
     */
    clearIndicatorState(indicatorKey: string): void;
    /**
     * Drop all streaming state. Used when the series is fully replaced so the next
     * append re-seeds from the new data (the active indicators are re-added by
     * {@link refreshIndicators}, which re-seeds each).
     * @returns {void}
     */
    resetIndicatorState(): void;
    /**
     * Step one indicator to the value at this.series' last bar, bypassing the
     * memoized full compute. `entry.state` is the committed running state covering
     * this.series[0 .. entry.len-1]; this advances it to cover the last bar when
     * `commit` is true (a closed bar) and leaves it untouched for a forming bar so
     * the next forming tick re-steps from the same base.
     *
     * To keep a forming-bar *close* O(1): when we step a forming bar we stash the
     * state that WOULD commit it (`entry.formingState`, covering one more bar). When
     * that bar later closes (a new bar arrives so `entry.len` lags by exactly one),
     * we promote the stash instead of re-seeding. The O(n) re-seed is now only a
     * safety net for a genuinely broken invariant (e.g. after a maxPoints trim).
     * @param {{ key: string, params: any, state: any, len: number, formingState: any, formingLen: number }} entry
     * @param {boolean} commit
     * @returns {*} the indicator value at the last bar.
     */
    _stepIndicatorEntry(entry: {
        key: string;
        params: any;
        state: any;
        len: number;
        formingState: any;
        formingLen: number;
    }, commit: boolean): any;
    /**
     * Incrementally append one or more OHLC bars (or replace the forming last bar)
     * without the full teardown/rebuild that {@link update} performs. Price candles,
     * every streamable overlay and oscillator pane, the volume pane, the x-axis, and
     * the view are updated in O(active indicators x small tail) instead of
     * O(full history): no normalizeOHLC over all bars, no memoized full indicator
     * recompute, and no pane destroy/recreate.
     *
     * @param {import("./types.js").OHLCPoint | import("./types.js").OHLCPoint[]} pointOrPoints
     *   One bar, or a batch, in the canonical `{ x, y:[o,h,l,c], v? }` shape.
     * @param {Object} [options]
     * @param {"follow"|"preserve"} [options.view="follow"] `follow` rides the right
     *   edge (shifts a zoomed window to include the new bar); `preserve` keeps the
     *   current zoom window unchanged.
     * @param {number} [options.maxPoints] Rolling-window cap: trims the oldest bars
     *   from the front so the buffer stays fixed-width. Running indicators keep their
     *   carried state (values reflect all history seen, not the trimmed window), so
     *   they intentionally differ from a cold reload of the truncated buffer.
     * @param {boolean} [options.updateLast=false] When the incoming `x` equals the
     *   last bar's `x`, replace it (a forming candle receiving ticks) instead of
     *   appending. With `updateLast`, a new-`x` bar is treated as still forming.
     * @returns {this}
     */
    appendData(pointOrPoints: import("./types.js").OHLCPoint | import("./types.js").OHLCPoint[], options?: {
        view?: "follow" | "preserve";
        maxPoints?: number;
        updateLast?: boolean;
    }): this;
    /**
     * Add a trading price line (a horizontal y-axis annotation on the main chart).
     * @param {import("./overlays/TradingOverlays.js").PriceLineConfig} config
     * @returns {string|null} the line id, or null on invalid input.
     */
    addPriceLine(config: import("./overlays/TradingOverlays.js").PriceLineConfig): string | null;
    /**
     * Add an order line. Pass `side: "buy" | "sell"` to color it accordingly.
     * @param {import("./overlays/TradingOverlays.js").PriceLineConfig} [config]
     * @returns {string|null}
     */
    addOrderLine(config?: import("./overlays/TradingOverlays.js").PriceLineConfig): string | null;
    /**
     * Add a stop-loss line.
     * @param {import("./overlays/TradingOverlays.js").PriceLineConfig} [config]
     * @returns {string|null}
     */
    addStopLoss(config?: import("./overlays/TradingOverlays.js").PriceLineConfig): string | null;
    /**
     * Add a take-profit line.
     * @param {import("./overlays/TradingOverlays.js").PriceLineConfig} [config]
     * @returns {string|null}
     */
    addTakeProfit(config?: import("./overlays/TradingOverlays.js").PriceLineConfig): string | null;
    /**
     * Add a price alert line.
     * @param {import("./overlays/TradingOverlays.js").PriceLineConfig} [config]
     * @returns {string|null}
     */
    addAlert(config?: import("./overlays/TradingOverlays.js").PriceLineConfig): string | null;
    /**
     * Patch an existing price line (e.g. reprice or relabel).
     * @param {string} id
     * @param {Partial<import("./overlays/TradingOverlays.js").PriceLineConfig>} patch
     * @returns {boolean} false if no such line.
     */
    updatePriceLine(id: string, patch: Partial<import("./overlays/TradingOverlays.js").PriceLineConfig>): boolean;
    /**
     * Remove a price line by id.
     * @param {string} id
     * @returns {boolean} false if no such line.
     */
    removePriceLine(id: string): boolean;
    /** Remove every trading price line. @returns {void} */
    clearPriceLines(): void;
    /**
     * @param {string} id
     * @returns {object|null} a copy of the line's config, or null.
     */
    getPriceLine(id: string): object | null;
    /** @returns {object[]} copies of all price-line configs. */
    getPriceLines(): object[];
    /**
     * Add a data-space annotation: a horizontal/vertical line or band, a point
     * marker, or a text label placed at data coordinates (price/time). Distinct
     * from the freehand drawing tools (screen space) and the trading price lines.
     * Annotations persist across update/theme/chart-type switches.
     *
     * @param {import("./overlays/Annotations.js").AnnotationConfig} config
     *   `{ type: "yLine"|"yBand"|"xLine"|"xBand"|"point"|"text", ... }`.
     * @returns {string|null} the annotation id, or null on invalid input.
     */
    addAnnotation(config: import("./overlays/Annotations.js").AnnotationConfig): string | null;
    /**
     * Patch an existing annotation.
     * @param {string} id
     * @param {object} patch
     * @returns {boolean} false if no such annotation.
     */
    updateAnnotation(id: string, patch: object): boolean;
    /**
     * Remove an annotation by id.
     * @param {string} id
     * @returns {boolean} false if no such annotation.
     */
    removeAnnotation(id: string): boolean;
    /** Remove every annotation added via {@link addAnnotation}. */
    clearAnnotations(): void;
    /**
     * @param {string} id
     * @returns {object|null} a copy of the annotation config, or null.
     */
    getAnnotation(id: string): object | null;
    /** @returns {object[]} copies of all annotation configs. */
    getAnnotations(): object[];
    /**
     * Add (or replace, if `id` already exists) an event marker: a time-anchored
     * flag (earnings, dividend, split, news, or custom) that floats along the
     * x-axis with a hover card. Markers reproject through zoom/pan and persist
     * across update/theme/chart-type switches; they are captured by
     * {@link getState} and restored by {@link setState}.
     *
     * @param {import("./overlays/EventMarkers.js").EventMarkerConfig} config
     *   `{ x, type?, label?, color?, glyph?, position?, meta? }`.
     * @returns {string|null} the marker id, or null on invalid input.
     */
    addEventMarker(config: import("./overlays/EventMarkers.js").EventMarkerConfig): string | null;
    /**
     * Patch an existing event marker.
     * @param {string} id
     * @param {object} patch
     * @returns {boolean} false if no such marker.
     */
    updateEventMarker(id: string, patch: object): boolean;
    /**
     * Remove an event marker by id.
     * @param {string} id
     * @returns {boolean} false if no such marker.
     */
    removeEventMarker(id: string): boolean;
    /** Remove every event marker added via {@link addEventMarker}. */
    clearEventMarkers(): void;
    /**
     * @param {string} id
     * @returns {object|null} a copy of the marker config, or null.
     */
    getEventMarker(id: string): object | null;
    /** @returns {object[]} copies of all event-marker configs. */
    getEventMarkers(): object[];
    /**
     * Show the on-chart data legend: a corner panel that reads out the
     * instrument's OHLC, change, and volume at the crosshair (falling back to the
     * latest bar), plus the value of each main-chart overlay indicator. The panel
     * is `pointer-events:none` and updates live via the `crosshairMove` event.
     *
     * @param {import("./components/Legend.js").LegendOptions} [opts]
     *   `{ position?, showVolume?, showChange?, showIndicators? }`.
     * @returns {ApexStock} this, for chaining.
     */
    showLegend(opts?: import("./components/Legend.js").LegendOptions): ApexStock;
    /** Hide the data legend. @returns {ApexStock} this, for chaining. */
    hideLegend(): ApexStock;
    /**
     * Toggle the data legend.
     * @returns {boolean} the new visibility.
     */
    toggleLegend(): boolean;
    /** @returns {boolean} whether the data legend is currently shown. */
    isLegendVisible(): boolean;
    /**
     * Add a programmatic, data-space drawing: a trend line, ray, horizontal price
     * level, vertical time marker, or rectangle/zone, anchored to price/time so it
     * re-projects through zoom/pan/resize like a mouse-drawn shape. Drawings are
     * captured by {@link ApexStock#getState} and restored by
     * {@link ApexStock#setState}.
     *
     * @param {import("./overlays/Drawings.js").DrawingConfig} config
     *   `{ type, points: [{x, y}], color?, width?, fill?, dashArray?, ... }`.
     * @returns {string|null} the drawing id, or null on invalid input.
     */
    addDrawing(config: import("./overlays/Drawings.js").DrawingConfig): string | null;
    /**
     * Patch an existing drawing (geometry and/or style).
     * @param {string} id
     * @param {Partial<import("./overlays/Drawings.js").DrawingConfig>} patch
     * @returns {boolean} false if no such drawing.
     */
    updateDrawing(id: string, patch: Partial<import("./overlays/Drawings.js").DrawingConfig>): boolean;
    /**
     * Remove a drawing by id.
     * @param {string} id
     * @returns {boolean} false if no such drawing.
     */
    removeDrawing(id: string): boolean;
    /** Remove every drawing (mouse-drawn shapes included). */
    clearDrawings(): void;
    /**
     * @param {string} id
     * @returns {object|null} a copy of the drawing config, or null.
     */
    getDrawing(id: string): object | null;
    /** @returns {object[]} copies of all drawing configs (mouse-drawn included). */
    getDrawings(): object[];
    /**
     * Add a comparison instrument (e.g. another ticker) overlaid on the chart as a
     * line on a secondary y-axis, to compare its movement against the primary
     * symbol. See {@link ApexStock#setComparisonMode} for absolute vs. percent.
     * @param {import("./overlays/Comparison.js").ComparisonConfig} config
     *   `{ name, data: [{x, y}], color? }` (OHLC arrays use the close).
     * @returns {string|null} the instrument name, or null on invalid input.
     */
    addComparison(config: import("./overlays/Comparison.js").ComparisonConfig): string | null;
    /**
     * Remove a comparison instrument by name.
     * @param {string} name
     * @returns {boolean} false if no such instrument.
     */
    removeComparison(name: string): boolean;
    /** Remove every comparison instrument (restores the single price axis). */
    clearComparisons(): void;
    /** @returns {object[]} the current comparison instruments. */
    getComparisons(): object[];
    /**
     * Set the comparison normalization mode.
     *
     * - `"percent"` (default): percent change from the baseline.
     * - `"absolute"`: raw prices.
     * - `"indexed"`: the baseline reads `indexBase` (default 100), the
     *   "100 = starting value" view.
     * - `"relative"`: `percentChange(asset) - percentChange(benchmark)`, in
     *   percentage points. Zero means "kept pace".
     * - `"ratio"`: `asset / benchmark`, rebased to `indexBase`.
     *
     * The last two read {@link ApexStock#setComparisonBenchmark}.
     * @param {import("./types.js").ComparisonMode} mode
     * @returns {this}
     */
    setComparisonMode(mode: import("./types.js").ComparisonMode): this;
    /** @returns {import("./types.js").ComparisonMode} the current comparison mode. */
    getComparisonMode(): import("./types.js").ComparisonMode;
    /**
     * Set the benchmark instrument for `relative` and `ratio` mode. The benchmark
     * is a **role**, not a ticker: pass the name of any added instrument, or
     * `"__primary__"` (the default) for the chart's own symbol. Removing the
     * instrument that fills the role hands it back to the primary.
     * @param {string} name
     * @returns {this}
     */
    setComparisonBenchmark(name: string): this;
    /** @returns {string} the benchmark instrument's name, or `"__primary__"`. */
    getComparisonBenchmark(): string;
    /**
     * Patch how comparison instruments are aligned and rebased (`join`, `fill`,
     * `baseline`, `indexBase`, `source`, `rebaseRatio`, `resample`) and re-render.
     * Unknown values are warned about and ignored, so a typo cannot silently
     * change what the numbers mean.
     * @param {import("./types.js").ComparisonOptions} patch
     * @returns {this}
     */
    setComparisonOptions(patch: import("./types.js").ComparisonOptions): this;
    /** @returns {import("./types.js").ComparisonOptions} the current alignment options. */
    getComparisonOptions(): import("./types.js").ComparisonOptions;
    /**
     * The comparison leaderboard: one row per instrument (the primary included),
     * with change, excess return vs the benchmark, high/low, volatility, worst
     * drawdown, rank, and grid coverage. Everything a "who's up more" table needs,
     * already computed.
     *
     * The window runs from the baseline to the last observation, so with
     * `baseline: "visible"` the rows follow the zoom; pass `from`/`to` (x values)
     * to scope it explicitly.
     * @param {{from?: number|Date|string, to?: number|Date|string}} [opts]
     * @returns {import("./types.js").ComparisonRow[]} empty when no instrument is added.
     */
    getComparisonStats(opts?: {
        from?: number | Date | string;
        to?: number | Date | string;
    }): import("./types.js").ComparisonRow[];
    /**
     * Set the primary price-axis scale mode. Purely an axis presentation change:
     * indicators, drawings, annotations, and trading price lines stay in true
     * price space and are unaffected.
     *
     * - `"linear"` — raw price, evenly spaced (default).
     * - `"logarithmic"` — log-distributed price axis; `opts.logBase` (default 10).
     * - `"percent"` — labelled as % change from a baseline (`opts.base`, default
     *   the first data point's close).
     * - `"indexed"` — labelled as an index where the baseline = `opts.indexBase`
     *   (default 100).
     *
     * Fires `priceScaleChange`.
     *
     * @param {"linear"|"logarithmic"|"percent"|"indexed"} mode
     * @param {{base?:number|null, logBase?:number, indexBase?:number}} [opts]
     * @returns {this}
     */
    setPriceScale(mode: "linear" | "logarithmic" | "percent" | "indexed", opts?: {
        base?: number | null;
        logBase?: number;
        indexBase?: number;
    }): this;
    /**
     * @returns {{mode:"linear"|"logarithmic"|"percent"|"indexed", base:number|null, logBase:number, indexBase:number}}
     *   the current price-scale configuration.
     */
    getPriceScale(): {
        mode: "linear" | "logarithmic" | "percent" | "indexed";
        base: number | null;
        logBase: number;
        indexBase: number;
    };
    /**
     * Add, remove, or reconfigure a technical indicator, preserving zoom state.
     *
     * - `updateIndicator(key)` — **toggles** the indicator on/off.
     * - `updateIndicator(key, params)` — sets the indicator's params, ensures it
     *   is active, and applies the change in place (never toggles it off). E.g.
     *   `updateIndicator("rsi", { period: 21 })`. Equivalent to
     *   {@link ApexStock#setIndicatorParams}.
     *
     * @param {string} indicatorKey - Indicator name (e.g. "rsi", "moving average").
     * @param {object} [params] - When provided, sets params + ensures active (no toggle).
     * @returns {this|void}
     */
    updateIndicator(indicatorKey: string, params?: object): this | void;
    /**
     * Set an indicator's parameters programmatically (e.g. change RSI's period),
     * ensuring the indicator is active and applying the change in place — without
     * the toggle semantics of {@link ApexStock#updateIndicator}. If the indicator
     * is not active it is added with these params; if it is active its data (and
     * streaming state) are recomputed in place, preserving zoom.
     *
     * @param {string} indicatorKey - Indicator name (e.g. "rsi", "moving average").
     * @param {object} params - Params to merge (e.g. `{ period: 21 }`).
     * @returns {this}
     */
    setIndicatorParams(indicatorKey: string, params: object): this;
    /**
     * Remove a technical indicator pane/overlay, preserving zoom state.
     * @param {string} indicatorKey - Indicator name (e.g. "rsi", "moving average").
     * @returns {void}
     */
    removeIndicator(indicatorKey: string): void;
    /**
     * Apply saved zoom state to all charts
     * @param {Object} zoomState - The zoom state with minX and maxX
     */
    applyZoomToAllCharts(zoomState: any): void;
    /**
     * Read a structured snapshot of the chart at a data-point index: OHLC,
     * volume, change vs the previous close, and every active indicator's value
     * (main-chart overlays and oscillator panes). The programmatic complement to
     * the on-chart legend and the `crosshairMove` event — pass the event's
     * `dataPointIndex` here to build a custom legend/readout. Values are plain
     * numbers (unformatted); unavailable ones are `null` or omitted.
     * @param {number} [index] - Data-point index; defaults to (and clamps to) the latest bar.
     * @returns {import("./core/DataReadout.js").Readout|null} null if there is no data.
     */
    getDataAt(index?: number): import("./core/DataReadout.js").Readout | null;
    /**
     * Merge the instance's `analysis` options under a per-call override.
     * @param {object} [opts]
     * @returns {object}
     * @private
     */
    private _analysisOpts;
    /**
     * Every statistic for a selected region of the chart: the change (absolute and
     * percent), the duration, the true high and low, the averages, the volatility,
     * and the deepest drawdown *within* the region.
     *
     * ```js
     * chart.getRangeStats(0, 42);                          // by bar index
     * chart.getRangeStats("2024-01-02", "2024-03-15");     // by date
     * const { min, max } = chart.getVisibleRange();
     * chart.getRangeStats(min, max);                       // the visible window
     * ```
     *
     * Endpoints may be given in either order as a bar index, an epoch-ms x value,
     * a `Date`, or a date string; a bare number is read as a bar index when it is
     * a valid one and as an x value otherwise (pass `{ by: "index" }` or
     * `{ by: "x" }` to be explicit). Values are unrounded and every percent-like
     * figure is in percent units. Anything the data cannot support is `null`, with
     * the reason in `warnings`. Notably `annualized` is omitted for spans under
     * `minAnnualizeDays` (default 30) rather than extrapolated.
     *
     * @param {number|string|Date} from
     * @param {number|string|Date} to
     * @param {Object} [opts] - Overrides the instance's `analysis` options.
     * @param {"close"|"open"|"high"|"low"} [opts.source="close"]
     * @param {"close"|"intrabar"} [opts.drawdownBasis="close"]
     * @param {number} [opts.periodsPerYear] - Annualization convention (e.g. 252).
     * @param {number} [opts.minAnnualizeDays=30]
     * @param {"auto"|"index"|"x"} [opts.by="auto"]
     * @returns {import("./analysis/Statistics.js").RangeStats|null} null when there
     *   is no data or the endpoints cannot be resolved.
     */
    getRangeStats(from: number | string | Date, to: number | string | Date, opts?: {
        source?: "close" | "open" | "high" | "low";
        drawdownBasis?: "close" | "intrabar";
        periodsPerYear?: number;
        minAnnualizeDays?: number;
        by?: "auto" | "index" | "x";
    }): import("./analysis/Statistics.js").RangeStats | null;
    /**
     * Measure a region of the chart: create a persistent measurement between two
     * points and return its statistics.
     *
     * The measurement is a real `measure` drawing, so it renders on the chart,
     * can be selected and dragged, reprojects through zoom and pan, and persists
     * through `getState()` / `setState()` exactly like a hand-drawn one. The
     * analysis panel picks it up automatically.
     *
     * ```js
     * const { id, stats } = chart.measureRange("2024-01-02", "2024-03-15");
     * stats.change.percent;      // +20.42
     * stats.drawdown.max;        // -6.4
     * chart.clearMeasurement(id);
     * ```
     *
     * Endpoints accept the same forms as {@link ApexStock#getRangeStats}. Fires
     * `rangeMeasured` with `source: "api"`.
     *
     * @param {number|string|Date} from
     * @param {number|string|Date} to
     * @param {object} [opts] - Drawing style (`color`, `upColor`, `downColor`,
     *   `fillOpacity`, `showLabel`, `locked`, `meta`, ...), plus `by` to steer how
     *   a numeric endpoint is read. Statistics conventions (`periodsPerYear`,
     *   `minAnnualizeDays`, `drawdownBasis`, `source`) are deliberately NOT
     *   per-measurement: they come from the chart's `analysis` options, so a
     *   measurement restored from state cannot disagree with the chart it is on.
     *   Use {@link ApexStock#getRangeStats} for a one-off with different
     *   conventions.
     * @returns {{id: string, stats: import("./analysis/Statistics.js").RangeStats}|null}
     *   null when there is no data or the endpoints cannot be resolved.
     */
    measureRange(from: number | string | Date, to: number | string | Date, opts?: object): {
        id: string;
        stats: import("./analysis/Statistics.js").RangeStats;
    } | null;
    /**
     * Every measurement currently on the chart, with its statistics, in drawing
     * order.
     * @returns {import("./analysis/Measurement.js").MeasurementInfo[]}
     */
    getMeasurements(): import("./analysis/Measurement.js").MeasurementInfo[];
    /**
     * One measurement by id.
     * @param {string} id
     * @returns {import("./analysis/Measurement.js").MeasurementInfo|null}
     */
    getMeasurement(id: string): import("./analysis/Measurement.js").MeasurementInfo | null;
    /**
     * Remove one measurement, or every measurement when `id` is omitted. Other
     * drawing types are never touched. Fires `measurementRemoved` per removal.
     * @param {string} [id]
     * @returns {number} how many measurements were removed.
     */
    clearMeasurement(id?: string): number;
    /**
     * Show the analysis panel: the on-chart readout of the active measurement's
     * region statistics.
     *
     * The panel is automatic by default (it appears when a measurement exists and
     * disappears when the last one is cleared), so this is only needed to pin it
     * open, move it, or change which metrics it shows. `analysis: { panel: false }`
     * at construction opts out entirely, for apps that render their own panel
     * from {@link ApexStock#getRangeStats}.
     *
     * @param {import("./components/AnalysisPanel.js").AnalysisPanelOptions} [opts]
     * @returns {this}
     */
    showAnalysisPanel(opts?: import("./components/AnalysisPanel.js").AnalysisPanelOptions): this;
    /** Hide the analysis panel until `showAnalysisPanel()` is called again. @returns {this} */
    hideAnalysisPanel(): this;
    /** @returns {boolean} whether the analysis panel is currently visible. */
    isAnalysisPanelVisible(): boolean;
    /**
     * The chart's drawdown: how far below its own running peak the instrument has
     * fallen at every bar, plus the deepest drawdown, the current one, and each
     * drawdown episode with its decline, recovery, and underwater durations kept
     * separate (`barsToTrough`, `barsToRecovery`, `barsUnderwater`).
     *
     * Values are percentages at or below zero. `basis: "intrabar"` measures each
     * bar's low against the running high instead of close-against-close, which is
     * the more conservative figure. It defaults to the chart's
     * `analysis.drawdownBasis`, so this, the range statistics, and the drawdown
     * pane all report the same thing.
     *
     * @param {{basis?: "close"|"intrabar"}} [opts]
     * @returns {import("./analysis/Drawdown.js").DrawdownResult}
     */
    getDrawdown(opts?: {
        basis?: "close" | "intrabar";
    }): import("./analysis/Drawdown.js").DrawdownResult;
    /**
     * Get the currently visible x-axis range (the same values reported by the
     * `rangeChange` event). Useful for lazy-loading data for the visible window or
     * synchronizing an external control.
     * @returns {{min: number, max: number}|null} Timestamps/category values, or null if not ready.
     */
    getVisibleRange(): {
        min: number;
        max: number;
    } | null;
    /**
     * Set the visible x-axis range across the main chart and every indicator pane
     * (zooms/pans to `[min, max]`). Fires a `rangeChange` event, like an
     * interactive zoom. Pass the whole data extent to effectively reset the zoom.
     * @param {number} min - Range start (timestamp/category value).
     * @param {number} max - Range end.
     * @returns {this}
     */
    setVisibleRange(min: number, max: number): this;
    /**
     * Lazily create the (headless) image/PDF exporter so programmatic export works
     * even before/without render(). render() creates the button-bearing one.
     * @returns {Export}
     * @private
     */
    private _ensureExporter;
    /**
     * Unified export: one entry point for every output format, returning a Promise
     * of a consistent result. Image formats (`png`/`svg`) and `pdf` resolve with a
     * `Blob` + object `url`; data formats (`csv`/`json`) resolve with the same plus
     * the serialized `text`. `png` falls back to `svg` on browsers that block
     * raster capture (flagged `fallback: true`). Pass `download: true` to also save
     * a file.
     *
     * `include` carries the analysis into the export, meaning something slightly
     * different in each medium because a spreadsheet and a report need different
     * things: for `csv`/`json` it adds per-bar columns (`"indicators"`,
     * `"analysis"`), and for `pdf` it sets a text summary below the chart
     * (`"analysis"`).
     *
     * @param {Object} [options]
     * @param {"png"|"svg"|"pdf"|"csv"|"json"} [options.format="png"]
     * @param {number} [options.scale] - Image/PDF resolution multiplier.
     * @param {"all"|"visible"} [options.range] - Data range (csv/json), and which
     *   window the PDF summary describes (defaults to the visible one there).
     * @param {Array<"ohlc"|"indicators"|"analysis">|string} [options.include] -
     *   Extra content: per-bar columns for csv/json, the summary block for pdf.
     * @param {string[]} [options.summary] - PDF only: your own summary lines.
     * @param {boolean} [options.includeVolume] - Volume column (csv/json).
     * @param {boolean} [options.raw] - Raw `x` instead of ISO time (csv/json).
     * @param {boolean} [options.pretty] - Pretty-print JSON.
     * @param {boolean} [options.download] - Also trigger a file download.
     * @param {string} [options.filename] - Download filename (extension added).
     * @returns {Promise<{format:string, blob: Blob, url: string, text?: string, fallback?: boolean}>}
     */
    export(options?: {
        format?: "png" | "svg" | "pdf" | "csv" | "json";
        scale?: number;
        range?: "all" | "visible";
        include?: Array<"ohlc" | "indicators" | "analysis"> | string;
        summary?: string[];
        includeVolume?: boolean;
        raw?: boolean;
        pretty?: boolean;
        download?: boolean;
        filename?: string;
    }): Promise<{
        format: string;
        blob: Blob;
        url: string;
        text?: string;
        fallback?: boolean;
    }>;
    /**
     * Export the OHLC data as CSV or JSON text (for a "download data" button,
     * reporting, or persistence). Columns: `time, open, high, low, close[,
     * volume]`; `time` is ISO-8601 for numeric timestamps (pass `{ raw: true }`
     * to keep the raw value). The CSV round-trips through
     * {@link ApexStock.fromCSV}.
     *
     * @param {Object} [options]
     * @param {"csv"|"json"} [options.format="csv"]
     * @param {"all"|"visible"} [options.range="all"] - `"visible"` exports only
     *   the points inside the current visible x-range (falls back to all when the
     *   range isn't known yet).
     * @param {boolean} [options.includeVolume] - Force the volume column on/off
     *   (defaults to on when any point has a `v`).
     * @param {Array<"ohlc"|"indicators"|"analysis">|string} [options.include=["ohlc"]]
     *   Extra column groups appended after the OHLC spine (which is always
     *   present, so the CSV keeps round-tripping through `fromCSV`):
     *   `"indicators"` adds one column per active indicator series (main-chart
     *   overlays *and* oscillator panes), null through each one's warm-up;
     *   `"analysis"` adds `return` (percent change from the previous bar) and
     *   `drawdown` (percent below the running peak, per `analysis.drawdownBasis`).
     *   Range statistics are a summary, not a per-bar value, so they are not
     *   columns: read them from {@link ApexStock#getRangeStats}.
     * @param {boolean} [options.raw] - Emit raw `x` instead of ISO time.
     * @param {boolean} [options.pretty] - Pretty-print JSON (default true).
     * @param {boolean} [options.download] - Also trigger a file download.
     * @param {string} [options.filename] - Download filename (extension added).
     * @returns {string} The serialized text.
     */
    exportData(options?: {
        format?: "csv" | "json";
        range?: "all" | "visible";
        includeVolume?: boolean;
        include?: Array<"ohlc" | "indicators" | "analysis"> | string;
        raw?: boolean;
        pretty?: boolean;
        download?: boolean;
        filename?: string;
    }): string;
    /**
     * Build the extra export columns for an `include` selection. Indicator columns
     * come from the live chart state; analysis columns from the same engine
     * `getRangeStats` uses, so an exported number matches an on-chart one.
     * @param {Array<string>|string|undefined} include
     * @param {number} length - Full series length (columns are bar-indexed).
     * @returns {Array<{name:string, values:Array<number|null>}>}
     * @private
     */
    private _exportColumns;
    /**
     * Export the chart as an image. PNG rasterizes a serialized snapshot of the
     * chart; browsers that block `<foreignObject>` rasterization fall back to SVG
     * (flagged as `fallback: true`). SVG is always available.
     *
     * @param {Object} [options]
     * @param {"png"|"svg"} [options.format="png"]
     * @param {number} [options.scale] - Output scale (resolution multiplier).
     * @param {boolean} [options.download] - Also trigger a file download.
     * @param {string} [options.filename] - Download filename (extension added).
     * @returns {Promise<{format:"png"|"svg", blob: Blob, url: string, fallback?: boolean}>}
     */
    exportImage(options?: {
        format?: "png" | "svg";
        scale?: number;
        download?: boolean;
        filename?: string;
    }): Promise<{
        format: "png" | "svg";
        blob: Blob;
        url: string;
        fallback?: boolean;
    }>;
    /** Trigger a browser download of text content. @private */
    private _downloadText;
    /**
     * Updates the chart theme
     * @param {string} newTheme - The new theme ('light' or 'dark')
     */
    updateTheme(newTheme: string): void;
    /**
     * Switch to a named theme preset (a curated look layered on light/dark; see
     * `ApexStock.getThemePresets()` for the built-ins, `ApexStock.registerTheme`
     * to add your own). The preset carries its own base mode.
     * @param {string} name
     * @returns {this}
     */
    setThemePreset(name: string): this;
    /** @returns {string|null} the active theme preset name, or null for a plain mode. */
    getThemePreset(): string | null;
    /**
     * Add (or replace, by `id`) a custom control in the primary toolbar. A button
     * is created from `title`/`icon`/`html` with an `onClick(chart, event)`
     * handler, or pass a ready-made `element`. `position` is `"left"` /
     * `"left-start"` / `"right"` (default `"right"`); `order` sorts within a side.
     * @param {import("./core/Toolbar.js").ToolbarItem} def
     * @returns {string|null} the item id, or null on invalid input.
     */
    addToolbarItem(def: import("./core/Toolbar.js").ToolbarItem): string | null;
    /**
     * Remove a custom toolbar item.
     * @param {string} id
     * @returns {boolean} false if no such item.
     */
    removeToolbarItem(id: string): boolean;
    /** @returns {Array<{id:string, title:string|undefined, position:string}>} custom toolbar items. */
    getToolbarItems(): Array<{
        id: string;
        title: string | undefined;
        position: string;
    }>;
    /**
     * Shared theme-change application for {@link updateTheme} and
     * {@link setThemePreset}: sync mainChartOptions colors, restyle the chrome,
     * push the config, and rebuild indicators/overlays for the new palette.
     * @param {boolean} cmpActive - Whether comparison was active (and suspended).
     * @private
     */
    private _applyThemeChange;
    /**
     * Gets the current theme.
     * @returns {import("./types.js").ThemeMode} Current theme ('light' or 'dark').
     */
    getTheme(): import("./types.js").ThemeMode;
    /**
     * Update the positions of oscillator settings controls
     * Called after height changes, indicator additions/removals
     */
    updateOscillatorSettings(): void;
    /**
     * Updates chart options and applies theme changes if needed.
     * @param {Partial<import("./types.js").StockChartOptions>} newOptions - New chart options.
     * @returns {void}
     */
    updateChartOptions(newOptions: Partial<import("./types.js").StockChartOptions>): void;
    calculateMovingAverage(series: any, period: any): number[];
    calculateRSI(series: any, period: any): number[];
    calculateBollingerBands(series: any, period: any, stdDev: any): {
        middle: Array<number | null>;
        upper: Array<number | null>;
        lower: Array<number | null>;
    };
    calculateMACD(series: any, fastPeriod: any, slowPeriod: any, signalPeriod: any): {
        macd: Array<number | null>;
        signal: Array<number | null>;
        histogram: Array<number | null>;
    };
    calculateEMA(series: any, period: any): number[];
    calculateFibonacciRetracements(series: any): number[];
    calculatePVT(series: any): import("./types.js").IndicatorPoint[];
    calculateVWAP(series: any, source: any): number[];
    calculateATR(series: any, period: any): import("./types.js").IndicatorPoint[];
    calculateDonchian(series: any, period: any): {
        upper: Array<number | null>;
        lower: Array<number | null>;
        middle: Array<number | null>;
    };
    calculateKeltner(series: any, emaPeriod: any, atrPeriod: any, multiplier: any): {
        upper: Array<number | null>;
        lower: Array<number | null>;
        middle: Array<number | null>;
    };
    calculateFibonacciRetracementsForRange(series: any, startIndex: any, endIndex: any): number[];
    calculateStochastic(series: any, period: any, smoothPeriod: any): {
        k: import("./types.js").IndicatorPoint[];
        d: import("./types.js").IndicatorPoint[];
    };
    calculateStdDevIndicator(series: any, period: any): import("./types.js").IndicatorPoint[];
    calculateADX(series: any, period: any): import("./types.js").IndicatorPoint[];
    calculateChaikinOsc(series: any, shortPeriod: any, longPeriod: any): import("./types.js").IndicatorPoint[];
    calculateEMAFromArray(arr: any, period: any): number[];
    calculateSMAFromArray(arr: any, period: any): number[];
    calculateBBPercent(series: any, lower: any, upper: any): import("./types.js").IndicatorPoint[];
    calculateBBWidth(series: any, middle: any, upper: any, lower: any): import("./types.js").IndicatorPoint[];
    calculateLinearRegression(series: any, period: any): import("./types.js").IndicatorPoint[];
    calculateIchimoku(series: any): {
        tenkan: import("./types.js").IndicatorPoint[];
        kijun: import("./types.js").IndicatorPoint[];
        senkouA: import("./types.js").IndicatorPoint[];
        senkouB: import("./types.js").IndicatorPoint[];
        chikou: import("./types.js").IndicatorPoint[];
    };
    calculateAcceleratorOsc(series: any, period: any): import("./types.js").IndicatorPoint[];
    calculateCCI(series: any, period: any): import("./types.js").IndicatorPoint[];
    calculateTSI(series: any, longPeriod: any, shortPeriod: any): {
        tsi: import("./types.js").IndicatorPoint[];
        signal: import("./types.js").IndicatorPoint[];
    };
}
import Utils from "./utils/Utils";
import EventEmitter from "./core/EventEmitter";
import TradingOverlays from "./overlays/TradingOverlays";
import Annotations from "./overlays/Annotations";
import Comparison from "./overlays/Comparison";
import PriceScale from "./core/PriceScale";
import Toolbar from "./core/Toolbar";
import Drawings from "./overlays/Drawings";
import EventMarkers from "./overlays/EventMarkers";
import Legend from "./components/Legend";
import Measurement from "./analysis/Measurement";
import AnalysisPanel from "./components/AnalysisPanel";
import ThemeManager from "./core/ThemeManager";
import SettingsControl from "./components/SettingsControl";
import OscillatorSettings from "./components/OscillatorSettings";
import ChartSwitch from "./core/ChartSwitch";
import DrawingTools from "./tools/drawing/DrawingTools";
import Export from "./tools/export/Export";
import XAxis from "./components/XAxis";
import ZoomControls from "./components/ZoomControls";
import TradingOverlayInteractions from "./overlays/TradingOverlayInteractions";
import Statistics from "./analysis/Statistics";
import Drawdown from "./analysis/Drawdown";
import Align from "./analysis/Align";
import ChartSync from "./core/ChartSync";
