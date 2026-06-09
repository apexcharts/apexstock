/**
 * ApexStock — a financial-charting layer on top of ApexCharts. Renders an OHLC
 * main chart plus technical-indicator panes, drawing tools, and theming.
 */
export default class ApexStock {
    /**
     * Register a license key globally. An invalid/expired key causes the
     * "Powered by apexcharts.com" watermark to be shown.
     * @param {string} key - License key in the form `APEX-{encoded}`.
     * @returns {void}
     */
    static setLicense(key: string): void;
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
    FIBLEVELS: number[];
    activeOscillator: any;
    themeManager: ThemeManager;
    theme: any;
    isDarkTheme: boolean;
    colors: any;
    series: import("./types.js").Series;
    SettingsControl: typeof SettingsControl;
    overlays: {
        "moving average": {
            enabled: boolean;
        };
        "bollinger bands": {
            enabled: boolean;
        };
        "exponential moving average": {
            enabled: boolean;
        };
        "fibonacci retracements": {
            enabled: boolean;
        };
        "linear regression": {
            enabled: boolean;
        };
        "ichimoku cloud indicator": {
            enabled: boolean;
        };
    };
    oscillators: {
        rsi: {
            enabled: boolean;
        };
        macd: {
            enabled: boolean;
        };
        volumes: {
            enabled: boolean;
        };
        "price volume trend": {
            enabled: boolean;
        };
        "stochastic oscillator": {
            enabled: boolean;
        };
        "standard deviation indicator": {
            enabled: boolean;
        };
        "average directional index": {
            enabled: boolean;
        };
        "chaikin oscillator": {
            enabled: boolean;
        };
        "commodity channel index": {
            enabled: boolean;
        };
        "trend strength index": {
            enabled: boolean;
        };
        "accelerator oscillator": {
            enabled: boolean;
        };
        "bollinger bands %b": {
            enabled: boolean;
        };
        "bollinger bands width": {
            enabled: boolean;
        };
    };
    indicators: {
        [x: string]: import("./types.js").IndicatorConfig;
    };
    volumesData: {
        x: string | number | Date;
        y: number;
    }[];
    mainChartOptions: any;
    chart: any;
    oscillatorSettings: OscillatorSettings;
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
import ThemeManager from "./core/ThemeManager";
import SettingsControl from "./components/SettingsControl";
import OscillatorSettings from "./components/OscillatorSettings";
import ChartSwitch from "./core/ChartSwitch";
import XAxis from "./components/XAxis";
import ZoomControls from "./components/ZoomControls";
