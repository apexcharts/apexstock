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
import { describe, it, expect } from "vitest";
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
