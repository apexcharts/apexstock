import { describe, it, expect } from "vitest";
import Drawdown from "../src/analysis/Drawdown.js";
import { ohlc, dailyOhlc, drawdownSeries } from "./fixtures.js";

// The designed fixture (see fixtures.js): closes 100 110 120 90 80 95 121 115.
// Running peak reaches 120 at index 2, the trough is 80 at index 4, the old
// peak is regained at index 6 (close 121), and index 7 opens a second, ongoing
// episode.
const EP0_DEPTH = ((80 - 120) / 120) * 100; // -33.333...
const EP1_DEPTH = ((115 - 121) / 121) * 100; // -4.9587...

describe("Drawdown.compute", () => {
  it("measures each bar against the running peak, capped at zero", () => {
    const { values } = Drawdown.compute(drawdownSeries());
    expect(values[0]).toBe(0);
    expect(values[1]).toBe(0);
    expect(values[2]).toBe(0);
    expect(values[3]).toBeCloseTo(-25, 10);
    expect(values[4]).toBeCloseTo(EP0_DEPTH, 10);
    expect(values[5]).toBeCloseTo(((95 - 120) / 120) * 100, 10);
    expect(values[6]).toBe(0); // new high-water mark
    expect(values[7]).toBeCloseTo(EP1_DEPTH, 10);
  });

  it("reports the deepest drawdown, the current one, and which episode is worst", () => {
    const res = Drawdown.compute(drawdownSeries());
    expect(res.max).toBeCloseTo(EP0_DEPTH, 10);
    expect(res.current).toBeCloseTo(EP1_DEPTH, 10);
    expect(res.maxEpisodeIndex).toBe(0);
    expect(res.basis).toBe("close");
  });

  it("separates decline, recovery, and total-underwater durations", () => {
    const [ep0, ep1] = Drawdown.compute(drawdownSeries()).episodes;

    expect(ep0.peak.index).toBe(2);
    expect(ep0.peak.value).toBe(120);
    expect(ep0.trough.index).toBe(4);
    expect(ep0.trough.value).toBe(80);
    expect(ep0.recovery.index).toBe(6);
    expect(ep0.barsToTrough).toBe(2); // peak -> trough
    expect(ep0.barsToRecovery).toBe(2); // trough -> old peak
    expect(ep0.barsUnderwater).toBe(4); // peak -> recovery
    expect(ep0.ongoing).toBe(false);

    expect(ep1.peak.index).toBe(6);
    expect(ep1.trough.index).toBe(7);
    expect(ep1.recovery).toBeNull();
    expect(ep1.barsToRecovery).toBeNull();
    expect(ep1.barsUnderwater).toBe(1); // peak -> end of data
    expect(ep1.ongoing).toBe(true);
  });

  it("emits chart points aligned to the series x values", () => {
    const series = drawdownSeries();
    const { points } = Drawdown.compute(series);
    expect(points).toHaveLength(series.length);
    expect(points[4]).toEqual({
      x: series[4].x,
      y: expect.closeTo(EP0_DEPTH, 10),
    });
  });

  it("has no drawdown at all for a monotonically rising series", () => {
    const res = Drawdown.compute(ohlc([10, 20, 30, 40]));
    expect(res.values).toEqual([0, 0, 0, 0]);
    expect(res.max).toBeNull();
    expect(res.maxEpisodeIndex).toBe(-1);
    expect(res.episodes).toEqual([]);
    expect(res.current).toBe(0);
  });

  it("is flat, not NaN, when every close is identical", () => {
    const res = Drawdown.compute(ohlc([50, 50, 50]));
    expect(res.values).toEqual([0, 0, 0]);
    expect(res.max).toBeNull();
  });

  it("memoizes per series identity and basis", () => {
    const series = drawdownSeries();
    expect(Drawdown.compute(series)).toBe(Drawdown.compute(series));
    expect(Drawdown.compute(series, { basis: "intrabar" })).not.toBe(
      Drawdown.compute(series)
    );
    const before = Drawdown.compute(series);
    Drawdown.invalidate(series);
    expect(Drawdown.compute(series)).not.toBe(before);
  });
});

describe("Drawdown.compute (intrabar basis)", () => {
  it("measures the low against the running high, so it is never shallower", () => {
    // Highs 2 above the close, lows 2 below.
    const closes = [100, 110, 120, 90, 80, 95, 121, 115];
    const series = dailyOhlc(closes, {
      highs: closes.map((c) => c + 2),
      lows: closes.map((c) => c - 2),
    });
    const close = Drawdown.compute(series, { basis: "close" });
    const intra = Drawdown.compute(series, { basis: "intrabar" });

    expect(intra.basis).toBe("intrabar");
    expect(intra.max).toBeLessThan(close.max);
    // The peak is the 122 high at index 2, the trough the 78 low at index 4.
    expect(intra.max).toBeCloseTo(((78 - 122) / 122) * 100, 10);
  });

  it("registers a bar dipping below its own high", () => {
    const series = dailyOhlc([100], { highs: [110], lows: [90] });
    const res = Drawdown.compute(series, { basis: "intrabar" });
    expect(res.values[0]).toBeCloseTo(((90 - 110) / 110) * 100, 10);
  });
});

describe("Drawdown.range", () => {
  it("resets the peak at the start of the range, ignoring earlier history", () => {
    const series = drawdownSeries();
    // Bars 3..7 start at 90, whose own running peak is 95 (index 5), so the
    // deepest drawdown inside the window is much shallower than the -33% the
    // full series reports from the 120 peak.
    const res = Drawdown.range(series, 3, 7);
    expect(res.values[3]).toBe(0); // the range's own first high-water mark
    expect(res.values[4]).toBeCloseTo(((80 - 90) / 90) * 100, 10);
    expect(res.max).toBeCloseTo(((80 - 90) / 90) * 100, 10);
    expect(res.episodes[0].peak.index).toBe(3);
  });

  it("leaves values outside the range null but plots only the window", () => {
    const series = drawdownSeries();
    const res = Drawdown.range(series, 3, 5);
    expect(res.values[0]).toBeNull();
    expect(res.values[6]).toBeNull();
    expect(res.values).toHaveLength(series.length);
    expect(res.points).toHaveLength(3);
  });

  it("accepts the bounds in either order", () => {
    const series = drawdownSeries();
    expect(Drawdown.range(series, 7, 3).max).toBeCloseTo(
      Drawdown.range(series, 3, 7).max,
      10
    );
  });

  it("falls back to the whole series for non-finite bounds", () => {
    const series = drawdownSeries();
    const res = Drawdown.range(series, NaN, undefined);
    expect(res.max).toBeCloseTo(Drawdown.compute(series).max, 10);
  });
});

describe("Drawdown.worst", () => {
  it("flattens the deepest episode of a range", () => {
    const worst = Drawdown.worst(drawdownSeries(), 0, 7);
    expect(worst.max).toBeCloseTo(EP0_DEPTH, 10);
    expect(worst.trough.index).toBe(4);
    expect(worst.barsUnderwater).toBe(4);
  });

  it("returns null when the range never fell below its peak", () => {
    expect(Drawdown.worst(ohlc([10, 20, 30]), 0, 2)).toBeNull();
  });
});

describe("Drawdown edge cases", () => {
  it("handles an empty series and a single bar", () => {
    expect(Drawdown.compute([]).values).toEqual([]);
    expect(Drawdown.compute([]).max).toBeNull();
    expect(Drawdown.compute(ohlc([10])).values).toEqual([0]);
  });

  it("survives a non-array input", () => {
    expect(Drawdown.compute(null).values).toEqual([]);
  });

  it("skips bars with unusable values without breaking the peak", () => {
    const series = ohlc([100, 120, 80]);
    series[1] = { x: 2, y: [NaN, NaN, NaN, NaN], v: 100 };
    const res = Drawdown.compute(series);
    expect(res.values[1]).toBeNull();
    // The peak is still 100 from bar 0, so bar 2 is 20% below it.
    expect(res.values[2]).toBeCloseTo(-20, 10);
  });
});
