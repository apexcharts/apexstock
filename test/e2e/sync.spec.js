import { test, expect } from "@playwright/test";

// Cross-chart sync in a real browser: zooming one chart mirrors the visible
// range to the linked one, and a crosshair on one draws a guide on the other.
const FIXTURE = "/apexstock/test/e2e/fixtures/sync.html";

const BASE = Date.UTC(2024, 0, 1);
const DAY = 86400000;
const at = (i) => BASE + i * DAY;

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

test.describe("cross-chart sync", () => {
  test("zooming one chart mirrors the visible range to the other", async ({ page }) => {
    const errors = await gotoFixture(page);

    await page.evaluate((r) => window.__a.setVisibleRange(r.min, r.max), {
      min: at(30),
      max: at(80),
    });
    await page.waitForTimeout(300); // let the zoomed event + sync settle

    const b = await page.evaluate(() => window.__b.getVisibleRange());
    const span = at(80) - at(30);
    expect(Math.abs(b.min - at(30))).toBeLessThan(span * 0.02);
    expect(Math.abs(b.max - at(80))).toBeLessThan(span * 0.02);

    // No runaway feedback: the ranges settle equal, not drifting.
    const a = await page.evaluate(() => window.__a.getVisibleRange());
    expect(Math.abs(a.min - b.min)).toBeLessThan(span * 0.02);
    expect(Math.abs(a.max - b.max)).toBeLessThan(span * 0.02);

    expect(errors).toEqual([]);
  });

  test("a crosshair on one chart draws a guide on the other", async ({ page }) => {
    await gotoFixture(page);

    const box = await page.locator("#chart-a .apexcharts-svg").first().boundingBox();
    // Sweep the pointer across chart A's plot to trigger crosshairMove.
    for (let f = 0.4; f <= 0.6; f += 0.05) {
      await page.mouse.move(box.x + box.width * f, box.y + box.height * 0.5);
    }

    const guide = page.locator("#chart-b .apexstock-sync-crosshair");
    await expect(guide).toHaveCount(1);
    // Visible and positioned within chart B.
    const shown = await guide.evaluate(
      (el) => el.style.display !== "none" && parseFloat(el.style.left) > 0
    );
    expect(shown).toBe(true);

    // Leaving chart A hides the guide.
    await page.mouse.move(box.x - 40, box.y - 40);
    await page.waitForTimeout(50);
    const hidden = await guide.evaluate((el) => el.style.display === "none");
    expect(hidden).toBe(true);
  });
});
