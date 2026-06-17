import { describe, it, expect, vi } from "vitest";
import ApexStock from "../src/ApexStock.js";
import ZoomControls from "../src/components/ZoomControls.js";

// Regression coverage for the zoom-button + custom-x-axis fix. Both must work on
// a numeric/datetime axis (min/max are epoch-ms timestamps, e.g. from
// aggregated/time-series data) AND a category axis (min/max are 1-based data
// indices). The earlier code conflated the two — clamping a timestamp range to
// `dataPoints` (an index count) made the buttons no-op, and always doing an
// index lookup on a numeric axis froze the x-axis labels on scroll/zoom.

describe("ApexStock.resolveXToTimestamp (axis-agnostic x bound -> timestamp)", () => {
  const resolve = (ctx, val, fb) =>
    ApexStock.prototype.resolveXToTimestamp.call(null, ctx, val, fb);

  const ts = [1704067200000, 1704153600000, 1704240000000]; // 3 daily points
  const ctx = { w: { config: { series: [{ data: ts.map((x) => ({ x })) }] } } };

  it("treats a small bound as a 1-based category index (data lookup)", () => {
    expect(resolve(ctx, 1, 0)).toBe(ts[0]);
    expect(resolve(ctx, 2, 0)).toBe(ts[1]);
    expect(resolve(ctx, 3, 0)).toBe(ts[2]);
  });

  it("treats a large bound as an already-resolved timestamp (numeric axis)", () => {
    expect(resolve(ctx, 1704153600000, 0)).toBe(1704153600000);
    // a timestamp slightly outside the data span (zoomed past the edge) passes
    // through untouched rather than being misread as an index
    expect(resolve(ctx, 1709999999999, 0)).toBe(1709999999999);
  });

  it("returns the fallback for a NaN/non-number bound or a missing index", () => {
    expect(resolve(ctx, NaN, 42)).toBe(42);
    expect(resolve(ctx, undefined, 42)).toBe(42);
    expect(resolve(ctx, 4, 42)).toBe(42); // index 3 (val-1) is out of range
  });
});

describe("ZoomControls zoom math (value-space, no index/timestamp conflation)", () => {
  function makeControls(zoomState, globals = {}) {
    const inst = Object.create(ZoomControls.prototype);
    inst.chart = { zoomX: vi.fn(), w: { globals } };
    inst.context = {
      getCurrentZoomState: () => zoomState,
      applyZoomToAllCharts: vi.fn(),
    };
    return inst;
  }

  it("zooms in by shrinking the range 25% toward the center (index axis)", () => {
    const c = makeControls({ minX: 0, maxX: 100 });
    c.zoomIn();
    // padding = (100 * 0.25) / 2 = 12.5
    expect(c.chart.zoomX).toHaveBeenCalledWith(12.5, 87.5);
    expect(c.context.applyZoomToAllCharts).toHaveBeenCalledWith({
      minX: 12.5,
      maxX: 87.5,
    });
  });

  it("zooms in correctly on a timestamp range (no dataPoints clamp)", () => {
    const c = makeControls({ minX: 1704067200000, maxX: 1709164800000 });
    c.zoomIn();
    // range 5.0976e9, padding 6.372e8 -> [1704704400000, 1708527600000]
    expect(c.chart.zoomX).toHaveBeenCalledWith(1704704400000, 1708527600000);
  });

  it("zooms out, clamped to the chart's full extent (initialMinX/Max)", () => {
    const c = makeControls(
      { minX: 25, maxX: 75 },
      { initialMinX: 0, initialMaxX: 100 }
    );
    c.zoomOut();
    // padding = (50 * 0.25) / 2 = 6.25 -> [18.75, 81.25], within [0,100]
    expect(c.chart.zoomX).toHaveBeenCalledWith(18.75, 81.25);
  });

  it("does not zoom out beyond the full data extent", () => {
    const c = makeControls(
      { minX: 5, maxX: 95 },
      { initialMinX: 0, initialMaxX: 100 }
    );
    c.zoomOut();
    // padding 11.25 -> [-6.25, 106.25] clamped to [0, 100]
    expect(c.chart.zoomX).toHaveBeenCalledWith(0, 100);
  });

  it("no-ops on a zero/invalid range instead of producing NaN", () => {
    const c = makeControls({ minX: 50, maxX: 50 });
    c.zoomIn();
    expect(c.chart.zoomX).not.toHaveBeenCalled();
  });
});
