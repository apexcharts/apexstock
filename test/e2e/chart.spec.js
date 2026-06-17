import { test, expect } from "@playwright/test";

const FIXTURE = "/apexstock/test/e2e/fixtures/chart.html";

// Wait until the fixture signals the first SVG has painted.
async function gotoChart(page) {
  await page.goto(FIXTURE);
  await page.waitForFunction(() => window.__ready === true, null, {
    timeout: 15000,
  });
  // The candlestick paths exist once ApexCharts has rendered.
  await expect(page.locator("#chart .apexcharts-svg")).toBeVisible();
}

test.describe("ApexStock toolbar + chart", () => {
  test.beforeEach(async ({ page }) => {
    await gotoChart(page);
  });

  test("renders the toolbar with all control groups", async ({ page }) => {
    const toolbar = page.locator(".apexstock-toolbar");
    await expect(toolbar).toBeVisible();

    // Drawing tools, indicator dropdown, chart-type dropdown, export button.
    await expect(
      page.locator(".apexstock-drawing-tool").first()
    ).toBeVisible();
    await expect(page.locator(".apexstock-custom-select-trigger")).toBeVisible();
    await expect(page.locator(".apexstock-chart-type-trigger")).toBeVisible();
    await expect(page.locator(".apexstock-export-btn")).toBeVisible();
  });

  test("renders candlestick bodies for the data", async ({ page }) => {
    // ApexCharts draws candle bodies as <path> elements in the series group.
    const candles = page.locator("#chart .apexcharts-candlestick-series path");
    expect(await candles.count()).toBeGreaterThan(10);
  });

  test("switches chart type via the dropdown", async ({ page }) => {
    await page.locator(".apexstock-chart-type-trigger").click();
    const heikin = page.locator(
      '.apexstock-chart-type-option[data-type="heikinashi"]'
    );
    await expect(heikin).toBeVisible();
    await heikin.click();

    // The selected option becomes active and the chart re-renders (svg present).
    await expect(
      page.locator('.apexstock-chart-type-option[data-type="heikinashi"]')
    ).toHaveClass(/active/);
    await expect(page.locator("#chart .apexcharts-svg")).toBeVisible();
  });

  test("draws a trendline on the overlay", async ({ page }) => {
    // Activate the line (trendline) tool.
    await page.locator('.apexstock-drawing-tool[data-tool="line"]').click();

    const overlay = page.locator(".apexstock-drawing-overlay");
    await expect(overlay).toBeVisible();
    const box = await overlay.boundingBox();
    expect(box).not.toBeNull();

    // Drag diagonally across the middle of the chart to draw a line.
    const x1 = box.x + box.width * 0.3;
    const y1 = box.y + box.height * 0.6;
    const x2 = box.x + box.width * 0.7;
    const y2 = box.y + box.height * 0.35;

    await page.mouse.move(x1, y1);
    await page.mouse.down();
    // Several steps so the (rAF-throttled) draw handler runs mid-drag.
    await page.mouse.move((x1 + x2) / 2, (y1 + y2) / 2, { steps: 5 });
    await page.mouse.move(x2, y2, { steps: 5 });
    await page.mouse.up();

    // A committed drawing carries a data-element-id in the overlay.
    await expect(
      page.locator(".apexstock-drawing-overlay [data-element-id]").first()
    ).toBeVisible({ timeout: 5000 });
  });
});

test.describe("ApexStock visual regression", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 960, height: 600 });
    await gotoChart(page);
  });

  test("toolbar matches the baseline", async ({ page }) => {
    await expect(page.locator(".apexstock-toolbar")).toHaveScreenshot(
      "toolbar.png"
    );
  });

  test("chart matches the baseline", async ({ page }) => {
    await expect(page.locator("#chart-container")).toHaveScreenshot(
      "chart.png"
    );
  });
});
