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

  test("zoom buttons change the visible range on a timestamp axis", async ({
    page,
  }) => {
    // The fixture uses epoch-timestamp x (numeric axis) — the case that used to
    // make the zoom buttons no-op.
    const range = () =>
      page.evaluate(() => {
        const z = window.__chart.getCurrentZoomState();
        return z.maxX - z.minX;
      });

    const before = await range();
    await page.locator(".apexstock-zoom-in").click();
    await expect.poll(range).toBeLessThan(before); // zoomed in -> smaller range

    const zoomedIn = await range();
    await page.locator(".apexstock-zoom-out").click();
    await expect.poll(range).toBeGreaterThan(zoomedIn); // zoomed back out
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

test.describe("ApexStock consumer theming", () => {
  const THEMED = "/apexstock/test/e2e/fixtures/chart-themed.html";

  test("custom --apexstock-* token overrides reach the rendered toolbar", async ({
    page,
  }) => {
    await page.goto(THEMED);
    await page.waitForFunction(() => window.__ready === true, null, {
      timeout: 15000,
    });

    // The override recipe (no stylesheet fork) must win over the library's own
    // token declarations: the chart-type wrapper reads --apexstock-light-bg.
    const wrapper = page.locator(".apexstock-chart-type-wrapper");
    await expect(wrapper).toBeVisible();
    const bg = await wrapper.evaluate(
      (el) => getComputedStyle(el).backgroundColor
    );
    // --apexstock-light-bg was overridden to #fffdf7 == rgb(255, 253, 247).
    expect(bg).toBe("rgb(255, 253, 247)");

    // The active drawing tool's text/icon color reads the accent token,
    // overridden to amber rgb(217, 138, 9).
    const active = page.locator('.apexstock-drawing-tool[data-tool="line"]');
    await active.click();
    await expect(active).toHaveClass(/active/);
    // The color transitions (var(--apexstock-as-ease)) from text to accent;
    // poll until it settles on the overridden amber.
    await expect
      .poll(() => active.evaluate((el) => getComputedStyle(el).color))
      .toBe("rgb(217, 138, 9)");
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

  test("custom-themed toolbar matches the baseline", async ({ page }) => {
    await page.goto("/apexstock/test/e2e/fixtures/chart-themed.html");
    await page.waitForFunction(() => window.__ready === true, null, {
      timeout: 15000,
    });
    await expect(page.locator("#chart .apexcharts-svg")).toBeVisible();
    await expect(page.locator(".apexstock-toolbar")).toHaveScreenshot(
      "toolbar-themed.png"
    );
  });
});
