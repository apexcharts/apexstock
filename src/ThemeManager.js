/**
 * ThemeManager.js
 * Handles theme management for ApexStock charts
 */

export default class ThemeManager {
  /**
   * Creates a new ThemeManager
   * @param {string} initialTheme - The initial theme ('light' or 'dark')
   */
  constructor(ctx, initialTheme = "light") {
    this.ctx = ctx;
    this.setTheme(initialTheme || "light");
    this.themeStylesApplied = false;
  }

  setTheme(themeName) {
    if (themeName !== "light" && themeName !== "dark") {
      console.warn('Invalid theme. Using "light" theme as default.');
      themeName = "light";
    }

    this.theme = themeName;
    this.isDarkTheme = themeName === "dark";
    this.initColorSchemes();
  }

  getTheme() {
    return this.theme;
  }

  isDark() {
    return this.isDarkTheme;
  }

  getColors() {
    return this.colorSchemes[this.theme];
  }

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
          bollingerBands: "rgba(0, 114, 255, 0.08)",
          fibonacci: "#FF9900",
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
          chaikin: "#CC3333",
          cci: "#FF6600",
          tsi: "#0066CC",
          ac: "#009900",
          bPercent: "#6600CC",
          bWidth: "#CC0066",
        },
      },
      dark: {
        toolbar: {
          background: "#424242",
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
          bollingerBands: "rgba(255, 232, 242, 0.12)",
          fibonacci: "#ffb74d",
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
          chaikin: "#ef5350",
          cci: "#ff9e80",
          tsi: "#64b5f6",
          ac: "#66bb6a",
          bPercent: "#9575cd",
          bWidth: "#ec407a",
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
    chartContainer.classList.remove(
      "apexstock-theme-light",
      "apexstock-theme-dark"
    );

    chartContainer.classList.add(`apexstock-theme-${this.theme}`);

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

    themeStyles.textContent = `
      [class^=apexstock-] * {
        font-family: ${
          this.ctx.chartOptions.chart.fontFamily ||
          "Helvetica, Arial, sans-serif"
        }
      }

      .apexstock-theme-${this.theme} .apexstock-toolbar {
        background-color: ${colors.toolbar.background};
        color: ${colors.toolbar.text};
        border-color: ${colors.toolbar.border};
      }
      
      .apexstock-theme-${this.theme} .apexstock-custom-select-trigger {
        background-color: ${colors.dropdown.background};
        color: ${colors.dropdown.text};
        border-color: ${colors.dropdown.border};
      }
      
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
   * Apply theme to an element's style
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

      default:
        break;
    }
  }

  /**
   * Get theme-specific configuration for ApexCharts
   * @returns {Object} Theme-specific chart configuration
   */
  getChartConfig() {
    return {
      chart: {
        theme: {
          mode: this.theme,
        },
      },
      tooltip: {
        theme: this.theme,
      },
      grid: {
        borderColor: this.isDarkTheme ? "#505D66" : "#e9ecef",
        strokeDashArray: 3,
      },
      yaxis: {
        labels: {
          style: {
            colors: this.isDarkTheme ? "#e0e0e0" : "#333",
          },
        },
      },
      plotOptions: {
        candlestick: {
          colors: {
            upward: this.isDarkTheme ? "#26A69A" : "#00B746",
            downward: this.isDarkTheme ? "#EF5350" : "#EF403C",
          },
        },
      },
    };
  }
}
