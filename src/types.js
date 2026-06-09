/**
 * Shared JSDoc type definitions for ApexStock's public API.
 *
 * These are types only — there is no runtime code here. Reference them from
 * other files via `import("./types.js").<TypeName>` in JSDoc annotations.
 */

/**
 * @typedef {"light" | "dark"} ThemeMode
 */

/**
 * A single OHLC(V) data point. The `y` tuple is ordered [open, high, low, close];
 * most indicators read the close (`y[3]`).
 * @typedef {Object} OHLCPoint
 * @property {number|string|Date} x - Category or timestamp for the candle.
 * @property {[number, number, number, number]} y - [open, high, low, close].
 * @property {number} [v] - Optional volume for the candle.
 */

/**
 * One series' worth of OHLC candles.
 * @typedef {OHLCPoint[]} Series
 */

/**
 * A computed indicator point. `y` is `null` during the warm-up period before
 * the indicator has enough data.
 * @typedef {Object} IndicatorPoint
 * @property {number|string|Date} x
 * @property {number|null} y
 */

/**
 * Per-indicator configuration. `enabled` toggles availability in the UI;
 * additional numeric keys (period, stdDev, ...) are indicator-specific.
 * @typedef {Object} IndicatorConfig
 * @property {boolean} [enabled]
 * @property {number} [period]
 * @property {number} [stdDev]
 */

/**
 * ApexStock-specific plot options nested under `plotOptions.stockChart`.
 * Indicators may be given as a keyed config map or an array of names.
 * @typedef {Object} StockChartPlotOptions
 * @property {Object.<string, IndicatorConfig>|string[]} [indicators]
 */

/**
 * Options passed to the {@link ApexStock} constructor. A superset of the
 * standard ApexCharts options object: the financial data lives in
 * `series[0].data` as OHLC points, with optional `plotOptions.stockChart`.
 * @typedef {Object} StockChartOptions
 * @property {Object} chart - ApexCharts `chart` config (height, id, zoom, ...).
 * @property {Array<{name?: string, data: Series}>} series - The first series holds the OHLC data.
 * @property {{mode?: ThemeMode}} [theme]
 * @property {{stockChart?: StockChartPlotOptions}} [plotOptions]
 */

/**
 * Visible x-axis range expressed as data indices/values.
 * @typedef {Object} ZoomState
 * @property {number} minX
 * @property {number} maxX
 */

export {};
