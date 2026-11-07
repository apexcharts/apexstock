// @vitest-environment jsdom
//
// The design-system layer (plan 36 Phase 2F): what ApexStock does with a design
// system an add-on registered (`apexstock/ignite-ui` registers Ignite UI's).
// jsdom resolves no Ignite UI colors, so a stub adapter stands in for the real
// one; the e2e suite runs the real add-on against real sheets. Each block also
// pins that a page without an add-on is unchanged.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import ThemeManager from "../src/core/ThemeManager.js";
import ThemePresets from "../src/core/ThemePresets.js";
import ApexStock from "../src/ApexStock.js";

const SLOT = "__apex_design_systems_v1__";

// The roles that follow the sheet's variant, as commons gates them.
const GATED = new Set([
  "fore",
  "muted",
  "grid",
  "raised",
  "overlay",
  "overlayContrast",
  "overlayBorder",
  "hover",
  "guide",
  "neutral",
]);

const LIGHT_COLORS = {
  fore: "#424242",
  muted: "#8a8a8a",
  grid: "#e0e0e0",
  hover: "#f5f5f5",
  focus: "#0099ff",
  positive: "#4eb862",
  negative: "#ff134a",
};

/** A layer shaped like the commons one: data plus the gate and palette methods. */
function layer({
  variant,
  colors = LIGHT_COLORS,
  font = "Titillium Web, sans-serif",
} = {}) {
  return {
    id: "igniteui",
    series: [],
    colors,
    font,
    variant,
    color(role, mode) {
      if (
        GATED.has(role) &&
        (this.variant || "light") !== (mode === "dark" ? "dark" : "light")
      ) {
        return undefined;
      }
      return this.colors[role];
    },
    palette: (builtin) => [...builtin],
  };
}

let current = null;
function installAdapter(l) {
  current = l;
  globalThis[SLOT] = {
    igniteui: { version: 1, name: "igniteui", rev: 1, read: () => current },
  };
}

// The feature registry every ApexCharts copy shares; ApexCharts' own add-on
// (`apexcharts/features/ignite-ui`) puts its stylesheet there.
const FEATURES = "__apexcharts_features_v1__";
let savedFeatures;
function installChartsAddon() {
  globalThis[FEATURES] = new Map([
    ["designSystemStyles", { name: "igniteui", css: "" }],
  ]);
}

function ohlcData(n = 40) {
  return Array.from({ length: n }, (_, i) => ({
    x: new Date(2020, 0, i + 1).getTime(),
    y: [10 + i, 12 + i, 9 + i, 11 + i],
    v: 1000 + i,
  }));
}

function installApexChartsMock() {
  global.ApexCharts = vi.fn(function (el, opts) {
    return {
      el,
      options: opts,
      w: {
        globals: { chartID: "chart", dataPoints: 40, minX: 0, maxX: 39 },
        config: {
          chart: { type: "candlestick" },
          series: (opts && opts.series) || [],
          yaxis: [{}],
          annotations: {},
        },
      },
      render: vi.fn(),
      destroy: vi.fn(),
      addEventListener: vi.fn(),
      updateSeries: vi.fn(),
      updateOptions: vi.fn(),
      removeAnnotation: vi.fn(),
      addYaxisAnnotation: vi.fn(),
      addXaxisAnnotation: vi.fn(),
      addPointAnnotation: vi.fn(),
      zoomX: vi.fn(),
    };
  });
}

/**
 * @param {object} [extra] - Options merged into the chart's.
 * @param {Object<string, string>} [tokens] - `--apx-*` tokens set on the
 *   page's wrapper before the chart is built.
 */
function makeInstance(extra = {}, tokens = {}) {
  const parent = document.createElement("div");
  for (const name of Object.keys(tokens)) {
    parent.style.setProperty(name, tokens[name]);
  }
  const container = document.createElement("div");
  parent.appendChild(container);
  document.body.appendChild(parent);
  return new ApexStock(container, {
    chart: { height: 400 },
    series: [{ name: "Price", data: ohlcData() }],
    ...extra,
  });
}

const prop = (el, name) => el.style.getPropertyValue(name);
const firstAxis = (y) => (Array.isArray(y) ? y[0] : y);
const mainUpdate = (inst) =>
  inst.chart.updateOptions.mock.calls
    .map((c) => c[0])
    .filter((o) => o && o.plotOptions && o.plotOptions.candlestick)
    .at(-1);
/** The options the RSI pane's chart is built with. */
const rsiPane = (inst) => {
  inst.updateIndicator("rsi");
  return global.ApexCharts.mock.calls.at(-1)[1];
};

beforeEach(() => {
  installApexChartsMock();
  savedFeatures = globalThis[FEATURES];
  delete globalThis[FEATURES];
});
afterEach(() => {
  delete globalThis[SLOT];
  if (savedFeatures) globalThis[FEATURES] = savedFeatures;
  else delete globalThis[FEATURES];
  current = null;
  document.body.innerHTML = "";
  delete global.ApexCharts;
});

describe("without an add-on", () => {
  it("reads nothing and writes no design-system property", () => {
    const inst = makeInstance();
    inst.render();
    expect(inst.themeManager.designSystem).toBeNull();
    expect(inst.chartEl.getAttribute("style") || "").not.toContain(
      "--_apexstock-ds"
    );
    expect(inst.primaryToolbar.getAttribute("style") || "").not.toContain(
      "--_apexstock-ds"
    );
  });

  it("pins the colors it sends the main chart", () => {
    const opts = makeInstance().mainChartOptions;
    expect(opts.grid.borderColor).toBe("#e9ecef");
    expect(firstAxis(opts.yaxis).labels.style.colors).toBe("#333");
    expect(opts.plotOptions.candlestick.colors).toEqual({
      upward: "#00B746",
      downward: "#EF403C",
    });
    expect(opts.theme).toBeUndefined();
  });

  it("builds an indicator pane with its mode alone", () => {
    for (const theme of [
      undefined,
      { accessibility: { colorBlindMode: "deuteranopia" } },
      { monochrome: { enabled: true } },
    ]) {
      const inst = makeInstance({
        chart: { height: 400, fontFamily: "Georgia, serif" },
        ...(theme ? { theme } : {}),
      });
      inst.render();
      const pane = rsiPane(inst);
      expect(pane.theme).toEqual({ mode: "light" });
      expect(pane.chart).not.toHaveProperty("fontFamily");
    }
  });
});

describe("with a light design system", () => {
  beforeEach(() => installAdapter(layer({ variant: "light" })));

  it("writes its roles on the chart's own elements", () => {
    const inst = makeInstance();
    inst.render();
    for (const el of [inst.chartEl, inst.primaryToolbar]) {
      expect(prop(el, "--_apexstock-ds-fore")).toBe("#424242");
      expect(prop(el, "--_apexstock-ds-grid")).toBe("#e0e0e0");
      expect(prop(el, "--_apexstock-ds-accent")).toBe("#0099ff");
      expect(prop(el, "--_apexstock-ds-up")).toBe("#4eb862");
      expect(prop(el, "--_apexstock-ds-font")).toBe(
        "Titillium Web, sans-serif"
      );
      // No overlay role on this sheet (Ignite UI before 7.5).
      expect(prop(el, "--_apexstock-ds-overlay")).toBe("");
    }
    // The consumer's wrapper gets nothing.
    expect(inst.chartEl.parentNode.getAttribute("style") || "").not.toContain(
      "--_apexstock-ds"
    );
  });

  it("maps up and down to its success and error colors", () => {
    const inst = makeInstance();
    inst.render();
    expect(inst.mainChartOptions.plotOptions.candlestick.colors).toEqual({
      upward: "#4eb862",
      downward: "#ff134a",
    });
    expect([inst.legend._upColor(), inst.analysisPanel._downColor()]).toEqual([
      "#4eb862",
      "#ff134a",
    ]);
    const t = inst.themeManager.getColors().tradingOverlays;
    expect([t.buy, t.stopLoss, t.order]).toEqual([
      "#4eb862",
      "#ff134a",
      "#0099ff",
    ]);
    expect(inst.themeManager.getUpDown(ThemeManager.SWITCH_UP_DOWN)).toEqual({
      up: "#4eb862",
      down: "#ff134a",
    });
  });

  it("sends the chart no grid or axis-text color, so it reads them itself", () => {
    installChartsAddon();
    const inst = makeInstance();
    const opts = inst.mainChartOptions;
    expect(opts.grid).not.toHaveProperty("borderColor");
    expect(firstAxis(opts.yaxis).labels.style.colors).toEqual([]);
    // The mode stays the chart's own (light, unset).
    expect(opts.theme).toBeUndefined();
    // Indicator panes too.
    expect(inst.themeManager.paneGridColor("#e9ecef")).toBeUndefined();
  });

  it("keeps the built-in grid and axis text while the charts cannot read it", () => {
    // ApexCharts' own add-on is not loaded (a script-tag page that loaded
    // only ApexStock's), so the plot keeps the colors it has without one.
    const inst = makeInstance();
    const opts = inst.mainChartOptions;
    expect(opts.grid.borderColor).toBe("#e9ecef");
    expect(firstAxis(opts.yaxis).labels.style.colors).toBe("#333");
    expect(inst.themeManager.paneGridColor("#e9ecef")).toBe("#e9ecef");
    // Its own chrome and the candles still follow the design system.
    expect(opts.plotOptions.candlestick.colors.upward).toBe("#4eb862");
  });

  it("still sends a grid and axis-text color the page passed", () => {
    installChartsAddon();
    const inst = makeInstance({
      grid: { borderColor: "#123456" },
      yaxis: { labels: { style: { colors: "#654321" } } },
    });
    const opts = inst.mainChartOptions;
    expect(opts.grid.borderColor).toBe("#123456");
    expect(firstAxis(opts.yaxis).labels.style.colors).toBe("#654321");
    expect(inst.themeManager.paneGridColor("#e9ecef")).toBe("#123456");
  });

  it("keeps a grid color passed to update() over a theme change", () => {
    installChartsAddon();
    const inst = makeInstance();
    inst.render();
    inst.update({ grid: { borderColor: "#abcdef" } });
    inst.updateTheme("dark");
    inst.updateTheme("light");
    expect(mainUpdate(inst).grid.borderColor).toBe("#abcdef");
  });

  it("styles the legend and analysis panel from it", () => {
    const inst = makeInstance();
    inst.render();
    expect(inst.legend._chrome("fore", "#1f2937")).toBe("#424242");
    expect(inst.analysisPanel._muted()).toBe("#8a8a8a");
    expect(inst.legend._font("system-ui")).toBe("Titillium Web, sans-serif");
    expect(inst.primaryToolbar.style.color).toBe("rgb(66, 66, 66)");
  });

  it("leaves the font alone where the page chose chart.fontFamily", () => {
    const inst = makeInstance({
      chart: { height: 400, fontFamily: "Georgia, serif" },
    });
    inst.render();
    expect(inst.legend._font("system-ui")).toBe("system-ui");
    expect(prop(inst.chartEl, "--_apexstock-font")).toBe("Georgia, serif");
  });

  it("lets a --apx-* token outrank it on the surfaces styled from JS", () => {
    const inst = makeInstance();
    // On the page's wrapper: ApexStock owns the inline --apx-* on its container.
    inst.chartEl.parentNode.style.setProperty("--apx-fore", "#0a0a0a");
    inst.render();
    inst.update({});
    expect(inst.legend._chrome("fore", "#1f2937")).toBe("#0a0a0a");
    // A role with no --apx-* token keeps the design system's.
    expect(inst.legend._chrome("muted", "#667085")).toBe("#8a8a8a");
  });

  it("writes a --apx-* token over it for the stylesheet's chains too", () => {
    const inst = makeInstance(
      {},
      { "--apx-fore": "#c80000", "--apx-grid": "#009600" }
    );
    inst.render();
    // The toolbar controls read only these, so they agree with the toolbar
    // and legend styled from JS.
    for (const el of [inst.chartEl, inst.primaryToolbar]) {
      expect(prop(el, "--_apexstock-ds-fore")).toBe("#c80000");
      expect(prop(el, "--_apexstock-ds-grid")).toBe("#009600");
      expect(prop(el, "--_apexstock-ds-muted")).toBe("#8a8a8a");
    }
    expect(inst.primaryToolbar.style.color).toBe("rgb(200, 0, 0)");
    expect(inst.primaryToolbar.style.borderColor).toBe("rgb(0, 150, 0)");
  });

  it("sends --apx-grid, not its own grid, once a grid color was sent", () => {
    installChartsAddon();
    const inst = makeInstance({}, { "--apx-grid": "#009600" });
    inst.render();
    expect(inst.mainChartOptions.grid).not.toHaveProperty("borderColor");
    // The dark round trip sends the built-in dark grid, which ApexCharts then
    // holds as the page's, so the way back has to send one.
    inst.updateTheme("dark");
    inst.updateTheme("light");
    expect(mainUpdate(inst).grid.borderColor).toBe("#009600");
  });

  it("forgets a preset's --apx-* values once the preset is off", () => {
    const inst = makeInstance({ theme: { preset: "mint" } });
    inst.render();
    // The preset writes them on the container...
    expect(prop(inst.chartEl, "--apx-fore")).toBe(
      ThemePresets.get("mint").axis
    );
    // ...and they never pass for the page's: leaving the preset reads the
    // tokens before they are cleared.
    inst.updateTheme("light");
    expect(prop(inst.chartEl, "--apx-fore")).toBe("");
    expect(prop(inst.chartEl, "--_apexstock-ds-fore")).toBe("#424242");
    expect(inst.primaryToolbar.style.color).toBe("rgb(66, 66, 66)");
  });

  it("gives an indicator pane its font and leaves its colors to it", () => {
    installChartsAddon();
    const inst = makeInstance();
    inst.render();
    const pane = rsiPane(inst);
    expect(pane.theme).toEqual({ mode: "light" });
    expect(pane.chart).not.toHaveProperty("fontFamily");
    expect(pane.grid).not.toHaveProperty("borderColor");
  });

  it("gives an indicator pane the page's font over its own", () => {
    const inst = makeInstance({
      chart: { height: 400, fontFamily: "Georgia, serif" },
    });
    inst.render();
    expect(rsiPane(inst).chart.fontFamily).toBe("Georgia, serif");
  });

  for (const theme of [
    { designSystem: false },
    { tokens: false },
    { accessibility: { colorBlindMode: "deuteranopia" } },
    { monochrome: { enabled: true } },
    { preset: "mint" },
  ]) {
    it(`turns it off for an indicator pane with theme ${JSON.stringify(theme)}`, () => {
      const inst = makeInstance({ theme });
      inst.render();
      const pane = rsiPane(inst);
      expect(pane.theme.designSystem).toBe(false);
      expect(pane.theme.mode).toBe(inst.theme);
      // Its font still applies where only its colors are off.
      const colorsOnly = !("designSystem" in theme) && !("tokens" in theme);
      expect(pane.chart.fontFamily).toBe(
        colorsOnly ? "Titillium Web, sans-serif" : undefined
      );
    });
  }

  it("ranks below a preset", () => {
    const inst = makeInstance({ theme: { preset: "mint" } });
    inst.render();
    const mint = ThemePresets.get("mint");
    expect(inst.mainChartOptions.plotOptions.candlestick.colors).toEqual({
      upward: mint.up,
      downward: mint.down,
    });
    expect(inst.mainChartOptions.grid.borderColor).toBe(mint.grid);
    expect(inst.themeManager.getColors().tradingOverlays.order).toBe(
      mint.accent
    );
    // A preset is a whole look: none of the design system's colors apply,
    // its font still does.
    for (const el of [inst.chartEl, inst.primaryToolbar]) {
      expect(el.getAttribute("style")).not.toMatch(/--_apexstock-ds-(?!font)/);
      expect(prop(el, "--_apexstock-ds-font")).toBe(
        "Titillium Web, sans-serif"
      );
    }
    expect(inst.legend._chrome("muted", "#667085")).toBe("#667085");
  });

  for (const off of [{ designSystem: false }, { tokens: false }]) {
    it(`is off with theme ${JSON.stringify(off)}`, () => {
      const inst = makeInstance({ theme: off });
      inst.render();
      expect(inst.themeManager.designSystem).toBeNull();
      expect(prop(inst.chartEl, "--_apexstock-ds-fore")).toBe("");
      expect(inst.mainChartOptions.grid.borderColor).toBe("#e9ecef");
      expect(inst.mainChartOptions.plotOptions.candlestick.colors.upward).toBe(
        "#00B746"
      );
    });
  }
});

describe("with a dark design system", () => {
  beforeEach(() =>
    installAdapter(
      layer({
        variant: "dark",
        colors: {
          ...LIGHT_COLORS,
          fore: "#f5f5f5",
          grid: "#8a8a8a",
          overlay: "#2f2f2f",
        },
      })
    )
  );

  it("fills an unset mode, with a transparent plot", () => {
    const inst = makeInstance();
    expect(inst.theme).toBe("dark");
    expect(inst.themeManager.modeSource).toBe("variant");
    const opts = inst.mainChartOptions;
    expect(opts.theme.mode).toBe("dark");
    expect(opts.tooltip.theme).toBe("dark");
    expect(opts.chart.background).toBe("transparent");
    inst.render();
    expect(inst.chartEl.classList.contains("apexstock-theme-dark")).toBe(true);
    expect(prop(inst.chartEl, "--_apexstock-ds-overlay")).toBe("#2f2f2f");
  });

  it("hands the plot to a --apx-surface token when it fills the mode", () => {
    const inst = makeInstance({}, { "--apx-surface": "#0a2850" });
    expect(inst.themeManager.modeSource).toBe("variant");
    // '' is unset for ApexCharts, so it paints the token, as after a runtime
    // switch; 'transparent' would count as the page's own and win.
    expect(inst.mainChartOptions.chart.background).toBe("");
  });

  it("keeps the plot transparent over a background ApexStock drops", () => {
    const inst = makeInstance({
      chart: { height: 400, background: "#102030" },
    });
    // A plain mode drops a construction background, so it counts as unset:
    // never nothing, which would leave ApexCharts' own dark paper.
    expect(inst.mainChartOptions.chart.background).toBe("transparent");
  });

  it("writes --apx-* tokens over its dark roles and its menu surface", () => {
    const inst = makeInstance(
      {},
      { "--apx-fore": "#c80000", "--apx-surface": "#0a2850" }
    );
    inst.render();
    expect(inst.theme).toBe("dark");
    expect(prop(inst.chartEl, "--_apexstock-ds-fore")).toBe("#c80000");
    expect(prop(inst.chartEl, "--_apexstock-ds-overlay")).toBe("#0a2850");
    expect(prop(inst.chartEl, "--_apexstock-ds-grid")).toBe("#8a8a8a");
  });

  it("leaves a mode the page passed alone, and its chrome roles off", () => {
    const inst = makeInstance({ theme: { mode: "light" } });
    inst.render();
    expect(inst.theme).toBe("light");
    // A dark sheet's text and hairlines never land on a light chart...
    expect(prop(inst.chartEl, "--_apexstock-ds-fore")).toBe("");
    expect(prop(inst.chartEl, "--_apexstock-ds-overlay")).toBe("");
    expect(inst.mainChartOptions.grid.borderColor).toBe("#e9ecef");
    // ...but its brand and semantic colors do.
    expect(prop(inst.chartEl, "--_apexstock-ds-up")).toBe("#4eb862");
  });

  it("ranks below a preset's mode", () => {
    const inst = makeInstance({ theme: { preset: "paper" } });
    expect(inst.theme).toBe("light");
    expect(inst.themeManager.modeSource).toBe("preset");
  });

  for (const mode of [
    { accessibility: { colorBlindMode: "deuteranopia" } },
    { monochrome: { enabled: true } },
  ]) {
    it(`gives up its colors, not its mode, with ${JSON.stringify(mode)}`, () => {
      const inst = makeInstance({ theme: mode });
      inst.render();
      expect(inst.theme).toBe("dark");
      expect(inst.chartEl.getAttribute("style")).not.toMatch(
        /--_apexstock-ds-(?!font)/
      );
      expect(prop(inst.chartEl, "--_apexstock-ds-font")).toBe(
        "Titillium Web, sans-serif"
      );
      expect(inst.mainChartOptions.plotOptions.candlestick.colors).toEqual({
        upward: "#26A69A",
        downward: "#EF5350",
      });
    });
  }

  it("is followed on update() and stops once the page picks a mode", () => {
    installAdapter(layer({ variant: "light" }));
    const inst = makeInstance();
    inst.render();
    expect(inst.theme).toBe("light");
    // A stylesheet swap to the dark sheet, picked up on the next update().
    installAdapter(
      layer({ variant: "dark", colors: { ...LIGHT_COLORS, fore: "#f5f5f5" } })
    );
    inst.update({});
    expect(inst.theme).toBe("dark");
    expect(mainUpdate(inst).theme.mode).toBe("dark");
    inst.updateTheme("light");
    installAdapter(layer({ variant: "dark" }));
    inst.update({});
    expect(inst.theme).toBe("light");
  });
});

describe("an add-on loaded after the chart", () => {
  it("applies on the next update()", () => {
    const inst = makeInstance();
    inst.render();
    expect(prop(inst.chartEl, "--_apexstock-ds-fore")).toBe("");
    installAdapter(layer({ variant: "light" }));
    inst.update({});
    expect(prop(inst.chartEl, "--_apexstock-ds-fore")).toBe("#424242");
    expect(mainUpdate(inst).plotOptions.candlestick.colors).toEqual({
      upward: "#4eb862",
      downward: "#ff134a",
    });
  });
});
