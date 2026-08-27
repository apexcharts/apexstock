import { test, expect } from "@playwright/test";

// getDataAt(index) in a real browser: OHLC + volume + change from the series,
// plus overlay (moving average) and oscillator-pane (RSI) indicator values, and
// the intended pairing with the crosshairMove event's dataPointIndex.
const FIXTURE = "/apexstock/test/e2e/fixtures/data-readout.html";

async function gotoFixture(page) {
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(FIXTURE);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 20000 });
  await expect(page.locator("#chart .apexcharts-svg").first()).toBeVisible();
  return errors;
}

test.describe("data readout (getDataAt)", () => {
  test("returns OHLC/volume/change and indicator values at an index", async ({ page }) => {
    const errors = await gotoFixture(page);

    const { readout, bar, prevClose } = await page.evaluate(() => {
      const idx = 60;
      return {
        readout: window.__chart.getDataAt(idx),
        bar: window.__chart.series[idx],
        prevClose: window.__chart.series[idx - 1].y[3],
      };
    });

    expect(readout.index).toBe(60);
    expect(readout.x).toBe(bar.x);
    expect(readout.ohlc).toEqual({
      open: bar.y[0],
      high: bar.y[1],
      low: bar.y[2],
      close: bar.y[3],
    });
    expect(readout.volume).toBe(bar.v);
    expect(readout.change.absolute).toBeCloseTo(bar.y[3] - prevClose, 6);

    // A moving-average overlay (main pane) and RSI (its own pane) both report.
    const panes = readout.indicators.map((i) => i.pane);
    expect(panes).toContain("main");
    expect(readout.indicators.some((i) => i.pane === "rsi")).toBe(true);
    const rsi = readout.indicators.find((i) => i.pane === "rsi");
    expect(rsi.value).toBeGreaterThanOrEqual(0);
    expect(rsi.value).toBeLessThanOrEqual(100);

    expect(errors).toEqual([]);
  });

  test("defaults to the latest bar and clamps out-of-range indices", async ({ page }) => {
    await gotoFixture(page);
    const { def, last, clamped } = await page.evaluate(() => ({
      def: window.__chart.getDataAt(),
      last: window.__chart.series.length - 1,
      clamped: window.__chart.getDataAt(9999).index,
    }));
    expect(def.index).toBe(last);
    expect(clamped).toBe(last);
  });

  test("pairs with the crosshairMove event's dataPointIndex", async ({ page }) => {
    const errors = await gotoFixture(page);
    const value = await page.evaluate(() => {
      let captured = null;
      window.__chart.on("crosshairMove", (e) => {
        if (e.dataPointIndex < 0) return;
        captured = window.__chart.getDataAt(e.dataPointIndex);
      });
      window.__chart.emit("crosshairMove", { dataPointIndex: 42, seriesIndex: 0 });
      return captured;
    });
    expect(value.index).toBe(42);
    expect(Number.isFinite(value.ohlc.close)).toBe(true);
    expect(errors).toEqual([]);
  });
});
