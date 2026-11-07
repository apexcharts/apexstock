import { test, expect } from "@playwright/test";

// Ignite UI theming (plan 36 Phase 2F), against the Ignite UI 7.4.1 sheets
// and the 7.5.0-beta.0 dark sheet with surface roles (fixtures/ignite-ui, the
// `--ig-*` tokens only). `addon=1` loads dist/apexstock.ignite-ui.min.js, and
// `acaddon=1` ApexCharts' own add-on, as a script-tag page does. Expected
// colors are resolved from the sheet in the page, so the specs pin the
// mapping, not today's palette values.
const FIXTURE = "/test/e2e/fixtures/theme-root.html";
const LIGHT = [
  "light-material",
  "light-bootstrap",
  "light-fluent",
  "light-indigo",
];
const DARK = ["dark-material", "dark-bootstrap", "dark-fluent", "dark-indigo"];
const ADDONS = "addon=1&acaddon=1";

async function gotoFixture(page, qs) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${FIXTURE}?${qs}`);
  await page.waitForFunction(() => window.__ready === true, null, {
    timeout: 20000,
  });
  return errors;
}

/**
 * Chart `i`'s themed surfaces and the sheet's roles, each color as the
 * "r,g,b" a 1px canvas paints for it, so `rgb()`, hex and `color(srgb ...)`
 * compare equal.
 */
const read = (page, i = 0) =>
  page.evaluate((i) => {
    const root = window.__root;
    const wrap = root.getElementById("wrap" + i);
    const chart = window.__charts[i];
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const px = (color) => {
      if (!color) return null;
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = "#000";
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 1, 1);
      const d = ctx.getImageData(0, 0, 1, 1).data;
      return d[3] === 0 ? "transparent" : `${d[0]},${d[1]},${d[2]}`;
    };
    const probe = document.createElement("span");
    document.body.appendChild(probe);
    const ig = (token) => {
      probe.style.color = `var(${token})`;
      return px(getComputedStyle(probe).color);
    };
    const igFont = getComputedStyle(document.documentElement)
      .getPropertyValue("--ig-font-family")
      .trim();
    const cs = (sel, p) => {
      const el = wrap.querySelector(sel);
      return el ? getComputedStyle(el)[p] : null;
    };
    const w = chart.chart.w;
    const attr = (sel, a) => {
      const el = wrap.querySelector(sel);
      return el ? el.getAttribute(a) : null;
    };
    const fills = [
      ...wrap.querySelectorAll(
        ".apexstock-main-chart .apexcharts-candlestick-series path"
      ),
    ].map((p) => px(p.getAttribute("fill")));
    const out = {
      theme: chart.theme,
      sheet: {
        fore: ig("--ig-gray-800"),
        muted: ig("--ig-gray-600"),
        grid: ig("--ig-gray-300"),
        up: ig("--ig-success-seed"),
        down: ig("--ig-error-seed"),
        overlay: ig("--ig-surface-overlay"),
        font: igFont,
      },
      toolbarText: px(cs(".apexstock-toolbar", "color")),
      toolbarBorder: px(cs(".apexstock-toolbar", "borderBottomColor")),
      selectText: px(cs(".apexstock-custom-select-trigger", "color")),
      selectBorder: px(
        cs(".apexstock-custom-select-trigger", "borderTopColor")
      ),
      optionsBg: px(cs(".apexstock-custom-options", "backgroundColor")),
      toolText: px(cs(".apexstock-drawing-tool", "color")),
      tickText: px(cs(".apexstock-xaxis-tick-label", "color")),
      font: cs(".apexstock-custom-select-trigger", "fontFamily"),
      plotFont: cs(".apexstock-main-chart text", "fontFamily"),
      surface: px(cs(".apexstock-chart", "backgroundColor")),
      candles: [...new Set(fills)].sort(),
      grid: px(attr(".apexstock-main-chart .apexcharts-gridline", "stroke")),
      yLabel: px(attr(".apexstock-main-chart .apexcharts-yaxis-label", "fill")),
      chartMode: w.config.theme.mode || "",
      tooltipTheme: w.config.tooltip.theme,
      paper: getComputedStyle(w.dom.Paper.node).backgroundColor,
    };
    probe.remove();
    return out;
  }, i);

/** The legend's inline text color. */
const legend = (page, i = 0) =>
  page.evaluate((i) => {
    const el = window.__root
      .getElementById("wrap" + i)
      .querySelector(".apexstock-legend");
    return el ? el.style.color : null;
  }, i);

/** Add an RSI pane to the last chart and read its y-axis text. */
const rsiPane = async (page) => {
  await page.evaluate(() => window.__chart.updateIndicator("rsi"));
  await page.waitForFunction(() => {
    const pane = window.__chart.indicatorChartMap.rsi;
    return !!(
      pane &&
      pane.el &&
      pane.el.querySelector(".apexcharts-yaxis-label")
    );
  });
  return page.evaluate(() => {
    const pane = window.__chart.indicatorChartMap.rsi;
    const label = pane.el.querySelector(".apexcharts-yaxis-label");
    return {
      fill: label.getAttribute("fill"),
      font: getComputedStyle(label).fontFamily,
    };
  });
};

/** A page `<style>` for the fixture's `css` parameter. */
const css = (text) => `css=${encodeURIComponent(text)}`;
const TOKENS =
  ":root { --apx-fore: rgb(200, 0, 0); --apx-grid: rgb(0, 150, 0); }";

/** A screenshot of the charts, for "renders exactly as" checks. */
const shot = (page) =>
  page.locator("#charts").screenshot({ animations: "disabled" });

test.describe("Ignite UI without the add-on", () => {
  for (const sheet of [
    "light-material",
    "dark-material",
    "next-dark-material",
  ]) {
    for (const root of ["", "&shadow=1"]) {
      const where = root ? " (shadow root)" : "";
      test(`a ${sheet} sheet renders exactly as no sheet${where}`, async ({
        page,
      }) => {
        await gotoFixture(page, `charts=none,dark&legend=1${root}`);
        const none = await shot(page);
        await gotoFixture(
          page,
          `charts=none,dark&legend=1&sheet=${sheet}${root}`
        );
        expect((await shot(page)).equals(none)).toBe(true);
        expect(
          await page.evaluate(() => window.__chart.themeManager.designSystem)
        ).toBeNull();
      });
    }
  }
});

for (const shadow of [false, true]) {
  const where = shadow ? " (shadow root)" : "";
  const root = shadow ? "&shadow=1" : "";

  test.describe(`Ignite UI with the add-on${where}`, () => {
    for (const sheet of LIGHT) {
      test(`${sheet}: the chrome, candles and chart follow the theme`, async ({
        page,
      }) => {
        const errors = await gotoFixture(
          page,
          `charts=none&legend=1&sheet=${sheet}&${ADDONS}${root}`
        );
        const s = await read(page);
        expect(s.theme).toBe("light");
        expect(s.toolbarText).toBe(s.sheet.fore);
        expect(s.toolbarBorder).toBe(s.sheet.grid);
        expect(s.selectText).toBe(s.sheet.fore);
        expect(s.selectBorder).toBe(s.sheet.grid);
        expect(s.toolText).toBe(s.sheet.fore);
        expect(s.tickText).toBe(s.sheet.muted);
        expect(s.candles).toEqual([s.sheet.up, s.sheet.down].sort());
        // ApexCharts reads the theme itself (ApexStock sends it no grid or
        // axis-text color).
        expect(s.grid).toBe(s.sheet.grid);
        expect(s.yLabel).toBe(s.sheet.fore);
        // The font follows the design system, in the chrome and the plot.
        expect(s.font).toContain(s.sheet.font.split(",")[0].trim());
        expect(s.plotFont).toBe(s.font);
        // The surface stays ApexStock's own (plan 36 OPEN-8).
        expect(s.surface).toBe("255,255,255");
        expect(errors).toEqual([]);
      });
    }

    for (const sheet of DARK) {
      test(`${sheet}: an unset mode goes dark, chart and tooltip included`, async ({
        page,
      }) => {
        await gotoFixture(
          page,
          `charts=none&legend=1&sheet=${sheet}&${ADDONS}${root}`
        );
        const s = await read(page);
        expect(s.theme).toBe("dark");
        expect(s.toolbarText).toBe(s.sheet.fore);
        expect(s.selectBorder).toBe(s.sheet.grid);
        expect(s.toolText).toBe(s.sheet.fore);
        expect(s.tickText).toBe(s.sheet.muted);
        expect(s.candles).toEqual([s.sheet.up, s.sheet.down].sort());
        expect(s.chartMode).toBe("dark");
        expect(s.tooltipTheme).toBe("dark");
        // The plot stays transparent over ApexStock's dark surface (D6b).
        expect(s.paper).toBe("rgba(0, 0, 0, 0)");
        expect(s.surface).toBe("30,36,43");
        expect(s.yLabel).toBe(s.sheet.fore);
        expect(await legend(page)).not.toBe("rgb(31, 41, 55)");
      });
    }

    test("the 7.5 surface roles reach the menus", async ({ page }) => {
      await gotoFixture(
        page,
        `charts=none&sheet=next-dark-material&${ADDONS}${root}`
      );
      const s = await read(page);
      expect(s.theme).toBe("dark");
      expect(s.sheet.overlay).not.toBeNull();
      expect(s.optionsBg).toBe(s.sheet.overlay);
      // Without the role (7.4.1), the menus keep ApexStock's dark surface.
      await gotoFixture(
        page,
        `charts=none&sheet=dark-material&${ADDONS}${root}`
      );
      expect((await read(page)).optionsBg).toBe("52,58,64");
    });

    test("theme.designSystem: false restores the built-in look", async ({
      page,
    }) => {
      const off = encodeURIComponent(
        JSON.stringify({ theme: { designSystem: false } })
      );
      await gotoFixture(page, `charts=none&legend=1${root}`);
      const none = await shot(page);
      await gotoFixture(
        page,
        `charts=none&legend=1&sheet=dark-material&${ADDONS}&extra=${off}${root}`
      );
      expect((await shot(page)).equals(none)).toBe(true);
    });

    for (const sheet of ["light-material", "dark-material"]) {
      test(`${sheet}: --apx-* tokens outrank it on every toolbar surface`, async ({
        page,
      }) => {
        await gotoFixture(
          page,
          `charts=none&legend=1&sheet=${sheet}&${ADDONS}&${css(TOKENS)}${root}`
        );
        // The controls ease their colors over --apexstock-as-ease (0.15s).
        await expect
          .poll(async () => (await read(page)).selectText)
          .toBe("200,0,0");
        const s = await read(page);
        expect(s.theme).toBe(sheet.startsWith("dark") ? "dark" : "light");
        for (const k of ["toolbarText", "selectText", "toolText", "yLabel"]) {
          expect(s[k]).toBe("200,0,0");
        }
        for (const k of ["toolbarBorder", "selectBorder", "grid"]) {
          expect(s[k]).toBe("0,150,0");
        }
        expect(await legend(page)).toBe("rgb(200, 0, 0)");
      });
    }
  });
}

test.describe("Ignite UI ranks below everything the page chose", () => {
  test("an explicit mode beats the variant, and its chrome stays built-in", async ({
    page,
  }) => {
    const light = encodeURIComponent(
      JSON.stringify({ theme: { mode: "light" } })
    );
    await gotoFixture(
      page,
      `charts=none&sheet=dark-material&${ADDONS}&extra=${light}`
    );
    const s = await read(page);
    expect(s.theme).toBe("light");
    // A dark sheet's light text never lands on a light chart...
    expect(s.selectText).toBe("51,51,51");
    expect(s.toolText).toBe("31,41,55");
    // ...but the brand and semantic colors still apply.
    expect(s.candles).toEqual([s.sheet.up, s.sheet.down].sort());
  });

  test("a preset beats it", async ({ page }) => {
    await gotoFixture(
      page,
      `charts=preset-mint&sheet=light-material&${ADDONS}`
    );
    const s = await read(page);
    expect(s.candles).toEqual(["16,185,129", "239,68,68"]);
    expect(s.grid).toBe(
      await page.evaluate(() => {
        const c = document.createElement("canvas").getContext("2d");
        c.fillStyle = "#e6f2ec";
        c.fillRect(0, 0, 1, 1);
        return [...c.getImageData(0, 0, 1, 1).data.slice(0, 3)].join(",");
      })
    );
    // The chrome is the preset's own, as with no sheet.
    await gotoFixture(page, "charts=preset-mint");
    const plain = await read(page);
    for (const k of ["toolText", "tickText", "selectText", "selectBorder"]) {
      expect(s[k]).toBe(plain[k]);
    }
  });

  for (const mode of [
    { accessibility: { colorBlindMode: "deuteranopia" } },
    { monochrome: { enabled: true } },
  ]) {
    test(`${Object.keys(mode)[0]} keeps ApexStock's own colors`, async ({
      page,
    }) => {
      const extra = encodeURIComponent(JSON.stringify({ theme: mode }));
      await gotoFixture(page, `charts=none&extra=${extra}`);
      const plain = await read(page);
      await gotoFixture(
        page,
        `charts=none&sheet=light-material&${ADDONS}&extra=${extra}`
      );
      const s = await read(page);
      for (const k of ["toolText", "tickText", "selectText", "candles"]) {
        expect(s[k]).toEqual(plain[k]);
      }
    });
  }

  test("a --apx-* token and the product's own token beat it", async ({
    page,
  }) => {
    await gotoFixture(page, `charts=none&sheet=light-material&${ADDONS}`);
    await page.addStyleTag({
      content: `:root { --apx-fore: rgb(10, 20, 30); }
        .apexstock-theme-light [class^="apexstock-"] { --apexstock-light-muted: rgb(40, 50, 60); }`,
    });
    // The controls ease their colors over --apexstock-as-ease (0.15s).
    await expect.poll(async () => (await read(page)).toolText).toBe("10,20,30");
    expect((await read(page)).tickText).toBe("40,50,60");
  });

  test("--apx-grid keeps the plot grid over a theme round trip", async ({
    page,
  }) => {
    await gotoFixture(
      page,
      `charts=none&sheet=light-material&${ADDONS}&${css(TOKENS)}`
    );
    expect((await read(page)).grid).toBe("0,150,0");
    await page.evaluate(() => {
      window.__chart.updateTheme("dark");
      window.__chart.updateTheme("light");
    });
    await expect.poll(async () => (await read(page)).theme).toBe("light");
    expect((await read(page)).grid).toBe("0,150,0");
  });

  test("a dark variant hands the plot to --apx-surface", async ({ page }) => {
    await gotoFixture(
      page,
      `charts=none&sheet=dark-material&${ADDONS}&${css(
        ":root { --apx-surface: rgb(10, 40, 80); }"
      )}`
    );
    const s = await read(page);
    expect(s.theme).toBe("dark");
    expect(s.paper).toBe("rgb(10, 40, 80)");
  });

  test("a dark variant keeps the plot transparent over a dropped background", async ({
    page,
  }) => {
    const bg = encodeURIComponent(
      JSON.stringify({ chart: { background: "#102030" } })
    );
    await gotoFixture(
      page,
      `charts=none&sheet=dark-material&${ADDONS}&extra=${bg}`
    );
    const s = await read(page);
    expect(s.theme).toBe("dark");
    expect(s.paper).toBe("rgba(0, 0, 0, 0)");
  });

  for (const theme of [
    { designSystem: false },
    { tokens: false },
    { accessibility: { colorBlindMode: "deuteranopia" } },
  ]) {
    test(`an indicator pane follows theme ${JSON.stringify(theme)}`, async ({
      page,
    }) => {
      const extra = encodeURIComponent(JSON.stringify({ theme }));
      await gotoFixture(page, `charts=none&extra=${extra}`);
      const plain = await rsiPane(page);
      await gotoFixture(
        page,
        `charts=none&sheet=light-material&${ADDONS}&extra=${extra}`
      );
      const pane = await rsiPane(page);
      expect(pane.fill).toBe(plain.fill);
      // A color-blind mode keeps the Ignite UI font, as the main chart does.
      if (theme.accessibility) {
        expect(pane.font).toContain("Titillium");
      } else {
        expect(pane.font).toBe(plain.font);
      }
    });
  }

  test("candle colors passed to update() beat it", async ({ page }) => {
    await gotoFixture(page, `charts=none&sheet=light-material&${ADDONS}`);
    await page.evaluate(() =>
      window.__chart.update({
        plotOptions: {
          candlestick: { colors: { upward: "#0000ff", downward: "#ff00ff" } },
        },
      })
    );
    await expect
      .poll(async () => (await read(page)).candles)
      .toEqual(["0,0,255", "255,0,255"]);
  });

  test("a runtime switch to dark on a light sheet keeps the built-in dark chrome", async ({
    page,
  }) => {
    await gotoFixture(page, `charts=none&sheet=light-material&${ADDONS}`);
    await page.evaluate(() => window.__chart.updateTheme("dark"));
    await expect
      .poll(async () => (await read(page)).toolText)
      .toBe("230,234,240");
    const s = await read(page);
    expect(s.chartMode).toBe("dark");
    expect(s.candles).toEqual([s.sheet.up, s.sheet.down].sort());
  });
});

test.describe("Ignite UI add-on loading", () => {
  test("ApexCharts' add-on alone themes the stock chrome too", async ({
    page,
  }) => {
    // It registers the adapter every Apex product shares, so a page that
    // loaded only ApexCharts' add-on gets the whole chart themed.
    await gotoFixture(page, "charts=none&sheet=light-material&acaddon=1");
    const s = await read(page);
    expect(s.toolText).toBe(s.sheet.fore);
    expect(s.candles).toEqual([s.sheet.up, s.sheet.down].sort());
    expect(s.yLabel).toBe(s.sheet.fore);
  });

  test("ApexStock's add-on alone themes its chrome; the charts take ApexCharts' add-on", async ({
    page,
  }) => {
    await gotoFixture(page, "charts=none&sheet=light-material&addon=1");
    const s = await read(page);
    expect(s.toolText).toBe(s.sheet.fore);
    expect(s.candles).toEqual([s.sheet.up, s.sheet.down].sort());
    // Without ApexCharts' add-on the chart cannot read the theme, so the plot
    // keeps ApexStock's built-in grid and axis text.
    expect(s.yLabel).toBe("51,51,51");
    expect(s.grid).toBe("233,236,239");
  });

  test("a chart in a shadow root shows the x-axis hover label in the theme", async ({
    page,
  }) => {
    await gotoFixture(
      page,
      `charts=none&sheet=dark-material&${ADDONS}&shadow=1`
    );
    const box = await page.evaluate(() => {
      const plot = window.__root.querySelector(
        "#wrap0 .apexstock-main-chart .apexcharts-grid"
      );
      const r = plot.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    await page.mouse.move(box.x, box.y);
    await page.mouse.move(box.x + 5, box.y + 5);
    await expect
      .poll(() =>
        page.evaluate(() => {
          const tip = window.__root.querySelector(
            "#wrap0 .apexstock-xaxis-tooltip"
          );
          return tip ? getComputedStyle(tip).display : null;
        })
      )
      .toBe("flex");
    const tip = await page.evaluate(() => {
      const el = window.__root.querySelector("#wrap0 .apexstock-xaxis-tooltip");
      return {
        text: el.textContent,
        bg: getComputedStyle(el).backgroundColor.match(/\d+/g).join(","),
      };
    });
    expect(tip.text).not.toBe("");
    // Dark mode paints the label in the text color, the sheet's gray-800.
    expect(tip.bg).toBe((await read(page)).sheet.fore);
  });
});
