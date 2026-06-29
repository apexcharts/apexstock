// @vitest-environment jsdom
//
// Step 3 of appendData: the appendData() orchestration. Verifies that one call
// patches the price candles, every streamable overlay/oscillator pane, and the
// volume pane incrementally (one new point each), WITHOUT a full teardown:
// no refreshIndicators, no pane destroy/recreate. Indicator values appended
// match the full Indicators.calculate* of the extended series. Also covers
// updateLast (forming candle), maxPoints (rolling window), batch, and the
// follow/preserve view policy.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import ApexStock from "../src/ApexStock.js";
import Indicators from "../src/indicators/Indicators.js";
import IndicatorStep from "../src/indicators/IndicatorStep.js";

function ohlcData(n = 60, withVolume = true) {
  const out = [];
  let price = 100;
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647), (seed - 1) / 2147483646);
  for (let i = 0; i < n; i++) {
    const open = price;
    const cl = price + (rand() - 0.5) * 4;
    const high = Math.max(open, cl) + rand();
    const low = Math.min(open, cl) - rand();
    out.push({
      x: new Date(2020, 0, i + 1).getTime(),
      y: [open, high, low, cl].map((v) => Number(v.toFixed(2))),
      ...(withVolume ? { v: 1000 + i } : {}),
    });
    price = cl;
  }
  return out;
}

function bar(x, base = 120, v = 9999) {
  return { x, y: [base, base + 2, base - 2, base + 1], v };
}

/** A capturing ApexCharts mock with per-instance series + data-derived zoom globals. */
function installApexChartsMock() {
  const instances = [];
  global.ApexCharts = vi.fn(function (el, opts) {
    const priceLike = (opts && opts.series && opts.series[0] && opts.series[0].data) || [];
    const inst = {
      el,
      options: opts,
      w: {
        globals: {
          chartID: "chart",
          dataPoints: priceLike.length,
          minX: priceLike.length ? priceLike[0].x : 0,
          maxX: priceLike.length ? priceLike[priceLike.length - 1].x : 0,
        },
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
      updateOptions: vi.fn(),
      removeAnnotation: vi.fn(),
      addYaxisAnnotation: vi.fn(),
      zoomX: vi.fn(),
    };
    instances.push(inst);
    return inst;
  });
  return instances;
}

function makeInstance(data = ohlcData()) {
  const parent = document.createElement("div");
  const container = document.createElement("div");
  parent.appendChild(container);
  document.body.appendChild(parent);
  return new ApexStock(container, {
    chart: { height: 500 },
    theme: { mode: "light" },
    series: [{ name: "Price", data }],
  });
}

/** Latest data array pushed to a chart's series by name. */
function seriesData(chart, name) {
  const s = chart.w.config.series.find((x) => x.name === name);
  return s && s.data;
}

describe("appendData — price candles", () => {
  let instances;
  beforeEach(() => {
    instances = installApexChartsMock();
  });
  afterEach(() => {
    document.body.innerHTML = "";
    delete global.ApexCharts;
  });

  it("appends a single bar to this.series and the Price series", () => {
    const data = ohlcData(60);
    const inst = makeInstance(data);
    const refreshSpy = vi.spyOn(inst, "refreshIndicators");
    const newBar = bar(new Date(2020, 0, 61).getTime());

    inst.appendData(newBar);

    expect(inst.series).toHaveLength(61);
    expect(inst.series[60]).toEqual(newBar);
    expect(inst.chart.updateSeries).toHaveBeenCalled();
    expect(seriesData(inst.chart, "Price")).toBe(inst.series);
    // Incremental: no full indicator rebuild.
    expect(refreshSpy).not.toHaveBeenCalled();
    // No new chart instances created (only the main chart exists).
    expect(instances).toHaveLength(1);
  });

  it("appends a batch (array) in order", () => {
    const inst = makeInstance(ohlcData(60));
    const batch = [
      bar(new Date(2020, 0, 61).getTime()),
      bar(new Date(2020, 0, 62).getTime()),
      bar(new Date(2020, 0, 63).getTime()),
    ];
    inst.appendData(batch);
    expect(inst.series).toHaveLength(63);
  });

  it("ignores an out-of-order / duplicate (non-forming) bar", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const data = ohlcData(60);
    const inst = makeInstance(data);
    inst.appendData(bar(data[59].x)); // same x, no updateLast
    expect(inst.series).toHaveLength(60);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("updateLast replaces the forming last bar instead of appending", () => {
    const data = ohlcData(60);
    const inst = makeInstance(data);
    const lastX = data[59].x;
    inst.appendData(bar(lastX, 150), { updateLast: true });
    expect(inst.series).toHaveLength(60); // replaced, not appended
    expect(inst.series[59].y[0]).toBe(150);
  });

  it("maxPoints trims the oldest bars from the front", () => {
    const inst = makeInstance(ohlcData(60));
    inst.appendData(bar(new Date(2020, 0, 61).getTime()), { maxPoints: 50 });
    expect(inst.series).toHaveLength(50);
    // Right edge is the freshly appended bar.
    expect(inst.series[49].y[0]).toBe(120);
  });

  it("no-ops with a warning when there are no valid points", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const inst = makeInstance(ohlcData(20));
    inst.appendData([{ x: NaN, y: [1, 2] }]);
    expect(inst.series).toHaveLength(20);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("appendData — overlays (main chart)", () => {
  beforeEach(() => installApexChartsMock());
  afterEach(() => {
    document.body.innerHTML = "";
    delete global.ApexCharts;
  });

  it("extends the Moving Average overlay by one correct point", () => {
    const data = ohlcData(60);
    const inst = makeInstance(data);
    inst.updateIndicator("moving average");

    const newBar = bar(new Date(2020, 0, 61).getTime());
    inst.appendData(newBar);

    const ma = seriesData(inst.chart, "Moving Average");
    expect(ma).toHaveLength(61);
    const expected = Indicators.calculateMovingAverage(inst.series, 10);
    expect(ma[60].x).toBe(newBar.x);
    expect(ma[60].y).toBeCloseTo(expected[60], 8);
  });

  it("extends the Bollinger rangeArea band with [lower, upper]", () => {
    const data = ohlcData(60);
    const inst = makeInstance(data);
    inst.updateIndicator("bollinger bands");

    const newBar = bar(new Date(2020, 0, 61).getTime());
    inst.appendData(newBar);

    const bb = seriesData(inst.chart, "Bollinger Bands");
    expect(bb).toHaveLength(61);
    const { upper, lower } = Indicators.calculateBollingerBands(inst.series, 20, 2);
    expect(bb[60].y[0]).toBeCloseTo(lower[60], 8);
    expect(bb[60].y[1]).toBeCloseTo(upper[60], 8);
  });
});

describe("appendData — oscillator panes", () => {
  let instances;
  beforeEach(() => {
    instances = installApexChartsMock();
  });
  afterEach(() => {
    document.body.innerHTML = "";
    delete global.ApexCharts;
  });

  it("extends the RSI pane by one correct point without recreating it", () => {
    const data = ohlcData(60);
    const inst = makeInstance(data);
    inst.updateIndicator("rsi");
    const pane = inst.indicatorChartMap["rsi"];
    const instanceCountBefore = instances.length;

    const newBar = bar(new Date(2020, 0, 61).getTime());
    inst.appendData(newBar);

    expect(instances.length).toBe(instanceCountBefore); // no recreate
    expect(pane.destroy).not.toHaveBeenCalled();
    const rsi = seriesData(pane, "RSI");
    expect(rsi).toHaveLength(61);
    const expected = Indicators.calculateRSI(inst.series, 14);
    expect(rsi[60].y).toBeCloseTo(expected[60], 8);
  });

  it("extends MACD's three series (truncated values)", () => {
    const data = ohlcData(60);
    const inst = makeInstance(data);
    inst.updateIndicator("macd");
    const pane = inst.indicatorChartMap["macd"];

    inst.appendData(bar(new Date(2020, 0, 61).getTime()));

    const m = Indicators.calculateMACD(inst.series, 12, 26, 9);
    const last = inst.series.length - 1;
    expect(seriesData(pane, "MACD")[last].y).toBeCloseTo(
      Indicators.calculateMACD(inst.series, 12, 26, 9).macd[last],
      6
    );
    expect(seriesData(pane, "Signal")).toHaveLength(61);
    expect(seriesData(pane, "Histogram")).toHaveLength(61);
    expect(m.signal[last]).not.toBeUndefined();
  });

  it("extends a running-state oscillator (ADX) correctly over several appends", () => {
    const data = ohlcData(80);
    const inst = makeInstance(data);
    inst.updateIndicator("average directional index");
    const pane = inst.indicatorChartMap["average directional index"];

    for (let i = 0; i < 5; i++) {
      inst.appendData(bar(new Date(2020, 0, 81 + i).getTime(), 120 + i));
    }
    const adx = Indicators.calculateADX(inst.series, 14);
    const last = inst.series.length - 1;
    expect(seriesData(pane, "ADX")[last].y).toBeCloseTo(adx[last].y, 6);
  });
});

describe("appendData — volume pane", () => {
  beforeEach(() => installApexChartsMock());
  afterEach(() => {
    document.body.innerHTML = "";
    delete global.ApexCharts;
  });

  it("appends the new bar's volume to the Volumes pane", () => {
    const inst = makeInstance(ohlcData(60));
    inst.updateIndicator("volumes");
    const pane = inst.indicatorChartMap["volumes"];

    const newBar = bar(new Date(2020, 0, 61).getTime(), 120, 7777);
    inst.appendData(newBar);

    const vols = seriesData(pane, "Volumes");
    expect(vols[vols.length - 1]).toEqual({ x: newBar.x, y: 7777 });
  });
});

describe("appendData — view policy", () => {
  beforeEach(() => installApexChartsMock());
  afterEach(() => {
    document.body.innerHTML = "";
    delete global.ApexCharts;
  });

  it("follow on a full (un-zoomed) view does not force a zoom", () => {
    const inst = makeInstance(ohlcData(60));
    inst.appendData(bar(new Date(2020, 0, 61).getTime()));
    expect(inst.chart.zoomX).not.toHaveBeenCalled();
  });

  it("follow on a zoomed view shifts the window to the right edge", () => {
    const data = ohlcData(60);
    const inst = makeInstance(data);
    // Simulate a zoom: visible window is the last ~10 bars.
    const w = inst.chart.w.globals;
    w.minX = data[50].x;
    w.maxX = data[59].x;
    const width = w.maxX - w.minX;

    const newBar = bar(new Date(2020, 0, 61).getTime());
    inst.appendData(newBar, { view: "follow" });

    expect(inst.chart.zoomX).toHaveBeenCalled();
    const [minX, maxX] = inst.chart.zoomX.mock.calls.at(-1);
    expect(maxX).toBe(newBar.x);
    expect(maxX - minX).toBe(width);
  });

  it("preserve on a zoomed view re-applies the exact prior window", () => {
    const data = ohlcData(60);
    const inst = makeInstance(data);
    const w = inst.chart.w.globals;
    w.minX = data[50].x;
    w.maxX = data[59].x;

    inst.appendData(bar(new Date(2020, 0, 61).getTime()), { view: "preserve" });

    const [minX, maxX] = inst.chart.zoomX.mock.calls.at(-1);
    expect(minX).toBe(data[50].x);
    expect(maxX).toBe(data[59].x);
  });
});

describe("appendData — forming candle (updateLast) + O(1) close", () => {
  beforeEach(() => installApexChartsMock());
  afterEach(() => {
    document.body.innerHTML = "";
    delete global.ApexCharts;
  });

  it("forming replaces track the recompute, and the close is O(1) (no re-seed)", () => {
    const base = ohlcData(60);
    const inst = makeInstance(base);
    // EMA is a running-state stepper, so its full re-seed is O(n) — the case the
    // O(1) forming-close promotion is meant to avoid.
    inst.updateIndicator("exponential moving average");

    const x1 = base[59].x + 86400000;
    const emaLast = () => {
      const ema = seriesData(inst.chart, "EMA");
      return ema[ema.length - 1].y;
    };
    const fullEmaLast = () => {
      const f = Indicators.calculateEMA(inst.series.slice(), 10);
      return f[f.length - 1];
    };

    // Open a forming bar, then replace it twice (same x).
    inst.appendData({ x: x1, y: [70, 75, 69, 74], v: 1 }, { updateLast: true });
    inst.appendData({ x: x1, y: [70, 80, 69, 78], v: 1 }, { updateLast: true });
    inst.appendData({ x: x1, y: [70, 82, 68, 80], v: 1 }, { updateLast: true });
    expect(inst.series).toHaveLength(61); // forming bar replaced in place
    expect(emaLast()).toBeCloseTo(fullEmaLast(), 8);

    // Close it by appending a NEW bar. The forming bar's stashed state is
    // promoted in O(1) — IndicatorStep.seed must NOT be called.
    const seedSpy = vi.spyOn(IndicatorStep, "seed");
    inst.appendData({ x: x1 + 86400000, y: [80, 85, 79, 83], v: 1 });
    expect(seedSpy).not.toHaveBeenCalled();
    seedSpy.mockRestore();

    expect(inst.series).toHaveLength(62);
    expect(emaLast()).toBeCloseTo(fullEmaLast(), 8); // still exact after close
  });

  it("a steady stream of closed appends never re-seeds (stays O(1))", () => {
    const base = ohlcData(60);
    const inst = makeInstance(base);
    inst.updateIndicator("exponential moving average");

    const seedSpy = vi.spyOn(IndicatorStep, "seed");
    let prev = base[59].y[3];
    for (let i = 0; i < 20; i++) {
      const x = base[59].x + (i + 1) * 86400000;
      const c = prev + 1;
      inst.appendData({ x, y: [prev, c + 1, prev - 1, c], v: 1 });
      prev = c;
    }
    expect(seedSpy).not.toHaveBeenCalled();
    seedSpy.mockRestore();

    const ema = seriesData(inst.chart, "EMA");
    const full = Indicators.calculateEMA(inst.series.slice(), 10);
    expect(ema[ema.length - 1].y).toBeCloseTo(full[full.length - 1], 8);
  });
});

describe("appendData — guards", () => {
  it("no-ops when the chart is not rendered", () => {
    installApexChartsMock();
    const inst = makeInstance(ohlcData(10));
    inst.chart = null; // simulate destroyed/unrendered
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => inst.appendData(bar(Date.now()))).not.toThrow();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
    document.body.innerHTML = "";
    delete global.ApexCharts;
  });
});
