import { test, expect } from "@playwright/test";

// Theme presets in a real browser: a preset drives the candlestick colors in the
// live chart config AND the `--apx-*` chrome tokens on the container (through the
// multi-class token cascade), it clears back to a plain mode, and it round-trips
// through getState/setState.
const FIXTURE = "/apexstock/test/e2e/fixtures/theme-presets.html";

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

// The candlestick up/down colors the live ApexCharts config is using.
async function candleColors(page) {
  return page.evaluate(() => {
    const c = window.__chart.chart.w.config.plotOptions.candlestick.colors;
    return { up: c.upward, down: c.downward };
  });
}

test.describe("theme presets", () => {
  test("built-in pack is exposed", async ({ page }) => {
    await gotoFixture(page);
    const presets = await page.evaluate(() => window.__presets);
    for (const n of ["paper", "arctic", "mint", "linen", "rose", "graphite"]) {
      expect(presets).toContain(n);
    }
  });

  test("a preset drives candle colors and the container accent token", async ({ page }) => {
    const errors = await gotoFixture(page);

    // Default plain light: no --apx-accent inline token on the container.
    const before = await page.evaluate(() =>
      document.querySelector("#chart").style.getPropertyValue("--apx-accent")
    );
    expect(before).toBe("");

    await page.evaluate(() => window.__chart.setThemePreset("mint"));

    expect(await page.evaluate(() => window.__chart.getThemePreset())).toBe("mint");
    // The container now carries the preset's accent + surface tokens.
    const accent = await page.evaluate(() =>
      document.querySelector("#chart").style.getPropertyValue("--apx-accent")
    );
    expect(accent).toBe("#14b8a6");
    // And the live candles use the mint up/down (emerald / red).
    expect(await candleColors(page)).toEqual({ up: "#10b981", down: "#ef4444" });

    expect(errors).toEqual([]);
  });

  test("switching to a plain mode clears the preset tokens", async ({ page }) => {
    await gotoFixture(page);
    await page.evaluate(() => window.__chart.setThemePreset("rose"));
    expect(
      await page.evaluate(() =>
        document.querySelector("#chart").style.getPropertyValue("--apx-accent")
      )
    ).toBe("#be185d");

    await page.evaluate(() => window.__chart.updateTheme("dark"));
    expect(await page.evaluate(() => window.__chart.getThemePreset())).toBeNull();
    expect(await page.evaluate(() => window.__chart.getTheme())).toBe("dark");
    // Preset tokens removed; candles back to the dark mode defaults.
    expect(
      await page.evaluate(() =>
        document.querySelector("#chart").style.getPropertyValue("--apx-accent")
      )
    ).toBe("");
    expect(await candleColors(page)).toEqual({ up: "#26A69A", down: "#EF5350" });
  });

  test("registerTheme adds a usable custom preset", async ({ page }) => {
    const errors = await gotoFixture(page);
    await page.evaluate(() =>
      window.ApexStock.registerTheme("corp", { accent: "#0a3d62", up: "#2ecc71", down: "#e74c3c" })
    );
    await page.evaluate(() => window.__chart.setThemePreset("corp"));
    expect(await candleColors(page)).toEqual({ up: "#2ecc71", down: "#e74c3c" });
    expect(
      await page.evaluate(() =>
        document.querySelector("#chart").style.getPropertyValue("--apx-accent")
      )
    ).toBe("#0a3d62");
    expect(errors).toEqual([]);
  });

  test("the preset round-trips through getState/setState", async ({ page }) => {
    const errors = await gotoFixture(page);
    const state = await page.evaluate(() => {
      window.__chart.setThemePreset("graphite");
      return JSON.parse(JSON.stringify(window.__chart.getState()));
    });
    expect(state.theme).toMatchObject({ mode: "light", preset: "graphite" });

    // Reset, then restore.
    await page.evaluate(() => window.__chart.updateTheme("light"));
    expect(await page.evaluate(() => window.__chart.getThemePreset())).toBeNull();

    await page.evaluate((s) => window.__chart.setState(s), state);
    expect(await page.evaluate(() => window.__chart.getThemePreset())).toBe("graphite");
    expect(errors).toEqual([]);
  });
});
