import Utils from "./utils/Utils";

class Indicators {
  static calculateMovingAverage(series, period) {
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
    return ma;
  }

  static calculateRSI(series, period) {
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
    return rsi;
  }

  static calculateBollingerBands(series, period, stdDev) {
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
    return { middle, upper, lower };
  }

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

  static calculateEMA(series, period) {
    const ema = [];
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
    return ema;
  }

  static calculateFibonacciRetracements(series) {
    const highs = series.map((pt) => pt.y[1]);
    const lows = series.map((pt) => pt.y[2]);
    const maxHigh = Math.max(...highs);
    const minLow = Math.min(...lows);
    const diff = maxHigh - minLow;
    return [0, 0.236, 0.382, 0.5, 0.618, 1].map(
      (level) => minLow + level * diff
    );
  }

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
        const changePct = (currClose - prevClose) / prevClose;
        prev = prev + changePct * volume;
        pvt.push({ x: series[i].x, y: Utils.truncateNumber(prev) });
      }
    }
    return pvt;
  }

  static calculateStochastic(series, period, smoothPeriod) {
    const k = [];
    for (let i = 0; i < series.length; i++) {
      if (i < period - 1) {
        k.push({ x: series[i].x, y: null });
      } else {
        const periodSlice = series.slice(i - period + 1, i + 1);
        const closes = periodSlice.map((pt) => pt.y[3]);
        const highs = periodSlice.map((pt) => pt.y[1]);
        const lows = periodSlice.map((pt) => pt.y[2]);
        const highestHigh = Math.max(...highs);
        const lowestLow = Math.min(...lows);
        const value =
          ((series[i].y[3] - lowestLow) / (highestHigh - lowestLow)) * 100;
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

  static calculateADX(series, period) {
    const adxArr = [];
    for (let i = 0; i < series.length; i++) {
      adxArr.push({ x: series[i].x, y: i < period ? null : 25 });
    }
    return adxArr;
  }

  static calculateChaikinOsc(series) {
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
    const emaShort = Indicators.calculateEMAFromArray(ad, 3);
    const emaLong = Indicators.calculateEMAFromArray(ad, 10);
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
}

export default Indicators;
