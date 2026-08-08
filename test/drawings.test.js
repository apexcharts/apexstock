// @vitest-environment jsdom
//
// Programmatic data-space drawing API (Drawings manager + ApexStock facade):
// normalization of the public {type, points} contract into the internal
// element model, CRUD + events, and lossless serialization through
// getState()/setState(). Pixel reprojection across zoom is covered by the
// Playwright smoke, not here.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Drawings from "../src/overlays/Drawings.js";
import ApexStock from "../src/ApexStock.js";

// ---------------------------------------------------------------------------
// Manager-level unit tests against a fake drawing layer (no SVG / getBBox).
// ---------------------------------------------------------------------------
function fakeCtx() {
  const elements = [];
  const emitted = [];
  return {
    colors: { indicators: { movingAverage: "#123456" } },
    drawingTools: { elements, redrawElements: vi.fn() },
    _emitter: { emit: (name, payload) => emitted.push({ name, payload }) },
    _elements: elements,
    _emitted: emitted,
  };
}

describe("Drawings (manager unit)", () => {
  let ctx;
  let d;
  beforeEach(() => {
    ctx = fakeCtx();
    d = new Drawings(ctx);
  });

  it("adds a trendline from two points and redraws + emits", () => {
    const id = d.add({ type: "trendline", points: [{ x: 10, y: 100 }, { x: 20, y: 130 }] });
    expect(id).toBe("draw-1");
    expect(ctx._elements).toHaveLength(1);
    const data = ctx._elements[0].data;
    expect(data).toMatchObject({
      id: "draw-1",
      type: "line", // trendline maps to the internal line renderer
      x1: 10, y1: 100, x2: 20, y2: 130,
      color: "#123456", // theme default
      width: 2,
    });
    expect(ctx.drawingTools.redrawElements).toHaveBeenCalledTimes(1);
    expect(ctx._emitted[0].name).toBe("drawingAdded");
    expect(ctx._emitted[0].payload.id).toBe("draw-1");
    expect(ctx._emitted[0].payload.drawing.type).toBe("line");
  });

  it("normalizes horizontalLine to a single price and reports it publicly", () => {
    const id = d.add({ type: "horizontalLine", points: [{ y: 150 }], color: "#f00" });
    expect(ctx._elements[0].data).toMatchObject({ type: "hline", y: 150, color: "#f00" });
    const pub = d.get(id);
    expect(pub.type).toBe("horizontalLine");
    expect(pub.points).toEqual([{ x: null, y: 150 }]);
  });

  it("normalizes verticalLine and coerces a Date x to epoch ms", () => {
    const when = new Date("2020-06-01T00:00:00Z");
    const id = d.add({ type: "verticalLine", points: [{ x: when }] });
    expect(ctx._elements[0].data).toMatchObject({ type: "vline", x: when.getTime() });
    expect(d.get(id).type).toBe("verticalLine");
  });

  it("normalizes a rectangle from two corners (min corner + size, default fill)", () => {
    d.add({ type: "rectangle", points: [{ x: 30, y: 90 }, { x: 10, y: 120 }] });
    const data = ctx._elements[0].data;
    expect(data).toMatchObject({
      type: "rectangle",
      x: 10, y: 90, width: 20, height: 30,
      fill: "#123456", fillOpacity: 0.2,
    });
  });

  it("supports rays and preserves dashArray + locked/visible flags", () => {
    const id = d.add({
      type: "ray",
      points: [{ x: 1, y: 1 }, { x: 2, y: 3 }],
      dashArray: 4, locked: true, visible: false,
    });
    const data = ctx._elements[0].data;
    expect(data.type).toBe("ray");
    expect(data.dashArray).toBe(4);
    expect(data.locked).toBe(true);
    expect(data.visible).toBe(false);
    const pub = d.get(id);
    expect(pub.locked).toBe(true);
    expect(pub.visible).toBe(false);
  });

  it("normalizes a Fibonacci retracement with default levels", () => {
    const id = d.add({ type: "fibRetracement", points: [{ x: 0, y: 100 }, { x: 10, y: 150 }] });
    const data = ctx._elements[0].data;
    expect(data).toMatchObject({
      type: "fib",
      fibType: "retracement",
      x1: 0, y1: 100, x2: 10, y2: 150,
      showLabels: true,
    });
    expect(data.levels).toEqual([0, 0.236, 0.382, 0.5, 0.618, 0.786, 1]);
    const pub = d.get(id);
    expect(pub.type).toBe("fibRetracement");
    expect(pub.points).toHaveLength(2);
    expect(pub.levels).toEqual(data.levels);
  });

  it("uses the extension level set for fibExtension and honors custom levels", () => {
    d.add({ type: "fibExtension", points: [{ x: 0, y: 10 }, { x: 5, y: 20 }] });
    expect(ctx._elements[0].data.levels).toEqual([0, 0.618, 1, 1.618, 2.618]);
    expect(d.getAll()[0].type).toBe("fibExtension");

    const id = d.add({
      type: "fibRetracement",
      points: [{ x: 0, y: 10 }, { x: 5, y: 20 }],
      levels: [0, 0.5, 1],
      showLabels: false,
    });
    const data = ctx._elements[1].data;
    expect(data.levels).toEqual([0, 0.5, 1]);
    expect(data.showLabels).toBe(false);
    expect(d.get(id).showLabels).toBe(false);
  });

  it("normalizes a measure between two points with direction colors", () => {
    const id = d.add({ type: "measure", points: [{ x: 0, y: 100 }, { x: 10, y: 90 }] });
    const data = ctx._elements[0].data;
    expect(data).toMatchObject({
      type: "measure",
      x1: 0, y1: 100, x2: 10, y2: 90,
      upColor: "#26a69a", downColor: "#ef5350",
      fillOpacity: 0.2, showLabel: true,
    });
    const pub = d.get(id);
    expect(pub.type).toBe("measure");
    expect(pub.points).toEqual([{ x: 0, y: 100 }, { x: 10, y: 90 }]);
  });

  it("snaps points to bar OHLC values when snap is set", () => {
    // Provide a series on the fake ctx for snap lookups.
    ctx.series = [
      { x: 100, y: [10, 20, 5, 15] }, // open10 high20 low5 close15
      { x: 200, y: [15, 30, 12, 25] },
    ];
    // Point near x=190, y=26 -> nearest bar x=200; nearest-OHLC to 26 is 25.
    d.add({ type: "trendline", points: [{ x: 190, y: 26 }, { x: 105, y: 6 }], snap: true });
    const data = ctx._elements[0].data;
    expect(data.x1).toBe(200);
    expect(data.y1).toBe(25); // nearest of [15,30,12,25] to 26
    expect(data.x2).toBe(100); // 105 -> bar 100
    expect(data.y2).toBe(5); // nearest of [10,20,5,15] to 6

    // Field-specific snap: force to each bar's high.
    d.add({ type: "trendline", points: [{ x: 100, y: 0 }, { x: 200, y: 0 }], snap: "high" });
    const d2 = ctx._elements[1].data;
    expect(d2.y1).toBe(20); // bar 100 high
    expect(d2.y2).toBe(30); // bar 200 high
  });

  it("rejects an unknown type and missing/invalid points", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(d.add({ type: "spline", points: [{ x: 1, y: 1 }] })).toBeNull();
    expect(d.add({ type: "trendline", points: [{ x: 1, y: 1 }] })).toBeNull(); // needs 2
    expect(d.add({ type: "horizontalLine", points: [{ y: "nope" }] })).toBeNull();
    expect(d.add(null)).toBeNull();
    expect(ctx._elements).toHaveLength(0);
    warn.mockRestore();
  });

  it("updates geometry + style in place and emits drawingUpdated", () => {
    const id = d.add({ type: "trendline", points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] });
    const ok = d.update(id, { color: "#0f0", points: [{ x: 5, y: 5 }, { x: 9, y: 2 }] });
    expect(ok).toBe(true);
    expect(ctx._elements).toHaveLength(1); // updated in place, not appended
    expect(ctx._elements[0].data).toMatchObject({ color: "#0f0", x1: 5, y1: 5, x2: 9, y2: 2 });
    expect(ctx._emitted.map((e) => e.name)).toContain("drawingUpdated");
    expect(d.update("nope", { color: "#000" })).toBe(false);
  });

  it("removes by id and clears all", () => {
    const a = d.add({ type: "horizontalLine", points: [{ y: 1 }] });
    d.add({ type: "horizontalLine", points: [{ y: 2 }] });
    expect(d.remove(a)).toBe(true);
    expect(d.remove(a)).toBe(false);
    expect(d.getAll()).toHaveLength(1);
    d.clear();
    expect(d.getAll()).toHaveLength(0);
    expect(ctx._emitted.map((e) => e.name)).toContain("drawingsCleared");
  });

  it("getAll() also reports mouse-drawn shapes already in the layer", () => {
    // Simulate a brush drawn by the mouse (raw internal data pushed by the layer).
    ctx._elements.push({
      element: null,
      data: { id: "brush-1", type: "brush", points: [{ x: 1, y: 2 }, { x: 3, y: 4 }], color: "#000", width: 2 },
    });
    const all = d.getAll();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ id: "brush-1", type: "brush", points: [{ x: 1, y: 2 }, { x: 3, y: 4 }] });
  });

  it("serializes to plain JSON and restores losslessly", () => {
    d.add({ type: "trendline", points: [{ x: 1, y: 2 }, { x: 3, y: 4 }] });
    d.add({ type: "rectangle", points: [{ x: 0, y: 0 }, { x: 5, y: 5 }] });
    const snap = d._serialize();
    expect(snap).toEqual(JSON.parse(JSON.stringify(snap))); // pure JSON
    expect(snap).toHaveLength(2);

    d.clear();
    expect(d.getAll()).toHaveLength(0);
    d._restore(snap);
    expect(d.getAll()).toHaveLength(2);
    expect(d.getAll()[0].type).toBe("line");
    expect(d.getAll()[1].type).toBe("rectangle");
  });

  it("buffers drawings added before the layer exists, then flushes on reapply", () => {
    const preCtx = {
      colors: {},
      drawingTools: null, // not yet rendered
      _emitter: { emit: () => {} },
    };
    const pre = new Drawings(preCtx);
    pre.add({ type: "horizontalLine", points: [{ y: 42 }] });
    expect(pre.getAll()).toHaveLength(1); // visible via the pending buffer

    // Layer comes online at render():
    const elements = [];
    preCtx.drawingTools = { elements, redrawElements: vi.fn() };
    pre.reapply();
    expect(elements).toHaveLength(1);
    expect(elements[0].data.type).toBe("hline");
    expect(pre.getAll()).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Integration through a rendered ApexStock (public facade + state round-trip).
// ---------------------------------------------------------------------------
function installApexChartsMock() {
  global.ApexCharts = vi.fn(function (el, opts) {
    const inst = {
      el,
      options: opts,
      w: {
        globals: {
          chartID: "chart",
          dataPoints: 60,
          minX: 0, maxX: 59, minY: 0, maxY: 100,
          translateX: 0, translateY: 0, gridWidth: 600, gridHeight: 400,
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
      updateSeries: vi.fn(function (s) { inst.w.config.series = s; }),
      updateOptions: vi.fn(),
      removeAnnotation: vi.fn(),
      addYaxisAnnotation: vi.fn(),
      zoomX: vi.fn(),
    };
    return inst;
  });
}

function ohlcData(n = 60) {
  return Array.from({ length: n }, (_, i) => ({
    x: new Date(2020, 0, i + 1).getTime(),
    y: [10 + i, 12 + i, 9 + i, 11 + i],
    v: 1000 + i,
  }));
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

describe("ApexStock drawings (integration)", () => {
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

  it("addDrawing creates a queryable data-space drawing", () => {
    const id = inst.addDrawing({
      type: "trendline",
      points: [{ x: ohlcData()[5].x, y: 20 }, { x: ohlcData()[40].x, y: 55 }],
    });
    expect(id).toBeTruthy();
    const all = inst.getDrawings();
    expect(all).toHaveLength(1);
    expect(all[0].type).toBe("line");
    expect(inst.getDrawing(id).points).toHaveLength(2);
    // The drawing landed in the live layer's element model.
    expect(inst.drawingTools.elements.some((e) => e.data.id === id)).toBe(true);
  });

  it("buffers a pre-render drawing and flushes it on render()", () => {
    const inst2 = makeInstance();
    const id = inst2.addDrawing({ type: "horizontalLine", points: [{ y: 42 }] });
    expect(inst2.getDrawings()).toHaveLength(1); // buffered
    inst2.render();
    expect(inst2.drawingTools.elements.some((e) => e.data.id === id)).toBe(true);
  });

  it("renders a Fibonacci retracement as a labeled group and round-trips", () => {
    const id = inst.addDrawing({
      type: "fibRetracement",
      points: [{ x: ohlcData()[10].x, y: 20 }, { x: ohlcData()[45].x, y: 60 }],
    });
    expect(inst.getDrawing(id).type).toBe("fibRetracement");
    // The drawing rendered as a <g> holding one <line> per level.
    const lines = document.querySelectorAll(".apexstock-drawing-overlay g line");
    expect(lines.length).toBeGreaterThanOrEqual(7); // 7 default retracement levels

    const state = JSON.parse(JSON.stringify(inst.getState()));
    const inst2 = makeInstance();
    inst2.render();
    inst2.setState(state);
    expect(inst2.getDrawings()[0].type).toBe("fibRetracement");
    expect(inst2.getDrawings()[0].levels).toEqual(inst.getDrawing(id).levels);
  });

  it("renders a measure box with a delta label", () => {
    const id = inst.addDrawing({
      type: "measure",
      points: [{ x: ohlcData()[10].x, y: 20 }, { x: ohlcData()[30].x, y: 45 }],
    });
    expect(inst.getDrawing(id).type).toBe("measure");
    const rects = document.querySelectorAll(".apexstock-drawing-overlay g rect");
    const labels = document.querySelectorAll(".apexstock-drawing-overlay g text");
    expect(rects.length).toBeGreaterThanOrEqual(1);
    expect(labels.length).toBeGreaterThanOrEqual(1);
    // Label reports the +25.00 (bars) move for an up measure.
    expect(labels[0].textContent).toContain("+25");
    expect(labels[0].textContent).toContain("bars");
  });

  it("snaps a drawing to bar closes through addDrawing({ snap })", () => {
    const bar = ohlcData()[12]; // y = [open, high, low, close]
    const id = inst.addDrawing({
      type: "horizontalLine",
      points: [{ x: bar.x, y: bar.y[3] + 0.3 }], // slightly off the close
      snap: "close",
    });
    // Snapped exactly onto the close.
    expect(inst.getDrawing(id).points[0].y).toBe(bar.y[3]);
  });

  it("updateDrawing / removeDrawing / clearDrawings work end-to-end", () => {
    const id = inst.addDrawing({ type: "horizontalLine", points: [{ y: 30 }], color: "#111" });
    expect(inst.updateDrawing(id, { color: "#eee", visible: false })).toBe(true);
    expect(inst.getDrawing(id).color).toBe("#eee");
    expect(inst.getDrawing(id).visible).toBe(false);
    expect(inst.removeDrawing(id)).toBe(true);
    expect(inst.getDrawings()).toHaveLength(0);

    inst.addDrawing({ type: "verticalLine", points: [{ x: ohlcData()[3].x }] });
    inst.clearDrawings();
    expect(inst.getDrawings()).toHaveLength(0);
  });

  it("getState() captures drawings and setState() restores them into a fresh chart", () => {
    inst.addDrawing({ type: "trendline", points: [{ x: ohlcData()[2].x, y: 15 }, { x: ohlcData()[50].x, y: 60 }] });
    inst.addDrawing({ type: "rectangle", points: [{ x: ohlcData()[5].x, y: 20 }, { x: ohlcData()[20].x, y: 40 }] });

    const state = JSON.parse(JSON.stringify(inst.getState()));
    expect(state.version).toBe(2);
    expect(state.drawings).toHaveLength(2);

    const inst2 = makeInstance();
    inst2.render();
    inst2.setState(state);

    const restored = inst2.getDrawings();
    expect(restored).toHaveLength(2);
    expect(restored.map((r) => r.type).sort()).toEqual(["line", "rectangle"]);
  });

  it("emits drawing lifecycle events", () => {
    const events = [];
    inst.on("drawingAdded", (p) => events.push(["add", p.id]));
    inst.on("drawingRemoved", (p) => events.push(["remove", p.id]));
    const id = inst.addDrawing({ type: "horizontalLine", points: [{ y: 5 }] });
    inst.removeDrawing(id);
    expect(events).toEqual([["add", id], ["remove", id]]);
  });

  it("destroy() tears down cleanly with drawings present", () => {
    inst.addDrawing({ type: "horizontalLine", points: [{ y: 10 }] });
    expect(() => inst.destroy()).not.toThrow();
  });
});
