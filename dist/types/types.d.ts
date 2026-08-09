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
 * - `drawingAdded` / `drawingUpdated` fire with `{ id, drawing }` when a
 *   programmatic drawing is added or patched; `drawingRemoved` fires with
 *   `{ id }`; `drawingsCleared` fires with `{}`.
 */
export type ApexStockEventName = "crosshairMove" | "click" | "rangeChange" | "indicatorToggle" | "drawingAdded" | "drawingUpdated" | "drawingRemoved" | "drawingsCleared";
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
     */
    source: "zoom" | "pan" | "reset";
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
     * - Theme mode.
     */
    theme: {
        mode: ThemeMode;
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
     * - Visible x-range, or null for full/auto.
     */
    zoom: {
        minX: number;
        maxX: number;
    } | null;
};
