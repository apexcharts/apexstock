// @vitest-environment jsdom
//
// Donchian and Keltner channel overlays (rangeArea bands). Hand-verified
// Donchian math + end-to-end rendering for both.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Indicators from "../src/indicators/Indicators.js";
import ApexStock from "../src/ApexStock.js";

// y = [open, high, low, close]
const dcBars = [
  { x: 1, y: [10, 12, 8, 11] },
  { x: 2, y: [11, 14, 9, 13] },
  { x: 3, y: [13, 13, 7, 9] },
  { x: 4, y: [9, 16, 11, 15] },
];

describe("Indicators.calculateDonchian", () => {
  it("tracks the trailing highest-high / lowest-low", () => {
    const d = Indicators.calculateDonchian(dcBars, 3);
    expect(d.upper).toEqual([null, null, 14, 16]);
    expect(d.lower).toEqual([null, null, 7, 7]);
    expect(d.middle).toEqual([null, null, 10.5, 11.5]);
  });
});

describe("Indicators.calculateKeltner", () => {
  it("is null until both EMA and ATR are established, then a symmetric band", () => {
    const bars = Array.from({ length: 30 }, (_, i) => ({
      x: i + 1,
      y: [100 + i, 102 + i, 98 + i, 101 + i],
    }));
    const k = Indicators.calculateKeltner(bars, 20, 10, 2);
    expect(k.upper[18]).toBeNull(); // EMA(20) not established yet
    const i = 25;
    expect(k.middle[i]).not.toBeNull();
    // Band is symmetric about the midline: upper - middle === middle - lower.
    expect(k.upper[i] - k.middle[i]).toBeCloseTo(k.middle[i] - k.lower[i], 6);
    expect(k.upper[i]).toBeGreaterThan(k.lower[i]);
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
      updateSeries: vi.fn(function (s) { inst.w.config.series = s; }),
      updateOptions: vi.fn(),
      zoomX: vi.fn(),
    };
    return inst;
  });
}

function makeInstance(data) {
  const parent = document.createElement("div");
  const container = document.createElement("div");
  parent.appendChild(container);
  document.body.appendChild(parent);
  return new ApexStock(container, {
    chart: { height: 400 },
    theme: { mode: "light" },
    series: [{ name: "Price", data }],
  });
}

const longBars = Array.from({ length: 40 }, (_, i) => ({
  x: i + 1,
  y: [100 + i, 105 + i, 96 + i, 101 + i],
  v: 1000,
}));

describe("channel overlays end-to-end", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    delete global.ApexCharts;
  });
  beforeEach(() => installApexChartsMock());

  it("Donchian renders a rangeArea band with [lower, upper] points", () => {
    const inst = makeInstance(dcBars);
    inst.updateIndicator("donchian channels", { period: 3 });
    const s = inst.chart.updateSeries.mock.calls.at(-1)[0];
    const band = s.find((x) => x.name === "Donchian Channels");
    expect(band).toBeTruthy();
    expect(band.type).toBe("rangeArea");
    expect(band.data[2].y).toEqual([7, 14]); // [lower, upper]
    expect(inst.indicatorChartMap["donchian channels"]).toBe(true);
  });

  it("Keltner renders a rangeArea band and is introspectable", () => {
    const inst = makeInstance(longBars);
    inst.updateIndicator("keltner channels");
    const s = inst.chart.updateSeries.mock.calls.at(-1)[0];
    const band = s.find((x) => x.name === "Keltner Channels");
    expect(band).toBeTruthy();
    expect(band.type).toBe("rangeArea");
    const last = band.data.at(-1).y;
    expect(last[1]).toBeGreaterThan(last[0]); // upper > lower

    expect(inst.getIndicator("keltner channels").label).toBe("Keltner Channels");
    expect(inst.getIndicator("donchian channels").label).toBe("Donchian Channels");
  });
});
