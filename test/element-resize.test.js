// @vitest-environment jsdom
//
// Reshaping a two-anchor drawing. A measure box, trendline, ray or fib is a
// pair of data-space anchors; dragging its body translates both (which is what
// projects a measured move onto a later breakout), and dragging one of its
// handles moves that anchor alone, which is the only way to change what a
// measurement covers without deleting and redrawing it.
//
// The browser half (real clicks, real hit-testing against the style popup) is
// covered by test/e2e/measure.spec.js; this pins the geometry and the state
// machine.
import { describe, it, expect, beforeEach, vi } from "vitest";
import ElementInteractionManager from "../src/core/ElementInteractionManager.js";

const SVG_NS = "http://www.w3.org/2000/svg";

/** Identity-ish converter: data units are pixels, offset so it is not trivial. */
function converter() {
  return {
    dataToScreen: (x, y) => ({ x: x * 2 + 10, y: y * 3 + 5 }),
    screenDeltaToDataDelta: (dx, dy) => ({ x: dx / 2, y: dy / 3 }),
  };
}

function makeManager(elements) {
  const chartEl = document.createElement("div");
  document.body.appendChild(chartEl);
  const svgOverlay = document.createElementNS(SVG_NS, "svg");
  const drawingGroup = document.createElementNS(SVG_NS, "g");
  svgOverlay.appendChild(drawingGroup);
  chartEl.appendChild(svgOverlay);

  const redraw = vi.fn();
  const mgr = new ElementInteractionManager(
    chartEl,
    svgOverlay,
    drawingGroup,
    elements,
    redraw,
    converter()
  );
  return { mgr, redraw, drawingGroup };
}

/** One two-anchor drawing, with a rendered node the manager can bind to. */
function measureItem(overrides = {}) {
  const node = document.createElementNS(SVG_NS, "g");
  return {
    element: node,
    data: {
      id: "m1",
      type: "measure",
      x1: 10,
      y1: 20,
      x2: 50,
      y2: 60,
      ...overrides,
    },
  };
}

const handleState = (mgr) =>
  mgr.resizeHandles.map((h) => ({
    shown: h.style.display === "block",
    cx: Number(h.getAttribute("cx")),
    cy: Number(h.getAttribute("cy")),
  }));

describe("resize handles", () => {
  let item;
  let mgr;

  beforeEach(() => {
    document.body.innerHTML = "";
    item = measureItem();
    ({ mgr } = makeManager([item]));
  });

  it("shows nothing until something is selected", () => {
    expect(mgr.resizeHandles).toHaveLength(2);
    expect(handleState(mgr).every((h) => !h.shown)).toBe(true);
  });

  it("places one handle on each anchor of the selected drawing", () => {
    mgr.selectedElementId = "m1";
    mgr.refreshSelectionVisuals();

    expect(handleState(mgr)).toEqual([
      { shown: true, cx: 30, cy: 65 }, // (10,20) -> (10*2+10, 20*3+5)
      { shown: true, cx: 110, cy: 185 }, // (50,60)
    ]);
  });

  it("uses the geometry the element was drawn at, not the raw anchors", () => {
    // A measure box with `snap` on is drawn on the bar values, so the handles
    // have to sit on those or they float off the corners they are meant to grab.
    item.anchors = { x1: 12, y1: 22, x2: 48, y2: 58 };
    mgr.selectedElementId = "m1";
    mgr.refreshSelectionVisuals();

    expect(handleState(mgr)).toEqual([
      { shown: true, cx: 34, cy: 71 },
      { shown: true, cx: 106, cy: 179 },
    ]);
  });

  it("shows no handles for a locked drawing", () => {
    item.data.locked = true;
    mgr.selectedElementId = "m1";
    mgr.refreshSelectionVisuals();
    expect(handleState(mgr).every((h) => !h.shown)).toBe(true);
  });

  it("shows no handles for a type without an anchor pair", () => {
    item.data.type = "rectangle";
    mgr.selectedElementId = "m1";
    mgr.refreshSelectionVisuals();
    expect(handleState(mgr).every((h) => !h.shown)).toBe(true);
  });

  it("shows no handles for a hidden or deleted drawing", () => {
    item.element = null; // `visible: false` renders no node
    mgr.selectedElementId = "m1";
    mgr.refreshSelectionVisuals();
    expect(handleState(mgr).every((h) => !h.shown)).toBe(true);
    expect(mgr.selectedElement).toBeNull();
  });

  it("hides them again when the selection is cleared", () => {
    mgr.selectedElementId = "m1";
    mgr.refreshSelectionVisuals();
    mgr.clearSelection();
    expect(handleState(mgr).every((h) => !h.shown)).toBe(true);
  });
});

describe("reshaping vs translating", () => {
  let item;
  let mgr;

  beforeEach(() => {
    document.body.innerHTML = "";
    item = measureItem();
    ({ mgr } = makeManager([item]));
    mgr.selectedElementId = "m1";
    mgr.refreshSelectionVisuals();
    mgr.storeElementStartPosition(item.data);
  });

  it("moves only the first anchor when its handle is dragged", () => {
    mgr.resizeAnchor = 0;
    mgr.moveElement(item.data, 5, 7, 10, 21);
    expect(item.data).toMatchObject({ x1: 15, y1: 27, x2: 50, y2: 60 });
  });

  it("moves only the second anchor when its handle is dragged", () => {
    mgr.resizeAnchor = 1;
    mgr.moveElement(item.data, 5, 7, 10, 21);
    expect(item.data).toMatchObject({ x1: 10, y1: 20, x2: 55, y2: 67 });
  });

  it("moves both anchors when the body is dragged, preserving the span", () => {
    mgr.resizeAnchor = null;
    mgr.moveElement(item.data, 5, 7, 10, 21);
    expect(item.data).toMatchObject({ x1: 15, y1: 27, x2: 55, y2: 67 });
    expect(item.data.x2 - item.data.x1).toBe(40); // unchanged
  });

  it("enters and leaves resize mode around a handle drag", () => {
    const stop = vi.fn();
    const prevent = vi.fn();
    mgr.handleResizeMouseDown(1, {
      clientX: 100,
      clientY: 50,
      stopPropagation: stop,
      preventDefault: prevent,
    });
    expect(mgr.resizeAnchor).toBe(1);
    expect(mgr.isMoving).toBe(true);
    // The element's own mousedown must not also start a translate.
    expect(stop).toHaveBeenCalled();
    expect(prevent).toHaveBeenCalled();

    mgr.handleMouseUp({ stopPropagation: vi.fn() });
    expect(mgr.isMoving).toBe(false);
    expect(mgr.resizeAnchor).toBeNull();
  });

  it("refuses to start a resize on a locked drawing", () => {
    item.data.locked = true;
    mgr.handleResizeMouseDown(0, {
      clientX: 100,
      clientY: 50,
      stopPropagation: vi.fn(),
      preventDefault: vi.fn(),
    });
    expect(mgr.resizeAnchor).toBeNull();
    expect(mgr.isMoving).toBe(false);
  });
});

describe("selection across a redraw", () => {
  it("survives, so the handles do not vanish mid-gesture", () => {
    // redrawElements() rebuilds every node and re-binds listeners, which runs on
    // every zoom, pan and drag frame. Dropping the selection there made the
    // outline disappear whenever the chart moved, and would pull the handles
    // out from under the pointer during a resize.
    document.body.innerHTML = "";
    const item = measureItem();
    const { mgr } = makeManager([item]);

    mgr.selectedElementId = "m1";
    mgr.refreshSelectionVisuals();
    expect(handleState(mgr).every((h) => h.shown)).toBe(true);

    // A redraw: fresh node for the same drawing, then listeners re-bound.
    item.element = document.createElementNS(SVG_NS, "g");
    mgr.updateElementEventListeners();

    expect(mgr.selectedElementId).toBe("m1");
    expect(mgr.selectedElement).toBe(item.element); // re-bound, not stale
    expect(handleState(mgr).every((h) => h.shown)).toBe(true);
  });
});
