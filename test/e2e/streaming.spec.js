import { test, expect } from "@playwright/test";

// Step 4 of appendData: real-browser live-loop verification. Drives appendData()
// against the actual ApexCharts core (not the jsdom mock): price + every active
// indicator track correctly, the oscillator pane is not recreated, there are zero
// console errors, and the incremental path is dramatically faster than the old
// update()-per-tick rebuild.
const FIXTURE = "/apexstock/test/e2e/fixtures/streaming.html";

async function gotoStreaming(page) {
  const errors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(String(err)));
  await page.goto(FIXTURE);
  await page.waitForFunction(() => window.__ready === true, null, {
    timeout: 20000,
  });
  await expect(page.locator("#chart .apexcharts-svg").first()).toBeVisible();
  return errors;
}

test.describe("appendData live loop", () => {
  test("appends 200 bars; price + indicators track, pane is not recreated", async ({
    page,
  }) => {
    const errors = await gotoStreaming(page);

    const before = await page.evaluate(() => window.__readState());
    expect(before.candleCount).toBe(before.seriesCount);

    const APPEND = 200;
    await page.evaluate((n) => window.__appendLoop(n), APPEND);

    const after = await page.evaluate(() => window.__readState());

    // Price grew by exactly the number of appended bars, and every indicator
    // series stayed aligned 1:1 with the candles.
    expect(after.seriesCount).toBe(before.seriesCount + APPEND);
    expect(after.candleCount).toBe(after.seriesCount);
    expect(after.maLen).toBe(after.candleCount);
    expect(after.bbLen).toBe(after.candleCount);
    expect(after.rsiLen).toBe(after.candleCount);

    // The last indicator values are real (finite), not NaN/undefined.
    expect(Number.isFinite(after.lastMA)).toBe(true);
    expect(Number.isFinite(after.lastRSI)).toBe(true);
    expect(after.lastRSI).toBeGreaterThanOrEqual(0);
    expect(after.lastRSI).toBeLessThanOrEqual(100);
    expect(Array.isArray(after.lastBB)).toBe(true);
    expect(Number.isFinite(after.lastBB[0])).toBe(true);
    expect(Number.isFinite(after.lastBB[1])).toBe(true);
    expect(after.lastBB[1]).toBeGreaterThanOrEqual(after.lastBB[0]);

    // The oscillator pane instance is the SAME object: no destroy/recreate.
    expect(after.rsiPaneSame).toBe(true);

    // The SVG is still present and healthy after the live loop.
    await expect(page.locator("#chart .apexcharts-svg").first()).toBeVisible();
    const candles = page.locator("#chart .apexcharts-candlestick-series path");
    expect(await candles.count()).toBeGreaterThan(10);

    expect(errors, "no console errors during the live loop").toEqual([]);
  });

  test("appendData is faster than update()-per-tick", async ({ page }) => {
    // update()-per-tick rebuilds the whole series + destroys/recreates the
    // oscillator pane every bar, so keep N modest and the timeout generous.
    test.setTimeout(90000);
    await gotoStreaming(page);

    const N = 15;
    const appendMs = await page.evaluate((n) => window.__appendLoop(n), N);
    const updateMs = await page.evaluate((n) => window.__updateLoop(n), N);

    // eslint-disable-next-line no-console
    console.log(
      `appendData ${N} bars: ${appendMs.toFixed(1)}ms ` +
        `(${(appendMs / N).toFixed(2)}ms/bar) vs ` +
        `update()-per-tick: ${updateMs.toFixed(1)}ms ` +
        `(${(updateMs / N).toFixed(2)}ms/bar) -> ` +
        `${(updateMs / appendMs).toFixed(1)}x faster`
    );

    // The incremental path must beat the full-rebuild baseline.
    expect(appendMs).toBeLessThan(updateMs);
  });
});
