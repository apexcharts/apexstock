// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import ChartSwitch from "../src/core/ChartSwitch.js";
import XAxis from "../src/components/XAxis.js";

// The chart-type conversions and the x-axis timestamp helper carry the most
// testable logic in the otherwise DOM-heavy modules. The conversions read no
// instance state, so we invoke them via `.call()` without constructing the
// DOM-building class.
const ha = (series) =>
  ChartSwitch.prototype._convertToHeikinAshi.call({}, series);
const renko = (series, brick) =>
  ChartSwitch.prototype._convertToRenko.call({}, series, brick);

const candle = (x, o, h, l, c) => ({ x, y: [o, h, l, c] });

describe("ChartSwitch._convertToHeikinAshi", () => {
  it("returns [] for empty/nullish input", () => {
    expect(ha([])).toEqual([]);
    expect(ha(null)).toEqual([]);
    expect(ha(undefined)).toEqual([]);
  });

  it("computes the first HA candle from the raw OHLC", () => {
    const out = ha([candle(1, 10, 20, 5, 15)]);
    expect(out).toHaveLength(1);
    // haOpen=(10+15)/2=12.5, haClose=(10+20+5+15)/4=12.5, hi=20, lo=5
    expect(out[0].y).toEqual([12.5, 20, 5, 12.5]);
    expect(out[0].x).toBe(1);
  });

  it("derives subsequent HA opens from the previous HA candle", () => {
    const out = ha([candle(1, 10, 20, 5, 15), candle(2, 15, 25, 12, 22)]);
    // prevHA open=close=12.5 -> haOpen=12.5; haClose=(15+25+12+22)/4=18.5
    expect(out[1].y).toEqual([12.5, 25, 12, 18.5]);
  });

  it("preserves length and emits valid 4-tuple OHLC for every point", () => {
    const series = Array.from({ length: 20 }, (_, i) =>
      candle(i, 100 + i, 105 + i, 95 + i, 102 + i)
    );
    const out = ha(series);
    expect(out).toHaveLength(20);
    expect(
      out.every((p) => p.y.length === 4 && p.y.every(Number.isFinite))
    ).toBe(true);
  });
});

describe("ChartSwitch._convertToRenko", () => {
  it("returns [] for empty/nullish input", () => {
    expect(renko([], 1)).toEqual([]);
    expect(renko(null, 1)).toEqual([]);
  });

  it("preserves the series length and always seeds index 0", () => {
    const series = Array.from({ length: 15 }, (_, i) =>
      candle(i, 100 + i, 101 + i, 99 + i, 100 + i)
    );
    const out = renko(series, 1);
    expect(out).toHaveLength(15);
    expect(out[0]).not.toBeNull();
    expect(out[0].x).toBe(series[0].x);
    // Every slot is an object preserving its timestamp; slots WITH a brick
    // carry a valid 4-tuple, empty slots carry y: null.
    expect(out.every((b) => b && "x" in b)).toBe(true);
    expect(
      out
        .filter((b) => b.y !== null)
        .every((b) => b.y.length === 4 && b.y.every(Number.isFinite))
    ).toBe(true);
  });

  it("forms no extra bricks when moves stay under the brick size", () => {
    // Tiny moves vs a 50%-of-price brick size -> only the seed brick; the
    // second slot keeps its timestamp but has no price action (y: null).
    const series = [candle(1, 100, 100, 100, 100), candle(2, 100, 100, 100, 100.1)];
    const out = renko(series, 50);
    expect(out[0].y).not.toBeNull();
    expect(out[1].y).toBeNull();
  });
});

describe("XAxis.getDataPointTimestamp", () => {
  // On a real XAxis instance `this.context` is the ApexStock instance, so the
  // method reads `this.context.series` / `this.context.xaxisRange`.
  const call = (ctx, index) =>
    XAxis.prototype.getDataPointTimestamp.call({ context: ctx }, index);

  it("returns the data point's timestamp for a valid index", () => {
    const ctx = {
      series: [candle(1000, 1, 2, 0, 1), candle(2000, 1, 2, 0, 1)],
      xaxisRange: { min: 999 },
    };
    expect(call(ctx, 0)).toBe(1000);
    expect(call(ctx, 1)).toBe(2000);
  });

  it("falls back to xaxisRange.min for an out-of-range index", () => {
    const ctx = { series: [candle(1000, 1, 2, 0, 1)], xaxisRange: { min: 42 } };
    expect(call(ctx, 5)).toBe(42);
  });

  it("falls back to xaxisRange.min when the series is empty", () => {
    const ctx = { series: [], xaxisRange: { min: 7 } };
    expect(call(ctx, 0)).toBe(7);
  });
});
