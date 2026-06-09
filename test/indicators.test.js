import { describe, it, expect } from "vitest";
import Indicators from "../src/indicators/Indicators.js";
import { ohlc, longSeries } from "./fixtures.js";

// Helper: count leading nulls in a plain array.
const leadingNulls = (arr) => arr.findIndex((v) => v !== null);
// Helper: count leading {y: null} in an array of points.
const leadingNullPoints = (arr) => arr.findIndex((p) => p.y !== null);

describe("calculateMovingAverage (SMA)", () => {
  it("computes a simple moving average over close prices with leading nulls", () => {
    const series = ohlc([10, 20, 30, 40, 50]);
    expect(Indicators.calculateMovingAverage(series, 3)).toEqual([
      null,
      null,
      20,
      30,
      40,
    ]);
  });

  it("returns all-null when the period exceeds the data length", () => {
    const series = ohlc([10, 20]);
    expect(Indicators.calculateMovingAverage(series, 5)).toEqual([null, null]);
  });
});

describe("calculateEMA", () => {
  it("seeds with the SMA then applies the smoothing multiplier", () => {
    // period 3 -> multiplier 0.5, seed SMA(10,20,30)=20
    const series = ohlc([10, 20, 30, 40, 50]);
    expect(Indicators.calculateEMA(series, 3)).toEqual([
      null,
      null,
      20,
      30,
      40,
    ]);
  });
});

describe("calculateRSI", () => {
  it("returns 100 when there are only gains", () => {
    const series = ohlc([10, 20, 30, 40, 50]);
    expect(Indicators.calculateRSI(series, 3)).toEqual([
      null,
      null,
      100,
      100,
      100,
    ]);
  });

  it("computes mixed gain/loss values", () => {
    const series = ohlc([10, 12, 11, 13, 12]);
    const rsi = Indicators.calculateRSI(series, 3);
    expect(rsi[0]).toBeNull();
    expect(rsi[1]).toBeNull();
    expect(rsi[2]).toBeCloseTo(66.67, 2);
    expect(rsi[3]).toBeCloseTo(80, 2);
    expect(rsi[4]).toBeCloseTo(50, 2);
  });
});

describe("calculateBollingerBands", () => {
  it("computes middle/upper/lower bands from population std dev", () => {
    const series = ohlc([10, 20, 30, 40, 50]);
    const { middle, upper, lower } = Indicators.calculateBollingerBands(
      series,
      3,
      2
    );
    expect(middle).toEqual([null, null, 20, 30, 40]);
    // std dev of {10,20,30} (population) = 8.16497; band offset = 2*std
    expect(upper[2]).toBeCloseTo(36.33, 2);
    expect(lower[2]).toBeCloseTo(3.67, 2);
    expect(upper[4]).toBeCloseTo(56.33, 2);
    expect(lower[4]).toBeCloseTo(23.67, 2);
  });
});

describe("calculateStdDevIndicator", () => {
  it("computes the rolling population standard deviation", () => {
    const series = ohlc([10, 20, 30, 40, 50]);
    const std = Indicators.calculateStdDevIndicator(series, 3);
    expect(leadingNullPoints(std)).toBe(2);
    expect(std[2].y).toBeCloseTo(8.16, 2);
    expect(std).toHaveLength(series.length);
  });
});

describe("calculateFibonacciRetracements", () => {
  it("returns the six standard retracement levels spanning low..high", () => {
    const series = ohlc([15, 30, 45, 25, 20], {
      highs: [20, 40, 60, 30, 25],
      lows: [10, 15, 20, 12, 18],
    });
    const levels = Indicators.calculateFibonacciRetracements(series);
    // maxHigh=60, minLow=10, diff=50
    expect(levels[0]).toBeCloseTo(10, 5);
    expect(levels[1]).toBeCloseTo(21.8, 5);
    expect(levels[2]).toBeCloseTo(29.1, 5);
    expect(levels[3]).toBeCloseTo(35, 5);
    expect(levels[4]).toBeCloseTo(40.9, 5);
    expect(levels[5]).toBeCloseTo(60, 5);
  });
});

describe("calculateLinearRegression", () => {
  it("fits perfectly linear data so the line equals the close price", () => {
    const closes = [10, 20, 30, 40, 50];
    const series = ohlc(closes);
    const lr = Indicators.calculateLinearRegression(series, 3);
    expect(leadingNullPoints(lr)).toBe(2);
    for (let i = 2; i < closes.length; i++) {
      expect(lr[i].y).toBeCloseTo(closes[i], 5);
    }
  });
});

describe("calculateMACD", () => {
  it("returns macd/signal/histogram arrays aligned to the series length", () => {
    const series = longSeries(60);
    const { macd, signal, histogram } = Indicators.calculateMACD(series);
    expect(macd).toHaveLength(series.length);
    expect(signal).toHaveLength(series.length);
    expect(histogram).toHaveLength(series.length);
    // slowPeriod default 26 -> macd null before index 25
    expect(macd[24]).toBeNull();
    expect(macd[25]).not.toBeNull();
  });
});

describe("calculateStochastic", () => {
  it("produces %K/%D within [0,100] and correct leading nulls", () => {
    const series = longSeries(40);
    const { k, d } = Indicators.calculateStochastic(series, 14, 3);
    expect(k).toHaveLength(series.length);
    expect(d).toHaveLength(series.length);
    expect(leadingNullPoints(k)).toBe(13);
    for (const pt of k) {
      if (pt.y !== null) {
        expect(pt.y).toBeGreaterThanOrEqual(0);
        expect(pt.y).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe("calculateCCI", () => {
  it("aligns to series length with period-1 leading nulls", () => {
    const series = longSeries(40);
    const cci = Indicators.calculateCCI(series, 20);
    expect(cci).toHaveLength(series.length);
    expect(leadingNullPoints(cci)).toBe(19);
  });
});

describe("calculateADX", () => {
  it("returns nulls when there is insufficient data", () => {
    const series = longSeries(10);
    const adx = Indicators.calculateADX(series, 14);
    expect(adx).toHaveLength(series.length);
    expect(adx.every((p) => p.y === null)).toBe(true);
  });

  it("produces values once enough data is available", () => {
    const series = longSeries(60);
    const adx = Indicators.calculateADX(series, 14);
    expect(adx).toHaveLength(series.length);
    expect(adx.some((p) => p.y !== null)).toBe(true);
  });
});

describe("calculateIchimoku", () => {
  it("returns five component lines aligned to the series length", () => {
    const series = longSeries(60);
    const ich = Indicators.calculateIchimoku(series);
    for (const key of ["tenkan", "kijun", "senkouA", "senkouB", "chikou"]) {
      expect(ich[key]).toHaveLength(series.length);
    }
  });
});

describe("calculatePVT", () => {
  it("starts at zero and aligns to series length", () => {
    const series = longSeries(20);
    const pvt = Indicators.calculatePVT(series);
    expect(pvt).toHaveLength(series.length);
    expect(pvt[0].y).toBe(0);
  });
});

describe("array helpers", () => {
  it("calculateSMAFromArray computes a rolling mean", () => {
    expect(Indicators.calculateSMAFromArray([1, 2, 3, 4, 5], 3)).toEqual([
      null,
      null,
      2,
      3,
      4,
    ]);
  });

  it("calculateEMAFromArray seeds with SMA then smooths", () => {
    expect(Indicators.calculateEMAFromArray([1, 2, 3, 4, 5], 3)).toEqual([
      null,
      null,
      2,
      3,
      4,
    ]);
  });
});

describe("Bollinger-derived oscillators", () => {
  it("calculateBBPercent and calculateBBWidth align to the bands", () => {
    const series = longSeries(40);
    const { middle, upper, lower } = Indicators.calculateBollingerBands(
      series,
      20,
      2
    );
    const pctB = Indicators.calculateBBPercent(series, lower, upper);
    const width = Indicators.calculateBBWidth(series, middle, upper, lower);
    expect(pctB).toHaveLength(series.length);
    expect(width).toHaveLength(series.length);
    // null where the underlying bands are null
    expect(pctB[0].y).toBeNull();
    expect(width[0].y).toBeNull();
    expect(pctB[series.length - 1].y).not.toBeNull();
  });
});

describe("memoization", () => {
  it("returns the identical cached reference for the same (series, params)", () => {
    const series = ohlc([10, 20, 30, 40, 50]);
    const a = Indicators.calculateMovingAverage(series, 3);
    const b = Indicators.calculateMovingAverage(series, 3);
    expect(b).toBe(a); // same reference -> served from cache
  });

  it("does not collide across different params or series", () => {
    const series = ohlc([10, 20, 30, 40, 50]);
    const p3 = Indicators.calculateMovingAverage(series, 3);
    const p2 = Indicators.calculateMovingAverage(series, 2);
    expect(p2).not.toBe(p3);

    const other = ohlc([10, 20, 30, 40, 50]); // equal values, different identity
    const p3b = Indicators.calculateMovingAverage(other, 3);
    expect(p3b).not.toBe(p3);
    expect(p3b).toEqual(p3); // same values though
  });

  it("EMA memoization still yields correct values", () => {
    const series = ohlc([10, 20, 30, 40, 50]);
    const first = Indicators.calculateEMA(series, 3);
    const second = Indicators.calculateEMA(series, 3);
    expect(second).toBe(first);
    expect(first).toEqual([null, null, 20, 30, 40]);
  });
});

describe("TSI and Accelerator oscillator", () => {
  it("calculateTSI returns tsi/signal aligned to the series length", () => {
    const series = longSeries(60);
    const { tsi, signal } = Indicators.calculateTSI(series);
    expect(tsi).toHaveLength(series.length);
    expect(signal).toHaveLength(series.length);
  });

  it("calculateAcceleratorOsc aligns to the series length", () => {
    const series = longSeries(60);
    const acc = Indicators.calculateAcceleratorOsc(series);
    expect(acc).toHaveLength(series.length);
  });
});
