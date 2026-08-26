import Utils from "../utils/Utils";
import ThemePresets from "./ThemePresets";
/**
 * ThemeManager.js
 * Handles theme management for ApexStock charts
 */

// Inline `--apx-*` family custom properties a preset drives on the container.
// Tracked so switching from a preset back to a plain mode clears them.
const APX_PROPS = ["--apx-accent", "--apx-surface", "--apx-fore", "--apx-grid"];

export default class ThemeManager {
  /**
   * Creates a new ThemeManager
   * @param {Object} ctx - The ApexStock context
   * @param {string} initialTheme - The initial theme ('light' or 'dark')
   */
  constructor(ctx, initialTheme = "light") {
    this.ctx = ctx;
    this.themeStylesApplied = false;
    /** Active preset def ({@link ThemePresets}), or null for a plain mode. */
    this.preset = null;
    this.presetName = null;
    this.initColorSchemes();
    this.setTheme(initialTheme || "light");
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
    const up = p ? p.up : dark ? "#26A69A" : "#00B746";
    const down = p ? p.down : dark ? "#EF5350" : "#EF403C";
    const grid = p ? p.grid : dark ? "#404040" : "#e9ecef";
    const axis = p ? p.axis : dark ? "#e0e0e0" : "#333";

    options.chart = options.chart || {};
    if (p) options.chart.background = p.background;
    else delete options.chart.background;

    options.plotOptions = options.plotOptions || {};
    options.plotOptions.candlestick = options.plotOptions.candlestick || {};
    options.plotOptions.candlestick.colors = { upward: up, downward: down };

    options.grid = options.grid || {};
    options.grid.borderColor = grid;

    const applyAxis = (ax) => {
      if (!ax || typeof ax !== "object") return;
      ax.labels = ax.labels || {};
      ax.labels.style = ax.labels.style || {};
      ax.labels.style.colors = axis;
    };
    if (Array.isArray(options.yaxis)) options.yaxis.forEach(applyAxis);
    else applyAxis(options.yaxis);

    return options;
  }

  getTheme() {
    return this.theme;
  }

  isDark() {
    return this.isDarkTheme;
  }

  getColors() {
    const base = this.colorSchemes[this.theme];
    if (!this.preset) return base;
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
        },
        // Default colors for trading overlays (price lines). Keyed by the
        // semantic role so consumers can re-theme buy/sell/SL/TP/alert lines.
        tradingOverlays: {
          buy: "#00B746",
          sell: "#EF403C",
          stopLoss: "#EF403C",
          takeProfit: "#00B746",
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
        },
        tradingOverlays: {
          buy: "#26A69A",
          sell: "#EF5350",
          stopLoss: "#EF5350",
          takeProfit: "#26A69A",
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
      toolbar.style.color = colors.toolbar.text;
      toolbar.style.borderColor = colors.toolbar.border;
    }

    this.injectThemeStyles();
  }

  /**
   * Inject theme-specific CSS into the document
   */
  injectThemeStyles() {
    const colors = this.getColors();

    let themeStyles = document.getElementById("apexstock-theme-styles");
    if (!themeStyles) {
      themeStyles = document.createElement("style");
      themeStyles.id = "apexstock-theme-styles";
      document.head.appendChild(themeStyles);
    }

    // Font family from chart options or default
    const fontFamily =
      this.ctx.chartOptions?.chart?.fontFamily ||
      "Helvetica, Arial, sans-serif";

    // Generate CSS for the current theme
    themeStyles.textContent = `
      [class^=apexstock-] * {
        font-family: ${fontFamily}
      }

      .apexstock-theme-${this.theme} .apexstock-toolbar {
        background-color: ${colors.toolbar.background};
        color: ${colors.toolbar.text};
        border-color: ${colors.toolbar.border};
      }
      
      .apexstock-theme-${this.theme} .apexstock-custom-select-trigger,
      .apexstock-theme-${this.theme} .apexstock-custom-options {
        background-color: ${colors.dropdown.background};
        color: ${colors.dropdown.text};
        border-color: ${colors.dropdown.border};
      }
      
      .apexstock-theme-${this.theme} .apexstock-custom-option {
        color: ${colors.dropdown.text};
      }
      
      .apexstock-theme-${this.theme} .apexstock-custom-option:hover {
        background-color: ${colors.dropdown.hover};
      }
      
      .apexstock-theme-${this.theme} .apexstock-custom-option.selected {
        background-color: ${colors.dropdown.selectedBackground};
      }
      
      .apexstock-theme-${this.theme} .apexchart-tooltip {
        background-color: ${this.isDarkTheme ? "#212529" : "#ffffff"};
        color: ${this.isDarkTheme ? "#f8f9fa" : "#333"};
        border-color: ${this.isDarkTheme ? "#343a40" : "#e9ecef"};
      }
      
      .apexstock-theme-${this.theme} .apexstock-toolbar-button {
        background-color: ${colors.dropdown.background};
        color: ${colors.dropdown.text};
        border-color: ${colors.dropdown.border};
      }
      
      .apexstock-theme-${this.theme} .apexstock-toolbar-button:hover {
        background-color: ${colors.dropdown.hover};
      }
    `;

    this.themeStylesApplied = true;
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
    const config = {
      chart: {
        theme: {
          mode: this.theme,
        },
      },
      tooltip: {
        theme: this.theme,
      },
      grid: {
        borderColor: p ? p.grid : this.isDarkTheme ? "#505D66" : "#e9ecef",
        strokeDashArray: 3,
      },
      yaxis: {
        labels: {
          style: {
            colors: p ? p.axis : this.isDarkTheme ? "#e0e0e0" : "#333",
          },
        },
      },
      plotOptions: {
        candlestick: {
          colors: {
            upward: p ? p.up : this.isDarkTheme ? "#26A69A" : "#00B746",
            downward: p ? p.down : this.isDarkTheme ? "#EF5350" : "#EF403C",
          },
        },
      },
    };
    // A preset also tints the plot background (subtle for the light pack).
    if (p) config.chart.background = p.background;
    return config;
  }
}
