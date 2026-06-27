// @vitest-environment jsdom
//
// Trading overlays: horizontal price lines (order / stop-loss / take-profit /
// alert) rendered as y-axis annotations on the main chart. These pin the public
// API (add/update/remove/clear/get), the per-type color + label defaults, the
// annotation config shape handed to ApexCharts, and persistence (re-apply on
// update / theme change / destroy).
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
  const instances = [];
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
      updateSeries: vi.fn(),
      updateOptions: vi.fn(),
      addYaxisAnnotation: vi.fn(),
      removeAnnotation: vi.fn(),
      zoomX: vi.fn(),
    };
    instances.push(inst);
    return inst;
  });
  return instances;
}

function makeInstance(data = ohlcData()) {
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

/** The last annotation config passed to addYaxisAnnotation. */
function lastAnno(inst) {
  const calls = inst.chart.addYaxisAnnotation.mock.calls;
  return calls.length ? calls[calls.length - 1][0] : null;
}

describe("trading overlays — add + defaults", () => {
  beforeEach(() => installApexChartsMock());
  afterEach(() => {
    document.body.innerHTML = "";
    delete global.ApexCharts;
  });

  it("addPriceLine renders a y-axis annotation at the price and returns an id", () => {
    const inst = makeInstance();
    const id = inst.addPriceLine({ price: 105.5 });
    expect(typeof id).toBe("string");
    expect(inst.chart.addYaxisAnnotation).toHaveBeenCalledTimes(1);
    const a = lastAnno(inst);
    expect(a.id).toBe(id);
    expect(a.y).toBe(105.5);
    expect(a.label.text).toBe("105.5");
    expect(a.borderColor).toBeTruthy();
  });

  it("auto-generates sequential ids when none is given", () => {
    const inst = makeInstance();
    const a = inst.addPriceLine({ price: 100 });
    const b = inst.addPriceLine({ price: 101 });
    expect(a).toBe("tl-1");
    expect(b).toBe("tl-2");
  });

  it("order lines color by side (buy=green, sell=red)", () => {
    const inst = makeInstance();
    inst.addOrderLine({ price: 100, side: "buy" });
    const buy = lastAnno(inst);
    inst.addOrderLine({ price: 90, side: "sell" });
    const sell = lastAnno(inst);
    expect(buy.borderColor).toBe("#00B746");
    expect(buy.label.text).toBe("Buy 100");
    expect(sell.borderColor).toBe("#EF403C");
    expect(sell.label.text).toBe("Sell 90");
  });

  it("stop-loss / take-profit / alert carry their type defaults", () => {
    const inst = makeInstance();
    inst.addStopLoss({ price: 95 });
    const sl = lastAnno(inst);
    expect(sl.borderColor).toBe("#EF403C");
    expect(sl.strokeDashArray).toBe(4);
    expect(sl.label.text).toBe("SL 95");

    inst.addTakeProfit({ price: 120 });
    const tp = lastAnno(inst);
    expect(tp.borderColor).toBe("#00B746");
    expect(tp.label.text).toBe("TP 120");

    inst.addAlert({ price: 110 });
    const al = lastAnno(inst);
    expect(al.borderColor).toBe("#FF9900");
    expect(al.strokeDashArray).toBe(6);
    expect(al.label.text).toBe("Alert 110");
  });

  it("honors explicit color, label, width, dash, labelPosition", () => {
    const inst = makeInstance();
    inst.addPriceLine({
      price: 100,
      color: "#123456",
      label: "Entry",
      width: 3,
      strokeDashArray: 2,
      labelPosition: "left",
    });
    const a = lastAnno(inst);
    expect(a.borderColor).toBe("#123456");
    expect(a.label.text).toBe("Entry");
    expect(a.borderWidth).toBe(3);
    expect(a.strokeDashArray).toBe(2);
    expect(a.label.position).toBe("left");
    expect(a.label.textAnchor).toBe("start");
  });

  it("rejects a missing/non-finite price with a warning and no annotation", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const inst = makeInstance();
    expect(inst.addPriceLine({})).toBe(null);
    expect(inst.addPriceLine({ price: NaN })).toBe(null);
    expect(inst.addPriceLine({ price: "abc" })).toBe(null);
    expect(inst.chart.addYaxisAnnotation).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("trading overlays — update / remove / clear / get", () => {
  beforeEach(() => installApexChartsMock());
  afterEach(() => {
    document.body.innerHTML = "";
    delete global.ApexCharts;
  });

  it("adding an existing id replaces it (remove then re-add)", () => {
    const inst = makeInstance();
    inst.addPriceLine({ id: "x", price: 100 });
    inst.addPriceLine({ id: "x", price: 200 });
    expect(inst.chart.removeAnnotation).toHaveBeenCalledWith("x");
    expect(lastAnno(inst).y).toBe(200);
    expect(inst.getPriceLines()).toHaveLength(1);
  });

  it("updatePriceLine reprices and refreshes the auto label", () => {
    const inst = makeInstance();
    const id = inst.addStopLoss({ price: 95 });
    const ok = inst.updatePriceLine(id, { price: 90 });
    expect(ok).toBe(true);
    expect(inst.chart.removeAnnotation).toHaveBeenCalledWith(id);
    const a = lastAnno(inst);
    expect(a.y).toBe(90);
    expect(a.label.text).toBe("SL 90"); // auto label tracked the new price
  });

  it("updatePriceLine keeps a custom label when the patch omits one", () => {
    const inst = makeInstance();
    const id = inst.addPriceLine({ price: 100, label: "Entry" });
    inst.updatePriceLine(id, { price: 105 });
    expect(lastAnno(inst).label.text).toBe("Entry");
    expect(lastAnno(inst).y).toBe(105);
  });

  it("updatePriceLine on a missing id warns and returns false", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const inst = makeInstance();
    expect(inst.updatePriceLine("nope", { price: 1 })).toBe(false);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("removePriceLine removes the annotation; missing id returns false", () => {
    const inst = makeInstance();
    const id = inst.addPriceLine({ price: 100 });
    expect(inst.removePriceLine(id)).toBe(true);
    expect(inst.chart.removeAnnotation).toHaveBeenCalledWith(id);
    expect(inst.getPriceLines()).toHaveLength(0);
    expect(inst.removePriceLine(id)).toBe(false);
  });

  it("clearPriceLines removes every line", () => {
    const inst = makeInstance();
    inst.addPriceLine({ price: 100 });
    inst.addPriceLine({ price: 101 });
    inst.addPriceLine({ price: 102 });
    inst.clearPriceLines();
    expect(inst.chart.removeAnnotation).toHaveBeenCalledTimes(3);
    expect(inst.getPriceLines()).toEqual([]);
  });

  it("get/getAll return copies that do not mutate internal state", () => {
    const inst = makeInstance();
    const id = inst.addPriceLine({ price: 100, meta: { orderId: 7 } });
    const copy = inst.getPriceLine(id);
    expect(copy.price).toBe(100);
    expect(copy.meta).toEqual({ orderId: 7 });
    copy.price = 999;
    expect(inst.getPriceLine(id).price).toBe(100); // unchanged
  });
});

describe("trading overlays — persistence + theming", () => {
  beforeEach(() => installApexChartsMock());
  afterEach(() => {
    document.body.innerHTML = "";
    delete global.ApexCharts;
  });

  it("re-applies lines after a series update()", () => {
    const inst = makeInstance(ohlcData(60));
    inst.addStopLoss({ price: 95 });
    inst.chart.addYaxisAnnotation.mockClear();
    inst.chart.removeAnnotation.mockClear();

    inst.update({ series: [{ name: "Price", data: ohlcData(70) }] });

    // reapply: remove then re-add the line.
    expect(inst.chart.removeAnnotation).toHaveBeenCalledWith("tl-1");
    expect(inst.chart.addYaxisAnnotation).toHaveBeenCalled();
    expect(lastAnno(inst).id).toBe("tl-1");
  });

  it("recolors lines on a theme change", () => {
    const inst = makeInstance();
    inst.addOrderLine({ price: 100 }); // no side -> default "order" color
    expect(lastAnno(inst).borderColor).toBe("#0099FF"); // light order color

    inst.updateTheme("dark");
    expect(lastAnno(inst).borderColor).toBe("#64b5f6"); // dark order color
  });

  it("destroy removes all annotations and empties state", () => {
    const inst = makeInstance();
    inst.addPriceLine({ price: 100 });
    inst.addPriceLine({ price: 101 });
    inst.destroy();
    expect(inst.chart.removeAnnotation).toHaveBeenCalledTimes(2);
    expect(inst.getPriceLines()).toEqual([]);
  });

  it("lines added before render() are drawn on render()", () => {
    const parent = document.createElement("div");
    const container = document.createElement("div");
    parent.appendChild(container);
    document.body.appendChild(parent);
    const inst = new ApexStock(container, {
      chart: { height: 400 },
      theme: { mode: "light" },
      series: [{ name: "Price", data: ohlcData() }],
    });
    // Add before render.
    inst.addPriceLine({ id: "pre", price: 100 });
    inst.chart.addYaxisAnnotation.mockClear();
    inst.render();
    // render() reapplies, so the pre-render line is drawn.
    const ids = inst.chart.addYaxisAnnotation.mock.calls.map((c) => c[0].id);
    expect(ids).toContain("pre");
  });
});
