import { test, expect } from "@playwright/test";

// The toolbar's per-mode colors and the font, which used to be generated per
// chart into one <style> in the document <head> (plan 34 K1). That style never
// reached a chart inside a shadow root, and each chart's render replaced the
// rules and the font of every other chart on the page. They are static rules
// in the stylesheet now, and the font is a per-chart custom property.
const FIXTURE = "/test/e2e/fixtures/theme-root.html";

async function gotoFixture(page, qs) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${FIXTURE}?${qs}`);
  await page.waitForFunction(() => window.__ready === true, null, {
    timeout: 20000,
  });
  return errors;
}

/** Computed toolbar and dropdown colors and fonts of chart `i`. */
const chrome = (page, i = 0) =>
  page.evaluate((i) => {
    const wrap = window.__root.getElementById("wrap" + i);
    const cs = (sel, prop) => {
      const el = wrap.querySelector(sel);
      return el ? getComputedStyle(el)[prop] : null;
    };
    return {
      selectBg: cs(".apexstock-custom-select-trigger", "backgroundColor"),
      selectColor: cs(".apexstock-custom-select-trigger", "color"),
      selectBorder: cs(".apexstock-custom-select-trigger", "borderTopColor"),
      optionColor: cs(".apexstock-custom-option", "color"),
      font: cs(".apexstock-custom-select-trigger", "fontFamily"),
      plotFont: cs(".apexstock-main-chart text", "fontFamily"),
    };
  }, i);

const LIGHT = {
  selectBg: "rgb(255, 255, 255)",
  selectColor: "rgb(51, 51, 51)",
  selectBorder: "rgb(206, 212, 218)",
  optionColor: "rgb(51, 51, 51)",
};
const DARK = {
  selectBg: "rgb(52, 58, 64)",
  selectColor: "rgb(248, 249, 250)",
  selectBorder: "rgb(73, 80, 87)",
  optionColor: "rgb(248, 249, 250)",
};

test.describe("Toolbar theme rules (K1)", () => {
  test("default: a single chart keeps its toolbar colors and font", async ({
    page,
  }) => {
    const errors = await gotoFixture(page, "charts=none");
    const c = await chrome(page);
    expect(c).toMatchObject(LIGHT);
    expect(c.font).toBe("Helvetica, Arial, sans-serif");
    expect(c.plotFont).toBe("Helvetica, Arial, sans-serif");
    // Nothing is generated into the document head any more.
    expect(
      await page.evaluate(
        () => !!document.getElementById("apexstock-theme-styles")
      )
    ).toBe(false);
    expect(errors).toEqual([]);
  });

  test("a light and a dark chart on one page keep their own colors", async ({
    page,
  }) => {
    await gotoFixture(page, "charts=dark,light");
    expect(await chrome(page, 0)).toMatchObject(DARK);
    expect(await chrome(page, 1)).toMatchObject(LIGHT);
  });

  test("each chart keeps its own chart.fontFamily", async ({ page }) => {
    await gotoFixture(
      page,
      "charts=none,none&extra=" +
        encodeURIComponent(JSON.stringify({ chart: { fontFamily: "Georgia" } }))
    );
    // The last chart's font used to replace every other chart's.
    expect((await chrome(page, 0)).font).toBe("Georgia");
    await page.evaluate(() => {
      window.__charts[0].chartOptions.chart.fontFamily = "Courier New";
      window.__charts[0].updateTheme("dark");
    });
    expect((await chrome(page, 0)).font).toBe('"Courier New"');
    expect((await chrome(page, 1)).font).toBe("Georgia");
  });

  for (const mode of ["light", "dark"]) {
    test(`inside a shadow root, a ${mode} chart matches the light DOM`, async ({
      page,
    }) => {
      await gotoFixture(page, `charts=${mode}`);
      const outside = await chrome(page);
      await gotoFixture(page, `charts=${mode}&shadow=1`);
      const inside = await chrome(page);
      expect(inside).toEqual(outside);
      expect(inside).toMatchObject(mode === "dark" ? DARK : LIGHT);
    });
  }

  test("inside a shadow root, the colors follow a runtime theme change", async ({
    page,
  }) => {
    await gotoFixture(page, "charts=light&shadow=1");
    await page.evaluate(() => window.__chart.updateTheme("dark"));
    // The controls ease their background over --apexstock-as-ease (0.15s).
    await expect.poll(() => chrome(page)).toMatchObject(DARK);
  });
});
