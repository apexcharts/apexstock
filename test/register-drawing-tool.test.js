// @vitest-environment jsdom
//
// Public custom drawing-tool registry: ApexStock.registerDrawingTool() lets a
// consumer add a new data-space drawing type that plugs into addDrawing(),
// renders via its own render(data, helpers), and round-trips through
// getState()/setState() like a built-in.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import ApexStock from "../src/ApexStock.js";
import {
  registerDrawingTool,
  getDrawingTool,
  hasDrawingTool,
  listDrawingTools,
  isBuiltinDrawingType,
} from "../src/tools/drawing/DrawingToolRegistry.js";

describe("DrawingToolRegistry (unit)", () => {
  it("registers a custom tool and rejects bad input / built-in collisions", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(registerDrawingTool("cross", { render: () => null })).toBe(true);
    expect(hasDrawingTool("cross")).toBe(true);
    expect(hasDrawingTool("CROSS")).toBe(true); // case-insensitive
    expect(getDrawingTool("cross").name).toBe("cross");
    expect(listDrawingTools()).toContain("cross");

    // Duplicate without overwrite is rejected; with overwrite it replaces.
    expect(registerDrawingTool("cross", { render: () => null })).toBe(false);
    expect(registerDrawingTool("cross", { render: () => null, overwrite: true })).toBe(true);

    // Invalid input and built-in collisions.
    expect(registerDrawingTool("", { render: () => null })).toBe(false);
    expect(registerDrawingTool("nofn", {})).toBe(false);
    expect(registerDrawingTool("line", { render: () => null })).toBe(false); // built-in
    expect(isBuiltinDrawingType("rectangle")).toBe(true);
    expect(isBuiltinDrawingType("cross")).toBe(false);
    warn.mockRestore();
  });
});

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

describe("ApexStock.registerDrawingTool (integration)", () => {
  beforeEach(() => installApexChartsMock());
  afterEach(() => {
    document.body.innerHTML = "";
    delete global.ApexCharts;
  });

  it("renders a custom drawing via addDrawing and passes projection helpers", () => {
    let sawHelpers = null;
    ApexStock.registerDrawingTool("marker-dot", {
      defaults: { radius: 6 },
      render(data, helpers) {
        sawHelpers = helpers;
        const p = helpers.dataToScreen(data.points[0].x, data.points[0].y);
        const c = document.createElementNS(helpers.svgNS, "circle");
        c.setAttribute("cx", p.x);
        c.setAttribute("cy", p.y);
        c.setAttribute("r", data.radius);
        c.setAttribute("fill", data.color);
        return c;
      },
      overwrite: true,
    });

    const inst = makeInstance();
    inst.render();
    const id = inst.addDrawing({
      type: "marker-dot",
      points: [{ x: ohlcData()[10].x, y: 42 }],
      color: "#f0f",
      note: "custom field",
    });

    expect(id).toBeTruthy();
    const drawing = inst.getDrawing(id);
    expect(drawing.type).toBe("marker-dot");
    expect(drawing.points[0].y).toBe(42);
    // Rendered as a <circle> on the overlay, and helpers were provided.
    expect(document.querySelectorAll(".apexstock-drawing-overlay circle").length).toBeGreaterThanOrEqual(1);
    expect(typeof sawHelpers.dataToScreen).toBe("function");
    expect(typeof sawHelpers.getChartBounds).toBe("function");

    // Tool defaults + arbitrary config fields survive on the stored record.
    const raw = inst.drawingTools.elements.find((e) => e.data.id === id).data;
    expect(raw.radius).toBe(6); // from defaults
    expect(raw.note).toBe("custom field"); // passed-through field
  });

  it("custom drawings round-trip through getState()/setState()", () => {
    ApexStock.registerDrawingTool("marker-dot", {
      defaults: { radius: 6 },
      render(data, helpers) {
        const p = helpers.dataToScreen(data.points[0].x, data.points[0].y);
        const c = document.createElementNS(helpers.svgNS, "circle");
        c.setAttribute("cx", p.x);
        c.setAttribute("cy", p.y);
        c.setAttribute("r", data.radius);
        return c;
      },
      overwrite: true,
    });

    const inst = makeInstance();
    inst.render();
    inst.addDrawing({ type: "marker-dot", points: [{ x: ohlcData()[5].x, y: 30 }] });
    const state = JSON.parse(JSON.stringify(inst.getState()));
    expect(state.drawings[0].type).toBe("marker-dot");
    expect(state.drawings[0].radius).toBe(6);

    const inst2 = makeInstance();
    inst2.render();
    inst2.setState(state);
    const restored = inst2.getDrawings();
    expect(restored).toHaveLength(1);
    expect(restored[0].type).toBe("marker-dot");
    // Re-rendered (the tool is still registered).
    expect(document.querySelectorAll(".apexstock-drawing-overlay circle").length).toBeGreaterThanOrEqual(1);
  });
});
