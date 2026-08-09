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
    totalHeight: any;
    Utils: typeof Utils;
    xAxisHeight: number;
    _emitter: EventEmitter;
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
    drawings: Drawings;
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
     * - `rangeChange` — visible x-range changed via zoom/pan/reset ({@link import("./types.js").RangeChangeEvent}).
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
     * object: theme mode, active chart type, active indicators (with their
     * params), and the visible x-range. The result is plain JSON (no functions),
     * safe to `JSON.stringify` and persist per user/workspace. Restore it with
     * {@link ApexStock#setState}.
     * @returns {import("./types.js").ApexStockState}
     */
    getState(): import("./types.js").ApexStockState;
    /**
     * Restore a state previously produced by {@link ApexStock#getState} (any
     * supported version — it is migrated internally). Reconciles theme, chart
     * type, indicators (+params), the toolbar selection, and zoom. Call after
     * {@link ApexStock#render}.
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
    computeHeights(newIndicatorCount: any): {
        newMainHeight: number;
        indicatorContainerHeight: number;
        indicatorHeight: number;
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
     * Set the comparison normalization mode: `"percent"` (indexed % change from
     * each instrument's first point, the default) or `"absolute"` (raw prices).
     * @param {"absolute"|"percent"} mode
     * @returns {this}
     */
    setComparisonMode(mode: "absolute" | "percent"): this;
    /** @returns {"absolute"|"percent"} the current comparison mode. */
    getComparisonMode(): "absolute" | "percent";
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
        raw?: boolean;
        pretty?: boolean;
        download?: boolean;
        filename?: string;
    }): string;
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
import Drawings from "./overlays/Drawings";
import ThemeManager from "./core/ThemeManager";
import SettingsControl from "./components/SettingsControl";
import OscillatorSettings from "./components/OscillatorSettings";
import ChartSwitch from "./core/ChartSwitch";
import DrawingTools from "./tools/drawing/DrawingTools";
import Export from "./tools/export/Export";
import XAxis from "./components/XAxis";
import ZoomControls from "./components/ZoomControls";
import TradingOverlayInteractions from "./overlays/TradingOverlayInteractions";
