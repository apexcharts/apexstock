// @vitest-environment jsdom
//
// Cross-chart synchronization (ChartSync + ApexStock.sync): zoom/pan mirrors
// across linked instances (with echo suppression so there is no feedback loop),
// and a crosshair on one draws/hides a guide on the others. Real-browser
// zoom propagation is covered by the Playwright smoke.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import ApexStock from "../src/ApexStock.js";

function installApexChartsMock() {
  global.ApexCharts = vi.fn(function (el, opts) {
    const inst = {
      el,
      options: opts,
      w: {
        globals: {
          chartID: "chart",
          dataPoints: 100,
          minX: 0, maxX: 100, minY: 0, maxY: 100,
          translateX: 10, translateY: 5, gridWidth: 200, gridHeight: 100,
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

function ohlc(n = 100) {
  return Array.from({ length: n }, (_, i) => ({ x: i, y: [10, 12, 9, 11], v: 100 }));
}

function makeInstance() {
  const parent = document.createElement("div");
  const container = document.createElement("div");
  parent.appendChild(container);
  document.body.appendChild(parent);
  return new ApexStock(container, {
    chart: { height: 300 },
    theme: { mode: "light" },
    series: [{ name: "Price", data: ohlc() }],
  });
}

describe("ApexStock.sync — zoom/pan", () => {
  let a, b, c, handle;
  beforeEach(() => {
    installApexChartsMock();
    a = makeInstance();
    b = makeInstance();
    c = makeInstance();
  });
  afterEach(() => {
    if (handle) handle.disconnect();
    handle = null;
    document.body.innerHTML = "";
    delete global.ApexCharts;
  });

  it("mirrors the per-frame rangeChanging signal, so linked charts track a gesture", () => {
    // ApexCharts reports a wheel zoom's `zoomed` only once the gesture settles,
    // so syncing on `rangeChange` alone left the linked charts still until the
    // scroll stopped and then jumped them. `rangeChanging` fires per frame.
    handle = ApexStock.sync([a, b]);
    a.emit("rangeChanging", { min: 10, max: 50, source: "live" });
    expect(b.chart.zoomX).toHaveBeenCalledWith(10, 50);

    a.emit("rangeChanging", { min: 12, max: 48, source: "live" });
    expect(b.chart.zoomX).toHaveBeenLastCalledWith(12, 48);
    expect(b.chart.zoomX).toHaveBeenCalledTimes(2);
  });

  it("suppresses the settled echo of a window already pushed live", () => {
    // The live frames and the settled callback report the same final window;
    // the target must not be re-zoomed to a range it is already showing.
    handle = ApexStock.sync([a, b]);
    a.emit("rangeChanging", { min: 10, max: 50, source: "live" });
    expect(b.chart.zoomX).toHaveBeenCalledTimes(1);
    a.emit("rangeChange", { min: 10, max: 50, source: "zoom" });
    expect(b.chart.zoomX).toHaveBeenCalledTimes(1);
  });

  it("mirrors a range change to the other instances, not the source", () => {
    handle = ApexStock.sync([a, b, c]);
    a.emit("rangeChange", { min: 10, max: 50, source: "zoom" });
    expect(b.chart.zoomX).toHaveBeenCalledWith(10, 50);
    expect(c.chart.zoomX).toHaveBeenCalledWith(10, 50);
    expect(a.chart.zoomX).not.toHaveBeenCalled(); // source is not re-zoomed
  });

  it("suppresses the echo so there is no feedback loop", () => {
    handle = ApexStock.sync([a, b]);
    a.emit("rangeChange", { min: 10, max: 50, source: "zoom" });
    expect(b.chart.zoomX).toHaveBeenCalledTimes(1);
    a.chart.zoomX.mockClear();
    b.chart.zoomX.mockClear();

    // b reports the very range we just pushed to it -> must be ignored.
    b.emit("rangeChange", { min: 10, max: 50, source: "zoom" });
    expect(a.chart.zoomX).not.toHaveBeenCalled();
  });

  it("still propagates a genuinely new range from any instance", () => {
    handle = ApexStock.sync([a, b]);
    a.emit("rangeChange", { min: 10, max: 50, source: "zoom" });
    a.chart.zoomX.mockClear();
    b.chart.zoomX.mockClear();

    b.emit("rangeChange", { min: 20, max: 60, source: "pan" });
    expect(a.chart.zoomX).toHaveBeenCalledWith(20, 60);
  });

  it("zoom:false disables range mirroring", () => {
    handle = ApexStock.sync([a, b], { zoom: false, crosshair: false });
    a.emit("rangeChange", { min: 10, max: 50, source: "zoom" });
    expect(b.chart.zoomX).not.toHaveBeenCalled();
  });

  it("disconnect() stops all propagation", () => {
    handle = ApexStock.sync([a, b]);
    handle.disconnect();
    a.emit("rangeChange", { min: 10, max: 50, source: "zoom" });
    expect(b.chart.zoomX).not.toHaveBeenCalled();
  });

  it("warns and no-ops with fewer than two instances", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = ApexStock.sync([a]);
    a.emit("rangeChange", { min: 1, max: 2, source: "zoom" });
    expect(b.chart.zoomX).not.toHaveBeenCalled();
    expect(() => h.disconnect()).not.toThrow();
    warn.mockRestore();
  });
});

describe("ApexStock.sync — crosshair guide", () => {
  let a, b, handle;
  beforeEach(() => {
    installApexChartsMock();
    a = makeInstance();
    b = makeInstance();
  });
  afterEach(() => {
    if (handle) handle.disconnect();
    handle = null;
    document.body.innerHTML = "";
    delete global.ApexCharts;
  });

  const guideOf = (inst) =>
    inst.chartEl.querySelector(".apexstock-sync-crosshair");

  it("draws a guide on the others at the crosshair x, then hides it", () => {
    handle = ApexStock.sync([a, b]);
    // x = 50 -> px = translateX(10) + (50/100)*gridWidth(200) = 110.
    a.emit("crosshairMove", { x: 50, dataPointIndex: 50, seriesIndex: 0 });
    const guide = guideOf(b);
    expect(guide).toBeTruthy();
    expect(guide.style.display).toBe("block");
    expect(guide.style.left).toBe("110px");
    expect(guide.style.height).toBe("100px");
    // Source chart does not get a guide.
    expect(guideOf(a)).toBeNull();

    // Pointer moves off a candle (x null) -> guide hides.
    a.emit("crosshairMove", { x: null, dataPointIndex: -1, seriesIndex: 0 });
    expect(guideOf(b).style.display).toBe("none");
  });

  it("hides the guide when x is outside the target's visible range", () => {
    handle = ApexStock.sync([a, b]);
    a.emit("crosshairMove", { x: 50, dataPointIndex: 50 });
    expect(guideOf(b).style.display).toBe("block");
    // Shrink b's visible domain so x=50 is off-grid.
    b.chart.w.globals.minX = 60;
    b.chart.w.globals.maxX = 90;
    a.emit("crosshairMove", { x: 50, dataPointIndex: 50 });
    expect(guideOf(b).style.display).toBe("none");
  });

  it("crosshair:false draws no guide", () => {
    handle = ApexStock.sync([a, b], { crosshair: false });
    a.emit("crosshairMove", { x: 50, dataPointIndex: 50 });
    expect(guideOf(b)).toBeNull();
  });

  it("disconnect() removes the guide element", () => {
    handle = ApexStock.sync([a, b]);
    a.emit("crosshairMove", { x: 50, dataPointIndex: 50 });
    expect(guideOf(b)).toBeTruthy();
    handle.disconnect();
    expect(guideOf(b)).toBeNull();
  });
});
