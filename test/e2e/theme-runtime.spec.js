import { test, expect } from "@playwright/test";

// Runtime theme changes in a real browser, against the ApexCharts the suite
// pins. Three surfaces used to stay behind:
// - the main pane's OHLC tooltip, foreColor and plot paper kept the
//   construction theme (ApexStock wrote `chart.theme.mode`, which ApexCharts
//   never reads), so the shipped theming example showed a white tooltip on a
//   dark chart;
// - the drawing popup decided dark from the whole page, once;
// - the legend's rise/fall colors ignored a preset's up/down.
// The "default" tests pin today's output for charts that never hit these.
const FIXTURE = "/test/e2e/fixtures/theme-runtime.html";

async function gotoFixture(page, qs) {
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${FIXTURE}?${qs}`);
  await page.waitForFunction(() => window.__ready === true, null, {
    timeout: 20000,
  });
  await expect(page.locator("#chart0 .apexcharts-svg").first()).toBeVisible();
  return errors;
}

/** The main pane's theme-dependent state. */
const paneState = (page, i = 0) =>
  page.evaluate((i) => {
    const w = window.__charts[i].chart.w;
    const paper = w.dom.Paper.node;
    return {
      mode: w.config.theme.mode,
      foreColor: w.config.chart.foreColor,
      paperStyle: paper.style.background,
      paper: getComputedStyle(paper).backgroundColor,
    };
  }, i);

/** Hover the plot and read the OHLC tooltip's theme class and surface. */
async function hoverTooltip(page, i = 0) {
  const box = await page
    .locator(`#chart${i} .apexcharts-svg`)
    .first()
    .boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(250);
  const tt = await page.evaluate((i) => {
    const el = document.querySelector(`#chart${i} .apexcharts-tooltip`);
    return {
      dark: el.classList.contains("apexcharts-theme-dark"),
      light: el.classList.contains("apexcharts-theme-light"),
      bg: getComputedStyle(el).backgroundColor,
    };
  }, i);
  await page.mouse.move(2, 2);
  return tt;
}

const WHITE = "rgb(255, 255, 255)";
const TRANSPARENT = "rgba(0, 0, 0, 0)";

test.describe("runtime theme: main pane", () => {
  test("default: a chart with no theme option is unchanged", async ({
    page,
  }) => {
    const errors = await gotoFixture(page, "charts=none");
    expect(await paneState(page)).toEqual({
      mode: "",
      foreColor: "#373d3f",
      paperStyle: "",
      paper: TRANSPARENT,
    });
    const tt = await hoverTooltip(page);
    expect(tt).toEqual({ dark: false, light: true, bg: WHITE });
    expect(errors).toEqual([]);
  });

  test("updateTheme('dark') darkens the tooltip, foreColor and paper", async ({
    page,
  }) => {
    const errors = await gotoFixture(page, "charts=none");
    await page.evaluate(() => window.__chart.updateTheme("dark"));
    await page.waitForTimeout(200);

    const s = await paneState(page);
    expect(s.mode).toBe("dark");
    expect(s.foreColor).toBe("#f6f7f8");
    expect(s.paper).toBe(TRANSPARENT);

    const tt = await hoverTooltip(page);
    expect(tt.dark).toBe(true);
    expect(tt.bg).not.toBe(WHITE);
    expect(errors).toEqual([]);
  });

  test("a consumer theme.mode no longer pins the paper and tooltip", async ({
    page,
  }) => {
    // Built light (ApexCharts paints a white paper), switched dark: the paper
    // used to stay white under a dark chart.
    await gotoFixture(page, "charts=light");
    await page.evaluate(() => window.__chart.updateTheme("dark"));
    await page.waitForTimeout(200);
    expect((await paneState(page)).paper).not.toBe(WHITE);
    expect((await hoverTooltip(page)).dark).toBe(true);

    await page.evaluate(() => window.__chart.updateTheme("light"));
    await page.waitForTimeout(200);
    const s = await paneState(page);
    expect(s.mode).toBe("light");
    expect(s.foreColor).toBe("#373d3f");
    const tt = await hoverTooltip(page);
    expect(tt).toMatchObject({ dark: false, light: true, bg: WHITE });
  });

  test("dark to light drops the dark tooltip and #343A3F paper", async ({
    page,
  }) => {
    await gotoFixture(page, "charts=dark");
    await page.evaluate(() => window.__chart.updateTheme("light"));
    await page.waitForTimeout(200);
    const s = await paneState(page);
    expect(s.paper).toBe(TRANSPARENT);
    expect(s.foreColor).toBe("#373d3f");
    expect(await hoverTooltip(page)).toMatchObject({ light: true, bg: WHITE });
  });

  test("setThemePreset to a dark preset darkens the tooltip", async ({
    page,
  }) => {
    await gotoFixture(page, "charts=preset-paper");
    await page.evaluate(() => window.__chart.setThemePreset("rt-dark"));
    await page.waitForTimeout(200);
    const s = await paneState(page);
    expect(s.mode).toBe("dark");
    // The preset owns its plot background and (through --apx-fore) the text.
    expect(s.paper).toBe("rgb(26, 21, 40)");
    expect(s.foreColor).toBe("#c4b5fd");
    expect((await hoverTooltip(page)).dark).toBe(true);
  });

  // The page's own tooltip.theme, chart.foreColor and theme.palette. ApexCharts
  // before 8.1 derived the mode's values over them on every runtime change.
  const OWN = encodeURIComponent(
    JSON.stringify({
      chart: { foreColor: "#334455" },
      theme: { palette: "palette2" },
      tooltip: { theme: "dark" },
    })
  );
  const ownKeys = (page) =>
    page.evaluate(() => {
      const c = window.__chart.chart.w.config;
      return {
        mode: c.theme.mode,
        tooltip: c.tooltip.theme,
        foreColor: c.chart.foreColor,
        palette: c.theme.palette,
      };
    });

  test("updateTheme keeps the page's own tooltip theme, foreColor and palette", async ({
    page,
  }) => {
    const errors = await gotoFixture(page, `charts=none&extra=${OWN}`);
    for (const mode of ["dark", "light"]) {
      await page.evaluate((m) => window.__chart.updateTheme(m), mode);
      await page.waitForTimeout(200);
      expect(await ownKeys(page)).toEqual({
        mode,
        tooltip: "dark",
        foreColor: "#334455",
        palette: "palette2",
      });
      expect(await hoverTooltip(page)).toMatchObject({
        dark: true,
        light: false,
      });
    }
    expect(errors).toEqual([]);
  });

  test("update({ theme: { mode } }) keeps them too", async ({ page }) => {
    await gotoFixture(page, `charts=none&extra=${OWN}`);
    for (const mode of ["dark", "light"]) {
      await page.evaluate(
        (m) => window.__chart.update({ theme: { mode: m } }),
        mode
      );
      await page.waitForTimeout(200);
      expect(await ownKeys(page)).toEqual({
        mode,
        tooltip: "dark",
        foreColor: "#334455",
        palette: "palette2",
      });
      expect((await hoverTooltip(page)).dark).toBe(true);
    }
  });

  test("update() keeps a plot background passed with the mode", async ({
    page,
  }) => {
    await gotoFixture(page, "charts=none");
    await page.evaluate(() =>
      window.__chart.update({
        theme: { mode: "dark" },
        chart: { background: "#0b0e11" },
      })
    );
    await page.waitForTimeout(200);
    expect((await paneState(page)).paper).toBe("rgb(11, 14, 17)");
  });

  test("default: an --apx-surface token paints the plot at construction", async ({
    page,
  }) => {
    await gotoFixture(page, "charts=dark&surface=black");
    expect((await paneState(page)).paper).toBe("rgb(0, 0, 0)");
  });

  test("an --apx-surface token keeps the plot through light and back to dark", async ({
    page,
  }) => {
    await gotoFixture(page, "charts=dark&surface=black");
    await page.evaluate(() => window.__chart.updateTheme("light"));
    await page.waitForTimeout(200);
    await page.evaluate(() => window.__chart.updateTheme("dark"));
    await page.waitForTimeout(200);
    const s = await paneState(page);
    expect(s.mode).toBe("dark");
    expect(s.paper).toBe("rgb(0, 0, 0)");
  });

  test("shipped theming example: preset paper, then Mode dark", async ({
    page,
  }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto("/examples/theming.html");
    await expect(page.locator(".apexcharts-svg").first()).toBeVisible();
    await page.waitForTimeout(500);
    await page.click('[data-mode="dark"]');
    await page.waitForTimeout(300);

    const box = await page.locator(".apexcharts-svg").first().boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(250);
    const got = await page.evaluate(() => {
      const t = document.querySelector(".apexcharts-tooltip");
      const svg = document.querySelector(".apexcharts-svg");
      return {
        dark: t.classList.contains("apexcharts-theme-dark"),
        bg: getComputedStyle(t).backgroundColor,
        paper: getComputedStyle(svg).backgroundColor,
      };
    });
    expect(got.dark).toBe(true);
    expect(got.bg).not.toBe(WHITE);
    expect(got.paper).not.toBe(WHITE);
    expect(errors).toEqual([]);
  });
});

// ---- Drawing popup ----

/** Add a measure drawing, select it with a real click, read the popup. */
async function selectDrawingPopup(page, i) {
  await page.evaluate((i) => {
    const c = window.__charts[i];
    const s = c.series;
    c.addDrawing({
      type: "measure",
      points: [
        { x: s[40].x, y: 96 },
        { x: s[70].x, y: 104 },
      ],
    });
  }, i);
  await page.waitForTimeout(150);
  const at = await page.evaluate((i) => {
    const r = document
      .querySelector(`#chart${i} .apexstock-drawing-overlay rect`)
      .getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, i);
  // A zero-delay click does not select.
  await page.mouse.click(at.x, at.y, { delay: 60 });
  await page.waitForTimeout(300);
  await expect(
    page.locator(`#chart${i} .apexstock-element-popup`)
  ).toBeVisible();
  return page.evaluate((i) => {
    const p = document.querySelector(`#chart${i} .apexstock-element-popup`);
    return {
      ownDark: p.classList.contains("apexstock-theme-dark"),
      bg: getComputedStyle(p).backgroundColor,
      del: getComputedStyle(p.querySelector(".apexstock-element-delete-btn"))
        .color,
      label: getComputedStyle(
        p.querySelector(".apexstock-color-container label")
      ).color,
      picker: getComputedStyle(
        p.querySelector(".apexstock-stroke-color-picker")
      ).backgroundColor,
    };
  }, i);
}

// Today's popup styling for a plain light and a plain dark chart.
const LIGHT_POPUP = {
  ownDark: false,
  bg: WHITE,
  del: "rgb(31, 41, 55)",
  label: "rgb(102, 102, 102)",
  picker: "rgb(239, 239, 239)",
};
const DARK_POPUP = {
  bg: "rgb(30, 36, 43)",
  del: "rgb(230, 234, 240)",
  label: "rgb(173, 181, 189)",
  picker: "rgb(39, 46, 54)",
};

test.describe("runtime theme: drawing popup", () => {
  test("default: a single light chart's popup is unchanged", async ({
    page,
  }) => {
    await gotoFixture(page, "charts=light");
    expect(await selectDrawingPopup(page, 0)).toEqual(LIGHT_POPUP);
  });

  test("default: a single dark chart's popup is still dark", async ({
    page,
  }) => {
    await gotoFixture(page, "charts=dark");
    expect(await selectDrawingPopup(page, 0)).toMatchObject(DARK_POPUP);
  });

  test("a light chart after a dark one gets a light popup", async ({
    page,
  }) => {
    await gotoFixture(page, "charts=dark,light");
    expect(await selectDrawingPopup(page, 1)).toEqual(LIGHT_POPUP);
  });

  test("a light chart before a dark one under the same wrapper stays light", async ({
    page,
  }) => {
    await gotoFixture(page, "charts=light,dark");
    expect(await selectDrawingPopup(page, 0)).toEqual(LIGHT_POPUP);
  });

  test("a sibling switching to dark leaves a light chart's popup light", async ({
    page,
  }) => {
    await gotoFixture(page, "charts=light,light");
    await page.evaluate(() => window.__charts[1].updateTheme("dark"));
    await page.waitForTimeout(200);
    expect(await selectDrawingPopup(page, 0)).toEqual(LIGHT_POPUP);
  });

  test("follows its chart from dark to light", async ({ page }) => {
    await gotoFixture(page, "charts=dark");
    await page.evaluate(() => window.__chart.updateTheme("light"));
    await page.waitForTimeout(200);
    expect(await selectDrawingPopup(page, 0)).toEqual(LIGHT_POPUP);
  });

  test("follows its chart from light to dark", async ({ page }) => {
    await gotoFixture(page, "charts=light");
    await page.evaluate(() => window.__chart.updateTheme("dark"));
    await page.waitForTimeout(200);
    expect(await selectDrawingPopup(page, 0)).toMatchObject(DARK_POPUP);
  });

  test("ignores body.dark-mode around a light chart", async ({ page }) => {
    await gotoFixture(page, "charts=light&bodyDark=1");
    expect(await selectDrawingPopup(page, 0)).toEqual(LIGHT_POPUP);
  });
});

// ---- Legend up/down ----

const hexToRgb = (hex) => {
  const n = parseInt(hex.replace("#", ""), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};

/** The legend's close color and the candle color for the latest bar. */
const legendVsCandle = (page) =>
  page.evaluate(() => {
    const c = window.__chart;
    const last = c.series[c.series.length - 1].y;
    const colors = c.chart.w.config.plotOptions.candlestick.colors;
    return {
      legend: c.legend._c.style.color,
      candle: last[3] >= last[0] ? colors.upward : colors.downward,
    };
  });

test.describe("runtime theme: legend rise/fall colors", () => {
  test("default: plain light legend colors are unchanged", async ({ page }) => {
    await gotoFixture(page, "charts=none&legend=1");
    const { legend, candle } = await legendVsCandle(page);
    expect(candle).toBe("#EF403C");
    expect(legend).toBe(hexToRgb("#EF403C"));
  });

  test("a preset's legend matches its candles", async ({ page }) => {
    await gotoFixture(page, "charts=preset-paper&legend=1");
    let { legend, candle } = await legendVsCandle(page);
    expect(legend).toBe(hexToRgb(candle));

    await page.evaluate(() => window.__chart.setThemePreset("rt-dark"));
    await page.waitForTimeout(200);
    ({ legend, candle } = await legendVsCandle(page));
    expect(candle).toBe("#f472b6");
    expect(legend).toBe(hexToRgb(candle));
  });

  test("candle colors passed to update() reach the legend", async ({
    page,
  }) => {
    await gotoFixture(page, "charts=preset-paper&legend=1");
    await page.evaluate(() =>
      window.__chart.update({
        plotOptions: {
          candlestick: { colors: { upward: "#0000ff", downward: "#ff00ff" } },
        },
      })
    );
    await page.waitForTimeout(200);
    const { legend, candle } = await legendVsCandle(page);
    expect(["#0000ff", "#ff00ff"]).toContain(candle);
    expect(legend).toBe(hexToRgb(candle));
  });
});
