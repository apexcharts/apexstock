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

// One semantic source for rise and fall: the chart-type switch and a measure
// box drawn without colors have their own pair in a plain mode, and take a
// preset's (or colors passed to update()) like the candles do.
test.describe("Up/down on the chart-type switch and the measure box", () => {
  /** The measure box fill (the overlay's filled rect). */
  const boxFill = (page) =>
    page.evaluate(() =>
      [...window.__root.querySelectorAll(".apexstock-drawing-overlay rect")]
        .map((r) => r.getAttribute("fill"))
        .find((f) => f && f !== "none")
    );

  /** Measure a rising stretch of the fixture data, then its box fill. */
  const measure = async (page) => {
    await page.evaluate(() => {
      const c = window.__chart;
      const s = c.series;
      // The longest rise in the fixture data, so the box is tinted "up".
      let best = [0, 1];
      for (let i = 0; i < s.length; i++) {
        for (let j = i + 5; j < s.length; j++) {
          if (s[j].y[3] - s[i].y[3] > s[best[1]].y[3] - s[best[0]].y[3])
            best = [i, j];
        }
      }
      c.measureRange(s[best[0]].x, s[best[1]].x);
    });
    return boxFill(page);
  };

  const candleFills = (page) =>
    page.evaluate(() => {
      const paths = [
        ...window.__root.querySelectorAll(
          ".apexstock-main-chart .apexcharts-candlestick-series path"
        ),
      ];
      return [...new Set(paths.map((p) => p.getAttribute("fill")))].sort();
    });

  test("default: a plain-mode measure keeps its own teal", async ({ page }) => {
    await gotoFixture(page, "charts=none");
    expect(await measure(page)).toBe("#26a69a");
  });

  test("a measure follows the preset, and a later preset switch", async ({
    page,
  }) => {
    await gotoFixture(page, "charts=preset-rose");
    expect(await measure(page)).toBe("#16a34a");
    await page.evaluate(() => window.__chart.setThemePreset("mint"));
    await expect.poll(() => boxFill(page)).toBe("#10b981");
  });

  test("default: a plain-mode chart-type switch keeps its own green and red", async ({
    page,
  }) => {
    await gotoFixture(page, "charts=none");
    await page.evaluate(() =>
      window.__chart.chartSwitch.changeChartType("heikinashi")
    );
    await expect
      .poll(() => candleFills(page))
      .toEqual(["rgba(248,113,113,1)", "rgba(52,211,153,1)"]);
  });

  test("a chart-type switch keeps the preset's candle colors", async ({
    page,
  }) => {
    await gotoFixture(page, "charts=preset-mint");
    await page.evaluate(() =>
      window.__chart.chartSwitch.changeChartType("heikinashi")
    );
    await expect
      .poll(() => candleFills(page))
      .toEqual(["rgba(16,185,129,1)", "rgba(239,68,68,1)"]);
  });
});
