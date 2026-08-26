// @vitest-environment jsdom
//
// PriceScale manager: primary price-axis scale modes (linear / logarithmic /
// percent / indexed), the label formatter each produces, config + programmatic
// entry points, secondary-axis preservation, lifecycle, and state round-trip.
import { describe, it, expect, beforeEach } from "vitest";
import PriceScale from "../src/core/PriceScale.js";

// First bar's close is 100 so percent/indexed math is clean.
function series() {
  return [
    { x: 1, y: [100, 110, 95, 100], v: 1_000_000 },
    { x: 2, y: [100, 130, 98, 120], v: 1_200_000 },
    { x: 3, y: [120, 210, 118, 200], v: 900_000 },
  ];
}

// A fake chart whose updateOptions records the yaxis it was given and folds it
// back into w.config.yaxis (so a later reapply reads the patched axis, as the
// real ApexCharts would).
function fakeCtx(overrides = {}) {
  const emitted = [];
  const yaxis = overrides.yaxis || [
    { opposite: true, labels: { formatter: (v) => Number(v).toFixed(2) } },
  ];
  const ctx = {
    series: overrides.series || series(),
    chartOptions: overrides.chartOptions || { series: [{ name: "AAPL" }] },
    _emitter: {
      emit: (name, payload) => emitted.push({ name, payload }),
    },
    _emitted: emitted,
    _updates: [],
    chart: {
      w: { config: { yaxis } },
      updateOptions(opts) {
        ctx._updates.push(opts);
        if (opts && opts.yaxis) ctx.chart.w.config.yaxis = opts.yaxis;
      },
    },
  };
  return ctx;
}

// The formatter the manager installed on the primary axis after a reapply.
const primaryFormatter = (ctx) => ctx.chart.w.config.yaxis[0].labels.formatter;

describe("PriceScale", () => {
  let ctx;
  let ps;
  beforeEach(() => {
    ctx = fakeCtx();
    ps = new PriceScale(ctx);
  });

  it("defaults to a linear, untouched scale", () => {
    expect(ps.getMode()).toBe("linear");
    expect(ps.get()).toEqual({
      mode: "linear",
      base: null,
      logBase: 10,
      indexBase: 100,
    });
    expect(ps._serialize()).toBeNull();
  });

  it("is a no-op until touched (no updateOptions)", () => {
    ps.reapply();
    expect(ctx._updates).toHaveLength(0);
  });

  it("logarithmic sets the native flag + logBase and emits the change", () => {
    ps.setMode("logarithmic");
    const axis = ctx.chart.w.config.yaxis[0];
    expect(axis.logarithmic).toBe(true);
    expect(axis.logBase).toBe(10);
    expect(ctx._emitted).toContainEqual({
      name: "priceScaleChange",
      payload: { mode: "logarithmic", base: null, logBase: 10, indexBase: 100 },
    });
  });

  it("logarithmic honors a custom logBase", () => {
    ps.setMode("logarithmic", { logBase: 2 });
    expect(ctx.chart.w.config.yaxis[0].logBase).toBe(2);
    expect(ps.get().logBase).toBe(2);
  });

  it("percent labels as % change from the first close", () => {
    ps.setMode("percent");
    const fmt = primaryFormatter(ctx);
    expect(fmt(100)).toBe("0.00%"); // baseline (first close)
    expect(fmt(110)).toBe("10.00%");
    expect(fmt(95)).toBe("-5.00%");
    // percent does not change the scale distribution (linear axis, relabelled)
    expect(ctx.chart.w.config.yaxis[0].logarithmic).toBe(false);
  });

  it("percent honors an explicit baseline", () => {
    ps.setMode("percent", { base: 200 });
    const fmt = primaryFormatter(ctx);
    expect(fmt(200)).toBe("0.00%");
    expect(fmt(100)).toBe("-50.00%");
    expect(ps.get().base).toBe(200);
  });

  it("indexed labels as an index against indexBase", () => {
    ps.setMode("indexed"); // default indexBase 100, base = first close 100
    let fmt = primaryFormatter(ctx);
    expect(fmt(100)).toBe("100.00");
    expect(fmt(120)).toBe("120.00");

    ps.setMode("indexed", { indexBase: 1000 });
    fmt = primaryFormatter(ctx);
    expect(fmt(100)).toBe("1000.00");
    expect(fmt(120)).toBe("1200.00");
  });

  it("linear restores a plain price formatter", () => {
    ps.setMode("percent");
    ps.setMode("linear");
    const fmt = primaryFormatter(ctx);
    expect(fmt(123.456)).toBe("123.46");
    expect(ctx.chart.w.config.yaxis[0].logarithmic).toBe(false);
  });

  it("falls back to linear for an unknown mode", () => {
    ps.setMode("bogus");
    expect(ps.getMode()).toBe("linear");
  });

  it("percent stays safe when the baseline is unavailable", () => {
    const empty = fakeCtx({ series: [] });
    const p = new PriceScale(empty);
    p.setMode("percent");
    expect(primaryFormatter(empty)(120)).toBe("0.00%");
  });

  it("recomputes the baseline from current data on reapply", () => {
    ps.setMode("percent");
    expect(primaryFormatter(ctx)(200)).toBe("100.00%"); // base 100
    // Data replaced: first close is now 200.
    ctx.series = [
      { x: 1, y: [200, 210, 190, 200] },
      { x: 2, y: [200, 260, 198, 250] },
    ];
    ps.reapply();
    expect(primaryFormatter(ctx)(200)).toBe("0.00%");
    expect(primaryFormatter(ctx)(250)).toBe("25.00%");
  });

  it("preserves a secondary (comparison) axis, patching only index 0", () => {
    const cmp = fakeCtx({
      yaxis: [
        { opposite: true, labels: {} },
        { opposite: false, seriesName: ["MSFT"], labels: {} },
      ],
    });
    const p = new PriceScale(cmp);
    p.setMode("logarithmic");
    expect(cmp.chart.w.config.yaxis).toHaveLength(2);
    expect(cmp.chart.w.config.yaxis[0].logarithmic).toBe(true);
    expect(cmp.chart.w.config.yaxis[1]).toEqual({
      opposite: false,
      seriesName: ["MSFT"],
      labels: {},
    });
  });

  it("reads initial config from options.priceScale and applies on reapply", () => {
    const configured = fakeCtx({
      chartOptions: { series: [{ name: "AAPL" }], priceScale: { mode: "logarithmic", logBase: 2 } },
    });
    const p = new PriceScale(configured);
    expect(p.getMode()).toBe("logarithmic");
    expect(p._serialize()).not.toBeNull();
    p.reapply();
    expect(configured.chart.w.config.yaxis[0].logarithmic).toBe(true);
    expect(configured.chart.w.config.yaxis[0].logBase).toBe(2);
  });

  it("serializes only when touched and round-trips through _restore", () => {
    expect(ps._serialize()).toBeNull();
    ps.setMode("percent", { base: 150 });
    const snap = ps._serialize();
    expect(snap).toEqual({ mode: "percent", base: 150, logBase: 10, indexBase: 100 });
    // JSON-safe.
    expect(JSON.parse(JSON.stringify(snap))).toEqual(snap);

    const fresh = fakeCtx();
    const p = new PriceScale(fresh);
    p._restore(snap);
    expect(p.get()).toEqual(snap);
    expect(primaryFormatter(fresh)(150)).toBe("0.00%");
  });

  it("_restore(null) resets a non-linear scale back to linear", () => {
    ps.setMode("indexed");
    ps._restore(null);
    expect(ps.getMode()).toBe("linear");
    // The axis formatter was re-asserted to plain price.
    expect(primaryFormatter(ctx)(120)).toBe("120.00");
  });

  it("destroy stops future reapplies from asserting", () => {
    ps.setMode("logarithmic");
    const before = ctx._updates.length;
    ps.destroy();
    ps.reapply();
    expect(ctx._updates.length).toBe(before);
  });
});
