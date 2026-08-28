// @vitest-environment node
//
// DataReadout (#41): a read-only OHLC + volume + change + indicator snapshot at
// a data-point index, drawn from ctx.series, main-chart overlay globals, and
// oscillator-pane charts.
import { describe, it, expect } from "vitest";
import DataReadout from "../src/core/DataReadout.js";

function fakeCtx(overrides = {}) {
  return {
    series: [
      { x: 1, y: [10, 12, 9, 11], v: 100 },
      { x: 2, y: [11, 15, 10, 14], v: 200 },
      { x: 3, y: [14, 16, 12, 13] }, // no volume
    ],
    chart: {
      w: {
        globals: {
          seriesNames: ["AAPL", "MA 20", "EMA 50"],
          series: [
            [11, 14, 13], // price (index 0, not an indicator)
            [10.5, 11.5, 12.0], // MA 20
            [9.9, null, 11.1], // EMA 50 (null at idx 1 -> omitted)
          ],
          colors: ["#000000", "#7D57C2", "#FF9900"],
        },
      },
    },
    indicatorChartMap: {},
    ...overrides,
  };
}

describe("DataReadout.at", () => {
  it("returns null when there is no series data", () => {
    expect(DataReadout.at({ series: [] })).toBeNull();
    expect(DataReadout.at({})).toBeNull();
  });

  it("reads OHLC, volume, and x at an index", () => {
    const r = DataReadout.at(fakeCtx(), 1);
    expect(r.index).toBe(1);
    expect(r.x).toBe(2);
    expect(r.ohlc).toEqual({ open: 11, high: 15, low: 10, close: 14 });
    expect(r.volume).toBe(200);
  });

  it("defaults to the latest bar and clamps out-of-range indices", () => {
    expect(DataReadout.at(fakeCtx()).index).toBe(2); // no arg -> last
    expect(DataReadout.at(fakeCtx(), 99).index).toBe(2);
    expect(DataReadout.at(fakeCtx(), -5).index).toBe(0);
  });

  it("computes change vs the previous close (null at the first bar)", () => {
    const r = DataReadout.at(fakeCtx(), 1); // close 14 vs prev 11
    expect(r.change.absolute).toBe(3);
    expect(r.change.percent).toBeCloseTo((3 / 11) * 100, 10);

    const first = DataReadout.at(fakeCtx(), 0);
    expect(first.change).toBeNull();
  });

  it("reports null volume when the bar has none", () => {
    expect(DataReadout.at(fakeCtx(), 2).volume).toBeNull();
  });

  it("includes main-chart overlay indicators, skipping non-finite values", () => {
    const r = DataReadout.at(fakeCtx(), 1);
    // MA 20 present; EMA 50 is null at idx 1 -> omitted.
    expect(r.indicators).toEqual([
      { name: "MA 20", value: 11.5, color: "#7D57C2", pane: "main" },
    ]);

    const r0 = DataReadout.at(fakeCtx(), 0);
    expect(r0.indicators.map((i) => i.name)).toEqual(["MA 20", "EMA 50"]);
  });

  it("includes oscillator-pane values and ignores non-chart map entries", () => {
    const ctx = fakeCtx({
      indicatorChartMap: {
        // Overlay entries are not charts (no `.w`) -> ignored, no crash.
        "moving average": true,
        rsi: {
          w: {
            globals: {
              seriesNames: ["RSI"],
              series: [[30, 55, 60]],
              colors: ["#7D57C2"],
            },
          },
        },
      },
    });
    const r = DataReadout.at(ctx, 1);
    const rsi = r.indicators.find((i) => i.pane === "rsi");
    expect(rsi).toEqual({
      key: "rsi",
      name: "RSI",
      value: 55,
      color: "#7D57C2",
      pane: "rsi",
    });
    // Overlay MA 20 is still there too.
    expect(r.indicators.some((i) => i.name === "MA 20" && i.pane === "main")).toBe(true);
  });

  it("returns faithful raw numbers (no rounding)", () => {
    const ctx = fakeCtx();
    ctx.chart.w.globals.series[1][1] = 11.123456789;
    expect(DataReadout.at(ctx, 1).indicators[0].value).toBe(11.123456789);
  });

  it("survives missing/garbled chart globals (OHLC still returns)", () => {
    const r = DataReadout.at({ series: fakeCtx().series, chart: {} }, 1);
    expect(r.ohlc.close).toBe(14);
    expect(r.indicators).toEqual([]);
  });
});

describe("DataReadout.columns", () => {
  it("returns one null-padded column per indicator series", () => {
    const cols = DataReadout.columns(fakeCtx());
    expect(cols.map((c) => c.name)).toEqual(["MA 20", "EMA 50"]);
    expect(cols[0]).toEqual({
      name: "MA 20",
      pane: "main",
      values: [10.5, 11.5, 12.0],
    });
    // Unlike the per-index readout, a warm-up hole is a null rather than an
    // omission, so the column stays aligned to the bars.
    expect(cols[1].values).toEqual([9.9, null, 11.1]);
  });

  it("includes oscillator panes, tagged with their key", () => {
    const cols = DataReadout.columns(
      fakeCtx({
        indicatorChartMap: {
          "moving average": true, // an overlay entry: not a chart, skipped
          rsi: {
            w: {
              globals: {
                seriesNames: ["RSI"],
                series: [[null, 55.5, 60.25]],
                colors: ["#00E396"],
              },
            },
          },
        },
      })
    );
    const rsi = cols.find((c) => c.name === "RSI");
    expect(rsi).toEqual({
      name: "RSI",
      pane: "rsi",
      key: "rsi",
      values: [null, 55.5, 60.25],
    });
  });

  it("drops a series that has no usable value at all", () => {
    const ctx = fakeCtx();
    ctx.chart.w.globals.series[1] = [null, null, null];
    expect(DataReadout.columns(ctx).map((c) => c.name)).toEqual(["EMA 50"]);
  });

  it("covers exactly `length` bars when asked", () => {
    const cols = DataReadout.columns(fakeCtx(), 2);
    expect(cols[0].values).toEqual([10.5, 11.5]);
  });

  it("survives a chart with no globals at all", () => {
    expect(DataReadout.columns({ series: [] })).toEqual([]);
    expect(DataReadout.columns({})).toEqual([]);
  });
});
