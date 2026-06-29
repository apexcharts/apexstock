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
     * The time-frame intervals accepted by {@link ApexStock.aggregateOHLC}.
     * @type {string[]}
     */
    static INTERVALS: string[];
    /**
     * @param {HTMLElement} chartEl - The container element where the charts will be rendered.
     * @param {import("./types.js").StockChartOptions} chartOptions - ApexCharts options whose `series[0].data` holds the OHLC points.
     */
    constructor(chartEl: HTMLElement, chartOptions: import("./types.js").StockChartOptions);
    chartEl: HTMLElement;
    chartOptions: import("./types.js").StockChartOptions;
    totalHeight: any;
    Utils: typeof Utils;
    xAxisHeight: number;
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
     * Render the main chart and initialize all sub-components (chart-type switch,
     * drawing tools, export, custom x-axis, zoom controls). Call once after
     * construction.
     * @returns {void}
     */
    render(): void;
    chartSwitch: ChartSwitch;
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
    destroy(): void;
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
     * Add or refresh a technical indicator pane/overlay, preserving zoom state.
     * @param {string} indicatorKey - Indicator name (e.g. "rsi", "moving average").
     * @returns {void}
     */
    updateIndicator(indicatorKey: string): void;
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
import TradingOverlays from "./overlays/TradingOverlays";
import ThemeManager from "./core/ThemeManager";
import SettingsControl from "./components/SettingsControl";
import OscillatorSettings from "./components/OscillatorSettings";
import ChartSwitch from "./core/ChartSwitch";
import XAxis from "./components/XAxis";
import ZoomControls from "./components/ZoomControls";
import TradingOverlayInteractions from "./overlays/TradingOverlayInteractions";
