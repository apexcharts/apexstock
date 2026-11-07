import { readDesignSystemLayer, readTokens } from "apex-commons";
import Utils from "../utils/Utils";
import ThemePresets from "./ThemePresets";
/**
 * ThemeManager.js
 * Handles theme management for ApexStock charts
 */

// Inline `--apx-*` family custom properties a preset drives on the container.
// Tracked so switching from a preset back to a plain mode clears them.
const APX_PROPS = ["--apx-accent", "--apx-surface", "--apx-fore", "--apx-grid"];

// The design system's roles, written as private custom properties on the
// chart's own elements. ApexStock.css puts each one between the `--apx-*`
// token and the built-in default, so with no design system the chains
// resolve exactly as before. Property -> the layer's role.
const DS_PROPS = {
  "--_apexstock-ds-accent": "focus",
  "--_apexstock-ds-fore": "fore",
  "--_apexstock-ds-muted": "muted",
  "--_apexstock-ds-grid": "grid",
  "--_apexstock-ds-hover": "hover",
  "--_apexstock-ds-overlay": "overlay",
  "--_apexstock-ds-overlay-text": "overlayContrast",
  "--_apexstock-ds-up": "positive",
  "--_apexstock-ds-down": "negative",
};
const DS_FONT_PROP = "--_apexstock-ds-font";

// The `--apx-*` token that outranks a design-system role, where one does. The
// menus' surface and text take the chrome's, as the stylesheet's own chains
// for them do (ApexStock.css, the overlay block).
const TOKEN_FOR_ROLE = {
  fore: "fore",
  grid: "grid",
  focus: "accent",
  overlay: "surface",
  overlayContrast: "fore",
};

export default class ThemeManager {
  /**
   * The chart-type switch's own candle pair in a plain mode (a 2025 design
   * choice: a different green and red after a switch). A preset, a design
   * system's success and error colors and colors passed to update() still win
   * over it.
   */
  static SWITCH_UP_DOWN = Object.freeze({ up: "#34D399", down: "#F87171" });

  /**
   * The measure box's own tint in a plain mode. A preset, a design system's
   * success and error colors and colors passed to update() still win over it;
   * colors passed with the drawing win over everything.
   */
  static MEASURE_UP_DOWN = Object.freeze({ up: "#26a69a", down: "#ef5350" });

  /**
   * Creates a new ThemeManager
   * @param {Object} ctx - The ApexStock context
   * @param {string} initialTheme - The initial theme ('light' or 'dark')
   */
  constructor(ctx, initialTheme = "light") {
    this.ctx = ctx;
    /** Active preset def ({@link ThemePresets}), or null for a plain mode. */
    this.preset = null;
    this.presetName = null;
    /**
     * Candle up/down the page passed to update(), or null. It wins over the
     * preset and mode colors until the candles go back to theme colors.
     * @type {{up: string, down: string}|null}
     */
    this.explicitUpDown = null;
    /**
     * Who chose the mode: the page (`theme.mode`, updateTheme), a preset, the
     * design system's variant, or nobody (the light default). Only the last
     * two follow the variant when it changes.
     * @type {"page"|"preset"|"variant"|"default"}
     */
    this.modeSource = "default";
    /**
     * The design system read at the chart container (an add-on such as
     * `apexstock/ignite-ui` registers it), or null. See {@link readDesignSystem}.
     * @type {import("apex-commons").DesignSystemLayer|null}
     */
    this.designSystem = null;
    /** The `--apx-*` tokens read with the design system (and only then). */
    this.cssTokens = {};
    /**
     * The page's `theme.tokens` and `theme.designSystem` switches, and
     * whether a color-blind or monochrome mode blocks the design system's
     * colors (its mode and font still apply), as it does in ApexCharts.
     */
    this.switches = {
      tokens: true,
      designSystem: true,
      colorBlind: false,
      monochrome: false,
    };
    /**
     * Grid and axis-text colors the page passed at construction or to
     * update(), which pass to the charts over the design system's.
     * @type {{grid?: string, axis?: string|string[]}}
     */
    this.pageChartColors = {};
    /** Whether a grid color was ever sent to the main chart. */
    this.gridSent = false;
    this.initColorSchemes();
    this.setTheme(initialTheme || "light");
  }

  /**
   * Read the page's design system at the chart container, through the
   * apex-commons lookup. Only an add-on (`apexstock/ignite-ui`) registers one:
   * without it this is null before any style is read, so a page that did not
   * load it pays nothing and looks exactly as before. Off for this chart with
   * `theme.designSystem: false` or `theme.tokens: false`; its colors are off
   * with `theme.accessibility.colorBlindMode` or `theme.monochrome.enabled`.
   * @param {Element|null|undefined} el - The chart container.
   * @param {object} [themeOpt] - A `theme` option the page passed; its
   *   switches are kept for later reads.
   * @returns {import("apex-commons").DesignSystemLayer|null}
   */
  readDesignSystem(el, themeOpt) {
    if (themeOpt && typeof themeOpt === "object") {
      if ("designSystem" in themeOpt) {
        this.switches.designSystem = themeOpt.designSystem !== false;
      }
      if ("tokens" in themeOpt)
        this.switches.tokens = themeOpt.tokens !== false;
      if ("accessibility" in themeOpt) {
        const a = themeOpt.accessibility;
        this.switches.colorBlind = !!(a && a.colorBlindMode);
      }
      if ("monochrome" in themeOpt) {
        const m = themeOpt.monochrome;
        this.switches.monochrome = !!(m && m.enabled);
      }
    }
    const on = this.switches.designSystem && this.switches.tokens;
    this.designSystem = on && el ? readDesignSystemLayer(el) : null;
    // The `--apx-*` tokens outrank it on every surface ApexStock styles, so
    // they are read with it.
    this.cssTokens = this.designSystem ? ThemeManager.pageTokens(el) : {};
    return this.designSystem;
  }

  /**
   * The `--apx-*` tokens as the page set them at `el`. A preset writes its own
   * on the container ({@link applyThemeStyles}); they are left out, so a
   * reading taken while a preset is still on (or before its values are
   * cleared) never stands in for the page's once the preset is off.
   * @param {HTMLElement} el - The chart container.
   * @returns {import("apex-commons").ApxTokens}
   */
  static pageTokens(el) {
    const own = el.style
      ? APX_PROPS.map((p) => [p, el.style.getPropertyValue(p)]).filter(
          (e) => e[1]
        )
      : [];
    own.forEach((e) => el.style.removeProperty(e[0]));
    const tokens = readTokens(el);
    own.forEach((e) => el.style.setProperty(e[0], e[1]));
    return tokens;
  }

  /**
   * The mode an unset mode takes from the design system's variant (plan 36
   * D6): dark for a dark variant, else light. A light variant writes nothing,
   * since light is the default anyway.
   * @returns {"light"|"dark"|null} null when the page or a preset chose the mode.
   */
  variantMode() {
    if (this.modeSource !== "default" && this.modeSource !== "variant") {
      return null;
    }
    const ds = this.designSystem;
    return ds && ds.variant === "dark" ? "dark" : "light";
  }

  /**
   * Set the mode from the design system's variant, when nothing else chose it.
   * @returns {boolean} whether the mode changed.
   */
  applyVariantMode() {
    const mode = this.variantMode();
    if (!mode) return false;
    const changed = mode !== this.theme;
    if (changed) this.setTheme(mode);
    this.modeSource = mode === "dark" ? "variant" : "default";
    return changed;
  }

  /**
   * One design-system role for this chart's mode, or undefined. A chrome role
   * (text, hairlines, overlays) applies only while the mode is the sheet's
   * variant, so a dark sheet's light text never lands on a light chart; the
   * brand and semantic roles always apply. A preset is a whole look and ranks
   * above the design system (plan 36 D5), and a color-blind or monochrome
   * mode bypasses it, so with either no role applies; the design system's
   * font and mode still do.
   * @param {import("apex-commons").DesignSystemColorRole} role
   * @returns {string|undefined}
   */
  dsColor(role) {
    const ds = this.designSystem;
    const sw = this.switches;
    return ds && !this.preset && !sw.colorBlind && !sw.monochrome
      ? ds.color(role, this.theme)
      : undefined;
  }

  /**
   * Whether the charts ApexStock draws read the design system themselves:
   * ApexCharts' own add-on (`apexcharts/features/ignite-ui`, which the
   * `apexstock/ignite-ui` bundler entry imports) registered it, in the feature
   * registry every ApexCharts copy on the page shares. Without it a chart
   * cannot follow the design system, so ApexStock keeps sending its built-in
   * grid and axis-text colors and the plot looks as it does without one.
   * @returns {boolean}
   */
  static chartsReadDesignSystem() {
    const registry = globalThis.__apexcharts_features_v1__;
    return !!(
      registry &&
      typeof registry.get === "function" &&
      registry.get("designSystemStyles")
    );
  }

  /**
   * One role where the design system fills it ({@link dsColor}), outranked by
   * the page's `--apx-*` token for it (plan 36 D5), else undefined. The one
   * resolution for the surfaces styled from JS ({@link chromeColor}), the
   * stylesheet's chains ({@link applyDesignSystemProps}) and a grid color
   * sent to the chart, so they agree in either mode. Without a design-system
   * value nothing applies and each keeps its built-in color, as before.
   * @param {import("apex-commons").DesignSystemColorRole} role
   * @returns {string|undefined}
   */
  roleColor(role) {
    const ds = this.dsColor(role);
    if (!ds) return undefined;
    const token = TOKEN_FOR_ROLE[role];
    return (token && this.cssTokens[token]) || ds;
  }

  /**
   * A chrome color for a surface ApexStock styles from JS (the toolbar, the
   * legend, the analysis panel): {@link roleColor}, else `fallback`.
   * @param {import("apex-commons").DesignSystemColorRole} role
   * @param {string} fallback
   * @returns {string}
   */
  chromeColor(role, fallback) {
    return this.roleColor(role) || fallback;
  }

  /**
   * The font for a surface ApexStock styles from JS, as {@link chromeColor}:
   * the design system's family, outranked by `--apx-font-family`. A page that
   * chose `chart.fontFamily` keeps `fallback` there, as without one.
   * @param {string} fallback
   * @returns {string}
   */
  chromeFont(fallback) {
    const ds = this.designSystem && this.designSystem.font;
    const chart =
      this.ctx && this.ctx.chartOptions && this.ctx.chartOptions.chart;
    if (!ds || (chart && chart.fontFamily)) return fallback;
    return this.cssTokens.font || ds;
  }

  /**
   * The grid or axis-text color ApexStock sends its charts, or undefined to
   * send none. A preset's first. Where the design system fills the role and
   * the charts read it ({@link chartsReadDesignSystem}), only a color the page
   * passed is sent, so the chart reads the design system itself and matches a
   * standalone chart (plan 36 OPEN-11); once a grid color was sent, ApexCharts
   * holds it as the page's, so the value the chart would have read goes
   * instead: `--apx-grid`, else the design system's ({@link roleColor}).
   * Otherwise `builtin`.
   * @param {"grid"|"axis"} role
   * @param {string} builtin
   * @returns {string|string[]|undefined}
   */
  chartColor(role, builtin) {
    const p = this.preset;
    if (p) return role === "grid" ? p.grid : p.axis;
    const ds = this.dsColor(role === "grid" ? "grid" : "fore");
    if (!ds || !ThemeManager.chartsReadDesignSystem()) return builtin;
    const page = this.pageChartColors[role];
    if (page) return page;
    return role === "grid" && this.gridSent
      ? this.roleColor("grid")
      : undefined;
  }

  /**
   * Note the grid and axis-text colors the page passed in `options`, at
   * construction or to update(); they go to the charts over the design
   * system's ({@link chartColor}). A key `options` does not carry keeps what
   * was noted before.
   * @param {object} [options] - Chart options as the page passed them.
   */
  notePageChartColors(options) {
    if (!options) return;
    const grid = options.grid && options.grid.borderColor;
    const y = Array.isArray(options.yaxis) ? options.yaxis[0] : options.yaxis;
    const axis = y && y.labels && y.labels.style && y.labels.style.colors;
    if (grid) this.pageChartColors.grid = grid;
    if (axis) this.pageChartColors.axis = axis;
  }

  /**
   * The grid color an indicator pane is built with. Panes are rebuilt on
   * every theme change, so nothing is held over: `builtin` (the pane's own
   * hairline, which a preset does not change), or, where the design system
   * fills the grid and the charts read it, only a grid color the page passed.
   * @param {string} builtin
   * @returns {string|undefined}
   */
  paneGridColor(builtin) {
    if (!this.dsColor("grid") || !ThemeManager.chartsReadDesignSystem()) {
      return builtin;
    }
    return this.pageChartColors.grid;
  }

  /**
   * The `theme` and font an indicator pane is built with. A pane is a chart
   * of its own that reads the design system itself, so it gets the main
   * chart's switches: off with `theme.designSystem: false` or
   * `theme.tokens: false`, and off for its colors under a preset, a
   * color-blind or a monochrome mode, where the font goes to it instead (as
   * the main chart keeps it). A page's `chart.fontFamily` outranks the design
   * system's font there too. Without a design system the pane is built as it
   * always was: `{ theme: { mode } }`, no font.
   * @returns {{theme: {mode: string, designSystem?: boolean}, fontFamily?: string}}
   */
  paneTheme() {
    const theme = { mode: this.theme };
    const sw = this.switches;
    if (!sw.designSystem || !sw.tokens) {
      theme.designSystem = false;
      return { theme };
    }
    const ds = this.designSystem;
    if (!ds) return { theme };
    const chart =
      this.ctx && this.ctx.chartOptions && this.ctx.chartOptions.chart;
    const pageFont = chart && chart.fontFamily;
    if (this.preset || sw.colorBlind || sw.monochrome) {
      theme.designSystem = false;
      const font = pageFont || this.cssTokens.font || ds.font;
      return font ? { theme, fontFamily: font } : { theme };
    }
    return pageFont ? { theme, fontFamily: pageFont } : { theme };
  }

  /**
   * Write the design system's roles as private custom properties on the
   * chart's own elements (the stylesheet's chains read them), or clear them.
   * Each is the role as {@link roleColor} resolves it, so a page's `--apx-*`
   * token outranks the design system in the rules that read only these (the
   * toolbar controls, the dark palette) as it does on the surfaces styled
   * from JS.
   * @param {Array<HTMLElement|null|undefined>} elements - The chart container
   *   and the toolbar, which sits beside it.
   */
  applyDesignSystemProps(elements) {
    const values = {};
    Object.keys(DS_PROPS).forEach((prop) => {
      values[prop] = this.roleColor(DS_PROPS[prop]);
    });
    values[DS_FONT_PROP] = this.designSystem && this.designSystem.font;
    elements.forEach((el) => {
      if (!el || !el.style) return;
      Object.keys(values).forEach((prop) => {
        if (values[prop]) el.style.setProperty(prop, values[prop]);
        else el.style.removeProperty(prop);
      });
    });
  }

  setTheme(themeName) {
    if (themeName !== "light" && themeName !== "dark") {
      Utils.warn('Invalid theme. Using "light" theme as default.');
      themeName = "light";
    }

    // A plain mode clears any active preset.
    this.preset = null;
    this.presetName = null;
    this.theme = themeName;
    this.isDarkTheme = themeName === "dark";
  }

  /**
   * Apply a named preset (or a resolved def). Sets the base mode from the
   * preset so all `isDarkTheme` logic keeps working; the preset then overrides
   * the chart colors ({@link getChartConfig}) and chrome tokens
   * ({@link applyThemeStyles}).
   * @param {string|object} nameOrDef
   * @returns {boolean} false if a name was given but is unknown.
   */
  applyPreset(nameOrDef) {
    const def = ThemePresets.resolve(nameOrDef);
    if (!def) {
      Utils.warn(`Unknown theme preset: ${nameOrDef}`);
      return false;
    }
    this.preset = def;
    this.presetName = typeof nameOrDef === "string" ? nameOrDef : null;
    this.theme = def.mode;
    this.isDarkTheme = def.mode === "dark";
    return true;
  }

  /** @returns {string|null} the active preset name, or null for a plain mode. */
  getPreset() {
    return this.presetName;
  }

  /**
   * Write the current theme's chart colors (candlestick, grid, axis labels,
   * background) into a chart-options object in place. This is the source of
   * truth for `mainChartOptions`: at construction and on every theme change,
   * `updateTheme` re-applies `Utils.extend(themeConfig, mainChartOptions)` with
   * `mainChartOptions` winning, so a preset's colors must live here or they are
   * overridden. For a plain mode it writes the exact built-in defaults, so
   * switching a preset off restores the original appearance with no drift.
   * @param {object} options - The chart-options object to mutate.
   * @returns {object} the same object.
   */
  syncChartOptionsToTheme(options) {
    if (!options) return options;
    const p = this.preset;
    const dark = this.isDarkTheme;
    const { up, down } = this.getUpDown();
    const grid = this.chartColor("grid", dark ? "#404040" : "#e9ecef");
    const axis = this.chartColor("axis", dark ? "#e0e0e0" : "#333");

    options.chart = options.chart || {};
    if (p) options.chart.background = p.background;
    else delete options.chart.background;

    options.plotOptions = options.plotOptions || {};
    options.plotOptions.candlestick = options.plotOptions.candlestick || {};
    options.plotOptions.candlestick.colors = { upward: up, downward: down };

    options.grid = options.grid || {};
    if (grid) {
      options.grid.borderColor = grid;
      this.gridSent = true;
    } else delete options.grid.borderColor;

    // No axis color: the labels take the chart's text color, which ApexCharts
    // fills from the design system. `[]` is ApexCharts' own default.
    const applyAxis = (ax) => {
      if (!ax || typeof ax !== "object") return;
      ax.labels = ax.labels || {};
      ax.labels.style = ax.labels.style || {};
      ax.labels.style.colors = axis || [];
    };
    if (Array.isArray(options.yaxis)) options.yaxis.forEach(applyAxis);
    else applyAxis(options.yaxis);

    return options;
  }

  /**
   * Write the mode-dependent ApexCharts keys for a RUNTIME theme change into a
   * chart-options object in place. ApexCharts reads the top-level
   * `theme.mode`, so without it a switch left the OHLC tooltip, foreColor and
   * plot background in the construction theme. Not used at construction: a
   * chart built without a `theme` option keeps ApexCharts' own unset mode.
   *
   * - `theme.mode` is merged into the consumer's own theme keys (palette,
   *   monochrome); the ApexStock-only `preset` key is dropped.
   * - `tooltip.theme` is written every time, since ApexCharts 8.x keeps an
   *   existing value on a mode change. Skipped when the page named it.
   * - A plain mode gets a transparent plot (the ApexStock surface shows
   *   through, as for the indicator panes), because a mode with no background
   *   makes ApexCharts paint its own white or #343A3F slab. A background the
   *   page passed is kept. Where ApexCharts painted the plot from a
   *   `--apx-surface` token, an empty value hands it back to that token:
   *   ApexCharts takes 'transparent' as the page's own and stops applying it.
   *
   * @param {object} options - The chart-options object to mutate.
   * @param {{tooltipTheme?: boolean, chartBackground?: boolean, tokenSurface?: boolean}} [explicit]
   *   Keys the page set itself, and whether a `--apx-surface` token paints
   *   the plot.
   * @returns {object} the same object.
   */
  syncChartModeToTheme(options, explicit = {}) {
    if (!options) return options;
    const theme = { ...(options.theme || {}), mode: this.theme };
    delete theme.preset;
    options.theme = theme;

    if (!explicit.tooltipTheme) {
      options.tooltip = options.tooltip || {};
      options.tooltip.theme = this.theme;
    }

    options.chart = options.chart || {};
    if (!this.preset && !explicit.chartBackground) {
      options.chart.background = explicit.tokenSurface ? "" : "transparent";
    }
    return options;
  }

  /**
   * Built-in candle up/down colors for a plain mode.
   * @param {boolean} dark
   * @returns {{up: string, down: string}}
   */
  static modeUpDown(dark) {
    return dark
      ? { up: "#26A69A", down: "#EF5350" }
      : { up: "#00B746", down: "#EF403C" };
  }

  /**
   * The active up/down colors: the ones the page passed to update(), else the
   * preset's when one is active, else the design system's, else the built-in
   * pair. The one source for
   * the candles and every surface that colors a rise or a fall to match them
   * (legend, analysis panel, chart-type switch, measure box). Colors passed at
   * construction are not tracked (the theme colors replace them).
   * @param {{up: string, down: string}} [builtin] - The surface's own pair for
   *   a plain mode, for the surfaces that have one ({@link SWITCH_UP_DOWN},
   *   {@link MEASURE_UP_DOWN}); the mode's candle defaults otherwise.
   * @returns {{up: string, down: string}}
   */
  getUpDown(builtin) {
    if (this.explicitUpDown) return { ...this.explicitUpDown };
    return this.getThemeUpDown(builtin);
  }

  /**
   * The theme's own up/down: the preset's when one is active, else the
   * design system's success and error colors, else the built-in pair,
   * ignoring colors the page passed.
   * @param {{up: string, down: string}} [builtin] - As for {@link getUpDown}.
   * @returns {{up: string, down: string}}
   */
  getThemeUpDown(builtin) {
    const p = this.preset;
    if (p) return { up: p.up, down: p.down };
    // The design system's success and error colors rank below a preset and
    // above the built-in pair (plan 36 D5).
    const base = builtin || ThemeManager.modeUpDown(this.isDarkTheme);
    return {
      up: this.dsColor("positive") || base.up,
      down: this.dsColor("negative") || base.down,
    };
  }

  getTheme() {
    return this.theme;
  }

  isDark() {
    return this.isDarkTheme;
  }

  getColors() {
    const base = this.colorSchemes[this.theme];
    if (!this.preset) {
      // The design system's semantic and accent colors re-tint the price
      // lines the same way, each only where it has one.
      const up = this.dsColor("positive");
      const down = this.dsColor("negative");
      const order = this.dsColor("focus");
      if (!up && !down && !order) return base;
      const t = { ...base.tradingOverlays };
      if (up) t.buy = t.takeProfit = up;
      if (down) t.sell = t.stopLoss = down;
      if (order) t.order = order;
      return { ...base, tradingOverlays: t };
    }
    // A preset re-tints the semantic price-line roles so they match its
    // candles/accent; the indicator palette stays the base-mode one.
    const p = this.preset;
    return {
      ...base,
      tradingOverlays: {
        ...base.tradingOverlays,
        buy: p.up,
        takeProfit: p.up,
        sell: p.down,
        stopLoss: p.down,
        order: p.accent,
      },
    };
  }

  /**
   * Initializes the color schemes for light and dark themes
   */
  initColorSchemes() {
    // The rise and fall roles take the candles' pair, so it is written once.
    const lightUD = ThemeManager.modeUpDown(false);
    const darkUD = ThemeManager.modeUpDown(true);
    this.colorSchemes = {
      light: {
        toolbar: {
          background: "#ffffff",
          text: "#333",
          border: "#e9ecef",
        },
        dropdown: {
          background: "#ffffff",
          hover: "#f1f3f5",
          text: "#333",
          border: "#ced4da",
          selectedBackground: "#e9ecef",
        },
        indicators: {
          movingAverage: "#7D57C2",
          ema: "#FF9900",
          vwap: "#E91E63",
          bollingerBands: "rgba(0, 114, 255, 0.08)",
          donchian: "rgba(255, 152, 0, 0.10)",
          keltner: "rgba(103, 58, 183, 0.10)",
          fibonacci: [
            "#7E7E7E",
            "#B5515E",
            "#CDA163",
            "#8AAB8C",
            "#4F9183",
            "#A4D6D4",
            "#7E7E7E",
          ],
          linearRegression: "#0099FF",
          tenkanSen: "#FF6600",
          kijunSen: "#0066FF",
          volume: "#6c757d",
          rsi: "#7D57C2",
          macd: "#008FFB",
          signal: "#FF4560",
          histogramPositive: "#00E396",
          histogramNegative: "#FF4560",
          pvt: "#0099CC",
          stochasticK: "#33CC33",
          stochasticD: "#FF9933",
          stdDev: "#CC33FF",
          adx: "#9900CC",
          atr: "#E67E22",
          chaikin: "#CC3333",
          cci: "#FF6600",
          tsi: "#0066CC",
          ac: "#009900",
          bPercent: "#6600CC",
          bWidth: "#CC0066",
          drawdown: lightUD.down,
        },
        // Default colors for trading overlays (price lines). Keyed by the
        // semantic role so consumers can re-theme buy/sell/SL/TP/alert lines.
        tradingOverlays: {
          buy: lightUD.up,
          sell: lightUD.down,
          stopLoss: lightUD.down,
          takeProfit: lightUD.up,
          alert: "#FF9900",
          order: "#0099FF",
          labelText: "#ffffff",
        },
      },
      dark: {
        toolbar: {
          background: "#343A3F",
          text: "#f8f9fa",
          border: "#343a40",
        },
        dropdown: {
          background: "#343a40",
          hover: "#495057",
          text: "#f8f9fa",
          border: "#495057",
          selectedBackground: "#495057",
        },
        indicators: {
          movingAverage: "#bb86fc",
          ema: "#ffb74d",
          vwap: "#f06292",
          bollingerBands: "rgba(255, 232, 242, 0.12)",
          donchian: "rgba(255, 183, 77, 0.14)",
          keltner: "rgba(179, 136, 255, 0.16)",
          fibonacci: [
            "#7E7E7E",
            "#B5515E",
            "#CDA163",
            "#8AAB8C",
            "#4F9183",
            "#A4D6D4",
            "#7E7E7E",
          ],
          linearRegression: "#64b5f6",
          tenkanSen: "#ff9e80",
          kijunSen: "#82b1ff",
          volume: "#b0bec5",
          rsi: "#bb86fc",
          macd: "#64b5f6",
          signal: "#f48fb1",
          histogramPositive: "#81c784",
          histogramNegative: "#e57373",
          pvt: "#4fc3f7",
          stochasticK: "#81c784",
          stochasticD: "#ffb74d",
          stdDev: "#ce93d8",
          adx: "#ba68c8",
          atr: "#ffa726",
          chaikin: "#ef5350",
          cci: "#ff9e80",
          tsi: "#64b5f6",
          ac: "#66bb6a",
          bPercent: "#9575cd",
          bWidth: "#ec407a",
          drawdown: darkUD.down,
        },
        tradingOverlays: {
          buy: darkUD.up,
          sell: darkUD.down,
          stopLoss: darkUD.down,
          takeProfit: darkUD.up,
          alert: "#ffb74d",
          order: "#64b5f6",
          labelText: "#ffffff",
        },
      },
    };
  }

  /**
   * Apply theme styles to UI elements
   * @param {HTMLElement} chartContainer - The chart container element
   * @param {HTMLElement} toolbar - The toolbar element
   */
  applyThemeStyles(chartContainer, toolbar) {
    if (!chartContainer) return;

    chartContainer.classList.remove(
      "apexstock-theme-light",
      "apexstock-theme-dark"
    );
    chartContainer.classList.add(`apexstock-theme-${this.theme}`);
    // Marks the chart's OWN container, as opposed to the consumer's wrapper,
    // which also carries the theme class (so a host card can follow the theme).
    // Anything that paints a surface has to target this and not the bare theme
    // class, or it repaints an element the consumer owns.
    chartContainer.classList.add("apexstock-chart");

    // Mirror the theme class onto the wrapper, here rather than only at
    // construction: it is the hook a host card styles itself from, and set once
    // it went stale on the first updateTheme()/setThemePreset(), leaving a
    // light wrapper around a dark chart.
    const wrapper = chartContainer.parentNode;
    if (wrapper && wrapper.classList) {
      wrapper.classList.remove("apexstock-theme-light", "apexstock-theme-dark");
      wrapper.classList.add(`apexstock-theme-${this.theme}`);
    }

    // Drive (or clear) the preset's chrome tokens on the container. Setting the
    // `--apx-*` family here lets the toolbar/dropdown/legend/tooltip follow the
    // preset through the existing token cascade (THEMING.md) with no per-element
    // styling. A plain mode removes them so the built-in defaults return.
    if (this.preset) {
      const p = this.preset;
      chartContainer.style.setProperty("--apx-accent", p.accent);
      chartContainer.style.setProperty("--apx-surface", p.background);
      chartContainer.style.setProperty("--apx-fore", p.axis);
      chartContainer.style.setProperty("--apx-grid", p.grid);
    } else {
      APX_PROPS.forEach((prop) => chartContainer.style.removeProperty(prop));
    }

    const colors = this.getColors();
    if (toolbar) {
      toolbar.style.backgroundColor = colors.toolbar.background;
      toolbar.style.color = this.chromeColor("fore", colors.toolbar.text);
      toolbar.style.borderColor = this.chromeColor(
        "grid",
        colors.toolbar.border
      );
    }

    this.applyFontFamily([chartContainer, toolbar]);
    this.applyDesignSystemProps([chartContainer, toolbar]);
  }

  /**
   * Write `chart.fontFamily` as `--_apexstock-font` on this chart's own
   * elements, for the stylesheet's font rule (ApexStock.css, section 15).
   *
   * The per-mode toolbar and dropdown colors used to be generated here into
   * one `<style>` in the document `<head>`. That missed a chart inside a shadow
   * root, and each chart's render replaced the rules and the font of every
   * other chart on the page, so they are static rules in the stylesheet now,
   * which ApexStock injects into the chart's own root.
   * @param {Array<HTMLElement|null|undefined>} elements - The chart container
   *   and the toolbar, which sits beside it.
   */
  applyFontFamily(elements) {
    const fontFamily = this.ctx.chartOptions?.chart?.fontFamily;
    elements.forEach((el) => {
      if (!el || !el.style) return;
      if (fontFamily) el.style.setProperty("--_apexstock-font", fontFamily);
      else el.style.removeProperty("--_apexstock-font");
    });
  }

  /**
   * Apply theme to an element's style based on element type
   * @param {HTMLElement} element - The element to style
   * @param {string} elementType - Type of element ('dropdown', 'option', etc.)
   */
  applyElementStyle(element, elementType) {
    if (!element) return;

    const colors = this.getColors();

    switch (elementType) {
      case "dropdown":
        element.style.backgroundColor = colors.dropdown.background;
        element.style.color = colors.dropdown.text;
        element.style.borderColor = colors.dropdown.border;
        break;

      case "option":
        element.style.color = colors.dropdown.text;
        break;

      case "toolbar":
        element.style.backgroundColor = colors.toolbar.background;
        element.style.color = colors.toolbar.text;
        element.style.borderColor = colors.toolbar.border;
        break;

      case "optionSelected":
        element.style.backgroundColor = colors.dropdown.selectedBackground;
        break;
    }
  }

  /**
   * Get theme-specific configuration for ApexCharts
   * @returns {Object} Theme-specific chart configuration
   */
  getChartConfig() {
    const p = this.preset;
    const { up, down } = this.getUpDown();
    const grid = this.chartColor(
      "grid",
      this.isDarkTheme ? "#505D66" : "#e9ecef"
    );
    if (grid) this.gridSent = true;
    const config = {
      // Always its own object, so a config extended with the caller's options
      // copies their `chart` instead of sharing it, and nothing ApexStock or
      // ApexCharts writes into the result lands in the caller's object.
      chart: {},
      tooltip: {
        theme: this.theme,
      },
      grid: grid
        ? { borderColor: grid, strokeDashArray: 3 }
        : { strokeDashArray: 3 },
      yaxis: {
        labels: {
          style: {
            // `[]` (ApexCharts' default): the labels take the chart's text
            // color, which ApexCharts fills from the design system.
            colors:
              this.chartColor("axis", this.isDarkTheme ? "#e0e0e0" : "#333") ||
              [],
          },
        },
      },
      plotOptions: {
        candlestick: {
          colors: { upward: up, downward: down },
        },
      },
    };
    // A preset also tints the plot background (subtle for the light pack).
    if (p) config.chart.background = p.background;
    return config;
  }
}
