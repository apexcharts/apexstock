import { test, expect } from "@playwright/test";

// The measurement flow in a real browser: a measurement renders as an anchored
// box with a multi-line readout, the analysis panel shows the region statistics,
// and both survive a zoom (the anchors are in data space, so the box must move
// with the bars rather than staying put in pixels).
const FIXTURE = "/test/e2e/fixtures/analysis.html";

async function gotoFixture(page) {
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(FIXTURE);
  await page.waitForFunction(() => window.__ready === true, null, {
    timeout: 20000,
  });
  await expect(page.locator("#chart .apexcharts-svg").first()).toBeVisible();
  return errors;
}

test.describe("analysis measurement", () => {
  test("measureRange draws an anchored box with a multi-line readout", async ({
    page,
  }) => {
    const errors = await gotoFixture(page);

    const stats = await page.evaluate(() => {
      const out = window.__chart.measureRange(0, 60);
      return { id: out.id, ...out.stats };
    });

    // Closes run 100 -> 160 over bars 0..60.
    expect(stats.bars).toBe(61);
    expect(stats.change.absolute).toBeCloseTo(60, 2);
    expect(stats.change.percent).toBeCloseTo(60, 2);
    expect(stats.calendarDays).toBeCloseTo(60, 6);

    // The box and its label rendered in the drawing overlay.
    const box = page
      .locator("#chart .apexstock-drawing-overlay g rect")
      .first();
    await expect(box).toBeVisible();
    const label = page
      .locator("#chart .apexstock-drawing-overlay g text")
      .first();
    await expect(label.locator("tspan")).toHaveCount(2);
    await expect(label).toContainText("bars");

    expect(errors).toEqual([]);
  });

  test("the analysis panel appears with the region statistics and goes away on clear", async ({
    page,
  }) => {
    const errors = await gotoFixture(page);

    await expect(page.locator("#chart .apexstock-analysis-panel")).toHaveCount(
      0
    );

    await page.evaluate(() => window.__chart.measureRange(60, 80));
    const panel = page.locator("#chart .apexstock-analysis-panel");
    await expect(panel).toBeVisible();

    // Bars 60..80 fall 160 -> 120: a 25% decline, and a pure drawdown.
    await expect(
      panel.locator('[data-metric="change"] .apexstock-analysis-metric-value')
    ).toHaveText("-40 (-25.00%)");
    await expect(
      panel.locator('[data-metric="duration"] .apexstock-analysis-metric-value')
    ).toHaveText("21 bars · 20d");
    await expect(
      panel.locator('[data-metric="drawdown"] .apexstock-analysis-metric-value')
    ).toContainText("-25.00%");
    await expect(
      panel.locator('[data-metric="recovery"] .apexstock-analysis-metric-value')
    ).toHaveText("not recovered");

    await page.evaluate(() => window.__chart.clearMeasurement());
    await expect(panel).toBeHidden();

    expect(errors).toEqual([]);
  });

  test("a measurement stays anchored to its bars through a zoom", async ({
    page,
  }) => {
    const errors = await gotoFixture(page);

    const before = await page.evaluate(() => {
      window.__chart.measureRange(20, 60);
      const r = document
        .querySelector("#chart .apexstock-drawing-overlay g rect")
        .getBoundingClientRect();
      return { x: r.x, width: r.width };
    });
    expect(before.width).toBeGreaterThan(0);

    // Zoom into a window that contains the measurement: the box must widen,
    // because it is anchored in data space, not pixels.
    const after = await page.evaluate(() => {
      const d = window.__data;
      window.__chart.setVisibleRange(d[10].x, d[70].x);
      return new Promise((resolve) => {
        setTimeout(() => {
          const r = document
            .querySelector("#chart .apexstock-drawing-overlay g rect")
            .getBoundingClientRect();
          resolve({ x: r.x, width: r.width });
        }, 400);
      });
    });

    expect(after.width).toBeGreaterThan(before.width * 1.3);

    // The statistics are unchanged: zooming changes the view, not the range.
    const stats = await page.evaluate(
      () => window.__chart.getMeasurements()[0].stats
    );
    expect(stats.bars).toBe(41);
    expect(stats.from.index).toBe(20);
    expect(stats.to.index).toBe(60);

    expect(errors).toEqual([]);
  });

  test("rangeMeasured fires once per measurement, and not on a zoom", async ({
    page,
  }) => {
    const errors = await gotoFixture(page);

    await page.evaluate(() => window.__chart.measureRange(0, 30));
    await expect
      .poll(() => page.evaluate(() => window.__events.length))
      .toBe(1);
    const first = await page.evaluate(() => window.__events[0]);
    expect(first.source).toBe("api");
    expect(first.bars).toBe(31);

    // A zoom redraws the measurement but does not change what it spans.
    await page.evaluate(() => {
      const d = window.__data;
      window.__chart.setVisibleRange(d[5].x, d[90].x);
    });
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => window.__events.length)).toBe(1);

    expect(errors).toEqual([]);
  });

  test("the drawdown pane renders below the price chart and shrinks it", async ({
    page,
  }) => {
    const errors = await gotoFixture(page);

    const before = await page.evaluate(() => ({
      panes: document.querySelectorAll("#chart [data-indicator]").length,
      mainHeight: document.querySelector("#chart .apexcharts-canvas")
        .clientHeight,
    }));
    expect(before.panes).toBe(0);

    await page.evaluate(() => window.__chart.updateIndicator("drawdown"));
    await page.waitForTimeout(500);

    const pane = page.locator('#chart [data-indicator="drawdown"]');
    await expect(pane).toBeVisible();
    // A real second ApexCharts instance, with an area series.
    await expect(pane.locator(".apexcharts-area-series").first()).toBeVisible();

    const after = await page.evaluate(() => {
      const p = document.querySelector('#chart [data-indicator="drawdown"]');
      return {
        panes: document.querySelectorAll("#chart [data-indicator]").length,
        mainHeight: document.querySelector("#chart .apexcharts-canvas")
          .clientHeight,
        paneHeight: p.clientHeight,
      };
    });
    expect(after.panes).toBe(1);
    // The price chart gave up room for the pane.
    expect(after.mainHeight).toBeLessThan(before.mainHeight);
    expect(after.paneHeight).toBeGreaterThan(0);

    // The deepest drawdown is labelled on the pane itself.
    await expect(
      pane.locator(".apexcharts-yaxis-annotation-label").first()
    ).toContainText("max -25");

    expect(errors).toEqual([]);
  });

  test("the drawdown pane shares one zoom with the price chart", async ({
    page,
  }) => {
    const errors = await gotoFixture(page);
    await page.evaluate(() => window.__chart.updateIndicator("drawdown"));
    await page.waitForTimeout(400);

    const ranges = await page.evaluate(() => {
      const d = window.__data;
      window.__chart.setVisibleRange(d[40].x, d[100].x);
      return new Promise((resolve) => {
        setTimeout(() => {
          const pane = window.__chart.indicatorChartMap.drawdown;
          resolve({
            main: [
              window.__chart.chart.w.globals.minX,
              window.__chart.chart.w.globals.maxX,
            ],
            pane: [pane.w.globals.minX, pane.w.globals.maxX],
            want: [d[40].x, d[100].x],
          });
        }, 500);
      });
    });
    // One shared x-window: the pane follows the price chart exactly.
    expect(ranges.pane).toEqual(ranges.main);
    expect(ranges.pane).toEqual(ranges.want);

    expect(errors).toEqual([]);
  });

  test("a taller drawdown pane takes room from the other panes", async ({
    page,
  }) => {
    const errors = await gotoFixture(page);

    const out = await page.evaluate(async () => {
      const chart = window.__chart;
      chart.updateIndicator("rsi");
      chart.updateIndicator("drawdown");
      const height = (key) =>
        document.querySelector(`#chart [data-indicator="${key}"]`).clientHeight;
      await new Promise((r) => setTimeout(r, 400));
      const dflt = { rsi: height("rsi"), dd: height("drawdown") };
      chart.setPaneHeightRatio("drawdown", 3);
      await new Promise((r) => setTimeout(r, 400));
      return { dflt, wide: { rsi: height("rsi"), dd: height("drawdown") } };
    });

    // The pane's own 1.4 default, then a 3:1 split.
    expect(out.dflt.dd).toBeGreaterThan(out.dflt.rsi);
    expect(out.wide.dd).toBeGreaterThan(out.dflt.dd);
    expect(out.wide.rsi).toBeLessThan(out.dflt.rsi);
    expect(out.wide.dd / out.wide.rsi).toBeGreaterThan(2.5);

    expect(errors).toEqual([]);
  });

  test("the drawdown pane round-trips through getState/setState", async ({
    page,
  }) => {
    const errors = await gotoFixture(page);

    const out = await page.evaluate(async () => {
      const chart = window.__chart;
      chart.updateIndicator("drawdown");
      chart.setPaneHeightRatio("drawdown", 2);
      await new Promise((r) => setTimeout(r, 300));
      const state = JSON.parse(JSON.stringify(chart.getState()));

      chart.updateIndicator("drawdown"); // toggle it off
      await new Promise((r) => setTimeout(r, 300));
      const gone = !document.querySelector(
        '#chart [data-indicator="drawdown"]'
      );

      chart.setState(state);
      await new Promise((r) => setTimeout(r, 500));
      return {
        gone,
        state: { indicators: state.indicators, panes: state.panes },
        back: !!document.querySelector('#chart [data-indicator="drawdown"]'),
        ratios: chart.getPaneHeightRatios(),
      };
    });

    expect(out.state.indicators).toEqual([
      { key: "drawdown", params: { basis: "close" } },
    ]);
    expect(out.state.panes).toEqual({ drawdown: { heightRatio: 2 } });
    expect(out.gone).toBe(true);
    expect(out.back).toBe(true);
    expect(out.ratios).toEqual({ drawdown: { heightRatio: 2 } });

    expect(errors).toEqual([]);
  });

  test("a measurement survives a state round-trip", async ({ page }) => {
    const errors = await gotoFixture(page);

    const restored = await page.evaluate(() => {
      const out = window.__chart.measureRange(10, 50);
      const state = JSON.parse(JSON.stringify(window.__chart.getState()));
      window.__chart.clearMeasurement();
      window.__chart.setState(state);
      const all = window.__chart.getMeasurements();
      return {
        count: all.length,
        id: all[0] && all[0].id,
        bars: all[0] && all[0].stats.bars,
        originalId: out.id,
      };
    });

    expect(restored.count).toBe(1);
    expect(restored.id).toBe(restored.originalId);
    expect(restored.bars).toBe(41);

    expect(errors).toEqual([]);
  });
});
