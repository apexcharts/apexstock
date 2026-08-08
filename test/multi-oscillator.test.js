// @vitest-environment jsdom
//
// Tests for multiple simultaneous oscillator panes (the one-at-a-time cap
// lifted). Covers coexistence, even height division across panes, re-expansion
// on removal, dropdown multi-select, and getState round-trip.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import ApexStock from "../src/ApexStock.js";

function ohlcData(n = 60) {
  return Array.from({ length: n }, (_, i) => ({
    x: new Date(2020, 0, i + 1).getTime(),
    y: [10 + i, 12 + i, 9 + i, 11 + i],
    v: 1000 + i,
  }));
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
      updateOptions: vi.fn(),
      removeAnnotation: vi.fn(),
      addYaxisAnnotation: vi.fn(),
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

describe("multiple oscillator panes", () => {
  let inst;
  beforeEach(() => {
    installApexChartsMock();
    inst = makeInstance();
  });
  afterEach(() => {
    document.body.innerHTML = "";
    delete global.ApexCharts;
  });

  it("keeps multiple oscillators active at once (no radio eviction)", () => {
    inst.updateIndicator("rsi");
    inst.updateIndicator("macd");

    expect(!!inst.indicatorChartMap["rsi"]).toBe(true);
    expect(!!inst.indicatorChartMap["macd"]).toBe(true);
    expect(inst.indicatorContainer.children.length).toBe(2);
  });

  it("divides the indicator area evenly across panes", () => {
    inst.updateIndicator("rsi");
    inst.updateIndicator("macd");

    const twoUp = inst.computeHeights(2).indicatorHeight;
    Array.from(inst.indicatorContainer.children).forEach((div) => {
      expect(div.style.height).toBe(twoUp + "px");
    });
    // Each pane instance was resized to the two-pane height.
    expect(inst.indicatorChartMap["rsi"].updateOptions).toHaveBeenCalledWith(
      { chart: { height: twoUp } },
      false,
      false,
      false
    );
  });

  it("re-expands the remaining pane when one is removed", () => {
    inst.updateIndicator("rsi");
    inst.updateIndicator("macd");
    inst.removeIndicator("rsi");

    expect(inst.indicatorContainer.children.length).toBe(1);
    const oneUp = inst.computeHeights(1).indicatorHeight;
    const remaining = inst.indicatorContainer.children[0];
    expect(remaining.dataset.indicator).toBe("macd");
    expect(remaining.style.height).toBe(oneUp + "px");
  });

  it("captures every active oscillator in getState", () => {
    inst.updateIndicator("rsi");
    inst.updateIndicator("macd");
    inst.updateIndicator("volumes");
    const keys = inst.getState().indicators.map((i) => i.key).sort();
    expect(keys).toEqual(["macd", "rsi", "volumes"]);
  });
});

describe("indicators dropdown — oscillator multi-select", () => {
  let inst;
  beforeEach(() => {
    installApexChartsMock();
    inst = makeInstance();
    inst.render();
  });
  afterEach(() => {
    document.body.innerHTML = "";
    delete global.ApexCharts;
  });

  it("clicking two oscillator options keeps both selected", () => {
    const opt = (key) =>
      inst.primaryToolbar.querySelector(
        `.apexstock-custom-option[data-value="${key}"]`
      );
    opt("rsi").click();
    opt("macd").click();

    expect(opt("rsi").classList.contains("selected")).toBe(true);
    expect(opt("macd").classList.contains("selected")).toBe(true);
    expect(!!inst.indicatorChartMap["rsi"]).toBe(true);
    expect(!!inst.indicatorChartMap["macd"]).toBe(true);
  });
});
