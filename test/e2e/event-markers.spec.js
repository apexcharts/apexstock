import { test, expect } from "@playwright/test";

// Event markers in a real browser: time-anchored badges render over the plot,
// reproject on zoom (and hide when their x scrolls off the visible grid), and
// show a hover card with the marker's label.
const FIXTURE = "/test/e2e/fixtures/event-markers.html";

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
  await expect(page.locator("#chart .apexcharts-svg").first()).toBeVisible();
  return errors;
}

test.describe("event markers", () => {
  test("render as badges over the plot and reproject / hide on zoom", async ({ page }) => {
    const errors = await gotoFixture(page);

    const badges = page.locator("#chart .apexstock-event-marker");
    await expect(badges).toHaveCount(2);

    const midId = await page.evaluate(() => window.__midId);
    const mid = page.locator(`#chart [data-marker-id="${midId}"]`);
    await expect(mid).toBeVisible();

    const before = await mid.evaluate((el) => parseFloat(el.style.left));

    // Zoom to a window that contains the mid marker (day 40) but excludes the
    // end marker (day 100).
    await page.evaluate((r) => window.__chart.setVisibleRange(r.min, r.max), {
      min: at(10),
      max: at(60),
    });
    await page.waitForTimeout(300);

    // Mid marker stays visible but moves right (narrower window spreads it out).
    await expect(mid).toBeVisible();
    const after = await mid.evaluate((el) => parseFloat(el.style.left));
    expect(after).toBeGreaterThan(before);

    // The end marker is now off the visible grid and hidden.
    const hiddenCount = await badges.evaluateAll(
      (els) => els.filter((el) => el.style.display === "none").length
    );
    expect(hiddenCount).toBe(1);

    // Reset the range: both markers are on-grid and visible again.
    await page.evaluate((r) => window.__chart.setVisibleRange(r.min, r.max), {
      min: at(0),
      max: at(119),
    });
    await page.waitForTimeout(300);
    const shownCount = await badges.evaluateAll(
      (els) => els.filter((el) => el.style.display !== "none").length
    );
    expect(shownCount).toBe(2);

    expect(errors).toEqual([]);
  });

  test("hovering a marker shows a card with its label", async ({ page }) => {
    await gotoFixture(page);

    const midId = await page.evaluate(() => window.__midId);
    const mid = page.locator(`#chart [data-marker-id="${midId}"]`);
    await mid.hover();

    const card = page.locator("#chart .apexstock-event-marker-card");
    await expect(card).toBeVisible();
    await expect(
      card.locator(".apexstock-event-marker-card-title")
    ).toHaveText("Q2 earnings");

    // Moving away hides the card.
    const box = await page.locator("#chart .apexcharts-svg").first().boundingBox();
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await page.waitForTimeout(50);
    await expect(card).toBeHidden();
  });
});
