import { describe, it, expect } from "vitest";
import Indicators from "../src/indicators/Indicators.js";
import { ohlc } from "./fixtures.js";

// Edge-case hardening: indicators must degrade gracefully (all-null / safe
// values) on empty input, period > length, flat windows, and zero prices —
// never throw and never emit NaN/Infinity.

describe("indicator edge cases", () => {
  describe("calculateEMA", () => {
    it("returns all-null when period > series length (no throw)", () => {
      const series = ohlc([10, 20, 30]); // length 3
      expect(() => Indicators.calculateEMA(series, 5)).not.toThrow();
      expect(Indicators.calculateEMA(series, 5)).toEqual([null, null, null]);
    });

    it("returns [] for an empty series", () => {
      expect(Indicators.calculateEMA([], 5)).toEqual([]);
    });
  });

  describe("calculateMACD (depends on EMA)", () => {
    it("does not throw and is all-null when slowPeriod > length", () => {
      const series = ohlc([1, 2, 3, 4, 5]); // length 5 < slowPeriod 26
      let res;
      expect(() => (res = Indicators.calculateMACD(series))).not.toThrow();
      expect(res.macd.every((v) => v === null)).toBe(true);
      expect(res.signal.every((v) => v === null)).toBe(true);
      expect(res.histogram.every((v) => v === null)).toBe(true);
    });
  });

  describe("calculateFibonacciRetracements", () => {
    it("returns zeroed levels for an empty series (no NaN/-Infinity)", () => {
      const out = Indicators.calculateFibonacciRetracements([]);
      expect(out).toHaveLength(6);
      expect(out.every((n) => Number.isFinite(n))).toBe(true);
      expect(out).toEqual([0, 0, 0, 0, 0, 0]);
    });

    it("still computes real levels for valid data", () => {
      const series = ohlc([10, 20], { highs: [10, 30], lows: [5, 20] });
      const out = Indicators.calculateFibonacciRetracements(series);
      expect(out[0]).toBe(5); // minLow
      expect(out[5]).toBe(30); // maxHigh
    });
  });

  describe("calculateStochastic", () => {
    it("yields 0 (not NaN) on a perfectly flat window", () => {
      const series = ohlc([5, 5, 5, 5, 5]); // high === low === close everywhere
      const { k } = Indicators.calculateStochastic(series, 3, 3);
      const computed = k.filter((p) => p.y !== null).map((p) => p.y);
      expect(computed.length).toBeGreaterThan(0);
      expect(computed.every((v) => Number.isFinite(v))).toBe(true);
      expect(computed.every((v) => v === 0)).toBe(true);
    });
  });

  describe("calculatePVT", () => {
    it("does not produce Infinity when a previous close is 0", () => {
      const series = ohlc([0, 5, 10], { volumes: [100, 100, 100] });
      const pvt = Indicators.calculatePVT(series);
      expect(pvt.every((p) => Number.isFinite(p.y))).toBe(true);
    });
  });

  describe("smoke: no calculator throws on a single-point series", () => {
    const single = ohlc([42], { volumes: [10] });
    const calls = [
      ["MovingAverage", () => Indicators.calculateMovingAverage(single, 5)],
      ["EMA", () => Indicators.calculateEMA(single, 5)],
      ["RSI", () => Indicators.calculateRSI(single, 14)],
      ["MACD", () => Indicators.calculateMACD(single)],
      ["Bollinger", () => Indicators.calculateBollingerBands(single, 20, 2)],
      ["Stochastic", () => Indicators.calculateStochastic(single, 14, 3)],
      ["ADX", () => Indicators.calculateADX(single, 14)],
      ["CCI", () => Indicators.calculateCCI(single, 20)],
      ["Ichimoku", () => Indicators.calculateIchimoku(single)],
      ["TSI", () => Indicators.calculateTSI(single)],
      ["PVT", () => Indicators.calculatePVT(single)],
      ["Fibonacci", () => Indicators.calculateFibonacciRetracements(single)],
    ];
    it.each(calls)("%s", (_name, fn) => {
      expect(fn).not.toThrow();
    });
  });
});
