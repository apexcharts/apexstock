// @vitest-environment jsdom
//
// Per-frame range tracking: the chrome ApexStock draws around the plot (the
// custom x-axis, the fibonacci pane, price-line handles, event markers, linked
// charts) has to follow a zoom gesture frame by frame, not wait for it to
// settle.
//
// Background: ApexCharts' `zoomed` callback is once-per-gesture by design (a
// wheel zoom defers it until 150ms after the last wheel event) while the plot
// itself re-renders every animation frame. Driving the chrome from `zoomed`
// alone therefore froze it for the whole gesture and snapped it into place
// afterwards. `updated` fires per frame, so it is the live signal; these tests
// pin the wiring, the "did the window actually move" guard that keeps it from
// reacting to every unrelated update, and the fact that the settled callback no
// longer repeats work the live path already did.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import ApexStock from "../src/ApexStock.js";
import EventManager from "../src/core/EventManager.js";

function ohlc(n = 40) {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({
      x: Date.UTC(2024, 0, i + 1),
      y: [100 + i, 101 + i, 99 + i, 100.5 + i],
      v: 1000 + i,
    });
  }
  return out;
}

/** A mock that records the chart-event handlers so a test can fire them. */
function installApexChartsMock() {
  const instances = [];
  global.ApexCharts = vi.fn(function (el, opts) {
    const priceLike =
      (opts && opts.series && opts.series[0] && opts.series[0].data) || [];
    const inst = {
      el,
      options: opts,
      handlers: {},
      w: {
        globals: {
          chartID: "chart",
          dataPoints: priceLike.length,
          minX: priceLike.length ? priceLike[0].x : 0,
          maxX: priceLike.length ? priceLike[priceLike.length - 1].x : 0,
          translateX: 10,
          translateY: 5,
          gridWidth: 200,
          gridHeight: 100,
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
      addEventListener: vi.fn(function (name, handler) {
        (inst.handlers[name] = inst.handlers[name] || []).push(handler);
      }),
      updateSeries: vi.fn(function (s) {
        inst.w.config.series = s;
      }),
      updateOptions: vi.fn(),
      removeAnnotation: vi.fn(),
      addYaxisAnnotation: vi.fn(),
      zoomX: vi.fn(),
    };
    instances.push(inst);
    return inst;
  });
  return instances;
}

const fire = (chart, name, payload) =>
  (chart.handlers[name] || []).forEach((h) => h(payload));

function makeInstance(data = ohlc()) {
  const parent = document.createElement("div");
  const container = document.createElement("div");
  parent.appendChild(container);
  document.body.appendChild(parent);
  return new ApexStock(container, {
    chart: { height: 500 },
    theme: { mode: "light" },
    series: [{ name: "Price", data }],
  });
}

/**
 * Construct without render(), then stand in for the parts of the chrome that
 * only exist after it. Keeps these tests on the tracking logic rather than on
 * DOM layout, which the Playwright spec covers in a real browser.
 */
function makeTracked(data = ohlc()) {
  const inst = makeInstance(data);
  inst.xaxis = { render: vi.fn() };
  inst.tradingInteractions = { sync: vi.fn() };
  inst._liveWindow = { min: inst.xaxisRange.min, max: inst.xaxisRange.max };
  inst._trackLiveRangeOn(inst.chart);
  return inst;
}

/** Move the mock's reported x-window, as a frame of a zoom gesture would. */
function setWindow(chart, min, max) {
  chart.w.globals.minX = min;
  chart.w.globals.maxX = max;
}

describe("live range tracking", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    installApexChartsMock();
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    document.body.innerHTML = "";
    delete global.ApexCharts;
  });

  it("render() subscribes to the main chart's per-frame `updated` event", () => {
    const inst = makeInstance();
    inst.render();
    expect(inst.chart.handlers.updated).toBeTruthy();
    expect(inst.chart.handlers.updated.length).toBeGreaterThan(0);
  });

  it("an `updated` whose window moved redraws the chrome and emits rangeChanging", () => {
    const inst = makeTracked();
    const seen = [];
    inst.on("rangeChanging", (p) => seen.push(p));

    const data = inst.series;
    setWindow(inst.chart, data[10].x, data[20].x);
    fire(inst.chart, "updated");

    expect(inst.xaxis.render).toHaveBeenCalledTimes(1);
    expect(inst.tradingInteractions.sync).toHaveBeenCalledTimes(1);
    expect(inst.xaxisRange).toEqual({ min: data[10].x, max: data[20].x });
    expect(seen).toEqual([
      { min: data[10].x, max: data[20].x, source: "live" },
    ]);
  });

  it("an `updated` that did not move the window is ignored", () => {
    // `updated` also fires for a new series, a theme rebuild, an append. None
    // of those should re-run the chrome.
    const inst = makeTracked();
    const seen = [];
    inst.on("rangeChanging", (p) => seen.push(p));

    fire(inst.chart, "updated");
    fire(inst.chart, "updated");
    expect(inst.xaxis.render).not.toHaveBeenCalled();
    expect(seen).toEqual([]);

    // ...and a repeat of a window already drawn is ignored too, so a gesture
    // costs one redraw per frame and not one per event.
    const data = inst.series;
    setWindow(inst.chart, data[5].x, data[15].x);
    fire(inst.chart, "updated");
    fire(inst.chart, "updated");
    expect(inst.xaxis.render).toHaveBeenCalledTimes(1);
    expect(seen).toHaveLength(1);
  });

  it("emits rangeChanging once per moved frame across a gesture", () => {
    const inst = makeTracked();
    const seen = [];
    inst.on("rangeChanging", (p) => seen.push(p));
    const data = inst.series;

    for (let i = 0; i < 6; i++) {
      setWindow(inst.chart, data[i].x, data[30 - i].x);
      fire(inst.chart, "updated");
    }

    expect(seen).toHaveLength(6);
    expect(inst.xaxis.render).toHaveBeenCalledTimes(6);
    expect(seen[5]).toEqual({
      min: data[5].x,
      max: data[25].x,
      source: "live",
    });
  });

  it("the settled zoom callback does not redraw a window the live path drew", () => {
    const inst = makeTracked();
    const data = inst.series;
    const settled = [];
    inst.on("rangeChange", (p) => settled.push(p));

    setWindow(inst.chart, data[10].x, data[20].x);
    fire(inst.chart, "updated");
    expect(inst.xaxis.render).toHaveBeenCalledTimes(1);

    // ApexCharts' end-of-gesture callback, reporting the same window.
    inst.handleZoom(inst.chart, {
      xaxis: { min: data[10].x, max: data[20].x },
    });

    // No second redraw of an identical window...
    expect(inst.xaxis.render).toHaveBeenCalledTimes(1);
    // ...but the public settled event still fires, once, as before.
    expect(settled).toEqual([
      { min: data[10].x, max: data[20].x, source: "zoom" },
    ]);
  });

  it("the settled callback still redraws a gesture that had no live frames", () => {
    // A programmatic setVisibleRange, a toolbar zoom, or a reset can land the
    // settled callback with no per-frame updates before it.
    const inst = makeTracked();
    const data = inst.series;

    inst.handleZoom(inst.chart, {
      xaxis: { min: data[3].x, max: data[9].x },
    });

    expect(inst.xaxis.render).toHaveBeenCalledTimes(1);
    expect(inst.xaxisRange).toEqual({ min: data[3].x, max: data[9].x });
  });

  it("the settled pan callback behaves the same way", () => {
    const inst = makeTracked();
    const data = inst.series;
    const settled = [];
    inst.on("rangeChange", (p) => settled.push(p));

    inst.handleScroll(inst.chart, {
      xaxis: { min: data[4].x, max: data[12].x },
    });
    expect(inst.xaxis.render).toHaveBeenCalledTimes(1);
    expect(settled).toEqual([
      { min: data[4].x, max: data[12].x, source: "pan" },
    ]);

    // Same window again: nothing left to draw.
    inst.handleScroll(inst.chart, {
      xaxis: { min: data[4].x, max: data[12].x },
    });
    expect(inst.xaxis.render).toHaveBeenCalledTimes(1);
    expect(settled).toHaveLength(2);
  });

  it("several panes tracking one window change redraw the chrome once", () => {
    // A wheel gesture over a pane zooms the whole group, so every pane's
    // `updated` fires. The window is read from the main chart, so the extra
    // panes must cost a comparison and not a redraw each.
    const inst = makeTracked();
    const data = inst.series;
    const panes = [1, 2].map(() => {
      const pane = {
        handlers: {},
        addEventListener: (n, h) => {
          (pane.handlers[n] = pane.handlers[n] || []).push(h);
        },
      };
      inst._trackLiveRangeOn(pane);
      return pane;
    });

    setWindow(inst.chart, data[8].x, data[18].x);
    fire(panes[0], "updated");
    fire(panes[1], "updated");
    fire(inst.chart, "updated");

    expect(inst.xaxis.render).toHaveBeenCalledTimes(1);
  });

  it("ignores a window that is not finite or not increasing", () => {
    const inst = makeTracked();
    setWindow(inst.chart, NaN, NaN);
    fire(inst.chart, "updated");
    setWindow(inst.chart, 500, 500);
    fire(inst.chart, "updated");
    setWindow(inst.chart, 900, 100);
    fire(inst.chart, "updated");
    expect(inst.xaxis.render).not.toHaveBeenCalled();
  });

  it("stops tracking once destroyed", () => {
    const inst = makeTracked();
    const data = inst.series;
    // destroy() releases inst.chart, so hold the instance the listener is on.
    const chart = inst.chart;
    const xaxis = inst.xaxis;
    inst.destroy();
    setWindow(chart, data[2].x, data[7].x);
    expect(() => fire(chart, "updated")).not.toThrow();
    expect(xaxis.render).not.toHaveBeenCalled();
  });

  it("survives a chart without the ApexCharts event API", () => {
    const inst = makeTracked();
    expect(() => inst._trackLiveRangeOn({})).not.toThrow();
    expect(() => inst._trackLiveRangeOn(null)).not.toThrow();
  });

  it("skips building the rangeChanging payload when nothing is subscribed", () => {
    const inst = makeTracked();
    const emit = vi.spyOn(inst._emitter, "emit");
    const data = inst.series;
    setWindow(inst.chart, data[1].x, data[9].x);
    fire(inst.chart, "updated");
    // The chrome still tracks; only the (per-frame) emission is skipped.
    expect(inst.xaxis.render).toHaveBeenCalledTimes(1);
    expect(emit).not.toHaveBeenCalledWith("rangeChanging", expect.anything());
  });
});

describe("drawing overlay reposition scheduling", () => {
  let frames;
  let rafSpy;

  beforeEach(() => {
    frames = [];
    rafSpy = vi
      .spyOn(global, "requestAnimationFrame")
      .mockImplementation((cb) => frames.push(cb));
    vi.spyOn(global, "cancelAnimationFrame").mockImplementation((id) => {
      frames[id - 1] = null;
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const flushFrame = () => frames.splice(0).forEach((cb) => cb && cb());

  function makeManager() {
    const chart = {
      handlers: {},
      addEventListener(name, handler) {
        (this.handlers[name] = this.handlers[name] || []).push(handler);
      },
    };
    const chartDiv = document.createElement("div");
    const svgOverlay = document.createElement("div");
    const redraw = vi.fn();
    const sync = vi.fn();
    const mgr = new EventManager(
      chart,
      chartDiv,
      svgOverlay,
      vi.fn(),
      vi.fn(),
      vi.fn(),
      vi.fn(),
      vi.fn(),
      redraw,
      sync
    );
    return { mgr, chart, redraw, sync };
  }

  it("coalesces a gesture's `updated` events into one redraw per frame", () => {
    // The plot emits `updated` once per animation frame while a wheel zoom is
    // in progress. This used to queue a 300ms timer per event, so the drawings
    // both redrew once per frame and landed well after the geometry they read.
    const { chart, redraw, sync } = makeManager();

    for (let i = 0; i < 12; i++) fire(chart, "updated");
    expect(redraw).not.toHaveBeenCalled(); // nothing synchronous
    expect(rafSpy).toHaveBeenCalledTimes(1); // ...and only one frame booked

    flushFrame();
    expect(redraw).toHaveBeenCalledTimes(1);
    expect(sync).toHaveBeenCalledTimes(1);

    // The next frame's events schedule again.
    fire(chart, "updated");
    flushFrame();
    expect(redraw).toHaveBeenCalledTimes(2);
  });

  it("redraws synchronously on the settled zoom/pan callbacks", () => {
    const { chart, redraw } = makeManager();
    fire(chart, "zoomed");
    expect(redraw).toHaveBeenCalledTimes(1);
    fire(chart, "scrolled");
    expect(redraw).toHaveBeenCalledTimes(2);
  });

  it("drops a pending reposition on destroy", () => {
    const { mgr, chart, redraw } = makeManager();
    fire(chart, "updated");
    mgr.destroy();
    flushFrame();
    expect(redraw).not.toHaveBeenCalled();
  });
});
