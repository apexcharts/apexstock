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

/**
 * Names of the events emitted on an {@link ApexStock} instance (see
 * `ApexStock#on`).
 * - `crosshairMove` fires as the pointer moves over the price chart
 *   ({@link CrosshairEvent}).
 * - `click` fires on a click on the price chart ({@link CrosshairEvent}).
 * - `rangeChange` fires when the visible x-range changes via zoom, pan, or
 *   reset ({@link RangeChangeEvent}).
 * - `indicatorToggle` fires when an indicator is added or removed
 *   ({@link IndicatorToggleEvent}).
 * @typedef {"crosshairMove" | "click" | "rangeChange" | "indicatorToggle"} ApexStockEventName
 */

/**
 * Payload for the `crosshairMove` and `click` events. `dataPointIndex` is `-1`
 * when the pointer is not over a candle, in which case `x`, `ohlc`, and
 * `volume` are `null`.
 * @typedef {Object} CrosshairEvent
 * @property {number} dataPointIndex - Index of the nearest candle, or -1.
 * @property {number} seriesIndex - Index of the series under the pointer (0 = price).
 * @property {number|string|Date|null} x - The candle's x value, or null.
 * @property {{open:number,high:number,low:number,close:number}|null} ohlc - The candle's OHLC, or null.
 * @property {number|null} volume - The candle's volume (if any), or null.
 * @property {MouseEvent} [nativeEvent] - The originating DOM event, when available.
 */

/**
 * Payload for the `rangeChange` event. Values are timestamps (epoch ms) or
 * category values matching the series `x`.
 * @typedef {Object} RangeChangeEvent
 * @property {number} min - New visible range start.
 * @property {number} max - New visible range end.
 * @property {"zoom"|"pan"|"reset"} source - What triggered the change.
 */

/**
 * Payload for the `indicatorToggle` event.
 * @typedef {Object} IndicatorToggleEvent
 * @property {string} key - The (lowercased) indicator key, e.g. "rsi".
 * @property {boolean} active - true if it was added, false if removed.
 */

/**
 * One active indicator within a captured state.
 * @typedef {Object} IndicatorState
 * @property {string} key - The (lowercased) indicator key, e.g. "rsi".
 * @property {Object.<string, number>} params - Its parameters (e.g. `{ period: 14 }`); `{}` for overlays.
 */

/**
 * Metadata + live state for one indicator, returned by `ApexStock#listIndicators`
 * and `ApexStock#getIndicator`.
 * @typedef {Object} IndicatorInfo
 * @property {string} key - The (lowercased) indicator key, e.g. "rsi".
 * @property {string} label - Display name (e.g. "RSI", "Moving average").
 * @property {"overlay"|"oscillator"} type - UI grouping (custom/annotation kinds group with overlays).
 * @property {"overlay"|"oscillator"|"custom"} kind - Raw registry kind.
 * @property {boolean} builtin - true if shipped with the library, false if registered via `registerIndicator`.
 * @property {boolean} active - true if currently active on this instance.
 * @property {boolean} streamable - true if it has an incremental `appendData()` twin.
 * @property {object} params - Current configurable params (or defaults); `{}` when none are exposed.
 */

/**
 * Streaming twin for a custom indicator, enabling incremental `appendData()`
 * updates instead of a full recompute per bar. See `ApexStock.registerIndicator`.
 * @typedef {Object} IndicatorStreamDefinition
 * @property {(series: Series, params: object) => *} seed - Capture running state from history.
 * @property {(state: *, series: Series, params: object) => {value: *, state: *}} step - Advance state by the last bar.
 * @property {(value: *, x: (number|string|Date)) => Array<{name: string, point: {x: *, y: *}}>} render - Turn a stepped value into rendered point(s).
 * @property {(liveParams: object) => object} [params] - Translate live params to the shape seed/step expect.
 */

/**
 * Definition passed to `ApexStock.registerIndicator`. Use the declarative form
 * (`type` + `calc`) for most indicators, or the advanced form (`kind` +
 * `build`/`apply`/`remove`) for full control over the ApexCharts series/options.
 * @typedef {Object} IndicatorDefinition
 * @property {"overlay"|"oscillator"} [type] - Declarative: where the indicator renders.
 * @property {(series: Series, params: object) => (number|null)[] | Object.<string, (number|null)[]> | Array<object>} [calc] -
 *   Declarative: compute the indicator. Return one aligned line, a named map of
 *   lines, or ready-made ApexCharts series.
 * @property {object} [defaultParams] - Default params merged into each `calc` call.
 * @property {string} [color] - Stroke color for a single-line indicator.
 * @property {string[]} [colors] - Stroke colors, one per output series.
 * @property {string} [chartType] - Oscillator pane series type (default "line").
 * @property {object} [yaxis] - Oscillator pane y-axis overrides (e.g. `{ min: 0, max: 100 }`).
 * @property {object} [chartOptions] - Extra ApexCharts options merged into the oscillator pane.
 * @property {string} [label] - Display/series name (defaults to a title-cased key).
 * @property {IndicatorStreamDefinition} [stream] - Optional streaming twin for `appendData()`.
 * @property {boolean} [overwrite] - Allow replacing an already-registered key.
 * @property {"overlay"|"oscillator"|"custom"} [kind] - Advanced: raw registry kind.
 * @property {Function} [build] - Advanced: raw registry `build(context, params[, common])`.
 * @property {Function} [apply] - Advanced: raw registry `apply(context, params)` (kind "custom").
 * @property {Function} [remove] - Advanced: raw registry `remove(context)` (kind "custom").
 */

/**
 * A portable, schema-versioned snapshot of an ApexStock chart, produced by
 * `ApexStock#getState` and consumed by `ApexStock#setState`. Plain JSON (no
 * functions), safe to `JSON.stringify`.
 * @typedef {Object} ApexStockState
 * @property {number} version - Schema version (see `ApexStock.STATE_VERSION`).
 * @property {{mode: ThemeMode}} theme - Theme mode.
 * @property {string} chartType - Active chart type (e.g. "candlestick", "heikinashi", "renko", "line", "area", "ohlc").
 * @property {IndicatorState[]} indicators - Active indicators, in application order.
 * @property {{minX: number, maxX: number}|null} zoom - Visible x-range, or null for full/auto.
 */

export {};
