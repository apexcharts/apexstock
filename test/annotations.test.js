// @vitest-environment jsdom
//
// Tests for the public data-space annotation API (addAnnotation and friends):
// y/x lines, bands, points, and text at data coordinates, distinct from the
// freehand drawing tools and the trading price lines.
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
      addYaxisAnnotation: vi.fn(),
      addXaxisAnnotation: vi.fn(),
      addPointAnnotation: vi.fn(),
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

describe("annotation API", () => {
  let inst;
  beforeEach(() => {
    installApexChartsMock();
    inst = makeInstance();
  });
  afterEach(() => {
    document.body.innerHTML = "";
    delete global.ApexCharts;
  });

  it("adds a yLine via addYaxisAnnotation and returns an id", () => {
    const id = inst.addAnnotation({ type: "yLine", y: 105, label: "target" });
    expect(id).toBeTruthy();
    expect(inst.chart.addYaxisAnnotation).toHaveBeenCalledTimes(1);
    const opts = inst.chart.addYaxisAnnotation.mock.calls[0][0];
    expect(opts).toMatchObject({ id, y: 105 });
    expect(opts.label.text).toBe("target");
    expect(inst.getAnnotation(id)).toMatchObject({ type: "yLine", y: 105 });
  });

  it("adds a yBand with fill + opacity", () => {
    inst.addAnnotation({ type: "yBand", y: 100, y2: 110, opacity: 0.2 });
    const opts = inst.chart.addYaxisAnnotation.mock.calls[0][0];
    expect(opts).toMatchObject({ y: 100, y2: 110, opacity: 0.2 });
    expect(opts.fillColor).toBeTruthy();
  });

  it("adds an xLine via addXaxisAnnotation, coercing a Date to a timestamp", () => {
    const when = new Date("2020-01-15T00:00:00Z");
    const id = inst.addAnnotation({ type: "xLine", x: when, label: "event" });
    const opts = inst.chart.addXaxisAnnotation.mock.calls[0][0];
    expect(opts.x).toBe(when.getTime());
    expect(inst.getAnnotation(id).x).toBe(when.getTime());
  });

  it("adds an xBand with x2", () => {
    inst.addAnnotation({ type: "xBand", x: 1, x2: 5 });
    const opts = inst.chart.addXaxisAnnotation.mock.calls[0][0];
    expect(opts).toMatchObject({ x: 1, x2: 5 });
  });

  it("adds a point marker via addPointAnnotation", () => {
    inst.addAnnotation({ type: "point", x: 3, y: 42, label: "buy" });
    const opts = inst.chart.addPointAnnotation.mock.calls[0][0];
    expect(opts).toMatchObject({ x: 3, y: 42 });
    expect(opts.marker.size).toBeGreaterThan(0);
    expect(opts.label.text).toBe("buy");
  });

  it("adds text as a markerless point annotation", () => {
    inst.addAnnotation({ type: "text", x: 3, y: 42, text: "note" });
    const opts = inst.chart.addPointAnnotation.mock.calls[0][0];
    expect(opts.marker.size).toBe(0);
    expect(opts.label.text).toBe("note");
  });

  it("omits the label key entirely when no label is given", () => {
    // Passing label:undefined makes ApexCharts dereference a missing label.
    inst.addAnnotation({ type: "yBand", y: 100, y2: 110 });
    const opts = inst.chart.addYaxisAnnotation.mock.calls[0][0];
    expect("label" in opts).toBe(false);
  });

  it("rejects invalid configs", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(inst.addAnnotation({ y: 1 })).toBeNull(); // no type
    expect(inst.addAnnotation({ type: "yLine" })).toBeNull(); // no y
    expect(inst.addAnnotation({ type: "point", x: 1 })).toBeNull(); // no y
    warn.mockRestore();
  });

  it("update patches and redraws", () => {
    const id = inst.addAnnotation({ type: "yLine", y: 100 });
    inst.chart.addYaxisAnnotation.mockClear();
    expect(inst.updateAnnotation(id, { y: 120 })).toBe(true);
    expect(inst.chart.removeAnnotation).toHaveBeenCalledWith(id);
    expect(inst.chart.addYaxisAnnotation.mock.calls[0][0].y).toBe(120);
    expect(inst.getAnnotation(id).y).toBe(120);
  });

  it("remove and clear remove by id (leaving trading price lines intact)", () => {
    inst.addPriceLine({ price: 100 }); // separate manager
    const a = inst.addAnnotation({ type: "yLine", y: 50 });
    const b = inst.addAnnotation({ type: "point", x: 2, y: 3 });
    expect(inst.getAnnotations()).toHaveLength(2);

    expect(inst.removeAnnotation(a)).toBe(true);
    expect(inst.getAnnotation(a)).toBeNull();

    inst.clearAnnotations();
    expect(inst.getAnnotations()).toHaveLength(0);
    // Trading price line untouched by clearAnnotations().
    expect(inst.getPriceLines()).toHaveLength(1);
  });

  it("reapply re-adds every annotation (persists across re-render)", () => {
    inst.addAnnotation({ type: "yLine", y: 10 });
    inst.addAnnotation({ type: "point", x: 1, y: 2 });
    inst.chart.addYaxisAnnotation.mockClear();
    inst.chart.addPointAnnotation.mockClear();

    inst.annotations.reapply();

    expect(inst.chart.addYaxisAnnotation).toHaveBeenCalledTimes(1);
    expect(inst.chart.addPointAnnotation).toHaveBeenCalledTimes(1);
  });
});
