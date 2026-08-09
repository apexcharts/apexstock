export default Indicators;
declare class Indicators {
    /**
     * Per-series memoization cache. Keyed on the series array identity (so a new
     * data array naturally invalidates and the old entry is GC'd), then on a
     * string describing the method + its parameters.
     *
     * Indicator math is pure, so caching is safe. Callers must treat the returned
     * arrays as read-only (they do today — results are mapped into new arrays).
     * @type {WeakMap<object, Map<string, *>>}
     */
    static _cache: WeakMap<object, Map<string, any>>;
    /**
     * @param {*} series
     * @param {string} key
     * @returns {*} The cached value, or `undefined` if absent.
     */
    static _cacheGet(series: any, key: string): any;
    /**
     * Stores and returns `value` for `(series, key)`.
     * @template T
     * @param {*} series
     * @param {string} key
     * @param {T} value
     * @returns {T}
     */
    static _cacheSet<T>(series: any, key: string, value: T): T;
    /**
     * Drop every cached result for `series`. The memo is keyed on the series array
     * identity, so when callers mutate that array in place (the appendData path
     * pushes/replaces bars rather than swapping in a fresh array), the cache must
     * be invalidated or a later full compute would return a stale, shorter result.
     * @param {*} series
     * @returns {void}
     */
    static invalidate(series: any): void;
    /**
     * Simple moving average of close prices.
     * @param {import("../types.js").Series} series
     * @param {number} period
     * @returns {Array<number|null>}
     */
    static calculateMovingAverage(series: import("../types.js").Series, period: number): Array<number | null>;
    /**
     * Relative Strength Index (Wilder) over close prices.
     * @param {import("../types.js").Series} series
     * @param {number} period
     * @returns {Array<number|null>}
     */
    static calculateRSI(series: import("../types.js").Series, period: number): Array<number | null>;
    /**
     * Bollinger Bands (middle SMA with upper/lower std-dev envelopes).
     * @param {import("../types.js").Series} series
     * @param {number} period
     * @param {number} stdDev - Standard-deviation multiplier.
     * @returns {{ middle: Array<number|null>, upper: Array<number|null>, lower: Array<number|null> }}
     */
    static calculateBollingerBands(series: import("../types.js").Series, period: number, stdDev: number): {
        middle: Array<number | null>;
        upper: Array<number | null>;
        lower: Array<number | null>;
    };
    /**
     * Moving Average Convergence Divergence.
     * @param {import("../types.js").Series} series
     * @param {number} [fastPeriod=12]
     * @param {number} [slowPeriod=26]
     * @param {number} [signalPeriod=9]
     * @returns {{ macd: Array<number|null>, signal: Array<number|null>, histogram: Array<number|null> }}
     */
    static calculateMACD(series: import("../types.js").Series, fastPeriod?: number, slowPeriod?: number, signalPeriod?: number): {
        macd: Array<number | null>;
        signal: Array<number | null>;
        histogram: Array<number | null>;
    };
    /**
     * Exponential moving average of close prices (seeded with the SMA).
     * @param {import("../types.js").Series} series
     * @param {number} period
     * @returns {Array<number|null>}
     */
    static calculateEMA(series: import("../types.js").Series, period: number): Array<number | null>;
    /**
     * Fibonacci retracement levels across the full series high/low range.
     * @param {import("../types.js").Series} series
     * @returns {number[]} The six standard levels (0, .236, .382, .5, .618, 1).
     */
    static calculateFibonacciRetracements(series: import("../types.js").Series): number[];
    /**
     * Fibonacci retracement levels across a sub-range of the series.
     * @param {import("../types.js").Series} series
     * @param {number} startIndex
     * @param {number} endIndex
     * @returns {number[]}
     */
    static calculateFibonacciRetracementsForRange(series: import("../types.js").Series, startIndex: number, endIndex: number): number[];
    /**
     * Price Volume Trend.
     * @param {import("../types.js").Series} series
     * @returns {import("../types.js").IndicatorPoint[]}
     */
    static calculatePVT(series: import("../types.js").Series): import("../types.js").IndicatorPoint[];
    /**
     * Volume-Weighted Average Price (cumulative, from the first bar). At each bar
     * `i`, `vwap = sum(price_k * volume_k) / sum(volume_k)` for `k = 0..i`, where
     * `price` is the typical price `(high + low + close) / 3` (`source: "hlc3"`,
     * default) or the `close` (`source: "close"`). Volume-less bars contribute 0;
     * while cumulative volume is still 0 the price itself is used so the line is
     * continuous. Only the output is truncated (the running sums are exact), so it
     * matches the streaming twin bar-for-bar.
     * @param {import("../types.js").Series} series
     * @param {"hlc3"|"close"} [source="hlc3"]
     * @returns {Array<number>}
     */
    static calculateVWAP(series: import("../types.js").Series, source?: "hlc3" | "close"): Array<number>;
    /**
     * Average True Range (Wilder). `TR_i = max(H-L, |H-prevC|, |L-prevC|)`
     * (`TR_0 = H-L`); the first ATR at index `period-1` is the average of the
     * first `period` TRs, then `ATR_i = (ATR_{i-1}*(period-1) + TR_i)/period`.
     * Indices before `period-1` are null. The running ATR is kept untruncated and
     * only the output is truncated, so it matches the streaming twin bar-for-bar.
     * @param {import("../types.js").Series} series
     * @param {number} [period=14]
     * @returns {import("../types.js").IndicatorPoint[]}
     */
    static calculateATR(series: import("../types.js").Series, period?: number): import("../types.js").IndicatorPoint[];
    /**
     * Donchian Channels: over a trailing window of `period` bars, `upper` is the
     * highest high, `lower` is the lowest low, and `middle` is their midpoint.
     * Indices before `period-1` are null. Windowed, so it agrees with the
     * streaming twin by recomputing the same trailing window.
     * @param {import("../types.js").Series} series
     * @param {number} [period=20]
     * @returns {{ upper: Array<number|null>, lower: Array<number|null>, middle: Array<number|null> }}
     */
    static calculateDonchian(series: import("../types.js").Series, period?: number): {
        upper: Array<number | null>;
        lower: Array<number | null>;
        middle: Array<number | null>;
    };
    /**
     * Keltner Channels: an EMA(close, `emaPeriod`) midline with bands offset by
     * `multiplier * ATR(atrPeriod)`. A bar is null until both the EMA and the ATR
     * are established. Composed from the (already truncated) EMA and ATR outputs,
     * so it agrees with the streaming twin (which composes the EMA + ATR steppers).
     * @param {import("../types.js").Series} series
     * @param {number} [emaPeriod=20]
     * @param {number} [atrPeriod=10]
     * @param {number} [multiplier=2]
     * @returns {{ upper: Array<number|null>, lower: Array<number|null>, middle: Array<number|null> }}
     */
    static calculateKeltner(series: import("../types.js").Series, emaPeriod?: number, atrPeriod?: number, multiplier?: number): {
        upper: Array<number | null>;
        lower: Array<number | null>;
        middle: Array<number | null>;
    };
    /**
     * Stochastic oscillator (%K and smoothed %D).
     * @param {import("../types.js").Series} series
     * @param {number} period
     * @param {number} smoothPeriod
     * @returns {{ k: import("../types.js").IndicatorPoint[], d: import("../types.js").IndicatorPoint[] }}
     */
    static calculateStochastic(series: import("../types.js").Series, period: number, smoothPeriod: number): {
        k: import("../types.js").IndicatorPoint[];
        d: import("../types.js").IndicatorPoint[];
    };
    /**
     * Rolling population standard deviation of close prices.
     * @param {import("../types.js").Series} series
     * @param {number} period
     * @returns {import("../types.js").IndicatorPoint[]}
     */
    static calculateStdDevIndicator(series: import("../types.js").Series, period: number): import("../types.js").IndicatorPoint[];
    /**
     * Average Directional Index (Wilder smoothing).
     * @param {import("../types.js").Series} series
     * @param {number} period
     * @returns {import("../types.js").IndicatorPoint[]}
     */
    static calculateADX(series: import("../types.js").Series, period: number): import("../types.js").IndicatorPoint[];
    /**
     * Chaikin oscillator (EMA difference of the accumulation/distribution line).
     * @param {import("../types.js").Series} series
     * @param {number} shortPeriod
     * @param {number} longPeriod
     * @returns {import("../types.js").IndicatorPoint[]}
     */
    static calculateChaikinOsc(series: import("../types.js").Series, shortPeriod: number, longPeriod: number): import("../types.js").IndicatorPoint[];
    /**
     * Exponential moving average over a plain numeric array.
     * @param {Array<number|null>} arr
     * @param {number} period
     * @returns {Array<number|null>}
     */
    static calculateEMAFromArray(arr: Array<number | null>, period: number): Array<number | null>;
    /**
     * Simple moving average over a plain numeric array.
     * @param {Array<number|null>} arr
     * @param {number} period
     * @returns {Array<number|null>}
     */
    static calculateSMAFromArray(arr: Array<number | null>, period: number): Array<number | null>;
    /**
     * Bollinger %B relative to precomputed lower/upper bands.
     * @param {import("../types.js").Series} series
     * @param {Array<number|null>} lower
     * @param {Array<number|null>} upper
     * @returns {import("../types.js").IndicatorPoint[]}
     */
    static calculateBBPercent(series: import("../types.js").Series, lower: Array<number | null>, upper: Array<number | null>): import("../types.js").IndicatorPoint[];
    /**
     * Bollinger band width relative to precomputed bands.
     * @param {import("../types.js").Series} series
     * @param {Array<number|null>} middle
     * @param {Array<number|null>} upper
     * @param {Array<number|null>} lower
     * @returns {import("../types.js").IndicatorPoint[]}
     */
    static calculateBBWidth(series: import("../types.js").Series, middle: Array<number | null>, upper: Array<number | null>, lower: Array<number | null>): import("../types.js").IndicatorPoint[];
    /**
     * Rolling linear-regression value of close prices.
     * @param {import("../types.js").Series} series
     * @param {number} period
     * @returns {import("../types.js").IndicatorPoint[]}
     */
    static calculateLinearRegression(series: import("../types.js").Series, period: number): import("../types.js").IndicatorPoint[];
    /**
     * Ichimoku Cloud components.
     * @param {import("../types.js").Series} series
     * @returns {{ tenkan: import("../types.js").IndicatorPoint[], kijun: import("../types.js").IndicatorPoint[], senkouA: import("../types.js").IndicatorPoint[], senkouB: import("../types.js").IndicatorPoint[], chikou: import("../types.js").IndicatorPoint[] }}
     */
    static calculateIchimoku(series: import("../types.js").Series): {
        tenkan: import("../types.js").IndicatorPoint[];
        kijun: import("../types.js").IndicatorPoint[];
        senkouA: import("../types.js").IndicatorPoint[];
        senkouB: import("../types.js").IndicatorPoint[];
        chikou: import("../types.js").IndicatorPoint[];
    };
    /**
     * Commodity Channel Index.
     * @param {import("../types.js").Series} series
     * @param {number} [period=20]
     * @returns {import("../types.js").IndicatorPoint[]}
     */
    static calculateCCI(series: import("../types.js").Series, period?: number): import("../types.js").IndicatorPoint[];
    /**
     * True Strength Index with its signal line.
     * @param {import("../types.js").Series} series
     * @param {number} [longPeriod=25]
     * @param {number} [shortPeriod=13]
     * @param {number} [signalPeriod=7]
     * @returns {{ tsi: import("../types.js").IndicatorPoint[], signal: import("../types.js").IndicatorPoint[] }}
     */
    static calculateTSI(series: import("../types.js").Series, longPeriod?: number, shortPeriod?: number, signalPeriod?: number): {
        tsi: import("../types.js").IndicatorPoint[];
        signal: import("../types.js").IndicatorPoint[];
    };
    /**
     * Accelerator oscillator (AO minus its SMA).
     * @param {import("../types.js").Series} series
     * @param {number} [acPeriod=5]
     * @returns {import("../types.js").IndicatorPoint[]}
     */
    static calculateAcceleratorOsc(series: import("../types.js").Series, acPeriod?: number): import("../types.js").IndicatorPoint[];
    /**
     * Awesome oscillator (SMA difference of median price). Helper for the
     * accelerator oscillator.
     * @param {import("../types.js").Series} series
     * @returns {import("../types.js").IndicatorPoint[]}
     */
    static calculateAwesomeOscillator(series: import("../types.js").Series): import("../types.js").IndicatorPoint[];
}
