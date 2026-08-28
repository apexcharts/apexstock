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
 * @property {AnalysisOptions} [analysis] - Analysis engine, measurement, panel,
 *   and comparison defaults.
 * @property {Object.<string, PaneOptions>} [panes] - Per-pane layout, keyed by
 *   indicator key (e.g. `{ drawdown: { heightRatio: 2 } }`).
 */

/**
 * Layout options for one oscillator/analysis pane.
 * @typedef {Object} PaneOptions
 * @property {number} [heightRatio] - This pane's share of the indicator area,
 *   relative to the other panes: two panes at 1 and 2 split it one-third /
 *   two-thirds. Defaults to the indicator's own preference (1 for most, 1.4 for
 *   the drawdown pane).
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
 *   reset ({@link RangeChangeEvent}). Once per gesture: a wheel or pinch zoom
 *   emits it when the gesture settles, not on every frame.
 * - `rangeChanging` fires on every frame of an in-progress zoom/pan
 *   ({@link RangeChangeEvent} with `source: "live"`). Use it to keep your own
 *   overlay glued to the axis during a gesture; use `rangeChange` for work that
 *   should happen once, such as fetching data for the new window.
 * - `indicatorToggle` fires when an indicator is added or removed
 *   ({@link IndicatorToggleEvent}).
 * - `drawingAdded` / `drawingUpdated` fire with `{ id, drawing }` when a
 *   programmatic drawing is added or patched; `drawingRemoved` fires with
 *   `{ id }`; `drawingsCleared` fires with `{}`.
 * - `eventMarkerAdded` / `eventMarkerUpdated` fire with `{ id, marker }` when an
 *   event marker is added or patched; `eventMarkerRemoved` fires with `{ id }`;
 *   `eventMarkersCleared` fires with `{}`. `eventMarkerHover` /
 *   `eventMarkerClick` fire with `{ id, marker, nativeEvent }` on pointer
 *   interaction with a marker badge.
 * - `priceScaleChange` fires with `{ mode, base, logBase, indexBase }` when the
 *   primary price-axis scale mode changes.
 * - `rangeMeasured` fires when a measurement settles (created, or its anchors
 *   moved) with {@link RangeMeasuredEvent}. One event per change, not one per
 *   drag frame, and never on a plain zoom or pan.
 * - `measurementRemoved` fires with `{ id }` when a measurement is cleared.
 * - `comparisonChange` fires when the comparison set, mode, benchmark, or
 *   baseline changes, with {@link ComparisonChangeEvent} (the recomputed
 *   leaderboard included).
 * - `comparisonRestoreNeeded` fires with `{ names }` after `setState` restored a
 *   comparison whose instrument data is not loaded: the consumer re-supplies it
 *   with `addComparison`. See {@link ApexStockState}.
 * @typedef {"crosshairMove" | "click" | "rangeChange" | "rangeChanging" | "indicatorToggle" | "drawingAdded" | "drawingUpdated" | "drawingRemoved" | "drawingsCleared" | "eventMarkerAdded" | "eventMarkerUpdated" | "eventMarkerRemoved" | "eventMarkersCleared" | "eventMarkerHover" | "eventMarkerClick" | "priceScaleChange" | "rangeMeasured" | "measurementRemoved" | "comparisonChange" | "comparisonRestoreNeeded"} ApexStockEventName
 */

/**
 * Payload for the `rangeMeasured` event.
 *
 * `change` (inside `stats`) is the instrument's close-to-close move over the
 * spanned bars; `selection` is the delta between the two anchors the user
 * dragged. They differ whenever the anchors are not on the closes, which is why
 * both are reported.
 * @typedef {Object} RangeMeasuredEvent
 * @property {string|null} id - The measurement's id, or null for a reading that
 *   came from ApexCharts' own measure ruler.
 * @property {RangeAnchor} from
 * @property {RangeAnchor} to
 * @property {{from: number|null, to: number|null, absolute: number|null, percent: number|null}} selection
 * @property {RangeStats} stats
 * @property {"drag"|"api"|"coreRuler"} source
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
 * @property {"zoom"|"pan"|"reset"|"live"} source - What triggered the change.
 *   `"live"` marks a per-frame `rangeChanging` emission mid-gesture.
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
 * Options for the analysis engine, given as `analysis` on the constructor
 * options and overridable per call on `getRangeStats` / `getDrawdown`.
 *
 * `periodsPerYear` is the bars-per-year convention used to annualize
 * volatility (252 for daily equities, 52 weekly, 12 monthly). It is inferred
 * from the bar spacing when it can be, and left out with a warning when it
 * cannot (intraday, where the answer depends on session length), so set it
 * explicitly for intraday data.
 * @typedef {Object} AnalysisOptions
 * @property {"close"|"open"|"high"|"low"} [source="close"] - Which OHLC field
 *   the anchors, the change, and the averages read.
 * @property {"close"|"intrabar"} [drawdownBasis="close"] - `"intrabar"` measures
 *   each bar's low against the running high (the conservative figure).
 * @property {number} [periodsPerYear] - Annualization convention.
 * @property {number} [minAnnualizeDays=30] - Below this span an annualized
 *   return is omitted rather than extrapolated.
 * @property {"auto"|"index"|"x"} [by="auto"] - How a bare number endpoint is read.
 * @property {{snap?: boolean|"open"|"high"|"low"|"close", label?: Function}} [measure]
 *   Measurement tool config. `snap` pulls the box's anchors onto the bar values
 *   (`true` means the close); `label(stats, { selection, drawing })` replaces the
 *   on-chart readout lines.
 * @property {boolean|import("./components/AnalysisPanel.js").AnalysisPanelOptions} [panel]
 *   The on-chart analysis panel. Automatic by default (it appears while a
 *   measurement exists); `false` opts out entirely for headless use.
 * @property {ComparisonOptions & {mode?: ComparisonMode, benchmark?: string}} [comparison]
 *   Multi-instrument comparison: alignment, baseline, mode, and the benchmark
 *   role. See {@link ComparisonOptions}.
 */

/**
 * One end of a measured range, resolved to a bar that actually exists.
 * @typedef {Object} RangeAnchor
 * @property {number} index
 * @property {number|string|Date} x
 * @property {number} value
 */

/**
 * Every statistic for a selected region, returned by `ApexStock#getRangeStats`.
 * Values are unrounded, every percent-like figure is in percent units
 * (`20.42` means +20.42%), and anything the data cannot support is `null` with
 * the reason in `warnings`. See `src/analysis/Statistics.js` for the per-field
 * documentation.
 * @typedef {Object} RangeStats
 * @property {RangeAnchor} from
 * @property {RangeAnchor} to
 * @property {{absolute: number, percent: number|null}} change
 * @property {number} bars - Inclusive bar count. Bars, not trading sessions.
 * @property {number} upBars
 * @property {number} downBars
 * @property {number} flatBars
 * @property {number|null} spanMs
 * @property {number|null} calendarDays
 * @property {{return: number, basis: "calendar"}|null} annualized
 * @property {{value: number, index: number, x: *}|null} high
 * @property {{value: number, index: number, x: *}|null} low
 * @property {{close: number|null, volume: number|null}} average
 * @property {{volume: number|null}} total
 * @property {import("./analysis/Statistics.js").VolatilityResult|null} volatility
 * @property {import("./analysis/Statistics.js").RangeDrawdown} drawdown
 * @property {{source: string, drawdown: string}} basis
 * @property {string[]} warnings
 */

/**
 * How comparison lines are normalized.
 * - `"absolute"`: raw values.
 * - `"percent"`: percent change from the baseline (the default).
 * - `"indexed"`: the baseline reads `indexBase` (the "100 = starting value" view).
 * - `"relative"`: `percentChange(asset) - percentChange(benchmark)`, in
 *   percentage points; zero means "kept pace".
 * - `"ratio"`: `asset / benchmark`, rebased so the baseline reads `indexBase`.
 * @typedef {"absolute"|"percent"|"indexed"|"relative"|"ratio"} ComparisonMode
 */

/**
 * How instruments with different calendars are put on one grid, and what "0%"
 * means. See `src/overlays/Comparison.js` for the reasoning behind the defaults.
 * @typedef {Object} ComparisonOptions
 * @property {"union"|"primary"|"intersection"} [join="union"] - `"union"` keeps
 *   every x any instrument has, `"primary"` resamples onto the primary's bars,
 *   `"intersection"` keeps only x values every instrument has.
 * @property {"hold"|"gap"|"drop"} [fill="hold"] - How a hole in one instrument
 *   is handled: carry the last observation, leave it null, or drop the x value
 *   for everyone.
 * @property {"common"|"own"|"visible"|number} [baseline="common"] - Where 0%
 *   sits. `"common"` is the first x where every instrument (primary included)
 *   has data, the only fair basis for different start dates. `"own"` is each
 *   instrument's own first point (pre-0.5.0 behavior). `"visible"` follows the
 *   zoom. A number is an explicit x value.
 * @property {number} [indexBase=100] - Baseline value for `indexed` and `ratio`.
 * @property {"close"|"open"|"high"|"low"} [source="close"] - Which OHLC field
 *   every instrument is compared on.
 * @property {boolean} [rebaseRatio=true] - `ratio` mode: rebase to `indexBase`
 *   instead of reporting the raw quotient.
 * @property {boolean|null} [resample=null] - Plot carried-forward grid points as
 *   well as real observations. Defaults to `join === "primary"`.
 */

/**
 * One row of the comparison leaderboard, from `ApexStock#getComparisonStats`.
 * The primary symbol is included, flagged with `primary: true`. Values are
 * unrounded and every percent-like figure is in percent units; anything the
 * data cannot support is `null`.
 * @typedef {Object} ComparisonRow
 * @property {string} name
 * @property {string|null} color - The line color, or null for the primary.
 * @property {boolean} primary - True for the chart's own symbol.
 * @property {boolean} benchmark - True for whichever instrument fills the
 *   benchmark role.
 * @property {number|null} from - x of the first observation in the window.
 * @property {number|null} to - x of the last.
 * @property {number|null} start - Value at `from`.
 * @property {number|null} end - Value at `to`.
 * @property {{absolute: number|null, percent: number|null}} change
 * @property {number|null} relative - Excess return vs the benchmark, in
 *   percentage points (0 for the benchmark itself).
 * @property {{value: number, x: number}|null} high - Highest `source` value in
 *   the window (not the intrabar high; see `ApexStock#getRangeStats` for that).
 * @property {{value: number, x: number}|null} low
 * @property {import("./analysis/Statistics.js").VolatilityResult|null} volatility
 * @property {{max: number, barsToTrough: number, barsToRecovery: number|null, barsUnderwater: number, recovered: boolean}|null} drawdown
 *   The worst drawdown in the window, measured on this instrument's own
 *   observations.
 * @property {number} bars - Observations in the window. Bars, not sessions.
 * @property {{bars: number, filled: number, firstX: number|null, lastX: number|null}} coverage
 *   How much of the shared grid this instrument covers, and how many of those
 *   points were carried forward rather than observed.
 * @property {number} rank - 1-based rank by percent change, best first; 0 when
 *   there is no percent change to rank.
 */

/**
 * Payload for the `comparisonChange` event.
 * @typedef {Object} ComparisonChangeEvent
 * @property {"add"|"remove"|"clear"|"mode"|"benchmark"|"options"|"visible"|"restore"} reason
 * @property {ComparisonMode} mode
 * @property {string} benchmark - The configured benchmark, or `"__primary__"`.
 * @property {string} baseline - The baseline policy actually applied (it can
 *   fall back to `"own"` when no x value has data for every instrument).
 * @property {string[]} instruments - Added instrument names, in insertion order.
 * @property {ComparisonRow[]} stats
 * @property {string[]} warnings
 */

/**
 * The comparison slice of {@link ApexStockState}. Instrument *data* is not
 * captured (the consumer owns it, and it would bloat state unboundedly): only
 * each instrument's identity and color, plus the mode, benchmark, and alignment
 * policy. On restore, instruments whose data is still loaded are kept and the
 * rest are reported through `comparisonRestoreNeeded`.
 * @typedef {Object} ComparisonState
 * @property {ComparisonMode} mode
 * @property {string} benchmark - An instrument name, or `"__primary__"`.
 * @property {ComparisonOptions} options
 * @property {Array<{name: string, color: string}>} instruments - Identity and
 *   styling, in display order. No data.
 */

/**
 * A portable, schema-versioned snapshot of an ApexStock chart, produced by
 * `ApexStock#getState` and consumed by `ApexStock#setState`. Plain JSON (no
 * functions), safe to `JSON.stringify`.
 * @typedef {Object} ApexStockState
 * @property {number} version - Schema version (see `ApexStock.STATE_VERSION`).
 * @property {{mode: ThemeMode, preset?: string|null}} theme - Theme mode, and the
 *   active named preset (or null for a plain mode).
 * @property {string} chartType - Active chart type (e.g. "candlestick", "heikinashi", "renko", "line", "area", "ohlc").
 * @property {IndicatorState[]} indicators - Active indicators, in application order.
 * @property {object[]} drawings - Data-space drawings (v2+), each a plain-JSON
 *   geometry+style record; restored verbatim by `setState`.
 * @property {object[]} eventMarkers - Time-anchored event markers (v2+), each a
 *   plain-JSON `{ x, type, label?, color?, glyph?, position?, meta? }` record.
 * @property {object[]} annotations - Data-space annotations (v2+): y/x lines,
 *   bands, points, and text records.
 * @property {object[]} priceLines - Trading price lines (v2+), declarative config
 *   only; interactive callbacks (`onCross`/`onMove`/`onRemove`) are not captured.
 * @property {{mode: "linear"|"logarithmic"|"percent"|"indexed", base: number|null, logBase: number, indexBase: number}|null} priceScale
 *   - Primary price-axis scale mode (v2+), or null for the default linear scale.
 * @property {Object.<string, {heightRatio: number}>|null} panes - Pane layout
 *   (v2+): the height ratios a consumer set, keyed by indicator key, or null
 *   when every pane is at its default. Which panes *exist* is derived from
 *   `indicators`, so only the layout is captured here.
 * @property {ComparisonState|null} comparison - Multi-instrument comparison
 *   (v2+): mode, benchmark, alignment policy, and instrument identity, or null
 *   for no comparison. Instrument data is not captured; `setState` emits
 *   `comparisonRestoreNeeded` with the names whose data must be re-supplied.
 *   Measurements need no key of their own: a measurement is a `measure` drawing,
 *   so it round-trips inside `drawings`.
 * @property {{minX: number, maxX: number}|null} zoom - Visible x-range, or null for full/auto.
 */

export {};
