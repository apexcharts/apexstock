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
    /**
     * - Analysis engine, measurement, panel,
     * and comparison defaults.
     */
    analysis?: AnalysisOptions;
    /**
     * - Per-pane layout, keyed by
     * indicator key (e.g. `{ drawdown: { heightRatio: 2 } }`).
     */
    panes?: {
        [x: string]: PaneOptions;
    };
};
/**
 * Layout options for one oscillator/analysis pane.
 */
export type PaneOptions = {
    /**
     * - This pane's share of the indicator area,
     * relative to the other panes: two panes at 1 and 2 split it one-third /
     * two-thirds. Defaults to the indicator's own preference (1 for most, 1.4 for
     * the drawdown pane).
     */
    heightRatio?: number;
};
/**
 * Visible x-axis range expressed as data indices/values.
 */
export type ZoomState = {
    minX: number;
    maxX: number;
};
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
 */
export type ApexStockEventName = "crosshairMove" | "click" | "rangeChange" | "rangeChanging" | "indicatorToggle" | "drawingAdded" | "drawingUpdated" | "drawingRemoved" | "drawingsCleared" | "eventMarkerAdded" | "eventMarkerUpdated" | "eventMarkerRemoved" | "eventMarkersCleared" | "eventMarkerHover" | "eventMarkerClick" | "priceScaleChange" | "rangeMeasured" | "measurementRemoved" | "comparisonChange" | "comparisonRestoreNeeded";
/**
 * Payload for the `rangeMeasured` event.
 *
 * `change` (inside `stats`) is the instrument's close-to-close move over the
 * spanned bars; `selection` is the delta between the two anchors the user
 * dragged. They differ whenever the anchors are not on the closes, which is why
 * both are reported.
 */
export type RangeMeasuredEvent = {
    /**
     * - The measurement's id, or null for a reading that
     * came from ApexCharts' own measure ruler.
     */
    id: string | null;
    from: RangeAnchor;
    to: RangeAnchor;
    selection: {
        from: number | null;
        to: number | null;
        absolute: number | null;
        percent: number | null;
    };
    stats: RangeStats;
    source: "drag" | "api" | "coreRuler";
};
/**
 * Payload for the `crosshairMove` and `click` events. `dataPointIndex` is `-1`
 * when the pointer is not over a candle, in which case `x`, `ohlc`, and
 * `volume` are `null`.
 */
export type CrosshairEvent = {
    /**
     * - Index of the nearest candle, or -1.
     */
    dataPointIndex: number;
    /**
     * - Index of the series under the pointer (0 = price).
     */
    seriesIndex: number;
    /**
     * - The candle's x value, or null.
     */
    x: number | string | Date | null;
    /**
     * - The candle's OHLC, or null.
     */
    ohlc: {
        open: number;
        high: number;
        low: number;
        close: number;
    } | null;
    /**
     * - The candle's volume (if any), or null.
     */
    volume: number | null;
    /**
     * - The originating DOM event, when available.
     */
    nativeEvent?: MouseEvent;
};
/**
 * Payload for the `rangeChange` event. Values are timestamps (epoch ms) or
 * category values matching the series `x`.
 */
export type RangeChangeEvent = {
    /**
     * - New visible range start.
     */
    min: number;
    /**
     * - New visible range end.
     */
    max: number;
    /**
     * - What triggered the change.
     * `"live"` marks a per-frame `rangeChanging` emission mid-gesture.
     */
    source: "zoom" | "pan" | "reset" | "live";
};
/**
 * Payload for the `indicatorToggle` event.
 */
export type IndicatorToggleEvent = {
    /**
     * - The (lowercased) indicator key, e.g. "rsi".
     */
    key: string;
    /**
     * - true if it was added, false if removed.
     */
    active: boolean;
};
/**
 * One active indicator within a captured state.
 */
export type IndicatorState = {
    /**
     * - The (lowercased) indicator key, e.g. "rsi".
     */
    key: string;
    /**
     * - Its parameters (e.g. `{ period: 14 }`); `{}` for overlays.
     */
    params: {
        [x: string]: number;
    };
};
/**
 * Metadata + live state for one indicator, returned by `ApexStock#listIndicators`
 * and `ApexStock#getIndicator`.
 */
export type IndicatorInfo = {
    /**
     * - The (lowercased) indicator key, e.g. "rsi".
     */
    key: string;
    /**
     * - Display name (e.g. "RSI", "Moving average").
     */
    label: string;
    /**
     * - UI grouping (custom/annotation kinds group with overlays).
     */
    type: "overlay" | "oscillator";
    /**
     * - Raw registry kind.
     */
    kind: "overlay" | "oscillator" | "custom";
    /**
     * - true if shipped with the library, false if registered via `registerIndicator`.
     */
    builtin: boolean;
    /**
     * - true if currently active on this instance.
     */
    active: boolean;
    /**
     * - true if it has an incremental `appendData()` twin.
     */
    streamable: boolean;
    /**
     * - Current configurable params (or defaults); `{}` when none are exposed.
     */
    params: object;
};
/**
 * Streaming twin for a custom indicator, enabling incremental `appendData()`
 * updates instead of a full recompute per bar. See `ApexStock.registerIndicator`.
 */
export type IndicatorStreamDefinition = {
    /**
     * - Capture running state from history.
     */
    seed: (series: Series, params: object) => any;
    /**
     * - Advance state by the last bar.
     */
    step: (state: any, series: Series, params: object) => {
        value: any;
        state: any;
    };
    /**
     * - Turn a stepped value into rendered point(s).
     */
    render: (value: any, x: (number | string | Date)) => Array<{
        name: string;
        point: {
            x: any;
            y: any;
        };
    }>;
    /**
     * - Translate live params to the shape seed/step expect.
     */
    params?: (liveParams: object) => object;
};
/**
 * Definition passed to `ApexStock.registerIndicator`. Use the declarative form
 * (`type` + `calc`) for most indicators, or the advanced form (`kind` +
 * `build`/`apply`/`remove`) for full control over the ApexCharts series/options.
 */
export type IndicatorDefinition = {
    /**
     * - Declarative: where the indicator renders.
     */
    type?: "overlay" | "oscillator";
    /**
     * -
     * Declarative: compute the indicator. Return one aligned line, a named map of
     * lines, or ready-made ApexCharts series.
     */
    calc?: (series: Series, params: object) => (number | null)[] | {
        [x: string]: (number | null)[];
    } | Array<object>;
    /**
     * - Default params merged into each `calc` call.
     */
    defaultParams?: object;
    /**
     * - Stroke color for a single-line indicator.
     */
    color?: string;
    /**
     * - Stroke colors, one per output series.
     */
    colors?: string[];
    /**
     * - Oscillator pane series type (default "line").
     */
    chartType?: string;
    /**
     * - Oscillator pane y-axis overrides (e.g. `{ min: 0, max: 100 }`).
     */
    yaxis?: object;
    /**
     * - Extra ApexCharts options merged into the oscillator pane.
     */
    chartOptions?: object;
    /**
     * - Display/series name (defaults to a title-cased key).
     */
    label?: string;
    /**
     * - Optional streaming twin for `appendData()`.
     */
    stream?: IndicatorStreamDefinition;
    /**
     * - Allow replacing an already-registered key.
     */
    overwrite?: boolean;
    /**
     * - Advanced: raw registry kind.
     */
    kind?: "overlay" | "oscillator" | "custom";
    /**
     * - Advanced: raw registry `build(context, params[, common])`.
     */
    build?: Function;
    /**
     * - Advanced: raw registry `apply(context, params)` (kind "custom").
     */
    apply?: Function;
    /**
     * - Advanced: raw registry `remove(context)` (kind "custom").
     */
    remove?: Function;
};
/**
 * Options for the analysis engine, given as `analysis` on the constructor
 * options and overridable per call on `getRangeStats` / `getDrawdown`.
 *
 * `periodsPerYear` is the bars-per-year convention used to annualize
 * volatility (252 for daily equities, 52 weekly, 12 monthly). It is inferred
 * from the bar spacing when it can be, and left out with a warning when it
 * cannot (intraday, where the answer depends on session length), so set it
 * explicitly for intraday data.
 */
export type AnalysisOptions = {
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
    panel?: boolean | import("./components/AnalysisPanel.js").AnalysisPanelOptions;
    /**
     * Multi-instrument comparison: alignment, baseline, mode, and the benchmark
     * role. See {@link ComparisonOptions}.
     */
    comparison?: ComparisonOptions & {
        mode?: ComparisonMode;
        benchmark?: string;
    };
};
/**
 * One end of a measured range, resolved to a bar that actually exists.
 */
export type RangeAnchor = {
    index: number;
    x: number | string | Date;
    value: number;
};
/**
 * Every statistic for a selected region, returned by `ApexStock#getRangeStats`.
 * Values are unrounded, every percent-like figure is in percent units
 * (`20.42` means +20.42%), and anything the data cannot support is `null` with
 * the reason in `warnings`. See `src/analysis/Statistics.js` for the per-field
 * documentation.
 */
export type RangeStats = {
    from: RangeAnchor;
    to: RangeAnchor;
    change: {
        absolute: number;
        percent: number | null;
    };
    /**
     * - Inclusive bar count. Bars, not trading sessions.
     */
    bars: number;
    upBars: number;
    downBars: number;
    flatBars: number;
    spanMs: number | null;
    calendarDays: number | null;
    annualized: {
        return: number;
        basis: "calendar";
    } | null;
    high: {
        value: number;
        index: number;
        x: any;
    } | null;
    low: {
        value: number;
        index: number;
        x: any;
    } | null;
    average: {
        close: number | null;
        volume: number | null;
    };
    total: {
        volume: number | null;
    };
    volatility: import("./analysis/Statistics.js").VolatilityResult | null;
    drawdown: import("./analysis/Statistics.js").RangeDrawdown;
    basis: {
        source: string;
        drawdown: string;
    };
    warnings: string[];
};
/**
 * How comparison lines are normalized.
 * - `"absolute"`: raw values.
 * - `"percent"`: percent change from the baseline (the default).
 * - `"indexed"`: the baseline reads `indexBase` (the "100 = starting value" view).
 * - `"relative"`: `percentChange(asset) - percentChange(benchmark)`, in
 *   percentage points; zero means "kept pace".
 * - `"ratio"`: `asset / benchmark`, rebased so the baseline reads `indexBase`.
 */
export type ComparisonMode = "absolute" | "percent" | "indexed" | "relative" | "ratio";
/**
 * How instruments with different calendars are put on one grid, and what "0%"
 * means. See `src/overlays/Comparison.js` for the reasoning behind the defaults.
 */
export type ComparisonOptions = {
    /**
     * - `"union"` keeps
     * every x any instrument has, `"primary"` resamples onto the primary's bars,
     * `"intersection"` keeps only x values every instrument has.
     */
    join?: "union" | "primary" | "intersection";
    /**
     * - How a hole in one instrument
     * is handled: carry the last observation, leave it null, or drop the x value
     * for everyone.
     */
    fill?: "hold" | "gap" | "drop";
    /**
     * - Where 0%
     * sits. `"common"` is the first x where every instrument (primary included)
     * has data, the only fair basis for different start dates. `"own"` is each
     * instrument's own first point (pre-0.5.0 behavior). `"visible"` follows the
     * zoom. A number is an explicit x value.
     */
    baseline?: "common" | "own" | "visible" | number;
    /**
     * - Baseline value for `indexed` and `ratio`.
     */
    indexBase?: number;
    /**
     * - Which OHLC field
     * every instrument is compared on.
     */
    source?: "close" | "open" | "high" | "low";
    /**
     * - `ratio` mode: rebase to `indexBase`
     * instead of reporting the raw quotient.
     */
    rebaseRatio?: boolean;
    /**
     * - Plot carried-forward grid points as
     * well as real observations. Defaults to `join === "primary"`.
     */
    resample?: boolean | null;
};
/**
 * One row of the comparison leaderboard, from `ApexStock#getComparisonStats`.
 * The primary symbol is included, flagged with `primary: true`. Values are
 * unrounded and every percent-like figure is in percent units; anything the
 * data cannot support is `null`.
 */
export type ComparisonRow = {
    name: string;
    /**
     * - The line color, or null for the primary.
     */
    color: string | null;
    /**
     * - True for the chart's own symbol.
     */
    primary: boolean;
    /**
     * - True for whichever instrument fills the
     * benchmark role.
     */
    benchmark: boolean;
    /**
     * - x of the first observation in the window.
     */
    from: number | null;
    /**
     * - x of the last.
     */
    to: number | null;
    /**
     * - Value at `from`.
     */
    start: number | null;
    /**
     * - Value at `to`.
     */
    end: number | null;
    change: {
        absolute: number | null;
        percent: number | null;
    };
    /**
     * - Excess return vs the benchmark, in
     * percentage points (0 for the benchmark itself).
     */
    relative: number | null;
    /**
     * - Highest `source` value in
     * the window (not the intrabar high; see `ApexStock#getRangeStats` for that).
     */
    high: {
        value: number;
        x: number;
    } | null;
    low: {
        value: number;
        x: number;
    } | null;
    volatility: import("./analysis/Statistics.js").VolatilityResult | null;
    /**
     *   The worst drawdown in the window, measured on this instrument's own
     *   observations.
     */
    drawdown: {
        max: number;
        barsToTrough: number;
        barsToRecovery: number | null;
        barsUnderwater: number;
        recovered: boolean;
    } | null;
    /**
     * - Observations in the window. Bars, not sessions.
     */
    bars: number;
    /**
     *   How much of the shared grid this instrument covers, and how many of those
     *   points were carried forward rather than observed.
     */
    coverage: {
        bars: number;
        filled: number;
        firstX: number | null;
        lastX: number | null;
    };
    /**
     * - 1-based rank by percent change, best first; 0 when
     * there is no percent change to rank.
     */
    rank: number;
};
/**
 * Payload for the `comparisonChange` event.
 */
export type ComparisonChangeEvent = {
    reason: "add" | "remove" | "clear" | "mode" | "benchmark" | "options" | "visible" | "restore";
    mode: ComparisonMode;
    /**
     * - The configured benchmark, or `"__primary__"`.
     */
    benchmark: string;
    /**
     * - The baseline policy actually applied (it can
     * fall back to `"own"` when no x value has data for every instrument).
     */
    baseline: string;
    /**
     * - Added instrument names, in insertion order.
     */
    instruments: string[];
    stats: ComparisonRow[];
    warnings: string[];
};
/**
 * The comparison slice of {@link ApexStockState}. Instrument *data* is not
 * captured (the consumer owns it, and it would bloat state unboundedly): only
 * each instrument's identity and color, plus the mode, benchmark, and alignment
 * policy. On restore, instruments whose data is still loaded are kept and the
 * rest are reported through `comparisonRestoreNeeded`.
 */
export type ComparisonState = {
    mode: ComparisonMode;
    /**
     * - An instrument name, or `"__primary__"`.
     */
    benchmark: string;
    options: ComparisonOptions;
    /**
     * - Identity and
     * styling, in display order. No data.
     */
    instruments: Array<{
        name: string;
        color: string;
    }>;
};
/**
 * A portable, schema-versioned snapshot of an ApexStock chart, produced by
 * `ApexStock#getState` and consumed by `ApexStock#setState`. Plain JSON (no
 * functions), safe to `JSON.stringify`.
 */
export type ApexStockState = {
    /**
     * - Schema version (see `ApexStock.STATE_VERSION`).
     */
    version: number;
    /**
     * - Theme mode, and the
     * active named preset (or null for a plain mode).
     */
    theme: {
        mode: ThemeMode;
        preset?: string | null;
    };
    /**
     * - Active chart type (e.g. "candlestick", "heikinashi", "renko", "line", "area", "ohlc").
     */
    chartType: string;
    /**
     * - Active indicators, in application order.
     */
    indicators: IndicatorState[];
    /**
     * - Data-space drawings (v2+), each a plain-JSON
     * geometry+style record; restored verbatim by `setState`.
     */
    drawings: object[];
    /**
     * - Time-anchored event markers (v2+), each a
     * plain-JSON `{ x, type, label?, color?, glyph?, position?, meta? }` record.
     */
    eventMarkers: object[];
    /**
     * - Data-space annotations (v2+): y/x lines,
     * bands, points, and text records.
     */
    annotations: object[];
    /**
     * - Trading price lines (v2+), declarative config
     * only; interactive callbacks (`onCross`/`onMove`/`onRemove`) are not captured.
     */
    priceLines: object[];
    /**
     *   - Primary price-axis scale mode (v2+), or null for the default linear scale.
     */
    priceScale: {
        mode: "linear" | "logarithmic" | "percent" | "indexed";
        base: number | null;
        logBase: number;
        indexBase: number;
    } | null;
    /**
     * - Pane layout
     * (v2+): the height ratios a consumer set, keyed by indicator key, or null
     * when every pane is at its default. Which panes *exist* is derived from
     * `indicators`, so only the layout is captured here.
     */
    panes: {
        [x: string]: {
            heightRatio: number;
        };
    } | null;
    /**
     * - Multi-instrument comparison
     * (v2+): mode, benchmark, alignment policy, and instrument identity, or null
     * for no comparison. Instrument data is not captured; `setState` emits
     * `comparisonRestoreNeeded` with the names whose data must be re-supplied.
     * Measurements need no key of their own: a measurement is a `measure` drawing,
     * so it round-trips inside `drawings`.
     */
    comparison: ComparisonState | null;
    /**
     * - Visible x-range, or null for full/auto.
     */
    zoom: {
        minX: number;
        maxX: number;
    } | null;
};
