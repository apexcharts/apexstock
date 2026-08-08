// @vitest-environment jsdom
//
// Tests for comparison mode: overlaying additional instruments on a secondary
// y-axis, in absolute and percent (indexed) modes.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import ApexStock from "../src/ApexStock.js";

function ohlcData(n = 60, start = 100) {
  const d = [];
  let p = start;
  for (let i = 0; i < n; i++) {
    const c = p + 1;
    d.push({ x: new Date(2020, 0, i + 1).getTime(), y: [p, p + 2, p - 1, c], v: 1000 + i });
    p = c;
  }
  return d;
}

function installApexChartsMock() {
  global.ApexCharts = vi.fn(function (el, opts) {
    const inst = {
      el,
      options: opts,
      w: {
        globals: { chartID: "chart", dataPoints: 60, minX: 0, maxX: 59 },
        config: {
          chart: { type: "candlestick" },
          series: (opts && opts.series) || [],
          yaxis: [{}],
          annotations: {},
        },
      },
      render: vi.fn(),
      destroy: vi.fn(),
      addEventListener: vi.fn(),
      updateSeries: vi.fn(function (s) {
        inst.w.config.series = s;
      }),
      updateOptions: vi.fn(function (opts) {
        if (opts && opts.yaxis !== undefined) inst.w.config.yaxis = opts.yaxis;
      }),
      addYaxisAnnotation: vi.fn(),
      removeAnnotation: vi.fn(),
      zoomX: vi.fn(),
    };
    return inst;
  });
}

function makeInstance() {
  const parent = document.createElement("div");
  const container = document.createElement("div");
  parent.appendChild(container);
  document.body.appendChild(parent);
  return new ApexStock(container, {
    chart: { height: 500 },
    theme: { mode: "light" },
    series: [{ name: "Price", data: ohlcData() }],
  });
}

/** Names of the current comparison line series on the main chart. */
const cmpNames = (inst) =>
  inst.chart.w.config.series.map((s) => s.name).filter((n) => n === "PEER" || n === "PEER2");

describe("comparison mode", () => {
  let inst;
  beforeEach(() => {
    installApexChartsMock();
    inst = makeInstance();
  });
  afterEach(() => {
    document.body.innerHTML = "";
    delete global.ApexCharts;
  });

  it("adds an instrument as a line series and returns its name", () => {
    const name = inst.addComparison({ name: "PEER", data: ohlcData(60, 50) });
    expect(name).toBe("PEER");
    expect(inst.chart.w.config.series.some((s) => s.name === "PEER")).toBe(true);
    expect(inst.getComparisons()).toHaveLength(1);
    expect(inst.comparison.isActive()).toBe(true);
  });

  it("binds a secondary y-axis (2 axes) when active, single axis when empty", () => {
    inst.addComparison({ name: "PEER", data: ohlcData(60, 50) });
    const yaxis = inst.chart.w.config.yaxis;
    expect(Array.isArray(yaxis)).toBe(true);
    expect(yaxis).toHaveLength(2);
    expect(yaxis[0].seriesName).toContain("Price"); // primary + overlays
    expect(yaxis[1].seriesName).toContain("PEER"); // comparison axis
    expect(yaxis[1].opposite).toBe(false);

    inst.removeComparison("PEER");
    expect(Array.isArray(inst.chart.w.config.yaxis)).toBe(false); // restored single axis
  });

  it("percent mode indexes each series to its first point (0%)", () => {
    inst.setComparisonMode("percent");
    inst.addComparison({ name: "PEER", data: ohlcData(3, 100) }); // closes 101,102,103
    const s = inst.chart.w.config.series.find((x) => x.name === "PEER");
    expect(s.data[0].y).toBe(0); // baseline
    // ~0.99% gain from 101 -> 102 (values are truncated to 2 decimals).
    expect(s.data[1].y).toBeCloseTo(0.99, 2);
  });

  it("absolute mode plots raw closes", () => {
    inst.setComparisonMode("absolute");
    inst.addComparison({ name: "PEER", data: ohlcData(3, 100) });
    const s = inst.chart.w.config.series.find((x) => x.name === "PEER");
    expect(s.data.map((p) => p.y)).toEqual([101, 102, 103]);
  });

  it("setComparisonMode recomputes existing instruments", () => {
    inst.addComparison({ name: "PEER", data: ohlcData(3, 100) });
    expect(inst.getComparisonMode()).toBe("percent");
    inst.setComparisonMode("absolute");
    expect(inst.getComparisonMode()).toBe("absolute");
    const s = inst.chart.w.config.series.find((x) => x.name === "PEER");
    expect(s.data[0].y).toBe(101); // now absolute
  });

  it("accepts {x,y:number} and {x,close} point shapes", () => {
    inst.setComparisonMode("absolute");
    inst.addComparison({ name: "PEER", data: [{ x: 1, y: 10 }, { x: 2, close: 20 }] });
    const s = inst.chart.w.config.series.find((x) => x.name === "PEER");
    expect(s.data.map((p) => p.y)).toEqual([10, 20]);
  });

  it("does not duplicate a carried-over comparison line on reapply", () => {
    inst.addComparison({ name: "PEER", data: ohlcData(60, 50) });
    // Simulate a chart-type switch carrying the line over as a pseudo-indicator.
    inst.chart.w.config.series = [
      { name: "Price", data: [] },
      { name: "PEER", data: [] }, // stale carry-over
    ];
    inst.comparison.reapply();
    expect(cmpNames(inst).filter((n) => n === "PEER")).toHaveLength(1);
  });

  it("rejects invalid configs", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(inst.addComparison({ data: [] })).toBeNull(); // no name
    expect(inst.addComparison({ name: "X" })).toBeNull(); // no data
    expect(inst.addComparison({ name: "X", data: [{ x: 1 }] })).toBeNull(); // no close
    warn.mockRestore();
  });

  it("clearComparisons removes all and restores the single axis", () => {
    inst.addComparison({ name: "PEER", data: ohlcData(60, 50) });
    inst.addComparison({ name: "PEER2", data: ohlcData(60, 200) });
    expect(inst.getComparisons()).toHaveLength(2);
    inst.clearComparisons();
    expect(inst.getComparisons()).toHaveLength(0);
    expect(inst.chart.w.config.series.some((s) => s.name.startsWith("PEER"))).toBe(false);
    expect(Array.isArray(inst.chart.w.config.yaxis)).toBe(false);
  });
});
