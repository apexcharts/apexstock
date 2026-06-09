export type ThemeMode = "light" | "dark";
/**
 * A single OHLC(V) data point. The `y` tuple is ordered [open, high, low, close];
 * most indicators read the close (`y[3]`).
 */
export type OHLCPoint = {
    /**
     * - Category or timestamp for the candle.
     */
    x: number | string | Date;
    /**
     * - [open, high, low, close].
     */
    y: [number, number, number, number];
    /**
     * - Optional volume for the candle.
     */
    v?: number;
};
/**
 * One series' worth of OHLC candles.
 */
export type Series = OHLCPoint[];
/**
 * A computed indicator point. `y` is `null` during the warm-up period before
 * the indicator has enough data.
 */
export type IndicatorPoint = {
    x: number | string | Date;
    y: number | null;
};
/**
 * Per-indicator configuration. `enabled` toggles availability in the UI;
 * additional numeric keys (period, stdDev, ...) are indicator-specific.
 */
export type IndicatorConfig = {
    enabled?: boolean;
    period?: number;
    stdDev?: number;
};
/**
 * ApexStock-specific plot options nested under `plotOptions.stockChart`.
 * Indicators may be given as a keyed config map or an array of names.
 */
export type StockChartPlotOptions = {
    indicators?: {
        [x: string]: IndicatorConfig;
    } | string[];
};
/**
 * Options passed to the {@link ApexStock} constructor. A superset of the
 * standard ApexCharts options object: the financial data lives in
 * `series[0].data` as OHLC points, with optional `plotOptions.stockChart`.
 */
export type StockChartOptions = {
    /**
     * - ApexCharts `chart` config (height, id, zoom, ...).
     */
    chart: any;
    /**
     * - The first series holds the OHLC data.
     */
    series: Array<{
        name?: string;
        data: Series;
    }>;
    theme?: {
        mode?: ThemeMode;
    };
    plotOptions?: {
        stockChart?: StockChartPlotOptions;
    };
};
/**
 * Visible x-axis range expressed as data indices/values.
 */
export type ZoomState = {
    minX: number;
    maxX: number;
};
