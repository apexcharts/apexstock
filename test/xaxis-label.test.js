// @vitest-environment jsdom
//
// The custom x-axis' crosshair label. ApexStock turns ApexCharts' own x-axis
// and its tooltip off and draws both itself, so the date under the cursor is
// formatted here.
//
// The format follows the DATA's bar spacing rather than the zoom level: minute
// bars are still minute bars when the view is zoomed out to a year, and a daily
// series has one timestamp per bar, so a time on it is noise. With bars stamped
// at UTC midnight and read in any other zone it was worse than noise: a bar
// that is simply March 5th was labelled "Mar 05, 2024 05:30".
import { describe, it, expect, afterEach } from "vitest";
import XAxis from "../src/components/XAxis.js";

const DAY = 24 * 60 * 60 * 1000;

/** `n` bars `stepMs` apart, in the shape the chart normalizes series into. */
function bars(n, stepMs, start = Date.UTC(2024, 0, 1)) {
  return Array.from({ length: n }, (_, i) => ({
    x: start + i * stepMs,
    y: [1, 2, 0, 1.5],
  }));
}

/**
 * An XAxis with just enough context for the format helpers. Built off the
 * prototype rather than through the constructor, which wires up DOM, listeners
 * and a ResizeObserver none of this needs.
 */
function axisOver(series) {
  const axis = Object.create(XAxis.prototype);
  axis.context = { series };
  return axis;
}

describe("XAxis.hasIntradayBars", () => {
  it("is false for daily bars", () => {
    expect(XAxis.hasIntradayBars(bars(30, DAY))).toBe(false);
  });

  it("is false for weekly and monthly bars", () => {
    expect(XAxis.hasIntradayBars(bars(30, 7 * DAY))).toBe(false);
    expect(XAxis.hasIntradayBars(bars(30, 30 * DAY))).toBe(false);
  });

  it("is true for hourly and minute bars", () => {
    expect(XAxis.hasIntradayBars(bars(30, 60 * 60 * 1000))).toBe(true);
    expect(XAxis.hasIntradayBars(bars(30, 60 * 1000))).toBe(true);
  });

  it("is true when only some gaps are intraday", () => {
    // A weekend gap makes most deltas larger; the SMALLEST one is the interval.
    const series = bars(10, 60 * 60 * 1000);
    series.push({ x: series[9].x + 3 * DAY, y: [1, 2, 0, 1.5] });
    expect(XAxis.hasIntradayBars(series)).toBe(true);
  });

  it("handles Date objects and date strings", () => {
    const asDates = bars(5, 60 * 60 * 1000).map((b) => ({
      ...b,
      x: new Date(b.x),
    }));
    expect(XAxis.hasIntradayBars(asDates)).toBe(true);

    const asStrings = bars(5, DAY).map((b) => ({
      ...b,
      x: new Date(b.x).toISOString(),
    }));
    expect(XAxis.hasIntradayBars(asStrings)).toBe(false);
  });

  it("says no when there is nothing to measure", () => {
    expect(XAxis.hasIntradayBars([])).toBe(false);
    expect(XAxis.hasIntradayBars(bars(1, DAY))).toBe(false);
    expect(XAxis.hasIntradayBars(null)).toBe(false);
    expect(XAxis.hasIntradayBars(undefined)).toBe(false);
  });

  it("ignores a zero or negative gap from a duplicated bar", () => {
    const series = bars(5, DAY);
    series.splice(2, 0, { ...series[2] }); // same timestamp twice
    expect(XAxis.hasIntradayBars(series)).toBe(false);
  });
});

describe("XAxis#crosshairFormat", () => {
  it("omits the time for daily bars", () => {
    expect(axisOver(bars(30, DAY)).crosshairFormat()).toBe("MMM DD, YYYY");
  });

  it("includes the time for intraday bars", () => {
    expect(axisOver(bars(30, 15 * 60 * 1000)).crosshairFormat()).toBe(
      "MMM DD, YYYY · HH:mm"
    );
  });

  it("re-decides when the series is replaced", () => {
    const axis = axisOver(bars(30, DAY));
    expect(axis.crosshairFormat()).toBe("MMM DD, YYYY");

    // Same length, different resolution: the cache key has to notice.
    axis.context.series = bars(30, 60 * 60 * 1000);
    expect(axis.crosshairFormat()).toBe("MMM DD, YYYY · HH:mm");
  });

  it("falls back to the date when there is no series", () => {
    expect(axisOver([]).crosshairFormat()).toBe("MMM DD, YYYY");
  });
});

describe("the formatted label", () => {
  const format = (series, x) => {
    const axis = axisOver(series);
    return axis.formatDate(new Date(x), axis.crosshairFormat());
  };

  it("prints a daily bar as a plain date", () => {
    // The bug this replaced: a UTC-midnight daily bar read in any other zone
    // picked up a spurious wall-clock time.
    const series = bars(30, DAY);
    expect(format(series, series[4].x)).toMatch(/^[A-Z][a-z]{2} \d{2}, \d{4}$/);
  });

  it("prints an intraday bar with its time", () => {
    const series = bars(30, 30 * 60 * 1000);
    expect(format(series, series[4].x)).toMatch(
      /^[A-Z][a-z]{2} \d{2}, \d{4} · \d{2}:\d{2}$/
    );
  });
});

/**
 * An axis with real elements carrying the geometry a browser would report, so
 * handleMouseMove's rect math runs for real.
 *
 * `gutter` is how far the plot area starts inside the widget, i.e. the width of
 * whatever ApexCharts drew to the left of the grid. `crosshairX` is the
 * crosshair's offset within that plot area, which is what its `x1` attribute
 * carries and what the chip used to be positioned by.
 */
function chipHarness({ gutter, crosshairX, stripWidth = 900, chipWidth = 80 }) {
  const STRIP_LEFT = 100; // the widget's own offset in the page
  const rectOf = (el, left, width) => {
    el.getBoundingClientRect = () => ({
      left,
      width,
      right: left + width,
      top: 0,
      bottom: 0,
      height: 0,
      x: left,
      y: 0,
    });
    return el;
  };

  // One chart at a time: getElementById would otherwise find an earlier
  // harness' element and read its crosshair.
  document.body.innerHTML = "";
  const chartEl = document.createElement("div");
  chartEl.id = "main-chart";
  const crosshair = rectOf(
    document.createElement("div"),
    STRIP_LEFT + gutter + crosshairX,
    0
  );
  crosshair.className = "apexcharts-xcrosshairs";
  // The plot-space coordinate ApexCharts publishes, and the value the chip was
  // positioned by before it accounted for the gutter.
  crosshair.setAttribute("x1", String(crosshairX));
  const inner = rectOf(
    document.createElement("div"),
    STRIP_LEFT + gutter,
    stripWidth - gutter
  );
  inner.className = "apexcharts-inner apexcharts-graphical";
  chartEl.appendChild(crosshair);
  chartEl.appendChild(inner);
  document.body.appendChild(chartEl);

  const axis = Object.create(XAxis.prototype);
  axis.axisElement = rectOf(
    document.createElement("div"),
    STRIP_LEFT,
    stripWidth
  );
  axis.tooltipElement = document.createElement("div");
  Object.defineProperty(axis.tooltipElement, "offsetWidth", {
    value: chipWidth,
  });
  axis.context = {
    xaxisRange: { min: 0, max: 1 },
    mainChartId: "main-chart",
    series: bars(30, DAY),
  };
  axis.findNearestDataPointIndex = () => 0;
  axis.getDataPointTimestamp = () => Date.UTC(2024, 0, 1);
  return axis;
}

/** The chip's `left`, in px, after one pointer move. */
function chipLeft(axis) {
  axis.handleMouseMove({ clientX: 0 });
  return parseFloat(axis.tooltipElement.style.left);
}

describe("the crosshair chip's position", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("sits on the crosshair when nothing is drawn left of the plot", () => {
    expect(chipLeft(chipHarness({ gutter: 0, crosshairX: 420 }))).toBe(420);
  });

  it("accounts for the gutter a left-hand y-axis occupies", () => {
    // The regression: the chip was placed at the crosshair's offset WITHIN the
    // plot, measured from the strip's own left edge, so it drifted left by the
    // whole gutter. A comparison chart stacks a percentage axis and a price
    // axis there, which is how this became 140px of visible error.
    expect(chipLeft(chipHarness({ gutter: 139, crosshairX: 420 }))).toBe(559);
  });

  it("keeps the chip inside the strip at either end", () => {
    // Half a chip from each edge, never hanging off it.
    expect(chipLeft(chipHarness({ gutter: 0, crosshairX: 4 }))).toBe(40);
    expect(chipLeft(chipHarness({ gutter: 0, crosshairX: 898 }))).toBe(860);
  });

  it("does not clamp a strip narrower than the chip into a negative offset", () => {
    const axis = chipHarness({ gutter: 0, crosshairX: 10, stripWidth: 50 });
    expect(chipLeft(axis)).toBe(10);
  });
});

describe("XAxis.buildTick", () => {
  it("builds a mark and a label carrying their own classes", () => {
    // The colors come from the stylesheet: ticks are only rebuilt on a render,
    // so an inline color left the labels in the old palette after a theme
    // switch until the next zoom or pan.
    const tick = XAxis.buildTick("Mar 05", "42%");
    expect(tick.className).toBe("apexstock-xaxis-tick");
    expect(tick.style.left).toBe("42%");

    const [mark, label] = tick.children;
    expect(mark.className).toBe("apexstock-xaxis-tick-mark");
    expect(label.className).toBe("apexstock-xaxis-tick-label");
    expect(label.textContent).toBe("Mar 05");
    // No inline color to go stale.
    expect(mark.style.backgroundColor).toBe("");
    expect(label.style.color).toBe("");
  });
});
