// @vitest-environment jsdom
//
// Measurement: the analysis layer behind the `measure` drawing tool. Covers the
// public API (measureRange / getMeasurements / clearMeasurement), the two
// separately-named changes (selection vs series close-to-close), snap, label
// composition, the settled-change `rangeMeasured` event, state round-tripping
// through the drawing set, and the ApexCharts core-ruler interop.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import ApexStock from "../src/ApexStock.js";
import Measurement from "../src/analysis/Measurement.js";

/** An ApexCharts mock with data-derived zoom globals (as in drawings.test.js). */
function installApexChartsMock() {
  global.ApexCharts = vi.fn(function (el, opts) {
    const priceLike =
      (opts && opts.series && opts.series[0] && opts.series[0].data) || [];
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
      updateSeries: vi.fn(function (next) {
        inst.w.config.series = next;
      }),
      updateOptions: vi.fn(),
      removeAnnotation: vi.fn(),
      addYaxisAnnotation: vi.fn(),
      zoomX: vi.fn(),
    };
    return inst;
  });
}

/**
 * Daily bars with a designed shape so the statistics are hand-checkable:
 * closes rise 100 -> 119 over 20 bars, then dip to 105 at bar 24, then recover.
 */
function ohlcData() {
  const closes = [];
  for (let i = 0; i < 20; i++) closes.push(100 + i);
  closes.push(115, 110, 108, 105, 112, 120, 121, 122, 123, 124);
  return closes.map((c, i) => ({
    x: Date.UTC(2024, 0, 1) + i * 86400000,
    y: [c - 1, c + 2, c - 2, c],
    v: 1000 + i,
  }));
}

function makeInstance(options = {}) {
  const parent = document.createElement("div");
  const container = document.createElement("div");
  parent.appendChild(container);
  document.body.appendChild(parent);
  return new ApexStock(container, {
    chart: { height: 500 },
    theme: { mode: "light" },
    series: [{ name: "Price", data: ohlcData() }],
    ...options,
  });
}

describe("measureRange", () => {
  let inst;
  let data;
  beforeEach(() => {
    installApexChartsMock();
    data = ohlcData();
    inst = makeInstance();
    inst.render();
  });
  afterEach(() => {
    document.body.innerHTML = "";
    delete global.ApexCharts;
  });

  it("creates a measure drawing and returns the region statistics", () => {
    const out = inst.measureRange(0, 10);
    expect(out).not.toBeNull();
    expect(out.stats.from.index).toBe(0);
    expect(out.stats.to.index).toBe(10);
    expect(out.stats.change.absolute).toBe(10); // close 100 -> 110
    expect(out.stats.bars).toBe(11);

    // It is a real drawing, queryable through the drawing API.
    const drawing = inst.getDrawing(out.id);
    expect(drawing.type).toBe("measure");
    expect(inst.drawingTools.elements.some((e) => e.data.id === out.id)).toBe(
      true
    );
  });

  it("anchors the drawing on the bars' closes", () => {
    const out = inst.measureRange(0, 10);
    const pts = inst.getDrawing(out.id).points;
    expect(pts[0]).toEqual({ x: data[0].x, y: data[0].y[3] });
    expect(pts[1]).toEqual({ x: data[10].x, y: data[10].y[3] });
  });

  it("accepts dates and timestamps, and either endpoint order", () => {
    const byIndex = inst.measureRange(0, 10).stats;
    inst.clearMeasurement();
    const byDate = inst.measureRange("2024-01-01", "2024-01-11").stats;
    inst.clearMeasurement();
    const reversed = inst.measureRange(data[10].x, data[0].x).stats;
    expect(byDate.from.index).toBe(byIndex.from.index);
    expect(byDate.to.index).toBe(byIndex.to.index);
    expect(reversed.from.index).toBe(0);
    expect(reversed.to.index).toBe(10);
  });

  it("passes drawing style through and keeps `by` out of the drawing", () => {
    const out = inst.measureRange(0, 5, {
      upColor: "#123456",
      showLabel: false,
      meta: { note: "swing" },
      by: "index",
    });
    const d = inst.getDrawing(out.id);
    expect(d.upColor).toBe("#123456");
    expect(d.showLabel).toBe(false);
    expect(d.meta).toEqual({ note: "swing" });
    expect(d.by).toBeUndefined();
  });

  it("warns and returns null when the endpoints cannot be resolved", () => {
    expect(inst.measureRange("not a date", 5)).toBeNull();
  });

  it("returns null when there is no data", () => {
    inst.series = [];
    expect(inst.measureRange(0, 1)).toBeNull();
  });
});

describe("selection vs change", () => {
  let inst;
  let data;
  beforeEach(() => {
    installApexChartsMock();
    data = ohlcData();
    inst = makeInstance();
    inst.render();
  });
  afterEach(() => {
    document.body.innerHTML = "";
    delete global.ApexCharts;
  });

  it("reports the dragged anchors and the series closes separately", () => {
    // Anchors deliberately off the closes: a swing measured low-to-high.
    const id = inst.addDrawing({
      type: "measure",
      points: [
        { x: data[0].x, y: data[0].y[2] }, // bar 0 low  = 98
        { x: data[10].x, y: data[10].y[1] }, // bar 10 high = 112
      ],
    });
    const m = inst.getMeasurement(id);
    expect(m.selection.from).toBe(98);
    expect(m.selection.to).toBe(112);
    expect(m.selection.absolute).toBe(14);
    // The series change over the same bars is close-to-close, not anchor delta.
    expect(m.stats.change.absolute).toBe(10);
    expect(m.stats.from.value).toBe(100);
    expect(m.stats.to.value).toBe(110);
  });

  it("makes the two agree when the anchors sit on the closes", () => {
    const out = inst.measureRange(0, 10);
    const m = inst.getMeasurement(out.id);
    expect(m.selection.absolute).toBeCloseTo(m.stats.change.absolute, 10);
  });

  it("carries the full region statistics, not just the endpoints", () => {
    const { stats } = inst.measureRange(0, 29);
    expect(stats.high.value).toBe(126); // bar 29 high = 124 + 2
    expect(stats.low.value).toBe(98); // bar 0 low = 100 - 2
    expect(stats.average.volume).toBeGreaterThan(0);
    expect(stats.volatility.stdev).toBeGreaterThan(0);
    // Closes peak at 119 (bar 19) and trough at 105 (bar 23), then recover.
    expect(stats.drawdown.max).toBeCloseTo(((105 - 119) / 119) * 100, 10);
    expect(stats.drawdown.peak.index).toBe(19);
    expect(stats.drawdown.trough.index).toBe(23);
    expect(stats.drawdown.recovered).toBe(true);
  });
});

describe("snap", () => {
  beforeEach(() => {
    installApexChartsMock();
  });
  afterEach(() => {
    document.body.innerHTML = "";
    delete global.ApexCharts;
  });

  it("leaves the box on the dragged anchors by default", () => {
    const inst = makeInstance();
    inst.render();
    const data = ohlcData();
    const id = inst.addDrawing({
      type: "measure",
      points: [
        { x: data[0].x, y: 90 },
        { x: data[5].x, y: 130 },
      ],
    });
    const record = inst.drawingTools.elements.find((e) => e.data.id === id);
    const resolved = inst.measurement.resolve(record.data);
    expect(resolved.geometry.y1).toBe(90);
    expect(resolved.geometry.y2).toBe(130);
  });

  it("pulls the box onto the bar closes with analysis.measure.snap", () => {
    const data = ohlcData();
    const inst = makeInstance({ analysis: { measure: { snap: true } } });
    inst.render();
    const id = inst.addDrawing({
      type: "measure",
      points: [
        { x: data[0].x, y: 90 },
        { x: data[5].x, y: 130 },
      ],
    });
    const record = inst.drawingTools.elements.find((e) => e.data.id === id);
    const resolved = inst.measurement.resolve(record.data);
    expect(resolved.geometry.y1).toBe(data[0].y[3]);
    expect(resolved.geometry.y2).toBe(data[5].y[3]);
    expect(resolved.geometry.x1).toBe(data[0].x);
  });

  it("ignores an unknown snap field and keeps the raw anchors", () => {
    const data = ohlcData();
    const inst = makeInstance({ analysis: { measure: { snap: "banana" } } });
    inst.render();
    const id = inst.addDrawing({
      type: "measure",
      points: [
        { x: data[0].x, y: 90 },
        { x: data[5].x, y: 130 },
      ],
    });
    const record = inst.drawingTools.elements.find((e) => e.data.id === id);
    expect(inst.measurement.resolve(record.data).geometry.y1).toBe(90);
  });

  it("snaps to a named field", () => {
    const data = ohlcData();
    const inst = makeInstance({ analysis: { measure: { snap: "high" } } });
    inst.render();
    const id = inst.addDrawing({
      type: "measure",
      points: [
        { x: data[0].x, y: 90 },
        { x: data[5].x, y: 130 },
      ],
    });
    const record = inst.drawingTools.elements.find((e) => e.data.id === id);
    expect(inst.measurement.resolve(record.data).geometry.y1).toBe(
      data[0].y[1]
    );
  });
});

describe("the on-chart label", () => {
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

  it("leads with the selection delta, then the duration", () => {
    const out = inst.measureRange(0, 10);
    const m = inst.measurement._cache.get(out.id);
    expect(m.lines).toHaveLength(2);
    expect(m.lines[0]).toBe("+10 (+10%)");
    expect(m.lines[1]).toBe("11 bars  ·  10d");
  });

  it("renders as one tspan per line inside a single text element", () => {
    inst.measureRange(0, 10);
    const texts = document.querySelectorAll(
      ".apexstock-drawing-overlay g text"
    );
    expect(texts.length).toBeGreaterThanOrEqual(1);
    const tspans = texts[0].querySelectorAll("tspan");
    expect(tspans).toHaveLength(2);
    expect(texts[0].textContent).toContain("bars");
  });

  it("omits the day count for a category x axis", () => {
    const inst2 = makeInstance({
      series: [
        {
          name: "P",
          data: [1, 2, 3, 4, 5].map((c, i) => ({ x: i + 1, y: [c, c, c, c] })),
        },
      ],
    });
    inst2.render();
    const out = inst2.measureRange(0, 4);
    const m = inst2.measurement._cache.get(out.id);
    expect(m.lines[1]).toBe("5 bars");
  });

  it("honors an analysis.measure.label override", () => {
    const inst2 = makeInstance({
      analysis: {
        measure: {
          label: (stats, extra) =>
            `${stats.bars}|${extra.selection.absolute}|${stats.change.percent.toFixed(1)}`,
        },
      },
    });
    inst2.render();
    const out = inst2.measureRange(0, 10);
    expect(inst2.measurement._cache.get(out.id).lines).toEqual(["11|10|10.0"]);
  });

  it("falls back to the default label when the override throws", () => {
    const inst2 = makeInstance({
      analysis: {
        measure: {
          label: () => {
            throw new Error("boom");
          },
        },
      },
    });
    inst2.render();
    const out = inst2.measureRange(0, 10);
    expect(inst2.measurement._cache.get(out.id).lines[1]).toContain("bars");
  });
});

describe("the rangeMeasured event", () => {
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

  it("fires once per API measurement, with the statistics attached", () => {
    const seen = [];
    inst.on("rangeMeasured", (e) => seen.push(e));
    const out = inst.measureRange(0, 10);
    expect(seen).toHaveLength(1);
    expect(seen[0].id).toBe(out.id);
    expect(seen[0].source).toBe("api");
    expect(seen[0].stats.change.absolute).toBe(10);
    expect(seen[0].selection.absolute).toBeCloseTo(10, 10);
  });

  it("stays silent when a redraw leaves the resolved bars alone", () => {
    inst.measureRange(0, 10);
    const seen = [];
    inst.on("rangeMeasured", (e) => seen.push(e));
    // A pan or zoom redraws every drawing without moving any anchor.
    inst.drawingTools.redrawElements();
    inst.drawingTools.redrawElements();
    inst.measurement.flush();
    expect(seen).toHaveLength(0);
  });

  it("fires again when an anchor actually moves", () => {
    const out = inst.measureRange(0, 10);
    const seen = [];
    inst.on("rangeMeasured", (e) => seen.push(e));
    const record = inst.drawingTools.elements.find((e) => e.data.id === out.id);
    record.data.x2 = ohlcData()[20].x; // simulate a drag to bar 20
    inst.drawingTools.redrawElements();
    inst.measurement.flush();
    expect(seen).toHaveLength(1);
    expect(seen[0].stats.to.index).toBe(20);
    expect(seen[0].source).toBe("drag");
  });

  it("defers the event while a drag is still in flight", () => {
    const out = inst.measureRange(0, 10);
    const seen = [];
    inst.on("rangeMeasured", (e) => seen.push(e));
    const record = inst.drawingTools.elements.find((e) => e.data.id === out.id);

    inst.drawingTools.isDrawing = true;
    record.data.x2 = ohlcData()[15].x;
    inst.drawingTools.redrawElements();
    inst.measurement.flush();
    expect(seen).toHaveLength(0); // still dragging

    inst.drawingTools.isDrawing = false;
    inst.measurement.flush();
    expect(seen).toHaveLength(1);
  });

  it("never emits for an in-progress drawing that has no id yet", () => {
    const seen = [];
    inst.on("rangeMeasured", (e) => seen.push(e));
    const data = ohlcData();
    inst.measurement.resolve({
      type: "measure",
      x1: data[0].x,
      y1: 100,
      x2: data[9].x,
      y2: 110,
      _drawing: true,
    });
    inst.measurement.flush();
    expect(seen).toHaveLength(0);
  });

  it("fires measurementRemoved on clear", () => {
    const out = inst.measureRange(0, 10);
    const seen = [];
    inst.on("measurementRemoved", (e) => seen.push(e));
    expect(inst.clearMeasurement(out.id)).toBe(1);
    expect(seen).toEqual([{ id: out.id }]);
  });
});

describe("getMeasurements / clearMeasurement", () => {
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

  it("lists every measurement with its statistics", () => {
    const a = inst.measureRange(0, 10);
    const b = inst.measureRange(15, 25);
    const all = inst.getMeasurements();
    expect(all.map((m) => m.id)).toEqual([a.id, b.id]);
    expect(all[1].stats.from.index).toBe(15);
  });

  it("clears one by id and leaves the rest", () => {
    const a = inst.measureRange(0, 10);
    const b = inst.measureRange(15, 25);
    expect(inst.clearMeasurement(a.id)).toBe(1);
    expect(inst.getMeasurements().map((m) => m.id)).toEqual([b.id]);
  });

  it("clears them all with no argument", () => {
    inst.measureRange(0, 10);
    inst.measureRange(15, 25);
    expect(inst.clearMeasurement()).toBe(2);
    expect(inst.getMeasurements()).toEqual([]);
  });

  it("never touches other drawing types", () => {
    const data = ohlcData();
    const line = inst.addDrawing({
      type: "trendline",
      points: [
        { x: data[0].x, y: 100 },
        { x: data[5].x, y: 105 },
      ],
    });
    inst.measureRange(0, 10);
    inst.clearMeasurement();
    expect(inst.getMeasurements()).toEqual([]);
    expect(inst.getDrawing(line)).not.toBeNull();
  });

  it("returns 0 for an unknown id and null from getMeasurement", () => {
    expect(inst.clearMeasurement("nope")).toBe(0);
    expect(inst.getMeasurement("nope")).toBeNull();
  });
});

describe("persistence", () => {
  beforeEach(() => {
    installApexChartsMock();
  });
  afterEach(() => {
    document.body.innerHTML = "";
    delete global.ApexCharts;
  });

  it("round-trips through getState/setState as a drawing", () => {
    const inst = makeInstance();
    inst.render();
    const out = inst.measureRange(0, 10);
    const state = JSON.parse(JSON.stringify(inst.getState()));

    const inst2 = makeInstance();
    inst2.render();
    inst2.setState(state);

    const restored = inst2.getMeasurements();
    expect(restored).toHaveLength(1);
    expect(restored[0].id).toBe(out.id);
    expect(restored[0].stats.change.absolute).toBe(10);
    expect(restored[0].stats.bars).toBe(11);
  });
});

describe("core measure-ruler interop", () => {
  let inst;
  let data;
  beforeEach(() => {
    installApexChartsMock();
    data = ohlcData();
    inst = makeInstance();
    inst.render();
  });
  afterEach(() => {
    document.body.innerHTML = "";
    delete global.ApexCharts;
  });

  it("re-emits the core `measured` event as rangeMeasured with our statistics", () => {
    const seen = [];
    inst.on("rangeMeasured", (e) => seen.push(e));
    inst.measurement.onCoreMeasured({
      from: { x: data[0].x, y: 100 },
      to: { x: data[10].x, y: 110 },
      dx: 10 * 86400000,
      dy: 10,
      percentChange: 10,
    });
    expect(seen).toHaveLength(1);
    expect(seen[0].source).toBe("coreRuler");
    expect(seen[0].id).toBeNull();
    expect(seen[0].stats.bars).toBe(11);
    expect(seen[0].stats.drawdown).toBeDefined();
  });

  it("builds the ruler's label from the same formatter", () => {
    const lines = inst.measurement.labelForCoreRuler({
      from: { x: data[0].x, y: 100 },
      to: { x: data[10].x, y: 110 },
    });
    expect(lines[0]).toBe("+10 (+10%)");
    expect(lines[1]).toContain("bars");
  });

  it("injects chart.measure.label only when the consumer enabled the ruler", () => {
    const off = makeInstance();
    expect(off.mainChartOptions.chart.measure).toBeUndefined();

    const on = makeInstance({
      chart: { height: 500, measure: { enabled: true } },
    });
    expect(typeof on.mainChartOptions.chart.measure.label).toBe("function");
    expect(
      on.mainChartOptions.chart.measure.label({
        from: { x: data[0].x, y: 100 },
        to: { x: data[10].x, y: 110 },
      })[0]
    ).toBe("+10 (+10%)");
  });

  it("leaves a consumer-supplied label alone", () => {
    const mine = () => ["mine"];
    const on = makeInstance({
      chart: { height: 500, measure: { enabled: true, label: mine } },
    });
    expect(on.mainChartOptions.chart.measure.label).toBe(mine);
  });

  it("returns an empty readout when the payload cannot be resolved", () => {
    expect(inst.measurement.labelForCoreRuler(null)).toEqual([""]);
    expect(inst.measurement._fromCoreRuler({ from: { x: 0 } })).toBeNull();
  });
});

describe("Measurement lifecycle", () => {
  beforeEach(() => {
    installApexChartsMock();
  });
  afterEach(() => {
    document.body.innerHTML = "";
    delete global.ApexCharts;
  });

  it("recomputes after appendData extends the series", () => {
    const inst = makeInstance();
    inst.render();
    const data = ohlcData();
    const out = inst.measureRange(0, 29);
    expect(out.stats.bars).toBe(30);

    inst.appendData({
      x: data[29].x + 86400000,
      y: [124, 130, 123, 129],
      v: 1500,
    });
    // The measurement still spans bars 0..29, but its cache was invalidated so
    // the next read recomputes rather than serving the stale entry.
    const again = inst.getMeasurements()[0];
    expect(again.stats.bars).toBe(30);
    expect(again.stats.high.value).toBe(126); // the new bar is outside the range
  });

  it("survives a theme switch", () => {
    const inst = makeInstance();
    inst.render();
    const out = inst.measureRange(0, 10);
    inst.updateTheme("dark");
    expect(inst.getMeasurements()).toHaveLength(1);
    expect(inst.getMeasurement(out.id).stats.bars).toBe(11);
  });

  it("drops state and cancels a queued flush on destroy", () => {
    const inst = makeInstance();
    inst.render();
    inst.measureRange(0, 10);
    inst.destroy();
    expect(inst.measurement._cache.size).toBe(0);
    expect(inst.measurement._pending.size).toBe(0);
  });

  it("measures before render(), while the drawing is still buffered", () => {
    const inst = makeInstance();
    // No render() yet: the drawing layer does not exist, so the measurement is
    // resolved from the buffered drawing set instead of the live one.
    const out = inst.measureRange(0, 10);
    expect(out.stats.bars).toBe(11);
    expect(inst.getMeasurements()).toHaveLength(1);

    // It flushes into the live layer on render, still measurable.
    inst.render();
    expect(inst.drawingTools.elements.some((e) => e.data.id === out.id)).toBe(
      true
    );
    expect(inst.getMeasurement(out.id).stats.bars).toBe(11);
  });

  it("bounds the resolved cache rather than growing without limit", () => {
    const inst = makeInstance();
    inst.render();
    const data = ohlcData();
    // More measurements than the cache holds; the oldest entries are evicted
    // but every measurement is still resolvable (recomputed on demand).
    for (let i = 0; i < 70; i++) {
      inst.addDrawing({
        type: "measure",
        points: [
          { x: data[0].x, y: 100 },
          { x: data[(i % 25) + 1].x, y: 110 },
        ],
      });
    }
    expect(inst.measurement._cache.size).toBeLessThanOrEqual(64);
    const all = inst.getMeasurements();
    expect(all).toHaveLength(70);
    expect(all[0].stats.bars).toBeGreaterThan(1);
  });

  it("resolves nothing without a series", () => {
    const m = new Measurement({ series: [] });
    expect(m.resolve({ x1: 1, x2: 2, y1: 1, y2: 2 })).toBeNull();
    expect(m.resolve(null)).toBeNull();
  });
});
