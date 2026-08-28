// @vitest-environment jsdom
//
// Event markers / timeline (EventMarkers manager): normalization of the public
// { x, type, ... } config, CRUD + events, HTML-overlay rendering + positioning
// from the chart's axis globals, lazy reproject wiring, hover card, and lossless
// serialization. Pixel reprojection across a real zoom is covered by the
// Playwright smoke, not here.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import EventMarkers from "../src/overlays/EventMarkers.js";

// A fake ApexStock ctx: a real (jsdom) chartEl for the overlay, axis globals for
// positioning, an emit spy, and an `on` that records handlers so we can drive a
// rangeChange and assert (de)activation.
function fakeCtx() {
  const emitted = [];
  const handlers = {};
  const chartEl = document.createElement("div");
  document.body.appendChild(chartEl);
  return {
    chartEl,
    chart: {
      w: {
        globals: {
          minX: 0,
          maxX: 100,
          translateX: 10,
          translateY: 5,
          gridWidth: 200,
          gridHeight: 100,
        },
      },
    },
    _emitter: { emit: (name, payload) => emitted.push({ name, payload }) },
    on(name, handler) {
      (handlers[name] = handlers[name] || []).push(handler);
      return () => {
        handlers[name] = (handlers[name] || []).filter((h) => h !== handler);
      };
    },
    _emitted: emitted,
    _handlers: handlers,
  };
}

const badges = (ctx) =>
  ctx.chartEl.querySelectorAll(".apexstock-event-marker");

describe("EventMarkers (manager unit)", () => {
  let ctx;
  let m;
  beforeEach(() => {
    ctx = fakeCtx();
    m = new EventMarkers(ctx);
  });
  afterEach(() => {
    m.destroy();
    ctx.chartEl.remove();
    vi.restoreAllMocks();
  });

  it("adds a marker: stores it, renders a badge, positions it, and emits", () => {
    const id = m.add({ x: 50, type: "earnings", label: "Q2 earnings" });
    expect(id).toBe("evt-1");
    expect(m.get(id)).toMatchObject({
      id: "evt-1",
      type: "earnings",
      x: 50,
      label: "Q2 earnings",
      glyph: "E", // type default
      color: "#f59e0b", // type default
      position: "bottom",
    });
    const els = badges(ctx);
    expect(els).toHaveLength(1);
    // x=50 -> translateX 10 + (50/100)*200 = 110px; bottom -> top+gridHeight.
    expect(els[0].style.left).toBe("110px");
    expect(els[0].style.top).toBe("105px");
    expect(els[0].style.display).toBe("block");
    expect(els[0].querySelector(".apexstock-event-marker-badge").textContent).toBe("E");
    expect(ctx._emitted[0].name).toBe("eventMarkerAdded");
    expect(ctx._emitted[0].payload.id).toBe("evt-1");
  });

  it("uses custom glyph/color/position over the type defaults", () => {
    m.add({ x: 25, type: "news", glyph: "!!", color: "#abcdef", position: "top" });
    const el = badges(ctx)[0];
    expect(el.querySelector(".apexstock-event-marker-badge").textContent).toBe("!!");
    expect(el.querySelector(".apexstock-event-marker-badge").style.background).toBe("rgb(171, 205, 239)");
    // top -> anchored at translateY.
    expect(el.style.top).toBe("5px");
  });

  it("falls back to the custom type for an unknown type", () => {
    const id = m.add({ x: 10, type: "not-a-type" });
    expect(m.get(id).type).toBe("custom");
    expect(m.get(id).glyph).toBe("•");
  });

  it("coerces a Date x to epoch ms", () => {
    const when = new Date("2020-06-01T00:00:00Z");
    const id = m.add({ x: when, type: "dividend" });
    expect(m.get(id).x).toBe(when.getTime());
  });

  it("rejects a config with no x (warns, returns null, no badge)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(m.add({ type: "earnings" })).toBeNull();
    expect(m.add(null)).toBeNull();
    expect(badges(ctx)).toHaveLength(0);
    expect(warn).toHaveBeenCalled();
  });

  it("hides a badge whose x is off the visible grid", () => {
    m.add({ x: 250, type: "split" }); // beyond maxX (100)
    expect(badges(ctx)[0].style.display).toBe("none");
  });

  it("subscribes to rangeChange lazily and reprojects on it", () => {
    expect(ctx._handlers.rangeChange || []).toHaveLength(0);
    m.add({ x: 50, type: "earnings" });
    expect(ctx._handlers.rangeChange).toHaveLength(1);

    // Zoom in so x=50 lands further right, then fire the range handler.
    ctx.chart.w.globals.minX = 40;
    ctx.chart.w.globals.maxX = 60;
    ctx._handlers.rangeChange[0]({ min: 40, max: 60, source: "zoom" });
    // x=50 -> 10 + ((50-40)/20)*200 = 110px still centered; move min to check.
    ctx.chart.w.globals.minX = 50;
    ctx.chart.w.globals.maxX = 60;
    ctx._handlers.rangeChange[0]({ min: 50, max: 60, source: "zoom" });
    // x=50 at the left edge -> 10 + 0 = 10px.
    expect(badges(ctx)[0].style.left).toBe("10px");
  });

  it("also tracks the per-frame rangeChanging signal", () => {
    // A wheel zoom re-renders the plot every frame but only reports `zoomed`
    // once it settles, so markers subscribed to `rangeChange` alone hung in
    // their old positions for the whole gesture. `rangeChanging` is the
    // per-frame signal; both are subscribed, since a programmatic
    // setVisibleRange produces only the settled one.
    m.add({ x: 50, type: "earnings" });
    expect(ctx._handlers.rangeChanging).toHaveLength(1);

    ctx.chart.w.globals.minX = 50;
    ctx.chart.w.globals.maxX = 60;
    ctx._handlers.rangeChanging[0]({ min: 50, max: 60, source: "live" });
    expect(badges(ctx)[0].style.left).toBe("10px");
  });

  it("unsubscribes both range signals when the last marker goes", () => {
    const id = m.add({ x: 50, type: "earnings" });
    expect(ctx._handlers.rangeChange).toHaveLength(1);
    expect(ctx._handlers.rangeChanging).toHaveLength(1);
    m.remove(id);
    expect(ctx._handlers.rangeChange).toHaveLength(0);
    expect(ctx._handlers.rangeChanging).toHaveLength(0);
  });

  it("updates a marker in place and emits eventMarkerUpdated", () => {
    const id = m.add({ x: 50, type: "earnings", label: "old" });
    ctx._emitted.length = 0;
    expect(m.update(id, { label: "new", color: "#111111" })).toBe(true);
    expect(m.get(id)).toMatchObject({ label: "new", color: "#111111" });
    expect(ctx._emitted[0].name).toBe("eventMarkerUpdated");
    // Still exactly one badge (replaced, not duplicated).
    expect(badges(ctx)).toHaveLength(1);
  });

  it("update on a missing id warns and returns false", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(m.update("nope", { label: "x" })).toBe(false);
    expect(warn).toHaveBeenCalled();
  });

  it("removes a marker, emits, and deactivates when the last one goes", () => {
    const a = m.add({ x: 20 });
    const b = m.add({ x: 40 });
    expect(ctx._handlers.rangeChange).toHaveLength(1);
    ctx._emitted.length = 0;

    expect(m.remove(a)).toBe(true);
    expect(ctx._emitted[0].name).toBe("eventMarkerRemoved");
    expect(badges(ctx)).toHaveLength(1);
    // Still active while one marker remains.
    expect(ctx._handlers.rangeChange).toHaveLength(1);

    m.remove(b);
    expect(badges(ctx)).toHaveLength(0);
    // Deactivated: the rangeChange handler was unsubscribed.
    expect(ctx._handlers.rangeChange).toHaveLength(0);
  });

  it("remove on a missing id returns false", () => {
    expect(m.remove("nope")).toBe(false);
  });

  it("clears all markers and emits eventMarkersCleared", () => {
    m.add({ x: 20 });
    m.add({ x: 40 });
    ctx._emitted.length = 0;
    m.clear();
    expect(badges(ctx)).toHaveLength(0);
    expect(m.getAll()).toHaveLength(0);
    expect(ctx._emitted.some((e) => e.name === "eventMarkersCleared")).toBe(true);
    expect(ctx._handlers.rangeChange).toHaveLength(0);
  });

  it("shows a hover card and emits hover/click on the badge", () => {
    const id = m.add({ x: 50, type: "earnings", label: "Q2 earnings" });
    ctx._emitted.length = 0;
    const el = badges(ctx)[0];

    el.dispatchEvent(new window.MouseEvent("mouseenter"));
    const card = ctx.chartEl.querySelector(".apexstock-event-marker-card");
    expect(card).not.toBeNull();
    expect(card.style.display).toBe("block");
    expect(card.querySelector(".apexstock-event-marker-card-title").textContent).toBe("Q2 earnings");
    expect(ctx._emitted.some((e) => e.name === "eventMarkerHover" && e.payload.id === id)).toBe(true);

    el.dispatchEvent(new window.MouseEvent("mouseleave"));
    expect(card.style.display).toBe("none");

    ctx._emitted.length = 0;
    el.dispatchEvent(new window.MouseEvent("click"));
    expect(ctx._emitted[0].name).toBe("eventMarkerClick");
    expect(ctx._emitted[0].payload.marker.label).toBe("Q2 earnings");
  });

  it("hover card title falls back to the capitalized type when unlabeled", () => {
    m.add({ x: 50, type: "dividend" });
    badges(ctx)[0].dispatchEvent(new window.MouseEvent("mouseenter"));
    const title = ctx.chartEl.querySelector(".apexstock-event-marker-card-title");
    expect(title.textContent).toBe("Dividend");
  });

  it("get returns null for a missing id; getAll returns fresh top-level copies", () => {
    m.add({ x: 10, type: "news", label: "orig" });
    expect(m.get("missing")).toBeNull();
    const all = m.getAll();
    expect(all).toHaveLength(1);
    all[0].label = "mutated";
    expect(m.get(all[0].id).label).toBe("orig"); // stored record untouched
  });

  it("_serialize / _restore round-trips losslessly", () => {
    m.add({ x: 10, type: "earnings", label: "A" });
    m.add({ x: 90, type: "news", glyph: "N", position: "top", meta: { k: 1 } });
    const snap = m._serialize();
    expect(snap).toHaveLength(2);

    const ctx2 = fakeCtx();
    const m2 = new EventMarkers(ctx2);
    m2._restore(snap);
    const back = m2.getAll();
    expect(back).toHaveLength(2);
    expect(back.map((x) => x.x).sort((a, b) => a - b)).toEqual([10, 90]);
    expect(back.find((x) => x.type === "news")).toMatchObject({
      glyph: "N",
      position: "top",
      meta: { k: 1 },
    });
    m2.destroy();
    ctx2.chartEl.remove();
  });

  it("destroy removes the layer + card and clears state", () => {
    m.add({ x: 50 });
    badges(ctx)[0].dispatchEvent(new window.MouseEvent("mouseenter"));
    m.destroy();
    expect(ctx.chartEl.querySelector(".apexstock-event-markers")).toBeNull();
    expect(ctx.chartEl.querySelector(".apexstock-event-marker-card")).toBeNull();
    expect(m.getAll()).toHaveLength(0);
  });
});
