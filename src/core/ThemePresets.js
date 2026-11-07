import { getTheme, registeredThemes, registerTheme } from "apex-commons";

/**
 * ThemePresets — a curated pack of named themes layered on the base light/dark
 * modes, plus the registry behind `ApexStock.registerTheme`.
 *
 * A preset is a small, declarative description of an *appearance*. It resolves
 * to two things the rest of the theme system already understands:
 *
 * 1. **Chart colors** (candlestick up/down, grid, axis label, plot background),
 *    merged into {@link ThemeManager#getChartConfig} — these paint the
 *    ApexCharts SVG, which is driven from JS, not CSS.
 * 2. **Chrome tokens** (accent / surface / foreground / grid), applied as inline
 *    `--apx-*` family custom properties on the chart container so ApexStock's
 *    own chrome (toolbar, dropdowns, legend, tooltip) follows through the
 *    documented token cascade (see THEMING.md) with no extra plumbing.
 *
 * Every preset declares a base `mode` (`"light"` | `"dark"`) so the existing
 * `isDarkTheme` logic (ApexCharts `theme.mode`, indicator palette, etc.) keeps
 * working unchanged; the preset only overrides the handful of colors that give
 * it character. The built-in pack is light-first (fintech/SaaS dashboards);
 * consumers add their own with `ApexStock.registerTheme(name, def)`.
 *
 * @typedef {Object} ThemePreset
 * @property {"light"|"dark"} mode - Base mode the preset builds on.
 * @property {string} up - Candlestick up color.
 * @property {string} down - Candlestick down color.
 * @property {string} grid - Grid + border color.
 * @property {string} axis - Axis label text color.
 * @property {string} background - Plot background.
 * @property {string} accent - Brand/accent color (focus rings, order line, active tool).
 */

/** @type {Object.<string, ThemePreset>} */
const BUILT_IN = {
  // Light-first fintech/SaaS pack. Conventional green-up / red-down candles
  // throughout (financial legibility); each preset's character comes from its
  // accent + a subtle background tint.
  paper: {
    mode: "light",
    up: "#16a34a",
    down: "#dc2626",
    grid: "#eef0f3",
    axis: "#475467",
    background: "#ffffff",
    accent: "#6366f1",
  },
  arctic: {
    mode: "light",
    up: "#16a34a",
    down: "#e11d48",
    grid: "#e5eaf0",
    axis: "#3f4a5a",
    background: "#f8fafc",
    accent: "#0284c7",
  },
  mint: {
    mode: "light",
    up: "#10b981",
    down: "#ef4444",
    grid: "#e6f2ec",
    axis: "#3f5147",
    background: "#f4fbf7",
    accent: "#14b8a6",
  },
  linen: {
    mode: "light",
    up: "#059669",
    down: "#dc2626",
    grid: "#efe7d8",
    axis: "#5b5344",
    background: "#fbf7ef",
    accent: "#7c3aed",
  },
  rose: {
    mode: "light",
    up: "#16a34a",
    down: "#e11d48",
    grid: "#f3e3ea",
    axis: "#5b4650",
    background: "#fdf6f8",
    accent: "#be185d",
  },
  graphite: {
    mode: "light",
    up: "#22c55e",
    down: "#ef4444",
    grid: "#e5e7eb",
    axis: "#334155",
    background: "#f5f6f8",
    accent: "#334155",
  },
};

const REQUIRED = ["up", "down", "grid", "axis", "background", "accent"];

/**
 * A theme from the family registry as a preset def. A preset registered here
 * carries its own fields; a theme another product registered carries only the
 * family `tokens` (and maybe a `mode`), which fill the matching roles.
 * @param {Record<string, any>} theme
 * @returns {Partial<ThemePreset>}
 */
function fromFamilyTheme(theme) {
  const t =
    (theme.tokens && typeof theme.tokens === "object" && theme.tokens) || {};
  return {
    mode: theme.mode,
    up: theme.up,
    down: theme.down,
    grid: theme.grid || t.grid,
    axis: theme.axis || t.fore,
    background: theme.background || t.surface,
    accent: theme.accent || t.accent,
  };
}

const ThemePresets = {
  /** @returns {boolean} true if `name` resolves to a built-in or registered preset. */
  has(name) {
    return (
      typeof name === "string" &&
      (!!(name && getTheme(name)) || name in BUILT_IN)
    );
  },

  /**
   * A registered theme wins over a built-in of the same name, as a preset
   * registered with `ApexStock.registerTheme` always did.
   * @param {string} name
   * @returns {ThemePreset|null} a copy of the preset def, or null if unknown.
   */
  get(name) {
    if (typeof name !== "string" || !name) return null;
    const registered = getTheme(name);
    if (registered) return ThemePresets.resolve(fromFamilyTheme(registered));
    return name in BUILT_IN ? { ...BUILT_IN[name] } : null;
  },

  /** @returns {string[]} all known preset names, the built-ins first. */
  names() {
    return Array.from(
      new Set([...Object.keys(BUILT_IN), ...registeredThemes()])
    );
  },

  /**
   * Register (or override) a named preset. Missing colors fall back to the
   * `paper` (light) or a dark baseline so a partial def is still valid.
   *
   * The preset goes into the registry the whole ApexCharts family shares
   * (apex-commons `registerTheme`), with its accent, plot background, axis
   * text and grid also stated as the family `tokens`. So a theme registered
   * once, from any product, is usable by name from every other one.
   * @param {string} name
   * @param {Partial<ThemePreset>} def
   * @returns {ThemePreset|null} the stored def, or null on invalid input.
   */
  register(name, def) {
    if (typeof name !== "string" || !name || !def || typeof def !== "object") {
      return null;
    }
    const preset = ThemePresets.resolve(def);
    registerTheme(name, {
      ...preset,
      tokens: {
        accent: preset.accent,
        surface: preset.background,
        fore: preset.axis,
        grid: preset.grid,
      },
    });
    return { ...preset };
  },

  /**
   * Normalize a preset name or partial def into a complete {@link ThemePreset}.
   * @param {string|Partial<ThemePreset>} nameOrDef
   * @returns {ThemePreset|null} null if a name was given but is unknown.
   */
  resolve(nameOrDef) {
    if (typeof nameOrDef === "string") return ThemePresets.get(nameOrDef);
    if (!nameOrDef || typeof nameOrDef !== "object") return null;
    const mode = nameOrDef.mode === "dark" ? "dark" : "light";
    // Baseline to backfill any missing color.
    const base =
      mode === "dark"
        ? {
            up: "#26A69A",
            down: "#EF5350",
            grid: "#505D66",
            axis: "#e0e0e0",
            background: "#1e242b",
            accent: "#64b5f6",
          }
        : BUILT_IN.paper;
    const out = { mode };
    REQUIRED.forEach((k) => {
      out[k] = typeof nameOrDef[k] === "string" ? nameOrDef[k] : base[k];
    });
    return out;
  },
};

export default ThemePresets;
