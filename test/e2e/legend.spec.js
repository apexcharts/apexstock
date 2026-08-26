import { test, expect } from "@playwright/test";

// On-chart data legend in a real browser: it shows the instrument name + OHLC,
// updates on hover, and lists a main-chart overlay indicator's value.
const FIXTURE = "/apexstock/test/e2e/fixtures/legend.html";

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

test.describe("data legend", () => {
  test("shows OHLC + an indicator row and tracks the crosshair", async ({ page }) => {
    const errors = await gotoFixture(page);

    const legend = page.locator("#chart .apexstock-legend");
    await expect(legend).toBeVisible();
    await expect(page.locator("#chart .apexstock-legend-title")).toHaveText("AAPL");

    // OHLC row is populated with numbers.
    await expect(page.locator("#chart .apexstock-legend-ohlc")).toContainText(/\d/);

    // The moving-average overlay produces one indicator row.
    await expect(
      page.locator("#chart .apexstock-legend-indicators > div")
    ).toHaveCount(1);

    // Drive a crosshair to a specific bar via the public event bus and assert the
    // readout reflects that bar's close (deterministic, no pointer geometry).
    const close5 = await page.evaluate(() => {
      window.__chart.emit("crosshairMove", { dataPointIndex: 5, seriesIndex: 0 });
      return window.__chart.series[5].y[3];
    });
    await expect(page.locator("#chart .apexstock-legend-ohlc")).toContainText(
      String(close5)
    );

    expect(errors).toEqual([]);
  });

  test("hideLegend removes the panel; showLegend brings it back", async ({ page }) => {
    await gotoFixture(page);
    const legend = page.locator("#chart .apexstock-legend");
    await expect(legend).toBeVisible();

    await page.evaluate(() => window.__chart.hideLegend());
    await expect(legend).toBeHidden();

    await page.evaluate(() => window.__chart.showLegend({ position: "top-right" }));
    await expect(page.locator("#chart .apexstock-legend-top-right")).toBeVisible();
  });
});
