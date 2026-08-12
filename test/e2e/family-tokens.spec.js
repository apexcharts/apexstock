import { test, expect } from "@playwright/test";

/**
 * The `--apx-*` family root tokens, checked in a real browser.
 *
 * The whole point of the contract is that custom properties inherit: a brand
 * declared once on `:root` has to reach tokens declared on
 * `[class^="apexstock-"]` deep inside the chart. That is a cascade property, so
 * it can only be verified with a real engine — jsdom resolves neither
 * inheritance nor stylesheets.
 */

const FIXTURE = "/apexstock/test/e2e/fixtures/chart.html";

async function gotoChart(page) {
  await page.goto(FIXTURE);
  await page.waitForFunction(() => window.__ready === true, null, {
    timeout: 15000,
  });
  await expect(page.locator("#chart .apexcharts-svg")).toBeVisible();
}

/** Resolved value of a custom property on the first ApexStock element. */
async function token(page, name) {
  return page.evaluate((prop) => {
    const el = document.querySelector('[class^="apexstock-"]');
    return el ? getComputedStyle(el).getPropertyValue(prop).trim() : "";
  }, name);
}

test.describe("Family tokens (--apx-*)", () => {
  test("a token declared on :root reaches the light palette", async ({
    page,
  }) => {
    await gotoChart(page);
    await page.addStyleTag({
      content: `:root {
        --apx-surface: rgb(250, 247, 255);
        --apx-fore: rgb(31, 41, 55);
        --apx-grid: rgb(228, 231, 236);
        --apx-accent: rgb(91, 33, 182);
      }`,
    });

    expect(await token(page, "--apexstock-light-bg")).toBe(
      "rgb(250, 247, 255)"
    );
    expect(await token(page, "--apexstock-light-text")).toBe("rgb(31, 41, 55)");
    expect(await token(page, "--apexstock-light-border")).toBe(
      "rgb(228, 231, 236)"
    );
    expect(await token(page, "--apexstock-light-divider")).toBe(
      "rgb(228, 231, 236)"
    );
    expect(await token(page, "--apexstock-blue")).toBe("rgb(91, 33, 182)");
  });

  test("the built-in defaults stand when no token is declared", async ({
    page,
  }) => {
    await gotoChart(page);

    expect(await token(page, "--apexstock-light-bg")).toBe("#ffffff");
    expect(await token(page, "--apexstock-light-text")).toBe("#1f2937");
    expect(await token(page, "--apexstock-blue")).toBe("#2563eb");
  });

  test("a value the host sets still beats the family token", async ({
    page,
  }) => {
    await gotoChart(page);
    await page.addStyleTag({
      content: `
        :root { --apx-surface: rgb(250, 247, 255); }
        .apexstock-theme-light [class^="apexstock-"],
        [class^="apexstock-"][class] { --apexstock-light-bg: rgb(255, 0, 0); }
      `,
    });

    expect(await token(page, "--apexstock-light-bg")).toBe("rgb(255, 0, 0)");
  });

  test("the dark palette is left alone, so it cannot be painted light", async ({
    page,
  }) => {
    await gotoChart(page);
    // A light brand surface plus dark mode is exactly the disagreement the dark
    // palette refuses to take part in.
    await page.addStyleTag({
      content: ":root { --apx-surface: rgb(255, 255, 255); }",
    });

    expect(await token(page, "--apexstock-dark-bg")).toBe("#1e242b");
    expect(await token(page, "--apexstock-dark-text")).toBe("#e6eaf0");
  });
});
