// @vitest-environment jsdom
//
// Runtime theme changes reaching every theme-dependent surface:
// - the main ApexCharts pane gets the top-level `theme.mode` (ApexCharts never
//   read the old `chart.theme.mode`), an explicit tooltip theme and a plot
//   background, so its tooltip/foreColor/paper follow updateTheme() and
//   setThemePreset() instead of staying in the construction theme;
// - the drawing popup follows its own chart, not the whole page;
// - the legend and analysis panel take up/down from the active theme (so a
//   preset's candles and their rise/fall colors agree).
// Each block also pins today's default output, which must not change.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import ThemeManager from "../src/core/ThemeManager.js";
import ThemePresets from "../src/core/ThemePresets.js";
import ApexStock from "../src/ApexStock.js";
import Legend from "../src/components/Legend.js";
import AnalysisPanel from "../src/components/AnalysisPanel.js";
import SelectedElementPopup from "../src/components/SelectedElementPopup.js";

const DARK_PRESET = {
  mode: "dark",
  up: "#22d3ee",
  down: "#f472b6",
  grid: "#2a2440",
  axis: "#c4b5fd",
  background: "#1a1528",
  accent: "#22d3ee",
};

describe("ThemeManager up/down (one source)", () => {
  it("pins the plain-mode candle defaults", () => {
    const colors = (mode) =>
      new ThemeManager({}, mode).getChartConfig().plotOptions.candlestick
        .colors;
    expect(colors("light")).toEqual({ upward: "#00B746", downward: "#EF403C" });
    expect(colors("dark")).toEqual({ upward: "#26A69A", downward: "#EF5350" });
  });

  it("getUpDown returns the plain-mode defaults", () => {
    expect(new ThemeManager({}, "light").getUpDown()).toEqual({
      up: "#00B746",
      down: "#EF403C",
    });
    expect(new ThemeManager({}, "dark").getUpDown()).toEqual({
      up: "#26A69A",
      down: "#EF5350",
    });
    expect(ThemeManager.modeUpDown(false)).toEqual({
      up: "#00B746",
      down: "#EF403C",
    });
  });

  it("returns the preset's up/down and drops back on setTheme", () => {
    const tm = new ThemeManager({}, "light");
    tm.applyPreset("mint");
    const mint = ThemePresets.get("mint");
    expect(tm.getUpDown()).toEqual({ up: mint.up, down: mint.down });
    tm.setTheme("light");
    expect(tm.getUpDown()).toEqual({ up: "#00B746", down: "#EF403C" });
  });

  it("colors the page passed win over the preset until cleared", () => {
    const tm = new ThemeManager({}, "light");
    tm.applyPreset("mint");
    tm.explicitUpDown = { up: "#0000ff", down: "#ff00ff" };
    expect(tm.getUpDown()).toEqual({ up: "#0000ff", down: "#ff00ff" });
    const mint = ThemePresets.get("mint");
    expect(tm.getThemeUpDown()).toEqual({ up: mint.up, down: mint.down });
    tm.explicitUpDown = null;
    expect(tm.getUpDown()).toEqual({ up: mint.up, down: mint.down });
  });

  it("getChartConfig and syncChartOptionsToTheme agree with getUpDown", () => {
    const tm = new ThemeManager({}, "light");
    tm.applyPreset(DARK_PRESET);
    const cfg = tm.getChartConfig();
    const opts = tm.syncChartOptionsToTheme({});
    const want = { upward: DARK_PRESET.up, downward: DARK_PRESET.down };
    expect(cfg.plotOptions.candlestick.colors).toEqual(want);
    expect(opts.plotOptions.candlestick.colors).toEqual(want);
  });
});

describe("ThemeManager.getChartConfig (default pinned)", () => {
  it("pins the plain light config", () => {
    const cfg = new ThemeManager({}, "light").getChartConfig();
    expect(cfg.theme).toBeUndefined();
    expect(cfg.tooltip).toEqual({ theme: "light" });
    expect(cfg.grid).toEqual({ borderColor: "#e9ecef", strokeDashArray: 3 });
    expect(cfg.yaxis.labels.style.colors).toBe("#333");
  });

  it("no longer writes the dead chart.theme (ApexCharts never read it)", () => {
    expect(new ThemeManager({}, "light").getChartConfig().chart).toEqual({});
    expect(new ThemeManager({}, "dark").getChartConfig().chart).toEqual({});
  });

  it("returns a fresh chart object every call", () => {
    const tm = new ThemeManager({}, "light");
    expect(tm.getChartConfig().chart).not.toBe(tm.getChartConfig().chart);
  });
});

describe("ThemeManager.syncChartModeToTheme", () => {
  it("writes top-level theme.mode, tooltip.theme and a transparent plot", () => {
    const tm = new ThemeManager({}, "dark");
    const opts = { tooltip: { theme: "light" }, chart: {} };
    tm.syncChartModeToTheme(opts);
    expect(opts.theme).toEqual({ mode: "dark" });
    expect(opts.tooltip.theme).toBe("dark");
    expect(opts.chart.background).toBe("transparent");
  });

  it("merges into the consumer's theme keys and drops the ApexStock-only preset key", () => {
    const tm = new ThemeManager({}, "light");
    const consumerTheme = { mode: "dark", palette: "palette7", preset: "mint" };
    const opts = { theme: consumerTheme };
    tm.syncChartModeToTheme(opts);
    expect(opts.theme).toEqual({ mode: "light", palette: "palette7" });
    // The consumer's own object is not mutated.
    expect(consumerTheme).toEqual({
      mode: "dark",
      palette: "palette7",
      preset: "mint",
    });
  });

  it("keeps a tooltip theme the page named", () => {
    const tm = new ThemeManager({}, "dark");
    const opts = { tooltip: { theme: "light" } };
    tm.syncChartModeToTheme(opts, { tooltipTheme: true });
    expect(opts.tooltip.theme).toBe("light");
    expect(opts.theme.mode).toBe("dark");
  });

  it("keeps a plot background the page passed", () => {
    const tm = new ThemeManager({}, "dark");
    const opts = { chart: { background: "#0b0e11" } };
    tm.syncChartModeToTheme(opts, { chartBackground: true });
    expect(opts.chart.background).toBe("#0b0e11");
  });

  it("hands the plot back to a --apx-surface token with an empty background", () => {
    const tm = new ThemeManager({}, "dark");
    const opts = { chart: { background: "transparent" } };
    tm.syncChartModeToTheme(opts, { tokenSurface: true });
    expect(opts.chart.background).toBe("");
  });

  it("leaves a preset's own plot background alone", () => {
    const tm = new ThemeManager({}, "light");
    tm.applyPreset(DARK_PRESET);
    const opts = tm.syncChartOptionsToTheme({});
    tm.syncChartModeToTheme(opts);
    expect(opts.chart.background).toBe(DARK_PRESET.background);
    expect(opts.theme.mode).toBe("dark");
    expect(opts.tooltip.theme).toBe("dark");
  });
});

// ---- ApexStock with a light ApexCharts mock ----

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

function makeInstance(extra = {}) {
  const parent = document.createElement("div");
  const container = document.createElement("div");
  parent.appendChild(container);
  document.body.appendChild(parent);
  return new ApexStock(container, {
    chart: { height: 400 },
    series: [{ name: "Price", data: ohlcData() }],
    ...extra,
  });
}

const lastUpdate = (inst) => inst.chart.updateOptions.mock.calls.at(-1)[0];
// update() follows its main call with layout-only ones (heights), so pick the
// last call that carries the candle colors.
const mainUpdate = (inst) =>
  inst.chart.updateOptions.mock.calls
    .map((c) => c[0])
    .filter((o) => o && o.plotOptions && o.plotOptions.candlestick)
    .at(-1);

describe("ApexStock main pane on a runtime theme change", () => {
  beforeEach(() => installApexChartsMock());
  afterEach(() => {
    document.body.innerHTML = "";
    delete global.ApexCharts;
  });

  it("pins the construction options for a chart built with no theme option", () => {
    const inst = makeInstance();
    const o = inst.chart.options;
    // No top-level theme, so ApexCharts keeps its own unset mode.
    expect("theme" in o).toBe(false);
    expect("background" in o.chart).toBe(false);
    expect(o.tooltip.theme).toBe("light");
    expect(o.plotOptions.candlestick.colors).toEqual({
      upward: "#00B746",
      downward: "#EF403C",
    });
    expect(o.yaxis.labels.style.colors).toBe("#333");
  });

  it("pins the construction options for theme { mode: 'dark' }", () => {
    const inst = makeInstance({ theme: { mode: "dark" } });
    const o = inst.chart.options;
    expect(o.theme).toEqual({ mode: "dark" });
    expect("background" in o.chart).toBe(false);
    expect(o.tooltip.theme).toBe("dark");
    expect(o.plotOptions.candlestick.colors).toEqual({
      upward: "#26A69A",
      downward: "#EF5350",
    });
  });

  it("constructs without the dead chart.theme key", () => {
    expect(makeInstance().chart.options.chart.theme).toBeUndefined();
  });

  it("updateTheme('dark') sends theme.mode, a dark tooltip and a transparent plot", () => {
    const inst = makeInstance();
    inst.render();
    inst.updateTheme("dark");
    const arg = lastUpdate(inst);
    expect(arg.theme).toEqual({ mode: "dark" });
    expect(arg.tooltip.theme).toBe("dark");
    expect(arg.chart.background).toBe("transparent");
    expect(arg.chart.theme).toBeUndefined();
  });

  it("a consumer theme.mode is rewritten, not re-sent stale", () => {
    const inst = makeInstance({ theme: { mode: "light" } });
    inst.render();
    inst.updateTheme("dark");
    expect(lastUpdate(inst).theme.mode).toBe("dark");
    inst.updateTheme("light");
    const arg = lastUpdate(inst);
    expect(arg.theme.mode).toBe("light");
    expect(arg.tooltip.theme).toBe("light");
    expect(arg.chart.background).toBe("transparent");
  });

  it("setThemePreset to a dark preset darkens the tooltip and drops the preset key", () => {
    ApexStock.registerTheme("rt-dark", DARK_PRESET);
    const inst = makeInstance({ theme: { preset: "paper" } });
    inst.render();
    inst.setThemePreset("rt-dark");
    const arg = lastUpdate(inst);
    expect(arg.theme).toEqual({ mode: "dark" });
    expect(arg.tooltip.theme).toBe("dark");
    expect(arg.chart.background).toBe(DARK_PRESET.background);
  });

  it("repoints a pre-7.7 ApexCharts tooltip at the live config", () => {
    const inst = makeInstance();
    inst.render();
    // ApexCharts < 7.7 held its construction tooltip config in an own
    // `tConfig` property and drew the element's theme class from it.
    const el = document.createElement("div");
    el.className = "apexcharts-tooltip apexcharts-theme-light";
    const tt = { tConfig: { theme: "light" }, getElTooltip: () => el };
    inst.chart.w.globals.tooltip = tt;
    inst.chart.updateOptions.mockImplementation((opts) => {
      inst.chart.w.config.tooltip = { ...opts.tooltip };
    });
    inst.updateTheme("dark");
    expect(tt.tConfig).toBe(inst.chart.w.config.tooltip);
    expect(el.className).toBe("apexcharts-tooltip apexcharts-theme-dark");
  });

  it("leaves a 7.7+ tooltip (live config accessor) alone", () => {
    const inst = makeInstance();
    inst.render();
    const getEl = vi.fn();
    const proto = {
      get tConfig() {
        return inst.chart.w.config.tooltip;
      },
    };
    const tt = Object.create(proto);
    tt.getElTooltip = getEl;
    inst.chart.w.globals.tooltip = tt;
    expect(() => inst.updateTheme("dark")).not.toThrow();
    expect(getEl).not.toHaveBeenCalled();
  });

  it("update({ theme: { mode } }) carries the plot background and tooltip too", () => {
    const inst = makeInstance({ theme: { mode: "light" } });
    inst.render();
    inst.update({ theme: { mode: "dark" } });
    const arg = mainUpdate(inst);
    expect(arg.theme).toEqual({ mode: "dark" });
    expect(arg.tooltip.theme).toBe("dark");
    expect(arg.chart.background).toBe("transparent");
  });

  it("update() without a mode change sends no theme keys (pinned)", () => {
    const inst = makeInstance();
    inst.render();
    inst.update({ chart: { height: 300 } });
    const arg = mainUpdate(inst);
    expect("theme" in arg).toBe(false);
    expect(arg.chart || {}).not.toHaveProperty("background");
    expect(arg.tooltip.theme).toBe("light");
  });

  it("keeps a tooltip theme the page named", () => {
    const inst = makeInstance({ tooltip: { theme: "dark" } });
    inst.render();
    inst.updateTheme("dark");
    inst.updateTheme("light");
    expect(lastUpdate(inst).tooltip.theme).toBe("dark");
  });

  it("update() keeps a plot background passed with the mode", () => {
    const inst = makeInstance();
    inst.render();
    inst.update({ theme: { mode: "dark" }, chart: { background: "#0b0e11" } });
    expect(mainUpdate(inst).chart.background).toBe("#0b0e11");
  });

  it("update() never writes into the caller's own objects", () => {
    const inst = makeInstance();
    inst.render();
    const passed = { theme: { mode: "dark" }, chart: { height: 380 } };
    inst.update(passed);
    expect(mainUpdate(inst).chart).not.toBe(passed.chart);
    expect(passed.chart).toEqual({ height: 380 });
    expect(passed.theme).toEqual({ mode: "dark" });

    const same = { theme: { mode: "dark" }, chart: { height: 300 } };
    inst.update(same);
    expect(mainUpdate(inst).chart).not.toBe(same.chart);
    expect(same.chart).toEqual({ height: 300 });
  });

  it("an --apx-surface token keeps the plot after a round trip", () => {
    const inst = makeInstance({ theme: { mode: "dark" } });
    inst.render();
    // ApexCharts records the token surface it painted.
    inst.chart.w.globals.tokenSurface = "black";
    inst.updateTheme("light");
    expect(lastUpdate(inst).chart.background).toBe("");
    inst.updateTheme("dark");
    expect(lastUpdate(inst).chart.background).toBe("");
    inst.update({ theme: { mode: "light" } });
    expect(mainUpdate(inst).chart.background).toBe("");
  });
});

// ---- A core that derives mode defaults over the payload (ApexCharts 7.1) ----

// ApexCharts 7.1 Theme.updateThemeOptions: a payload with a `theme` key gets
// the mode's tooltip theme, foreColor and palette, whatever it passed.
class Theme71 {
  updateThemeOptions(options) {
    options.chart = options.chart || {};
    options.tooltip = options.tooltip || {};
    const mode = options.theme.mode;
    options.tooltip.theme = mode || "light";
    options.chart.foreColor =
      mode === "dark"
        ? "#f6f7f8"
        : mode === "light"
          ? "#373d3f"
          : options.chart.foreColor || "#373d3f";
    options.theme.palette =
      mode === "dark"
        ? "palette4"
        : mode === "light"
          ? "palette1"
          : options.theme.palette || "palette1";
    return options;
  }
}

function emulateCore71(inst) {
  const chart = inst.chart;
  chart.theme = new Theme71();
  chart.w.config.theme = { mode: "", palette: "palette1" };
  chart.w.config.tooltip = { theme: "light" };
  chart.updateOptions.mockImplementation((options) => {
    if (options.theme) options = chart.theme.updateThemeOptions(options);
    const c = chart.w.config;
    chart.w.config = {
      ...c,
      chart: { ...c.chart, ...options.chart },
      theme: { ...c.theme, ...options.theme },
      tooltip: { ...c.tooltip, ...options.tooltip },
    };
  });
}

describe("ApexStock keeps the page's own theme keys on a 7.1-like core", () => {
  beforeEach(() => installApexChartsMock());
  afterEach(() => {
    document.body.innerHTML = "";
    delete global.ApexCharts;
  });

  const own = {
    chart: { height: 400, foreColor: "#334455" },
    theme: { palette: "palette7" },
    tooltip: { theme: "dark" },
  };

  it("updateTheme dark then light keeps tooltip.theme, foreColor and palette", () => {
    const inst = makeInstance(own);
    inst.render();
    emulateCore71(inst);
    for (const mode of ["dark", "light"]) {
      inst.updateTheme(mode);
      const c = inst.chart.w.config;
      expect(c.theme.mode).toBe(mode);
      expect(c.tooltip.theme).toBe("dark");
      expect(c.chart.foreColor).toBe("#334455");
      expect(c.theme.palette).toBe("palette7");
    }
    // The core's method is the prototype one again.
    expect(Object.hasOwn(inst.chart.theme, "updateThemeOptions")).toBe(false);
  });

  it("update({ theme: { mode } }) keeps them too", () => {
    const inst = makeInstance(own);
    inst.render();
    emulateCore71(inst);
    inst.update({ theme: { mode: "dark" } });
    const c = inst.chart.w.config;
    expect(c.theme.mode).toBe("dark");
    expect(c.tooltip.theme).toBe("dark");
    expect(c.chart.foreColor).toBe("#334455");
    expect(c.theme.palette).toBe("palette7");
  });

  it("does not write the core's mode defaults into mainChartOptions", () => {
    const inst = makeInstance();
    inst.render();
    emulateCore71(inst);
    inst.updateTheme("dark");
    inst.updateTheme("light");
    expect(inst.mainChartOptions.chart.foreColor).toBeUndefined();
    expect(inst.mainChartOptions.theme).toEqual({ mode: "light" });
  });

  it("pins the mode defaults for a page that set none", () => {
    const inst = makeInstance();
    inst.render();
    emulateCore71(inst);
    inst.updateTheme("dark");
    let c = inst.chart.w.config;
    expect([c.tooltip.theme, c.chart.foreColor, c.theme.palette]).toEqual([
      "dark",
      "#f6f7f8",
      "palette4",
    ]);
    inst.updateTheme("light");
    c = inst.chart.w.config;
    expect([c.tooltip.theme, c.chart.foreColor, c.theme.palette]).toEqual([
      "light",
      "#373d3f",
      "palette1",
    ]);
  });
});

// ---- Candle colors passed to update() ----

describe("candle colors passed to update()", () => {
  beforeEach(() => installApexChartsMock());
  afterEach(() => {
    document.body.innerHTML = "";
    delete global.ApexCharts;
  });

  const colors = { upward: "#0000ff", downward: "#ff00ff" };

  it("the legend and panel follow them until the theme colors return", () => {
    const inst = makeInstance({ theme: { preset: "paper" } });
    inst.render();
    const paper = ThemePresets.get("paper");
    inst.update({ plotOptions: { candlestick: { colors } } });
    expect(mainUpdate(inst).plotOptions.candlestick.colors).toEqual(colors);
    for (const comp of [inst.legend, inst.analysisPanel]) {
      expect([comp._upColor(), comp._downColor()]).toEqual([
        "#0000ff",
        "#ff00ff",
      ]);
    }
    // An update without colors puts the theme's back on the candles.
    inst.update({ chart: { height: 300 } });
    expect(inst.legend._upColor()).toBe(paper.up);
    inst.update({ plotOptions: { candlestick: { colors } } });
    inst.updateTheme("dark");
    expect([inst.legend._upColor(), inst.legend._downColor()]).toEqual([
      "#26A69A",
      "#EF5350",
    ]);
  });

  it("a missing side comes from the theme", () => {
    const inst = makeInstance();
    inst.render();
    inst.update({
      plotOptions: { candlestick: { colors: { upward: "#0000ff" } } },
    });
    expect([inst.legend._upColor(), inst.legend._downColor()]).toEqual([
      "#0000ff",
      "#EF403C",
    ]);
  });

  it("pins the theme colors when none are passed", () => {
    const inst = makeInstance();
    inst.render();
    inst.update({ chart: { height: 300 } });
    expect(mainUpdate(inst).plotOptions.candlestick.colors).toEqual({
      upward: "#00B746",
      downward: "#EF403C",
    });
    expect([inst.legend._upColor(), inst.legend._downColor()]).toEqual([
      "#00B746",
      "#EF403C",
    ]);
  });
});

// ---- Legend + AnalysisPanel up/down ----

function stubCtx(themeManager) {
  return {
    chartEl: document.createElement("div"),
    isDarkTheme: themeManager ? themeManager.isDark() : false,
    themeManager,
    analysisOptions: {},
    chartOptions: { series: [{ name: "X" }], legend: {} },
    on: () => () => {},
  };
}

describe("Legend and AnalysisPanel up/down colors", () => {
  it("pin the plain-mode defaults", () => {
    for (const C of [Legend, AnalysisPanel]) {
      const light = new C(stubCtx(new ThemeManager({}, "light")));
      expect([light._upColor(), light._downColor()]).toEqual([
        "#00B746",
        "#EF403C",
      ]);
      const dark = new C(stubCtx(new ThemeManager({}, "dark")));
      expect([dark._upColor(), dark._downColor()]).toEqual([
        "#26A69A",
        "#EF5350",
      ]);
      // A host without a ThemeManager (unit fakes) keeps the mode defaults.
      const bare = new C({ ...stubCtx(null), isDarkTheme: true });
      expect([bare._upColor(), bare._downColor()]).toEqual([
        "#26A69A",
        "#EF5350",
      ]);
    }
  });

  it("follow the active preset, as the candles do", () => {
    for (const C of [Legend, AnalysisPanel]) {
      const tm = new ThemeManager({}, "light");
      const comp = new C(stubCtx(tm));
      tm.applyPreset("mint");
      const mint = ThemePresets.get("mint");
      expect([comp._upColor(), comp._downColor()]).toEqual([
        mint.up,
        mint.down,
      ]);
      tm.applyPreset(DARK_PRESET);
      expect([comp._upColor(), comp._downColor()]).toEqual([
        DARK_PRESET.up,
        DARK_PRESET.down,
      ]);
    }
  });
});

// ---- Drawing popup ----

describe("SelectedElementPopup theme", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    document.body.className = "";
  });

  const make = (cls) => {
    const chart = document.createElement("div");
    chart.className = cls;
    document.body.appendChild(chart);
    const popup = new SelectedElementPopup(
      chart,
      () => {},
      () => {}
    );
    return { chart, popup };
  };

  it("does not take a dark class from another dark chart on the page", () => {
    make("apexstock-theme-dark");
    const { chart, popup } = make("apexstock-theme-light");
    expect(popup.popupElement.parentNode).toBe(chart);
    expect(popup.popupElement.classList.contains("apexstock-theme-dark")).toBe(
      false
    );
    popup.destroy();
  });

  it("does not take a dark class from body.dark-mode", () => {
    document.body.classList.add("dark-mode");
    const { popup } = make("apexstock-theme-light");
    expect(popup.popupElement.classList.contains("apexstock-theme-dark")).toBe(
      false
    );
    popup.destroy();
  });

  it("pins the popup's own classes for a single chart", () => {
    const { popup } = make("apexstock-theme-light");
    expect(popup.popupElement.className).toBe("apexstock-element-popup");
    popup.destroy();
  });
});
