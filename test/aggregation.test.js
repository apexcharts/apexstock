import { describe, it, expect } from "vitest";
import {
  aggregateOHLC,
  INTERVALS,
  INTERVAL_MS,
} from "../src/utils/Aggregation.js";

const H = 3600000;
const DAY = 86400000;
const jan1 = Date.UTC(2024, 0, 1); // Monday 2024-01-01 00:00 UTC

describe("aggregateOHLC", () => {
  it("rolls hourly candles into one daily candle (O=first, H=max, L=min, C=last, V=sum)", () => {
    const series = [
      { x: jan1 + 0 * H, y: [100, 105, 98, 102], v: 10 },
      { x: jan1 + 1 * H, y: [102, 110, 101, 108], v: 20 }, // high
      { x: jan1 + 2 * H, y: [108, 109, 95, 100], v: 30 }, // low
      { x: jan1 + 3 * H, y: [100, 103, 99, 101], v: 40 }, // last close
    ];
    const out = aggregateOHLC(series, "1d");
    expect(out).toHaveLength(1);
    expect(out[0].x).toBe(jan1);
    expect(out[0].y).toEqual([100, 110, 95, 101]);
    expect(out[0].v).toBe(100);
  });

  it("buckets 1-minute candles into 5-minute groups, x = bucket start", () => {
    const M = 60000;
    const series = Array.from({ length: 7 }, (_, i) => ({
      x: jan1 + i * M,
      y: [i, i + 1, i - 1, i + 0.5],
    }));
    const out = aggregateOHLC(series, "5m");
    expect(out).toHaveLength(2); // [0..4], [5..6]
    expect(out[0].x).toBe(jan1);
    expect(out[1].x).toBe(jan1 + 5 * M);
    expect(out[0].y[0]).toBe(0); // first open
    expect(out[0].y[3]).toBe(4.5); // close of minute 4
    expect(out[1].y[0]).toBe(5);
  });

  it("omits volume when the input has none", () => {
    const out = aggregateOHLC(
      [
        { x: jan1, y: [1, 2, 0, 1] },
        { x: jan1 + H, y: [1, 3, 1, 2] },
      ],
      "1d"
    );
    expect(out[0]).not.toHaveProperty("v");
    expect(out[0].y).toEqual([1, 3, 0, 2]);
  });

  it("aggregates by UTC week (Monday-anchored)", () => {
    // 2024-01-01 is a Monday; 8 daily candles span two weeks.
    const series = Array.from({ length: 8 }, (_, i) => ({
      x: jan1 + i * DAY,
      y: [i, i + 5, i - 5, i + 1],
    }));
    const out = aggregateOHLC(series, "1w");
    expect(out).toHaveLength(2);
    expect(out[0].x).toBe(jan1); // week 1 starts Mon Jan 1
    expect(out[1].x).toBe(jan1 + 7 * DAY); // week 2 starts Mon Jan 8
    expect(out[0].y[0]).toBe(0); // first open of week 1
    expect(out[0].y[3]).toBe(7); // close of day 6 (Sun)
  });

  it("aggregates by calendar month", () => {
    const feb1 = Date.UTC(2024, 1, 1);
    const series = [
      { x: jan1, y: [1, 9, 1, 2] },
      { x: Date.UTC(2024, 0, 15), y: [2, 4, 0, 3] },
      { x: feb1, y: [3, 7, 2, 6] },
    ];
    const out = aggregateOHLC(series, "1M");
    expect(out).toHaveLength(2);
    expect(out[0].x).toBe(jan1);
    expect(out[0].y).toEqual([1, 9, 0, 3]); // Jan: O=1,H=9,L=0,C=3
    expect(out[1].x).toBe(feb1);
  });

  it("accepts date-string and Date x values", () => {
    const out = aggregateOHLC(
      [
        { x: "2024-01-01T00:00:00Z", y: [1, 2, 1, 2] },
        { x: new Date("2024-01-01T01:00:00Z"), y: [2, 5, 2, 4] },
      ],
      "1d"
    );
    expect(out).toHaveLength(1);
    expect(out[0].x).toBe(jan1);
    expect(out[0].y).toEqual([1, 5, 1, 4]);
  });

  it("returns [] for empty input and a copy for an unknown interval", () => {
    expect(aggregateOHLC([], "1d")).toEqual([]);
    const series = [{ x: jan1, y: [1, 2, 1, 2] }];
    const out = aggregateOHLC(series, "bogus");
    expect(out).toEqual(series);
    expect(out).not.toBe(series); // a copy, not the same ref
  });

  it("does not mutate the input series", () => {
    const series = [
      { x: jan1, y: [1, 2, 0, 1] },
      { x: jan1 + H, y: [1, 9, 1, 8] },
    ];
    const snapshot = JSON.parse(JSON.stringify(series));
    aggregateOHLC(series, "1d");
    expect(series).toEqual(snapshot);
  });

  it("exposes INTERVALS / INTERVAL_MS metadata", () => {
    expect(INTERVALS).toContain("1h");
    expect(INTERVALS).toContain("1w");
    expect(INTERVALS).toContain("1M");
    expect(INTERVAL_MS["1d"]).toBe(DAY);
  });
});
