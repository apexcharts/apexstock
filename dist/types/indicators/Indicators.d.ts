export default Indicators;
declare class Indicators {
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
