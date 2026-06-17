import Utils from "../utils/Utils";

class Indicators {
  /**
   * Per-series memoization cache. Keyed on the series array identity (so a new
   * data array naturally invalidates and the old entry is GC'd), then on a
   * string describing the method + its parameters.
   *
   * Indicator math is pure, so caching is safe. Callers must treat the returned
   * arrays as read-only (they do today — results are mapped into new arrays).
   * @type {WeakMap<object, Map<string, *>>}
   */
  static _cache = new WeakMap();

  /**
   * @param {*} series
   * @param {string} key
   * @returns {*} The cached value, or `undefined` if absent.
   */
  static _cacheGet(series, key) {
    if (!series || typeof series !== "object") return undefined;
    const perSeries = Indicators._cache.get(series);
    return perSeries ? perSeries.get(key) : undefined;
  }

  /**
   * Stores and returns `value` for `(series, key)`.
   * @template T
   * @param {*} series
   * @param {string} key
   * @param {T} value
   * @returns {T}
   */
  static _cacheSet(series, key, value) {
    if (series && typeof series === "object") {
      let perSeries = Indicators._cache.get(series);
      if (!perSeries) {
        perSeries = new Map();
        Indicators._cache.set(series, perSeries);
      }
      perSeries.set(key, value);
    }
    return value;
  }

  /**
   * Simple moving average of close prices.
   * @param {import("../types.js").Series} series
   * @param {number} period
   * @returns {Array<number|null>}
   */
  static calculateMovingAverage(series, period) {
    const cached = Indicators._cacheGet(series, "ma:" + period);
    if (cached !== undefined) return cached;
    const ma = [];
    for (let i = 0; i < series.length; i++) {
      if (i < period - 1) {
        ma.push(null);
      } else {
        let sum = 0;
        for (let j = i - period + 1; j <= i; j++) {
          sum += series[j].y[3];
        }
        ma.push(Utils.truncateNumber(sum / period));
      }
    }
    return Indicators._cacheSet(series, "ma:" + period, ma);
  }

  /**
   * Relative Strength Index (Wilder) over close prices.
   * @param {import("../types.js").Series} series
   * @param {number} period
   * @returns {Array<number|null>}
   */
  static calculateRSI(series, period) {
    const cached = Indicators._cacheGet(series, "rsi:" + period);
    if (cached !== undefined) return cached;
    const rsi = [];
    let gains = 0,
      losses = 0;
    for (let i = 0; i < series.length; i++) {
      const price = series[i].y[3];
      if (i === 0) {
        rsi.push(null);
      } else {
        const change = price - series[i - 1].y[3];
        const gain = change > 0 ? change : 0;
        const loss = change < 0 ? -change : 0;
        if (i < period) {
          gains += gain;
          losses += loss;
          if (i === period - 1) {
            const avgGain = gains / period;
            const avgLoss = losses / period;
            const rsVal = avgLoss === 0 ? 0 : avgGain / avgLoss;
            const rsiValue = avgLoss === 0 ? 100 : 100 - 100 / (1 + rsVal);
            rsi.push(Utils.truncateNumber(rsiValue));
          } else {
            rsi.push(null);
          }
        } else {
          let sumGain = 0,
            sumLoss = 0;
          for (let j = i - period + 1; j <= i; j++) {
            const delta = series[j].y[3] - series[j - 1].y[3];
            sumGain += delta > 0 ? delta : 0;
            sumLoss += delta < 0 ? -delta : 0;
          }
          const avgGain = sumGain / period;
          const avgLoss = sumLoss / period;
          const rsVal = avgLoss === 0 ? 0 : avgGain / avgLoss;
          const rsiValue = avgLoss === 0 ? 100 : 100 - 100 / (1 + rsVal);
          rsi.push(Utils.truncateNumber(rsiValue));
        }
      }
    }
    return Indicators._cacheSet(series, "rsi:" + period, rsi);
  }

  /**
   * Bollinger Bands (middle SMA with upper/lower std-dev envelopes).
   * @param {import("../types.js").Series} series
   * @param {number} period
   * @param {number} stdDev - Standard-deviation multiplier.
   * @returns {{ middle: Array<number|null>, upper: Array<number|null>, lower: Array<number|null> }}
   */
  static calculateBollingerBands(series, period, stdDev) {
    const cached = Indicators._cacheGet(series, "bb:" + period + ":" + stdDev);
    if (cached !== undefined) return cached;
    const middle = Indicators.calculateMovingAverage(series, period);
    const upper = [],
      lower = [];
    for (let i = 0; i < series.length; i++) {
      if (i < period - 1) {
        upper.push(null);
        lower.push(null);
      } else {
        let sum = 0;
        for (let j = i - period + 1; j <= i; j++) {
          const deviation = series[j].y[3] - middle[i];
          sum += deviation * deviation;
        }
        const stdDevValue = Math.sqrt(sum / period);
        upper.push(Utils.truncateNumber(middle[i] + stdDev * stdDevValue));
        lower.push(Utils.truncateNumber(middle[i] - stdDev * stdDevValue));
      }
    }
    return Indicators._cacheSet(series, "bb:" + period + ":" + stdDev, {
      middle,
      upper,
      lower,
    });
  }

  /**
   * Moving Average Convergence Divergence.
   * @param {import("../types.js").Series} series
   * @param {number} [fastPeriod=12]
   * @param {number} [slowPeriod=26]
   * @param {number} [signalPeriod=9]
   * @returns {{ macd: Array<number|null>, signal: Array<number|null>, histogram: Array<number|null> }}
   */
  static calculateMACD(
    series,
    fastPeriod = 12,
    slowPeriod = 26,
    signalPeriod = 9
  ) {
    const fastEMA = Indicators.calculateEMA(series, fastPeriod);
    const slowEMA = Indicators.calculateEMA(series, slowPeriod);
    const macd = [];
    for (let i = 0; i < series.length; i++) {
      if (i < slowPeriod - 1) {
        macd.push(null);
      } else {
        macd.push(fastEMA[i] - slowEMA[i]);
      }
    }
    const signal = [];
    let signalSum = 0,
      validCount = 0;
    for (let i = 0; i < macd.length; i++) {
      if (i < slowPeriod - 1 + signalPeriod - 1) {
        signal.push(null);
      } else {
        if (validCount < signalPeriod) {
          signalSum += macd[i - (signalPeriod - 1) + validCount];
          validCount++;
          if (validCount === signalPeriod) {
            signal.push(signalSum / signalPeriod);
          } else {
            signal.push(null);
          }
        } else {
          const multiplier = 2 / (signalPeriod + 1);
          signal.push(macd[i] * multiplier + signal[i - 1] * (1 - multiplier));
        }
      }
    }
    const histogram = [];
    for (let i = 0; i < series.length; i++) {
      if (i < slowPeriod - 1 + signalPeriod - 1) {
        histogram.push(null);
      } else {
        histogram.push(macd[i] - signal[i]);
      }
    }
    return { macd, signal, histogram };
  }

  /**
   * Exponential moving average of close prices (seeded with the SMA).
   * @param {import("../types.js").Series} series
   * @param {number} period
   * @returns {Array<number|null>}
   */
  static calculateEMA(series, period) {
    const cached = Indicators._cacheGet(series, "ema:" + period);
    if (cached !== undefined) return cached;
    const ema = [];
    // Not enough points to seed the EMA: return all-null (the warm-up
    // convention) instead of reading past the end of the array and throwing.
    if (!Array.isArray(series) || period < 1 || series.length < period) {
      for (let i = 0; i < (series ? series.length : 0); i++) ema.push(null);
      return Indicators._cacheSet(series, "ema:" + period, ema);
    }
    const multiplier = 2 / (period + 1);
    let sum = 0;
    for (let i = 0; i < period; i++) {
      sum += series[i].y[3];
    }
    const sma = sum / period;
    for (let i = 0; i < series.length; i++) {
      if (i < period - 1) {
        ema.push(null);
      } else if (i === period - 1) {
        ema.push(Utils.truncateNumber(sma));
      } else {
        ema.push(
          Utils.truncateNumber(
            series[i].y[3] * multiplier + ema[i - 1] * (1 - multiplier)
          )
        );
      }
    }
    return Indicators._cacheSet(series, "ema:" + period, ema);
  }

  /**
   * Fibonacci retracement levels across the full series high/low range.
   * @param {import("../types.js").Series} series
   * @returns {number[]} The six standard levels (0, .236, .382, .5, .618, 1).
   */
  static calculateFibonacciRetracements(series) {
    // Empty input would make Math.max/min return ∓Infinity → NaN levels.
    if (!Array.isArray(series) || series.length === 0) {
      return [0, 0.236, 0.382, 0.5, 0.618, 1].map(() => 0);
    }
    const highs = series.map((pt) => pt.y[1]);
    const lows = series.map((pt) => pt.y[2]);
    const maxHigh = Math.max(...highs);
    const minLow = Math.min(...lows);
    const diff = maxHigh - minLow;
    return [0, 0.236, 0.382, 0.5, 0.618, 1].map(
      (level) => minLow + level * diff
    );
  }

  /**
   * Fibonacci retracement levels across a sub-range of the series.
   * @param {import("../types.js").Series} series
   * @param {number} startIndex
   * @param {number} endIndex
   * @returns {number[]}
   */
  static calculateFibonacciRetracementsForRange(series, startIndex, endIndex) {
    // Ensure indices are valid
    if (!series || series.length === 0) return [];

    startIndex = Math.max(0, startIndex);
    endIndex = Math.min(series.length - 1, endIndex);

    // Get data points within the range
    const visibleSeries = series.slice(startIndex, endIndex + 1);

    // Find highest high and lowest low within this range
    const highs = visibleSeries.map((pt) => pt.y[1]);
    const lows = visibleSeries.map((pt) => pt.y[2]);
    const maxHigh = Math.max(...highs);
    const minLow = Math.min(...lows);
    const diff = maxHigh - minLow;

    // Calculate Fibonacci levels
    return [0, 0.236, 0.382, 0.5, 0.618, 1].map(
      (level) => minLow + level * diff
    );
  }

  /**
   * Price Volume Trend.
   * @param {import("../types.js").Series} series
   * @returns {import("../types.js").IndicatorPoint[]}
   */
  static calculatePVT(series) {
    const pvt = [];
    let prev = 0;
    for (let i = 0; i < series.length; i++) {
      if (i === 0) {
        pvt.push({ x: series[i].x, y: 0 });
      } else {
        const prevClose = series[i - 1].y[3];
        const currClose = series[i].y[3];
        const volume = series[i].v || 0;
        // Guard a zero previous close (would yield Infinity/NaN).
        const changePct =
          prevClose === 0 ? 0 : (currClose - prevClose) / prevClose;
        prev = prev + changePct * volume;
        pvt.push({ x: series[i].x, y: Utils.truncateNumber(prev) });
      }
    }
    return pvt;
  }

  /**
   * Stochastic oscillator (%K and smoothed %D).
   * @param {import("../types.js").Series} series
   * @param {number} period
   * @param {number} smoothPeriod
   * @returns {{ k: import("../types.js").IndicatorPoint[], d: import("../types.js").IndicatorPoint[] }}
   */
  static calculateStochastic(series, period, smoothPeriod) {
    const k = [];
    for (let i = 0; i < series.length; i++) {
      if (i < period - 1) {
        k.push({ x: series[i].x, y: null });
      } else {
        const periodSlice = series.slice(i - period + 1, i + 1);
        const highs = periodSlice.map((pt) => pt.y[1]);
        const lows = periodSlice.map((pt) => pt.y[2]);
        const highestHigh = Math.max(...highs);
        const lowestLow = Math.min(...lows);
        const range = highestHigh - lowestLow;
        // Flat window (high === low): %K is undefined; report 0 rather than NaN.
        const value = range === 0 ? 0 : ((series[i].y[3] - lowestLow) / range) * 100;
        k.push({ x: series[i].x, y: Utils.truncateNumber(value) });
      }
    }
    const d = [];
    for (let i = 0; i < k.length; i++) {
      if (i < smoothPeriod - 1 || k[i].y === null) {
        d.push({ x: k[i].x, y: null });
      } else {
        let sum = 0;
        for (let j = i - smoothPeriod + 1; j <= i; j++) {
          sum += k[j].y;
        }
        d.push({ x: k[i].x, y: Utils.truncateNumber(sum / smoothPeriod) });
      }
    }
    return { k, d };
  }

  /**
   * Rolling population standard deviation of close prices.
   * @param {import("../types.js").Series} series
   * @param {number} period
   * @returns {import("../types.js").IndicatorPoint[]}
   */
  static calculateStdDevIndicator(series, period) {
    const stdDevArr = [];
    for (let i = 0; i < series.length; i++) {
      if (i < period - 1) {
        stdDevArr.push({ x: series[i].x, y: null });
      } else {
        const periodSlice = series.slice(i - period + 1, i + 1);
        const closes = periodSlice.map((pt) => pt.y[3]);
        const mean = closes.reduce((a, b) => a + b, 0) / period;
        let sumSq = 0;
        closes.forEach((c) => {
          sumSq += Math.pow(c - mean, 2);
        });
        const std = Math.sqrt(sumSq / period);
        stdDevArr.push({ x: series[i].x, y: Utils.truncateNumber(std) });
      }
    }
    return stdDevArr;
  }

  /**
   * Average Directional Index (Wilder smoothing).
   * @param {import("../types.js").Series} series
   * @param {number} period
   * @returns {import("../types.js").IndicatorPoint[]}
   */
  static calculateADX(series, period) {
    if (!series || series.length < period * 2) {
      // Need at least 2 * period data points for meaningful calculation
      return series.map((point) => ({ x: point.x, y: null }));
    }

    // Initialize result array with null values and the same dates as input series
    const result = series.map((point) => ({
      x: point.x,
      y: null,
    }));

    // Arrays for intermediate calculations
    const trArr = []; // True Range
    const plusDMArr = []; // Plus Directional Movement
    const minusDMArr = []; // Minus Directional Movement
    const smoothedTRArr = []; // Smoothed True Range
    const smoothedPlusDMArr = []; // Smoothed Plus DM
    const smoothedMinusDMArr = []; // Smoothed Minus DM
    const plusDIArr = []; // Plus Directional Indicator
    const minusDIArr = []; // Minus Directional Indicator
    const dxArr = []; // Directional Index

    // Step 1: Calculate True Range (TR) and Directional Movement (DM)
    for (let i = 1; i < series.length; i++) {
      // Current and previous candles
      const curr = series[i].y;
      const prev = series[i - 1].y;

      // High, Low, Close for current and previous
      const highCurr = curr[1];
      const lowCurr = curr[2];
      const closePrev = prev[3];

      // True Range calculation
      const tr1 = Math.abs(highCurr - lowCurr);
      const tr2 = Math.abs(highCurr - closePrev);
      const tr3 = Math.abs(lowCurr - closePrev);
      const tr = Math.max(tr1, tr2, tr3);
      trArr.push(tr);

      // Plus Directional Movement (+DM)
      const upMove = highCurr - prev[1];
      const downMove = prev[2] - lowCurr;
      let plusDM = 0;
      let minusDM = 0;

      if (upMove > downMove && upMove > 0) {
        plusDM = upMove;
      }

      if (downMove > upMove && downMove > 0) {
        minusDM = downMove;
      }

      plusDMArr.push(plusDM);
      minusDMArr.push(minusDM);
    }

    // Step 2: Calculate first smoothed values for TR, +DM, -DM
    let firstTR = 0;
    let firstPlusDM = 0;
    let firstMinusDM = 0;

    for (let i = 0; i < period; i++) {
      firstTR += trArr[i];
      firstPlusDM += plusDMArr[i];
      firstMinusDM += minusDMArr[i];
    }

    smoothedTRArr.push(firstTR);
    smoothedPlusDMArr.push(firstPlusDM);
    smoothedMinusDMArr.push(firstMinusDM);

    // Step 3: Calculate remaining smoothed values using Wilder's method
    for (let i = 1; i < trArr.length - period + 1; i++) {
      const smoothedTR =
        smoothedTRArr[i - 1] -
        smoothedTRArr[i - 1] / period +
        trArr[i + period - 1];
      const smoothedPlusDM =
        smoothedPlusDMArr[i - 1] -
        smoothedPlusDMArr[i - 1] / period +
        plusDMArr[i + period - 1];
      const smoothedMinusDM =
        smoothedMinusDMArr[i - 1] -
        smoothedMinusDMArr[i - 1] / period +
        minusDMArr[i + period - 1];

      smoothedTRArr.push(smoothedTR);
      smoothedPlusDMArr.push(smoothedPlusDM);
      smoothedMinusDMArr.push(smoothedMinusDM);

      // Step 4: Calculate +DI and -DI
      const plusDI = (smoothedPlusDM / smoothedTR) * 100;
      const minusDI = (smoothedMinusDM / smoothedTR) * 100;

      plusDIArr.push(plusDI);
      minusDIArr.push(minusDI);

      // Step 5: Calculate DX
      const diDiff = Math.abs(plusDI - minusDI);
      const diSum = plusDI + minusDI;
      const dx = (diDiff / diSum) * 100;

      dxArr.push(dx);
    }

    // Step 6: Calculate ADX (Average of DX over period)
    let adxSum = 0;
    for (let i = 0; i < period; i++) {
      if (i < dxArr.length) {
        adxSum += dxArr[i];
      }
    }

    // First ADX value (average of first period DX values)
    let adx = adxSum / period;
    const firstAdxIndex = period * 2; // Index in the original series

    if (firstAdxIndex < series.length) {
      result[firstAdxIndex].y = Utils.truncateNumber(adx);
    }

    // Calculate remaining ADX values using Wilder's smoothing
    for (let i = period; i < dxArr.length; i++) {
      adx = (adx * (period - 1) + dxArr[i]) / period;
      const adxIndex = i + period + 1; // Adjust index for original series

      if (adxIndex < series.length) {
        result[adxIndex].y = Utils.truncateNumber(adx);
      }
    }

    return result;
  }

  /**
   * Chaikin oscillator (EMA difference of the accumulation/distribution line).
   * @param {import("../types.js").Series} series
   * @param {number} shortPeriod
   * @param {number} longPeriod
   * @returns {import("../types.js").IndicatorPoint[]}
   */
  static calculateChaikinOsc(series, shortPeriod, longPeriod) {
    const ad = [];
    let cumulative = 0;
    for (let i = 0; i < series.length; i++) {
      const high = series[i].y[1];
      const low = series[i].y[2];
      const close = series[i].y[3];
      const volume = series[i].v || 0;
      const clv = (high - close - (close - low)) / (high - low || 1);
      cumulative += clv * volume;
      ad.push(cumulative);
    }
    const emaShort = Indicators.calculateEMAFromArray(ad, shortPeriod);
    const emaLong = Indicators.calculateEMAFromArray(ad, longPeriod);
    const chaikin = [];
    for (let i = 0; i < ad.length; i++) {
      if (emaShort[i] === null || emaLong[i] === null) {
        chaikin.push({ x: series[i].x, y: null });
      } else {
        chaikin.push({
          x: series[i].x,
          y: Utils.truncateNumber(emaShort[i] - emaLong[i]),
        });
      }
    }
    return chaikin;
  }

  /**
   * Exponential moving average over a plain numeric array.
   * @param {Array<number|null>} arr
   * @param {number} period
   * @returns {Array<number|null>}
   */
  static calculateEMAFromArray(arr, period) {
    const ema = [];
    const multiplier = 2 / (period + 1);
    let sum = 0;
    for (let i = 0; i < arr.length; i++) {
      if (i < period) {
        if (arr[i] !== null) sum += arr[i];
        else sum += 0;
        if (i === period - 1) {
          const sma = sum / period;
          ema.push(Utils.truncateNumber(sma));
        } else {
          ema.push(null);
        }
      } else {
        ema.push(
          Utils.truncateNumber(
            arr[i] * multiplier + ema[i - 1] * (1 - multiplier)
          )
        );
      }
    }
    return ema;
  }

  /**
   * Simple moving average over a plain numeric array.
   * @param {Array<number|null>} arr
   * @param {number} period
   * @returns {Array<number|null>}
   */
  static calculateSMAFromArray(arr, period) {
    const sma = [];
    for (let i = 0; i < arr.length; i++) {
      if (i < period - 1) {
        sma.push(null);
      } else {
        let sum = 0;
        for (let j = i - period + 1; j <= i; j++) {
          sum += arr[j];
        }
        sma.push(Utils.truncateNumber(sum / period));
      }
    }
    return sma;
  }

  /**
   * Bollinger %B relative to precomputed lower/upper bands.
   * @param {import("../types.js").Series} series
   * @param {Array<number|null>} lower
   * @param {Array<number|null>} upper
   * @returns {import("../types.js").IndicatorPoint[]}
   */
  static calculateBBPercent(series, lower, upper) {
    const percentB = [];
    for (let i = 0; i < series.length; i++) {
      const close = series[i].y[3];
      if (lower[i] === null || upper[i] === null) {
        percentB.push({ x: series[i].x, y: null });
      } else {
        const pb = (close - lower[i]) / (upper[i] - lower[i]);
        percentB.push({ x: series[i].x, y: Utils.truncateNumber(pb) });
      }
    }
    return percentB;
  }

  /**
   * Bollinger band width relative to precomputed bands.
   * @param {import("../types.js").Series} series
   * @param {Array<number|null>} middle
   * @param {Array<number|null>} upper
   * @param {Array<number|null>} lower
   * @returns {import("../types.js").IndicatorPoint[]}
   */
  static calculateBBWidth(series, middle, upper, lower) {
    const bbWidth = [];
    for (let i = 0; i < series.length; i++) {
      if (middle[i] === null || upper[i] === null || lower[i] === null) {
        bbWidth.push({ x: series[i].x, y: null });
      } else {
        const width = (upper[i] - lower[i]) / middle[i];
        bbWidth.push({ x: series[i].x, y: Utils.truncateNumber(width) });
      }
    }
    return bbWidth;
  }

  /**
   * Rolling linear-regression value of close prices.
   * @param {import("../types.js").Series} series
   * @param {number} period
   * @returns {import("../types.js").IndicatorPoint[]}
   */
  static calculateLinearRegression(series, period) {
    const lr = [];
    for (let i = 0; i < series.length; i++) {
      if (i < period - 1) {
        lr.push({ x: series[i].x, y: null });
      } else {
        let sumX = 0,
          sumY = 0,
          sumXY = 0,
          sumX2 = 0;
        for (let j = i - period + 1; j <= i; j++) {
          const xVal = j;
          const yVal = series[j].y[3];
          sumX += xVal;
          sumY += yVal;
          sumXY += xVal * yVal;
          sumX2 += xVal * xVal;
        }
        const slope =
          (period * sumXY - sumX * sumY) / (period * sumX2 - sumX * sumX);
        const intercept = (sumY - slope * sumX) / period;
        const lrVal = slope * i + intercept;
        lr.push({ x: series[i].x, y: Utils.truncateNumber(lrVal) });
      }
    }
    return lr;
  }

  /**
   * Ichimoku Cloud components.
   * @param {import("../types.js").Series} series
   * @returns {{ tenkan: import("../types.js").IndicatorPoint[], kijun: import("../types.js").IndicatorPoint[], senkouA: import("../types.js").IndicatorPoint[], senkouB: import("../types.js").IndicatorPoint[], chikou: import("../types.js").IndicatorPoint[] }}
   */
  static calculateIchimoku(series) {
    const tenkan = [];
    const kijun = [];
    const senkouA = [];
    const senkouB = [];
    const chikou = [];
    for (let i = 0; i < series.length; i++) {
      if (i < 8) {
        tenkan.push({ x: series[i].x, y: null });
      } else {
        const slice = series.slice(i - 8, i + 1);
        const high = Math.max(...slice.map((pt) => pt.y[1]));
        const low = Math.min(...slice.map((pt) => pt.y[2]));
        tenkan.push({
          x: series[i].x,
          y: Utils.truncateNumber((high + low) / 2),
        });
      }
      if (i < 25) {
        kijun.push({ x: series[i].x, y: null });
      } else {
        const slice = series.slice(i - 25, i + 1);
        const high = Math.max(...slice.map((pt) => pt.y[1]));
        const low = Math.min(...slice.map((pt) => pt.y[2]));
        kijun.push({
          x: series[i].x,
          y: Utils.truncateNumber((high + low) / 2),
        });
      }
      if (i < 26) {
        chikou.push({ x: series[i].x, y: null });
      } else {
        chikou.push({ x: series[i - 26].x, y: series[i].y[3] });
      }
      if (i < 51) {
        senkouB.push({ x: series[i].x, y: null });
      } else {
        const slice = series.slice(i - 51, i + 1);
        const high = Math.max(...slice.map((pt) => pt.y[1]));
        const low = Math.min(...slice.map((pt) => pt.y[2]));
        senkouB.push({
          x: series[i].x,
          y: Utils.truncateNumber((high + low) / 2),
        });
      }
      if (i < 25 || tenkan[i].y === null || kijun[i].y === null) {
        senkouA.push({ x: series[i].x, y: null });
      } else {
        senkouA.push({
          x: series[i].x,
          y: Utils.truncateNumber((tenkan[i].y + kijun[i].y) / 2),
        });
      }
    }
    return { tenkan, kijun, senkouA, senkouB, chikou };
  }

  /**
   * Commodity Channel Index.
   * @param {import("../types.js").Series} series
   * @param {number} [period=20]
   * @returns {import("../types.js").IndicatorPoint[]}
   */
  static calculateCCI(series, period = 20) {
    const cci = [];
    for (let i = 0; i < series.length; i++) {
      if (i < period - 1) {
        cci.push({ x: series[i].x, y: null });
      } else {
        const periodSlice = series.slice(i - period + 1, i + 1);

        // Calculate typical price for each candle (high + low + close) / 3
        const typicalPrices = periodSlice.map(
          (candle) => (candle.y[1] + candle.y[2] + candle.y[3]) / 3
        );

        // Calculate simple moving average of typical prices
        const sma = typicalPrices.reduce((sum, tp) => sum + tp, 0) / period;

        // Calculate mean deviation
        let meanDeviation = 0;
        typicalPrices.forEach((tp) => {
          meanDeviation += Math.abs(tp - sma);
        });
        meanDeviation /= period;

        // Calculate CCI
        const currentTP =
          (series[i].y[1] + series[i].y[2] + series[i].y[3]) / 3;
        const cciValue =
          meanDeviation === 0 ? 0 : (currentTP - sma) / (0.015 * meanDeviation);

        cci.push({ x: series[i].x, y: Utils.truncateNumber(cciValue) });
      }
    }
    return cci;
  }

  /**
   * True Strength Index with its signal line.
   * @param {import("../types.js").Series} series
   * @param {number} [longPeriod=25]
   * @param {number} [shortPeriod=13]
   * @param {number} [signalPeriod=7]
   * @returns {{ tsi: import("../types.js").IndicatorPoint[], signal: import("../types.js").IndicatorPoint[] }}
   */
  static calculateTSI(
    series,
    longPeriod = 25,
    shortPeriod = 13,
    signalPeriod = 7
  ) {
    const tsi = [];
    const momentum = [];
    const absChange = [];

    // Calculate price changes
    for (let i = 0; i < series.length; i++) {
      if (i === 0) {
        momentum.push(0);
        absChange.push(0);
      } else {
        const change = series[i].y[3] - series[i - 1].y[3];
        momentum.push(change);
        absChange.push(Math.abs(change));
      }
    }

    // Calculate EMAs
    const ema1 = Indicators.calculateEMAFromArray(momentum, longPeriod);
    const ema2 = Indicators.calculateEMAFromArray(ema1, shortPeriod);

    const absEma1 = Indicators.calculateEMAFromArray(absChange, longPeriod);
    const absEma2 = Indicators.calculateEMAFromArray(absEma1, shortPeriod);

    // Calculate TSI values
    for (let i = 0; i < series.length; i++) {
      if (ema2[i] === null || absEma2[i] === null || absEma2[i] === 0) {
        tsi.push({ x: series[i].x, y: null });
      } else {
        const tsiValue = 100 * (ema2[i] / absEma2[i]);
        tsi.push({ x: series[i].x, y: Utils.truncateNumber(tsiValue) });
      }
    }

    // Calculate signal line
    const tsiValues = tsi.map((t) => t.y);
    const signal = Indicators.calculateEMAFromArray(tsiValues, signalPeriod);

    // Format the result
    const signalLine = tsi.map((t, i) => ({
      x: t.x,
      y: signal[i],
    }));

    return { tsi, signal: signalLine };
  }

  /**
   * Accelerator oscillator (AO minus its SMA).
   * @param {import("../types.js").Series} series
   * @param {number} [acPeriod=5]
   * @returns {import("../types.js").IndicatorPoint[]}
   */
  static calculateAcceleratorOsc(series, acPeriod = 5) {
    // First calculate Awesome Oscillator
    const awesome = Indicators.calculateAwesomeOscillator(series);

    // Then calculate the SMA of Awesome Oscillator
    const awesomeValues = awesome.map((a) => a.y);
    const sma = Indicators.calculateSMAFromArray(awesomeValues, acPeriod);

    // Calculate Accelerator Oscillator = AO - SMA(AO, acPeriod)
    const acc = [];
    for (let i = 0; i < series.length; i++) {
      if (awesome[i].y === null || sma[i] === null) {
        acc.push({ x: series[i].x, y: null });
      } else {
        acc.push({
          x: series[i].x,
          y: Utils.truncateNumber(awesome[i].y - sma[i]),
        });
      }
    }

    return acc;
  }

  // Helper method for Accelerator Oscillator
  /**
   * Awesome oscillator (SMA difference of median price). Helper for the
   * accelerator oscillator.
   * @param {import("../types.js").Series} series
   * @returns {import("../types.js").IndicatorPoint[]}
   */
  static calculateAwesomeOscillator(series) {
    const fastPeriod = 5;
    const slowPeriod = 34;
    const ao = [];

    for (let i = 0; i < series.length; i++) {
      if (i < slowPeriod - 1) {
        ao.push({ x: series[i].x, y: null });
      } else {
        // Calculate median price for each candle (high + low) / 2
        const fastSlice = series.slice(i - fastPeriod + 1, i + 1);
        const slowSlice = series.slice(i - slowPeriod + 1, i + 1);

        // Calculate SMA of median prices
        const fastMedian =
          fastSlice.reduce(
            (sum, candle) => sum + (candle.y[1] + candle.y[2]) / 2,
            0
          ) / fastPeriod;

        const slowMedian =
          slowSlice.reduce(
            (sum, candle) => sum + (candle.y[1] + candle.y[2]) / 2,
            0
          ) / slowPeriod;

        // AO = SMA(median price, 5) - SMA(median price, 34)
        const aoValue = fastMedian - slowMedian;
        ao.push({ x: series[i].x, y: Utils.truncateNumber(aoValue) });
      }
    }

    return ao;
  }
}

export default Indicators;
