// @vitest-environment jsdom
//
// Theme preset pack (#37) + registerTheme (#38): the ThemePresets registry, the
// ThemeManager preset layer (chart-color overrides + chrome tokens + reset), and
// the ApexStock static/instance API plus state round-trip.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import ThemePresets from "../src/core/ThemePresets.js";
import ThemeManager from "../src/core/ThemeManager.js";
import ApexStock from "../src/ApexStock.js";

const BUILT_INS = ["paper", "arctic", "mint", "linen", "rose", "graphite"];

describe("ThemePresets registry", () => {
  it("exposes the built-in light-first pack", () => {
    const names = ThemePresets.names();
    BUILT_INS.forEach((n) => expect(names).toContain(n));
    expect(ThemePresets.has("mint")).toBe(true);
    expect(ThemePresets.has("nope")).toBe(false);
  });

  it("get() returns a complete def copy, or null", () => {
    const mint = ThemePresets.get("mint");
    expect(mint).toMatchObject({ mode: "light" });
    ["up", "down", "grid", "axis", "background", "accent"].forEach((k) =>
      expect(typeof mint[k]).toBe("string")
    );
    // A copy, not the internal object.
    mint.up = "#000000";
    expect(ThemePresets.get("mint").up).not.toBe("#000000");
    expect(ThemePresets.get("nope")).toBeNull();
  });

  it("resolve() normalizes names and partial defs, backfilling missing colors", () => {
    expect(ThemePresets.resolve("arctic")).toEqual(ThemePresets.get("arctic"));
    expect(ThemePresets.resolve("nope")).toBeNull();
    expect(ThemePresets.resolve(null)).toBeNull();

    const dark = ThemePresets.resolve({ mode: "dark", up: "#abcabc" });
    expect(dark.mode).toBe("dark");
    expect(dark.up).toBe("#abcabc");
    expect(typeof dark.down).toBe("string"); // backfilled from the dark baseline
    expect(typeof dark.background).toBe("string");

    const light = ThemePresets.resolve({ accent: "#123456" });
    expect(light.mode).toBe("light");
    expect(light.accent).toBe("#123456");
  });

  it("register() adds a custom preset (last write wins)", () => {
    expect(ThemePresets.register("", {})).toBeNull();
    expect(ThemePresets.register("brandx", null)).toBeNull();

    const def = ThemePresets.register("brandx", { accent: "#abcdef" });
    expect(def.accent).toBe("#abcdef");
    expect(ThemePresets.has("brandx")).toBe(true);
    expect(ThemePresets.names()).toContain("brandx");

    ThemePresets.register("brandx", { accent: "#ff0000", up: "#00ff00" });
    expect(ThemePresets.get("brandx").accent).toBe("#ff0000");
    expect(ThemePresets.get("brandx").up).toBe("#00ff00");
  });
});

describe("ThemeManager preset layer", () => {
  let tm;
  beforeEach(() => {
    tm = new ThemeManager({ chartOptions: {} }, "light");
  });

  it("defaults to a plain light mode (no preset)", () => {
    expect(tm.getTheme()).toBe("light");
    expect(tm.getPreset()).toBeNull();
  });

  it("applyPreset() sets the base mode and overrides chart colors", () => {
    const mint = ThemePresets.get("mint");
    expect(tm.applyPreset("mint")).toBe(true);
    expect(tm.getPreset()).toBe("mint");
    expect(tm.isDark()).toBe(false);

    const cfg = tm.getChartConfig();
    expect(cfg.plotOptions.candlestick.colors).toEqual({
      upward: mint.up,
      downward: mint.down,
    });
    expect(cfg.grid.borderColor).toBe(mint.grid);
    expect(cfg.yaxis.labels.style.colors).toBe(mint.axis);
    expect(cfg.chart.background).toBe(mint.background);
  });

  it("re-tints the price-line roles to match the preset", () => {
    tm.applyPreset("rose");
    const rose = ThemePresets.get("rose");
    const to = tm.getColors().tradingOverlays;
    expect(to.buy).toBe(rose.up);
    expect(to.takeProfit).toBe(rose.up);
    expect(to.sell).toBe(rose.down);
    expect(to.stopLoss).toBe(rose.down);
    expect(to.order).toBe(rose.accent);
  });

  it("applyPreset() returns false for an unknown name", () => {
    expect(tm.applyPreset("nope")).toBe(false);
    expect(tm.getPreset()).toBeNull();
  });

  it("supports an inline (dark) preset def", () => {
    tm.applyPreset({ mode: "dark", up: "#abcabc", down: "#defdef" });
    expect(tm.isDark()).toBe(true);
    expect(tm.getChartConfig().plotOptions.candlestick.colors.upward).toBe("#abcabc");
  });

  it("syncChartOptionsToTheme writes preset colors and resets to defaults on setTheme", () => {
    tm.applyPreset("linen");
    const linen = ThemePresets.get("linen");
    const opts = {};
    tm.syncChartOptionsToTheme(opts);
    expect(opts.plotOptions.candlestick.colors).toEqual({
      upward: linen.up,
      downward: linen.down,
    });
    expect(opts.chart.background).toBe(linen.background);
    expect(opts.grid.borderColor).toBe(linen.grid);

    // Switch to a plain dark mode: preset cleared, colors reset, bg removed.
    tm.setTheme("dark");
    expect(tm.getPreset()).toBeNull();
    tm.syncChartOptionsToTheme(opts);
    expect(opts.plotOptions.candlestick.colors).toEqual({
      upward: "#26A69A",
      downward: "#EF5350",
    });
    expect("background" in opts.chart).toBe(false);
  });

  it("applyThemeStyles sets --apx-* tokens for a preset and clears them otherwise", () => {
    const container = document.createElement("div");
    tm.applyPreset("arctic");
    const arctic = ThemePresets.get("arctic");
    tm.applyThemeStyles(container, null);
    expect(container.style.getPropertyValue("--apx-accent")).toBe(arctic.accent);
    expect(container.style.getPropertyValue("--apx-surface")).toBe(arctic.background);

    tm.setTheme("light");
    tm.applyThemeStyles(container, null);
    expect(container.style.getPropertyValue("--apx-accent")).toBe("");
    expect(container.style.getPropertyValue("--apx-surface")).toBe("");
  });
});

// ---- ApexStock static + instance API (with a light ApexCharts mock) ----

function ohlcData(n = 40) {
  return Array.from({ length: n }, (_, i) => ({
    x: new Date(2020, 0, i + 1).getTime(),
    y: [10 + i, 12 + i, 9 + i, 11 + i],
    v: 1000 + i,
  }));
}

function installApexChartsMock() {
  global.ApexCharts = vi.fn(function (el, opts) {
    const inst = {
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
    return inst;
  });
}

function makeInstance(theme) {
  const parent = document.createElement("div");
  const container = document.createElement("div");
  parent.appendChild(container);
  document.body.appendChild(parent);
  return new ApexStock(container, {
    chart: { height: 400 },
    theme: theme || { mode: "light" },
    series: [{ name: "Price", data: ohlcData() }],
  });
}

describe("ApexStock theme presets (static + instance)", () => {
  beforeEach(() => installApexChartsMock());
  afterEach(() => {
    document.body.innerHTML = "";
    delete global.ApexCharts;
  });

  it("exposes the presets statically and registers custom ones", () => {
    const names = ApexStock.getThemePresets();
    BUILT_INS.forEach((n) => expect(names).toContain(n));
    ApexStock.registerTheme("corp", { accent: "#0a3d62", up: "#2ecc71" });
    expect(ApexStock.getThemePresets()).toContain("corp");
  });

  it("applies a preset from construction (theme.preset)", () => {
    const inst = makeInstance({ preset: "mint" });
    const mint = ThemePresets.get("mint");
    expect(inst.getThemePreset()).toBe("mint");
    expect(inst.getTheme()).toBe("light");
    // Baked into the options handed to ApexCharts.
    expect(inst.chart.options.plotOptions.candlestick.colors).toEqual({
      upward: mint.up,
      downward: mint.down,
    });
    expect(inst.chart.options.chart.background).toBe(mint.background);
  });

  it("warns and falls back to the mode for an unknown preset", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const inst = makeInstance({ preset: "does-not-exist", mode: "dark" });
    expect(inst.getThemePreset()).toBeNull();
    expect(inst.getTheme()).toBe("dark");
    warn.mockRestore();
  });

  it("setThemePreset switches at runtime and pushes the new colors", () => {
    const inst = makeInstance({ mode: "light" });
    inst.render();
    inst.chart.updateOptions.mockClear();

    const ret = inst.setThemePreset("arctic");
    expect(ret).toBe(inst); // chainable
    expect(inst.getThemePreset()).toBe("arctic");

    const arctic = ThemePresets.get("arctic");
    const lastArg = inst.chart.updateOptions.mock.calls.at(-1)[0];
    expect(lastArg.plotOptions.candlestick.colors).toEqual({
      upward: arctic.up,
      downward: arctic.down,
    });
  });

  it("updateTheme clears an active preset", () => {
    const inst = makeInstance({ preset: "mint" });
    inst.render();
    expect(inst.getThemePreset()).toBe("mint");

    inst.updateTheme("dark");
    expect(inst.getThemePreset()).toBeNull();
    expect(inst.getTheme()).toBe("dark");
  });

  it("round-trips the preset through getState/setState", () => {
    const a = makeInstance({ mode: "light" });
    a.render();
    a.setThemePreset("graphite");
    const state = JSON.parse(JSON.stringify(a.getState()));
    expect(state.theme).toMatchObject({ mode: "light", preset: "graphite" });

    const b = makeInstance({ mode: "light" });
    b.render();
    b.setState(state);
    expect(b.getThemePreset()).toBe("graphite");
  });
});
