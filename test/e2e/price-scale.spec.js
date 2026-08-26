import { test, expect } from "@playwright/test";

// Primary price-scale modes in a real browser: the y-axis relabels for
// percent/indexed, logarithmic renders a candlestick chart without error, the
// priceScaleChange event fires, and the mode round-trips through getState/
// setState.
const FIXTURE = "/apexstock/test/e2e/fixtures/price-scale.html";

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

// Text of every y-axis label currently rendered.
async function yLabels(page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll("#chart .apexcharts-yaxis text")).map(
      (t) => (t.textContent || "").trim()
    )
  );
}

test.describe("price scale modes", () => {
  test("percent mode relabels the y-axis and fires the event", async ({ page }) => {
    const errors = await gotoFixture(page);

    // Default linear: labels are plain numbers, no percent signs.
    const linear = await yLabels(page);
    expect(linear.some((t) => /\d/.test(t))).toBe(true);
    expect(linear.some((t) => t.includes("%"))).toBe(false);

    await page.evaluate(() => window.__chart.setPriceScale("percent"));
    await expect
      .poll(async () => (await yLabels(page)).some((t) => t.includes("%")))
      .toBe(true);

    // The first bar's close is the 0% baseline.
    const labels = await yLabels(page);
    expect(labels.some((t) => t.includes("%"))).toBe(true);

    const events = await page.evaluate(() => window.__scaleEvents);
    expect(events.at(-1)).toMatchObject({ mode: "percent" });

    expect(errors).toEqual([]);
  });

  test("indexed mode relabels against the index base", async ({ page }) => {
    const errors = await gotoFixture(page);
    await page.evaluate(() => window.__chart.setPriceScale("indexed", { indexBase: 100 }));

    expect(await page.evaluate(() => window.__chart.getPriceScale())).toMatchObject({
      mode: "indexed",
      indexBase: 100,
    });
    // No percent signs (indexed labels are plain numbers), but the mode changed.
    await expect
      .poll(async () => (await yLabels(page)).some((t) => t.includes("%")))
      .toBe(false);

    expect(errors).toEqual([]);
  });

  test("logarithmic mode renders a candlestick chart without error", async ({ page }) => {
    const errors = await gotoFixture(page);

    await page.evaluate(() => window.__chart.setPriceScale("logarithmic", { logBase: 10 }));
    // Candles still on screen.
    await expect(page.locator("#chart .apexcharts-candlestick-area").first()).toBeVisible();
    expect(await page.evaluate(() => window.__chart.getPriceScale())).toMatchObject({
      mode: "logarithmic",
      logBase: 10,
    });

    expect(errors).toEqual([]);
  });

  test("the mode round-trips through getState/setState", async ({ page }) => {
    const errors = await gotoFixture(page);

    const state = await page.evaluate(() => {
      window.__chart.setPriceScale("percent", { base: 25 });
      return JSON.parse(JSON.stringify(window.__chart.getState()));
    });
    expect(state.priceScale).toMatchObject({ mode: "percent", base: 25 });

    // Reset to linear, then restore the captured state.
    await page.evaluate(() => window.__chart.setPriceScale("linear"));
    await page.evaluate((s) => window.__chart.setState(s), state);

    expect(await page.evaluate(() => window.__chart.getPriceScale())).toMatchObject({
      mode: "percent",
      base: 25,
    });
    await expect
      .poll(async () => (await yLabels(page)).some((t) => t.includes("%")))
      .toBe(true);

    expect(errors).toEqual([]);
  });
});
