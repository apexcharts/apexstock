import { test, expect } from "@playwright/test";

// Trading overlays in a real browser: the price lines render as y-axis
// annotations on the main chart, survive a theme switch and a chart-type switch,
// and the update/remove API reflects in the DOM. No console errors.
const FIXTURE = "/apexstock/test/e2e/fixtures/trading-overlays.html";

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

// Count rendered y-axis annotation lines on the main chart.
function annoLines(page) {
  return page
    .locator("#chart .apexcharts-yaxis-annotations line")
    .count();
}

test.describe("trading overlays", () => {
  test("renders the five price lines with labels and no console errors", async ({
    page,
  }) => {
    const errors = await gotoFixture(page);

    expect(await annoLines(page)).toBeGreaterThanOrEqual(5);

    // Labels are drawn as text inside the annotation group.
    const labels = page.locator("#chart .apexcharts-yaxis-annotations text");
    const texts = await labels.allTextContents();
    const joined = texts.join(" | ");
    expect(joined).toContain("Buy");
    expect(joined).toContain("Sell");
    expect(joined).toContain("SL");
    expect(joined).toContain("TP");
    expect(joined).toContain("Alert");

    // The data model holds all five regardless of render clipping.
    const count = await page.evaluate(() => window.__chart.getPriceLines().length);
    expect(count).toBe(5);

    expect(errors).toEqual([]);
  });

  test("lines survive a theme switch", async ({ page }) => {
    await gotoFixture(page);
    await page.evaluate(() => window.__chart.update({ theme: { mode: "dark" } }));
    await page.waitForTimeout(150);
    // Re-applied (still drawn) and the model is intact.
    expect(await annoLines(page)).toBeGreaterThanOrEqual(5);
    expect(await page.evaluate(() => window.__chart.getPriceLines().length)).toBe(5);
  });

  test("lines survive a chart-type switch", async ({ page }) => {
    await gotoFixture(page);
    await page.locator(".apexstock-chart-type-trigger").click();
    await page.locator('.apexstock-chart-type-option[data-type="heikinashi"]').click();
    await expect(page.locator("#chart .apexcharts-svg").first()).toBeVisible();
    await page.waitForTimeout(200);
    // The annotations are re-applied after the switch (still drawn) and the model
    // is intact (some may clip if the Heikin-Ashi range narrows past a level).
    expect(await annoLines(page)).toBeGreaterThanOrEqual(1);
    expect(await page.evaluate(() => window.__chart.getPriceLines().length)).toBe(5);
  });

  test("update + remove reflect in the DOM", async ({ page }) => {
    await gotoFixture(page);
    const before = await annoLines(page);

    // Remove two lines.
    await page.evaluate(() => {
      window.__chart.removePriceLine("alert");
      window.__chart.removePriceLine("sl");
    });
    await page.waitForTimeout(120);
    expect(await annoLines(page)).toBe(before - 2);

    // Reprice the buy line; its auto/explicit label stays, value moves.
    await page.evaluate(() => window.__chart.updatePriceLine("buy", { price: 98 }));
    await page.waitForTimeout(120);
    expect(await annoLines(page)).toBe(before - 2); // still present, just moved

    // Clear everything.
    await page.evaluate(() => window.__chart.clearPriceLines());
    await page.waitForTimeout(120);
    expect(await annoLines(page)).toBe(0);
  });

  test("a draggable line reprices on drag and fires onMove", async ({ page }) => {
    await gotoFixture(page);
    const before = await page.evaluate(() => window.__priceOf("buy"));

    const strip = page.locator('.apexstock-trading-grab[data-line-id="buy"]');
    await expect(strip).toBeVisible();
    const box = await strip.boundingBox();
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    // Drag downward (y increases) -> lower price.
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx, cy + 60, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(120);

    const after = await page.evaluate(() => window.__priceOf("buy"));
    expect(after).toBeLessThan(before);

    const moved = await page.evaluate(() => window.__events.move);
    expect(moved).not.toBeNull();
    expect(moved.id).toBe("buy");
  });

  test("clicking a closable line's label removes it and fires onRemove", async ({
    page,
  }) => {
    await gotoFixture(page);
    const before = await annoLines(page);

    // The close affordance is a button in the interaction overlay.
    await page.locator('.apexstock-trading-close[data-line-id="alert"]').click();
    await page.waitForTimeout(150);

    expect(await annoLines(page)).toBe(before - 1);
    expect(await page.evaluate(() => window.__events.remove)).toEqual({
      id: "alert",
    });
    expect(await page.evaluate(() => window.__priceOf("alert"))).toBeNull();
  });
});
