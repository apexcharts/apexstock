// @vitest-environment jsdom
//
// Tests for optional ApexCharts injection: pass the constructor per-instance
// (`options.ApexCharts`) or app-wide (`ApexStock.setApexCharts`) instead of
// relying on the `window.ApexCharts` global (bundler/framework-friendly).
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import ApexStock from "../src/ApexStock.js";

function ohlcData(n = 60) {
  return Array.from({ length: n }, (_, i) => ({
    x: new Date(2020, 0, i + 1).getTime(),
    y: [10 + i, 12 + i, 9 + i, 11 + i],
    v: 1000 + i,
  }));
}

/** A fresh spy ApexCharts constructor, independent of the global. */
function makeCtor() {
  return vi.fn(function (el, opts) {
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
    return inst;
  });
}

function container() {
  const parent = document.createElement("div");
  const el = document.createElement("div");
  parent.appendChild(el);
  document.body.appendChild(parent);
  return el;
}

const OPTS = () => ({
  chart: { height: 500 },
  theme: { mode: "light" },
  series: [{ name: "Price", data: ohlcData() }],
});

describe("optional ApexCharts injection", () => {
  beforeEach(() => {
    delete global.ApexCharts;
    ApexStock.setApexCharts(null);
  });
  afterEach(() => {
    document.body.innerHTML = "";
    delete global.ApexCharts;
    ApexStock.setApexCharts(null);
    vi.restoreAllMocks();
  });

  it("uses a per-instance injected constructor (no global present)", () => {
    const Ctor = makeCtor();
    const inst = new ApexStock(container(), OPTS(), { ApexCharts: Ctor });
    expect(Ctor).toHaveBeenCalledTimes(1);
    expect(inst._ApexCharts).toBe(Ctor);
    expect(inst.chart).toBeTruthy();
  });

  it("uses the app-wide default from setApexCharts (no global present)", () => {
    const Ctor = makeCtor();
    ApexStock.setApexCharts(Ctor);
    const inst = new ApexStock(container(), OPTS());
    expect(Ctor).toHaveBeenCalledTimes(1);
    expect(inst._ApexCharts).toBe(Ctor);
  });

  it("prefers the per-instance injection over the app-wide default", () => {
    const Default = makeCtor();
    const Injected = makeCtor();
    ApexStock.setApexCharts(Default);
    const inst = new ApexStock(container(), OPTS(), { ApexCharts: Injected });
    expect(inst._ApexCharts).toBe(Injected);
    expect(Injected).toHaveBeenCalledTimes(1);
    expect(Default).not.toHaveBeenCalled();
  });

  it("falls back to the window.ApexCharts global when nothing is injected", () => {
    const Ctor = makeCtor();
    global.ApexCharts = Ctor;
    const inst = new ApexStock(container(), OPTS());
    expect(Ctor).toHaveBeenCalledTimes(1);
    expect(inst._ApexCharts).toBe(Ctor);
  });

  it("prefers injection over the global", () => {
    const Global = makeCtor();
    const Injected = makeCtor();
    global.ApexCharts = Global;
    const inst = new ApexStock(container(), OPTS(), { ApexCharts: Injected });
    expect(inst._ApexCharts).toBe(Injected);
    expect(Global).not.toHaveBeenCalled();
  });

  it("throws a clear error when no constructor is resolvable", () => {
    expect(() => new ApexStock(container(), OPTS())).toThrow(
      /ApexCharts was not found/
    );
  });

  it("uses the injected constructor for oscillator panes too", () => {
    const Ctor = makeCtor();
    const inst = new ApexStock(container(), OPTS(), { ApexCharts: Ctor });
    expect(Ctor).toHaveBeenCalledTimes(1); // main chart
    inst.updateIndicator("rsi"); // oscillator -> its own pane
    expect(Ctor).toHaveBeenCalledTimes(2); // main + pane, both via injection
  });
});
