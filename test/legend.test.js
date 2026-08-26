// @vitest-environment jsdom
//
// On-chart data legend (Legend component): OHLC + change + volume readout driven
// by the crosshairMove event (falling back to the latest bar), main-chart overlay
// indicator rows, lazy subscription, options, and lifecycle.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Legend from "../src/components/Legend.js";

// OHLC series where each bar's close climbs, so change vs the previous close is
// deterministic and positive.
function series() {
  return [
    { x: 1, y: [100, 105, 99, 102], v: 1_500_000 },
    { x: 2, y: [102, 108, 101, 106], v: 2_400_000 },
    { x: 3, y: [106, 110, 104, 104], v: 900_000 }, // close < open -> "down" color
  ];
}

function fakeCtx(overrides = {}) {
  const handlers = {};
  const chartEl = document.createElement("div");
  document.body.appendChild(chartEl);
  return {
    chartEl,
    isDarkTheme: false,
    series: series(),
    chartOptions: {
      series: [{ name: "AAPL" }],
      legend: overrides.legend || {},
    },
    chart: {
      w: {
        globals: {
          seriesNames: ["AAPL", "MA 20", "EMA 50"],
          series: [
            [102, 106, 104], // price (index 0, ignored by the legend)
            [101.5, 103.2, 104.1], // MA 20
            [100.0, 101.1, 102.2], // EMA 50
          ],
          colors: ["#000", "#7D57C2", "#FF9900"],
        },
      },
    },
    on(name, handler) {
      (handlers[name] = handlers[name] || []).push(handler);
      return () => {
        handlers[name] = (handlers[name] || []).filter((h) => h !== handler);
      };
    },
    _handlers: handlers,
    ...overrides.ctx,
  };
}

const panel = (ctx) => ctx.chartEl.querySelector(".apexstock-legend");
const txt = (ctx, sel) => {
  const el = ctx.chartEl.querySelector(sel);
  return el ? el.textContent : null;
};

describe("Legend (data window)", () => {
  let ctx;
  let lg;
  beforeEach(() => {
    ctx = fakeCtx();
    lg = new Legend(ctx);
  });
  afterEach(() => {
    lg.destroy();
    ctx.chartEl.remove();
    vi.restoreAllMocks();
  });

  it("show() renders the latest bar's OHLC + title and subscribes to crosshairMove", () => {
    expect(ctx._handlers.crosshairMove || []).toHaveLength(0);
    lg.show();
    expect(ctx._handlers.crosshairMove).toHaveLength(1);
    expect(panel(ctx)).not.toBeNull();

    // Latest bar is index 2: O106 H110 L104 C104.
    const ohlc = txt(ctx, ".apexstock-legend-ohlc");
    expect(ohlc).toContain("106");
    expect(ohlc).toContain("110");
    expect(ohlc).toContain("104");
    expect(txt(ctx, ".apexstock-legend-title")).toBe("AAPL");
  });

  it("updates to the hovered bar on crosshairMove", () => {
    lg.show();
    ctx._handlers.crosshairMove[0]({ dataPointIndex: 0 });
    // Bar 0: C102, change has no previous bar -> hidden.
    expect(txt(ctx, ".apexstock-legend-ohlc")).toContain("102");
    const chg = ctx.chartEl.querySelector(".apexstock-legend-change");
    expect(chg.style.display).toBe("none");
  });

  it("computes change vs the previous close and colors it", () => {
    lg.show();
    ctx._handlers.crosshairMove[0]({ dataPointIndex: 1 });
    // Bar 1 close 106, prev close 102 -> +4 (+3.92%), up color.
    const chg = ctx.chartEl.querySelector(".apexstock-legend-change");
    expect(chg.textContent).toContain("+4");
    expect(chg.textContent).toContain("3.92%");
    expect(chg.style.display).not.toBe("none");
    expect(chg.style.color).toBe("rgb(0, 183, 70)"); // light up color #00B746
  });

  it("formats volume compactly", () => {
    lg.show();
    ctx._handlers.crosshairMove[0]({ dataPointIndex: 1 });
    expect(txt(ctx, ".apexstock-legend-volume")).toBe("Vol 2.40M");
  });

  it("renders one row per finite main-chart overlay indicator", () => {
    lg.show();
    ctx._handlers.crosshairMove[0]({ dataPointIndex: 2 });
    const rows = ctx.chartEl.querySelectorAll(".apexstock-legend-indicators > div");
    expect(rows).toHaveLength(2); // MA 20 + EMA 50 (price series[0] is skipped)
    const text = ctx.chartEl.querySelector(".apexstock-legend-indicators").textContent;
    expect(text).toContain("MA 20");
    expect(text).toContain("104.1");
    expect(text).toContain("EMA 50");
    expect(text).toContain("102.2");
  });

  it("re-renders indicator rows when an indicator toggles after show()", () => {
    // Start with no overlays, then add one and fire indicatorToggle.
    ctx.chart.w.globals.seriesNames = ["AAPL"];
    ctx.chart.w.globals.series = [[102, 106, 104]];
    lg.show();
    expect(ctx.chartEl.querySelectorAll(".apexstock-legend-indicators > div")).toHaveLength(0);

    ctx.chart.w.globals.seriesNames = ["AAPL", "MA 20"];
    ctx.chart.w.globals.series = [[102, 106, 104], [101.5, 103.2, 104.1]];
    ctx._handlers.indicatorToggle[0]({ key: "moving average", active: true });
    expect(ctx.chartEl.querySelectorAll(".apexstock-legend-indicators > div")).toHaveLength(1);
  });

  it("skips indicator series with a non-finite value at the index", () => {
    ctx.chart.w.globals.series[1] = [101.5, null, NaN]; // MA 20 undefined at idx 2
    lg.show();
    ctx._handlers.crosshairMove[0]({ dataPointIndex: 2 });
    const rows = ctx.chartEl.querySelectorAll(".apexstock-legend-indicators > div");
    expect(rows).toHaveLength(1); // only EMA 50
  });

  it("honors showVolume/showChange/showIndicators = false", () => {
    lg.show({ showVolume: false, showChange: false, showIndicators: false });
    ctx._handlers.crosshairMove[0]({ dataPointIndex: 1 });
    expect(ctx.chartEl.querySelector(".apexstock-legend-volume").style.display).toBe("none");
    expect(ctx.chartEl.querySelector(".apexstock-legend-change").style.display).toBe("none");
    expect(ctx.chartEl.querySelectorAll(".apexstock-legend-indicators > div")).toHaveLength(0);
  });

  it("applies the position via a class + corner styles", () => {
    lg.show({ position: "bottom-right" });
    const el = panel(ctx);
    expect(el.className).toContain("apexstock-legend-bottom-right");
    expect(el.style.bottom).toBe("8px");
    expect(el.style.right).toBe("10px");
  });

  it("hide() unsubscribes and hides; toggle() flips; isVisible() reflects state", () => {
    lg.show();
    expect(lg.isVisible()).toBe(true);
    lg.hide();
    expect(lg.isVisible()).toBe(false);
    expect(ctx._handlers.crosshairMove).toHaveLength(0);
    expect(panel(ctx).style.display).toBe("none");

    expect(lg.toggle()).toBe(true); // shows
    expect(lg.isVisible()).toBe(true);
    expect(lg.toggle()).toBe(false); // hides
  });

  it("is enabled by options.legend.show and appears on reapply()", () => {
    const ctx2 = fakeCtx({ legend: { show: true, position: "top-right" } });
    const lg2 = new Legend(ctx2);
    expect(lg2.isVisible()).toBe(false); // not shown until reapply/render
    lg2.reapply();
    expect(lg2.isVisible()).toBe(true);
    expect(panel(ctx2).className).toContain("apexstock-legend-top-right");
    lg2.destroy();
    ctx2.chartEl.remove();
  });

  it("reapply() is a no-op when not enabled", () => {
    lg.reapply();
    expect(panel(ctx)).toBeNull();
    expect(ctx._handlers.crosshairMove || []).toHaveLength(0);
  });

  it("hides gracefully when the series is empty", () => {
    ctx.series = [];
    lg.show();
    expect(panel(ctx).style.display).toBe("none");
  });

  it("destroy() removes the panel and unsubscribes", () => {
    lg.show();
    lg.destroy();
    expect(panel(ctx)).toBeNull();
    expect(ctx._handlers.crosshairMove).toHaveLength(0);
  });
});
