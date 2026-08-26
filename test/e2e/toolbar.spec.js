import { test, expect } from "@playwright/test";

// Toolbar customization in a real browser: config hides a built-in section and
// injects a custom button that fires its onClick, and the runtime API adds/
// removes items against the real, fully-populated toolbar.
const FIXTURE = "/apexstock/test/e2e/fixtures/toolbar.html";

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

test.describe("toolbar customization", () => {
  test("config hides a built-in section and injects a working custom button", async ({ page }) => {
    const errors = await gotoFixture(page);

    // The built-in download button is hidden; the chart-type switcher remains.
    await expect(page.locator(".apexstock-export-btn-container")).toBeHidden();
    await expect(page.locator(".apexstock-chart-type-wrapper")).toBeVisible();

    // The custom button rendered into the toolbar.
    const snap = page.locator('.apexstock-toolbar [data-toolbar-item="snapshot"]');
    await expect(snap).toBeVisible();

    // Clicking it fires onClick.
    await snap.click();
    await snap.click();
    expect(await page.evaluate(() => window.__snap)).toBe(2);

    expect(errors).toEqual([]);
  });

  test("addToolbarItem / removeToolbarItem work at runtime", async ({ page }) => {
    const errors = await gotoFixture(page);

    await page.evaluate(() =>
      window.__chart.addToolbarItem({ id: "reset", title: "Reset", position: "left-start" })
    );
    const reset = page.locator('.apexstock-toolbar [data-toolbar-item="reset"]');
    await expect(reset).toBeVisible();
    await expect(reset).toHaveText("Reset");

    // left-start prepends before the built-in left sections.
    const firstIsReset = await page.evaluate(
      () =>
        document
          .querySelector(".apexstock-toolbar-left")
          .firstElementChild.getAttribute("data-toolbar-item") === "reset"
    );
    expect(firstIsReset).toBe(true);

    // getToolbarItems reflects both the config item and the runtime one.
    const ids = await page.evaluate(() =>
      window.__chart.getToolbarItems().map((i) => i.id)
    );
    expect(ids).toContain("snapshot");
    expect(ids).toContain("reset");

    // Remove it.
    expect(await page.evaluate(() => window.__chart.removeToolbarItem("reset"))).toBe(true);
    await expect(reset).toHaveCount(0);

    expect(errors).toEqual([]);
  });
});
