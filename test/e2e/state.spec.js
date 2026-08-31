import { test, expect } from "@playwright/test";

// State persistence in a real browser: getState() on a chart carrying
// annotations + a trading price line, then setState() on a second chart, draws
// those overlays on the target chart (portable, cross-instance).
const FIXTURE = "/test/e2e/fixtures/state.html";

async function gotoFixture(page) {
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(FIXTURE);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 20000 });
  await expect(page.locator("#chart-a .apexcharts-svg").first()).toBeVisible();
  await expect(page.locator("#chart-b .apexcharts-svg").first()).toBeVisible();
  return errors;
}

test.describe("state persistence", () => {
  test("getState captures annotations + price lines; setState restores them on another chart", async ({ page }) => {
    const errors = await gotoFixture(page);

    // Chart B starts with no annotations of its own.
    await expect(page.locator("#chart-b .apexcharts-yaxis-annotations line")).toHaveCount(0);

    // Capture A's state and assert the new v2 keys are populated.
    const state = await page.evaluate(() => window.__a.getState());
    expect(state.version).toBe(2);
    expect(state.annotations.length).toBe(2);
    expect(state.priceLines.length).toBe(1);
    // Callbacks are not serialized.
    expect(JSON.stringify(state.priceLines)).not.toContain("onCross");

    // Apply it to B.
    await page.evaluate((s) => window.__b.setState(s), state);
    await page.waitForTimeout(200);

    // B now shows the horizontal annotation + the price line (both y-axis
    // annotations) and the vertical (x-axis) annotation.
    const yLines = page.locator("#chart-b .apexcharts-yaxis-annotations line");
    await expect(yLines).toHaveCount(2);
    const xLines = page.locator("#chart-b .apexcharts-xaxis-annotations line");
    await expect(xLines).toHaveCount(1);

    // The model round-trips too.
    const restored = await page.evaluate(() => ({
      annotations: window.__b.getAnnotations().length,
      priceLines: window.__b.getPriceLines().length,
    }));
    expect(restored.annotations).toBe(2);
    expect(restored.priceLines).toBe(1);

    expect(errors).toEqual([]);
  });
});
