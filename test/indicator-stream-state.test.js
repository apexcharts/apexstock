// @vitest-environment jsdom
//
// Step 2 of appendData: the registry -> stepper resolution map (IndicatorStep)
// and the per-indicator streaming-state lifecycle on ApexStock (seed on add,
// clear on remove/toggle-off, reset on full series replace), plus the memo-
// bypass correctness bridge (a seeded state stepped by one bar reproduces the
// full Indicators.calculate* of the extended series).
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import ApexStock from "../src/ApexStock.js";
import Indicators from "../src/indicators/Indicators.js";
import IndicatorStep from "../src/indicators/IndicatorStep.js";

function ohlcData(n = 60, withVolume = true) {
  return Array.from({ length: n }, (_, i) => ({
    x: new Date(2020, 0, i + 1).getTime(),
    y: [10 + i, 12 + i, 9 + i, 11 + i],
    ...(withVolume ? { v: 1000 + i } : {}),
  }));
}

function installApexChartsMock() {
  const instances = [];
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

describe("IndicatorStep.resolve / streamableKeys (registry -> stepper map)", () => {
  // Defaults here must mirror exactly the `params.x || default` reads in each
  // registry build() in IndicatorHandlers.js.
  const RESOLVE_CASES = [
    ["moving average", {}, { key: "sma", params: { period: 10 } }],
    ["moving average", { period: 25 }, { key: "sma", params: { period: 25 } }],
    ["exponential moving average", {}, { key: "ema", params: { period: 10 } }],
    ["linear regression", {}, { key: "linreg", params: { period: 14 } }],
    [
      "bollinger bands",
      {},
      { key: "bollinger", params: { period: 20, stdDev: 2 } },
    ],
    ["rsi", {}, { key: "rsi", params: { period: 14 } }],
    ["macd", {}, { key: "macd", params: { fast: 12, slow: 26, signal: 9 } }],
    [
      "macd",
      { fastPeriod: 5, slowPeriod: 13, signalPeriod: 3 },
      { key: "macd", params: { fast: 5, slow: 13, signal: 3 } },
    ],
    ["price volume trend", {}, { key: "pvt", params: {} }],
    [
      "stochastic oscillator",
      {},
      { key: "stochastic", params: { period: 14, smoothPeriod: 3 } },
    ],
    ["standard deviation indicator", {}, { key: "stddev", params: { period: 14 } }],
    ["average directional index", {}, { key: "adx", params: { period: 14 } }],
    [
      "chaikin oscillator",
      {},
      { key: "chaikin", params: { short: 3, long: 10 } },
    ],
    ["commodity channel index", {}, { key: "cci", params: { period: 20 } }],
    [
      "trend strength index",
      {},
      {
        key: "tsi",
        params: { longPeriod: 25, shortPeriod: 13, signalPeriod: 7 },
      },
    ],
    ["accelerator oscillator", {}, { key: "ac", params: { acPeriod: 5 } }],
    [
      "bollinger bands %b",
      {},
      { key: "bbpercent", params: { period: 20, stdDev: 2 } },
    ],
    [
      "bollinger bands width",
      {},
      { key: "bbwidth", params: { period: 20, stdDev: 2 } },
    ],
  ];

  for (const [registryKey, liveParams, expected] of RESOLVE_CASES) {
    it(`resolves "${registryKey}" (${JSON.stringify(liveParams)})`, () => {
      const r = IndicatorStep.resolve(registryKey, liveParams);
      expect(r.key).toBe(expected.key);
      expect(r.params).toEqual(expected.params);
      expect(["overlay", "oscillator"]).toContain(r.kind);
      expect(typeof r.render).toBe("function");
      // Every resolved stepper key must have an actual stepper.
      expect(IndicatorStep.has(expected.key)).toBe(true);
    });
  }

  it("returns null for indicators without a streaming twin", () => {
    for (const k of [
      "ichimoku cloud indicator",
      "fibonacci retracements",
      "volumes",
      "not a real indicator",
    ]) {
      expect(IndicatorStep.resolve(k)).toBe(null);
      expect(IndicatorStep.isStreamable(k)).toBe(false);
    }
  });

  it("streamableKeys() lists exactly the mapped registry keys", () => {
    expect(IndicatorStep.streamableKeys().sort()).toEqual(
      RESOLVE_CASES.map((c) => c[0])
        .filter((k, i, a) => a.indexOf(k) === i)
        .sort()
    );
  });
});

describe("ApexStock streaming-state lifecycle", () => {
  beforeEach(() => installApexChartsMock());
  afterEach(() => {
    document.body.innerHTML = "";
    delete global.ApexCharts;
  });

  it("seeds state for a streamable overlay on add and clears it on remove", () => {
    const inst = makeInstance();
    inst.updateIndicator("moving average");

    const entry = inst._indicatorState["moving average"];
    expect(entry).toBeTruthy();
    expect(entry.key).toBe("sma");
    expect(entry.params).toEqual({ period: 10 });
    expect(entry.state).toBeTruthy();

    inst.removeIndicator("moving average");
    expect(inst._indicatorState["moving average"]).toBeUndefined();
  });

  it("seeds state for a streamable oscillator on add", () => {
    const inst = makeInstance();
    inst.updateIndicator("macd");
    const entry = inst._indicatorState["macd"];
    expect(entry).toBeTruthy();
    expect(entry.key).toBe("macd");
    expect(entry.params).toEqual({ fast: 12, slow: 26, signal: 9 });
  });

  it("toggling an indicator off (via updateIndicator) clears its state", () => {
    const inst = makeInstance();
    inst.updateIndicator("rsi");
    expect(inst._indicatorState["rsi"]).toBeTruthy();
    // updateIndicator toggles: second call removes it.
    inst.updateIndicator("rsi");
    expect(inst._indicatorState["rsi"]).toBeUndefined();
  });

  it("does NOT create state for non-streamable indicators", () => {
    const inst = makeInstance();
    inst.updateIndicator("ichimoku cloud indicator");
    expect(inst._indicatorState["ichimoku cloud indicator"]).toBeUndefined();
    inst.updateIndicator("fibonacci retracements");
    expect(inst._indicatorState["fibonacci retracements"]).toBeUndefined();
  });

  it("re-seeds active indicators from the new data on a series replace", () => {
    const inst = makeInstance(ohlcData(60));
    inst.updateIndicator("moving average");
    const before = inst._indicatorState["moving average"].state;

    inst.update({ series: [{ name: "Price", data: ohlcData(80) }] });

    const after = inst._indicatorState["moving average"];
    expect(after).toBeTruthy();
    expect(after.key).toBe("sma");
    // A fresh object (re-seeded), not the stale reference.
    expect(after.state).not.toBe(before);
  });

  it("resetIndicatorState drops everything", () => {
    const inst = makeInstance();
    inst.updateIndicator("moving average");
    inst.updateIndicator("rsi");
    expect(Object.keys(inst._indicatorState).length).toBe(2);
    inst.resetIndicatorState();
    expect(inst._indicatorState).toEqual({});
  });
});

describe("memo-bypass correctness bridge (seed -> step matches full recompute)", () => {
  beforeEach(() => installApexChartsMock());
  afterEach(() => {
    document.body.innerHTML = "";
    delete global.ApexCharts;
  });

  // Drive the resolved stepper exactly as appendData will: seed from the current
  // series, then step on the series extended by one bar, and confirm the value
  // equals the full Indicators.calculate* of the extended series at its last bar.
  const BRIDGE = [
    {
      key: "moving average",
      last: (s) => {
        const a = Indicators.calculateMovingAverage(s, 10);
        return a[a.length - 1];
      },
    },
    {
      key: "average directional index",
      last: (s) => {
        const a = Indicators.calculateADX(s, 14);
        return a[a.length - 1].y;
      },
    },
    {
      key: "trend strength index",
      last: (s) => {
        const o = Indicators.calculateTSI(s, 25, 13, 7);
        return {
          tsi: o.tsi[o.tsi.length - 1].y,
          signal: o.signal[o.signal.length - 1].y,
        };
      },
    },
  ];

  for (const { key, last } of BRIDGE) {
    it(`"${key}": seeded state stepped by one bar matches the full recompute`, () => {
      const base = ohlcData(80);
      const inst = makeInstance(base);
      inst.updateIndicator(key);
      const entry = inst._indicatorState[key];

      // Append one bar and step.
      const newBar = {
        x: new Date(2020, 0, 81).getTime(),
        y: [90, 93, 88, 91],
        v: 5000,
      };
      const extended = [...base, newBar];
      const { value } = IndicatorStep.step(
        entry.key,
        entry.state,
        extended,
        entry.params
      );

      const expected = last(extended);
      if (expected === null || typeof expected === "number") {
        expect(value ?? null).toEqual(
          expected === null ? null : expect.closeTo(expected, 8)
        );
      } else {
        for (const k of Object.keys(expected)) {
          expect(value[k] ?? null).toEqual(
            expected[k] === null ? null : expect.closeTo(expected[k], 8)
          );
        }
      }
    });
  }
});
