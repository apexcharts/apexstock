// @vitest-environment jsdom
//
// ATR (Average True Range) indicator: Wilder-smoothed true range as an
// oscillator pane. Hand-verified math + end-to-end add/introspection.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Indicators from "../src/indicators/Indicators.js";
import ApexStock from "../src/ApexStock.js";

// y = [open, high, low, close]
const bars = [
  { x: 1, y: [9, 10, 8, 9] }, // TR0 = 10-8 = 2
  { x: 2, y: [9, 12, 9, 11] }, // TR1 = max(3, 3, 0) = 3
  { x: 3, y: [11, 13, 10, 12] }, // TR2 = max(3, 2, 1) = 3
  { x: 4, y: [12, 15, 12, 14] }, // TR3 = max(3, 3, 0) = 3
];

describe("Indicators.calculateATR", () => {
  it("is null until `period` bars, then Wilder-smoothed", () => {
    const v = Indicators.calculateATR(bars, 3).map((p) => p.y);
    expect(v[0]).toBeNull();
    expect(v[1]).toBeNull();
    expect(v[2]).toBeCloseTo(8 / 3, 2); // (2+3+3)/3 = 2.67
    expect(v[3]).toBeCloseTo(((8 / 3) * 2 + 3) / 3, 2); // 2.78
  });

  it("returns all-null when shorter than the period", () => {
    const v = Indicators.calculateATR(bars.slice(0, 2), 3).map((p) => p.y);
    expect(v).toEqual([null, null]);
  });
});

function installApexChartsMock() {
  global.ApexCharts = vi.fn(function (el, opts) {
    const inst = {
      el,
      options: opts,
      w: { globals: {}, config: { chart: { type: "candlestick" }, series: (opts && opts.series) || [], yaxis: [{}], annotations: {} } },
      render: vi.fn(),
      destroy: vi.fn(),
      addEventListener: vi.fn(),
      updateSeries: vi.fn(),
      updateOptions: vi.fn(),
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
    chart: { height: 400 },
    theme: { mode: "light" },
    series: [{ name: "Price", data: Array.from({ length: 40 }, (_, i) => ({ x: i + 1, y: [10 + i, 12 + i, 9 + i, 11 + i], v: 1000 })) }],
  });
}

describe("ApexStock ATR oscillator", () => {
  let inst;
  beforeEach(() => {
    installApexChartsMock();
    inst = makeInstance();
  });
  afterEach(() => {
    document.body.innerHTML = "";
    delete global.ApexCharts;
  });

  it("creates a separate ATR oscillator pane and marks it active", () => {
    inst.render();
    const before = global.ApexCharts.mock.calls.length;
    inst.updateIndicator("atr");
    // A new ApexCharts instance (the pane) was created.
    expect(global.ApexCharts.mock.calls.length).toBe(before + 1);
    expect(inst.indicatorChartMap.atr).toBeTruthy();
  });

  it("is introspectable as an oscillator with an uppercase label", () => {
    const info = inst.getIndicator("atr");
    expect(info.label).toBe("ATR");
    expect(info.type).toBe("oscillator");
    expect(info.builtin).toBe(true);
  });
});
