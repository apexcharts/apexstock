// Agreement tests for the streaming indicator twins (IndicatorStep): seeding on
// a head slice and stepping bar-by-bar must reproduce, exactly, the value a full
// Indicators.calculate* produces at the same index. This is the correctness
// contract the appendData() path relies on.
import { describe, it, expect } from "vitest";
import Indicators from "../src/indicators/Indicators.js";
import IndicatorStep from "../src/indicators/IndicatorStep.js";

/** Deterministic OHLCV series. */
function genSeries(n) {
  const out = [];
  let seed = 123;
  const rand = () => ((seed = (seed * 16807) % 2147483647), (seed - 1) / 2147483646);
  let price = 100;
  const base = Date.UTC(2024, 0, 1);
  const day = 86400000;
  for (let i = 0; i < n; i++) {
    const open = price;
    const cl = price + (rand() - 0.5) * 4;
    const high = Math.max(open, cl) + rand() * 2;
    const low = Math.min(open, cl) - rand() * 2;
    out.push({
      x: base + i * day,
      y: [open, high, low, cl].map((v) => Number(v.toFixed(2))),
      v: Math.floor(rand() * 1_000_000) + 100_000,
    });
    price = cl;
  }
  return out;
}

const SERIES = genSeries(120);

/** Stream values for indices [split, end] using seed(head) + step per bar. */
function stream(key, series, params, split) {
  let state = IndicatorStep.seed(key, series.slice(0, split), params);
  const vals = [];
  for (let i = split; i < series.length; i++) {
    const r = IndicatorStep.step(key, state, series.slice(0, i + 1), params);
    state = r.state;
    vals.push(r.value);
  }
  return vals;
}

/** Expect a streamed value to equal the full value (handles null + float). */
function same(streamed, full, prec = 8) {
  if (full === null || full === undefined) {
    expect(streamed ?? null).toBe(null);
  } else if (typeof full === "number") {
    expect(streamed).toBeCloseTo(full, prec);
  } else {
    for (const k of Object.keys(full)) same(streamed[k], full[k], prec);
  }
}

const CASES = [
  {
    key: "sma",
    params: { period: 5 },
    splits: [1, 10],
    full: (s, p) => Indicators.calculateMovingAverage(s, p.period),
  },
  {
    key: "rsi",
    params: { period: 14 },
    splits: [1, 20],
    full: (s, p) => Indicators.calculateRSI(s, p.period),
  },
  {
    key: "bollinger",
    params: { period: 20, stdDev: 2 },
    splits: [1, 30],
    full: (s, p) => {
      const b = Indicators.calculateBollingerBands(s, p.period, p.stdDev);
      return s.map((_, i) => ({
        middle: b.middle[i],
        upper: b.upper[i],
        lower: b.lower[i],
      }));
    },
  },
  {
    key: "ema",
    params: { period: 12 },
    splits: [1, 20], // 1 exercises the warm-up fallback
    full: (s, p) => Indicators.calculateEMA(s, p.period),
  },
  {
    key: "macd",
    params: { fast: 12, slow: 26, signal: 9 },
    splits: [1, 40], // 1 exercises warm-up; 40 is steady-state O(1)
    full: (s, p) => {
      const m = Indicators.calculateMACD(s, p.fast, p.slow, p.signal);
      return s.map((_, i) => ({
        macd: m.macd[i] ?? null,
        signal: m.signal[i] ?? null,
        histogram: m.histogram[i] ?? null,
      }));
    },
  },
  {
    key: "pvt",
    params: {},
    splits: [1, 5],
    full: (s) => Indicators.calculatePVT(s).map((pt) => pt.y),
  },
  {
    key: "chaikin",
    params: { short: 3, long: 10 },
    splits: [1, 20], // 1 exercises warm-up; 20 is steady-state O(1)
    full: (s, p) =>
      Indicators.calculateChaikinOsc(s, p.short, p.long).map((pt) => pt.y),
  },
  {
    key: "stochastic",
    params: { period: 14, smoothPeriod: 3 },
    splits: [1, 25],
    full: (s, p) => {
      const o = Indicators.calculateStochastic(s, p.period, p.smoothPeriod);
      return s.map((_, i) => ({ k: o.k[i].y, d: o.d[i].y }));
    },
  },
  {
    key: "stddev",
    params: { period: 20 },
    splits: [1, 30],
    full: (s, p) => Indicators.calculateStdDevIndicator(s, p.period).map((pt) => pt.y),
  },
  {
    key: "cci",
    params: { period: 20 },
    splits: [1, 30],
    full: (s, p) => Indicators.calculateCCI(s, p.period).map((pt) => pt.y),
  },
  {
    key: "linreg",
    params: { period: 14 },
    splits: [1, 20],
    full: (s, p) =>
      Indicators.calculateLinearRegression(s, p.period).map((pt) => pt.y),
  },
  {
    key: "ao",
    params: {},
    splits: [1, 40],
    full: (s) => Indicators.calculateAwesomeOscillator(s).map((pt) => pt.y),
  },
  {
    key: "ac",
    params: { acPeriod: 5 },
    splits: [1, 45],
    full: (s, p) =>
      Indicators.calculateAcceleratorOsc(s, p.acPeriod).map((pt) => pt.y),
  },
  {
    key: "bbpercent",
    params: { period: 20, stdDev: 2 },
    splits: [1, 30],
    full: (s, p) => {
      const b = Indicators.calculateBollingerBands(s, p.period, p.stdDev);
      return Indicators.calculateBBPercent(s, b.lower, b.upper).map((pt) => pt.y);
    },
  },
  {
    key: "bbwidth",
    params: { period: 20, stdDev: 2 },
    splits: [1, 30],
    full: (s, p) => {
      const b = Indicators.calculateBollingerBands(s, p.period, p.stdDev);
      return Indicators.calculateBBWidth(s, b.middle, b.upper, b.lower).map(
        (pt) => pt.y
      );
    },
  },
  {
    key: "adx",
    params: { period: 14 },
    splits: [1, 40],
    full: (s, p) => Indicators.calculateADX(s, p.period).map((pt) => pt.y),
  },
  {
    key: "tsi",
    params: { longPeriod: 25, shortPeriod: 13, signalPeriod: 7 },
    splits: [1, 60],
    full: (s, p) => {
      const o = Indicators.calculateTSI(
        s,
        p.longPeriod,
        p.shortPeriod,
        p.signalPeriod
      );
      return s.map((_, i) => ({ tsi: o.tsi[i].y, signal: o.signal[i].y }));
    },
  },
];

describe("IndicatorStep agreement with full calculate*", () => {
  for (const c of CASES) {
    for (const split of c.splits) {
      it(`${c.key} (split=${split}) matches the full recompute`, () => {
        const streamed = stream(c.key, SERIES, c.params, split);
        const full = c.full(SERIES, c.params);
        expect(streamed).toHaveLength(SERIES.length - split);
        for (let i = 0; i < streamed.length; i++) {
          same(streamed[i], full[split + i]);
        }
      });
    }
  }

  it("exposes has()/keys() for the implemented steppers", () => {
    expect(IndicatorStep.keys().sort()).toEqual(
      [
        "ac",
        "adx",
        "ao",
        "bbpercent",
        "bbwidth",
        "bollinger",
        "cci",
        "chaikin",
        "ema",
        "linreg",
        "macd",
        "pvt",
        "rsi",
        "sma",
        "stddev",
        "stochastic",
        "tsi",
      ].sort()
    );
    expect(IndicatorStep.has("sma")).toBe(true);
    expect(IndicatorStep.has("nope")).toBe(false);
  });
});
