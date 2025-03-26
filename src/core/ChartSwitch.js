/**
 * ChartSwitch component for ApexStock
 * Allows switching between different chart types (line, area, candle, column, heikin-ashi)
 */
export default class ChartSwitch {
  /**
   * @param {ApexCharts} chart - The ApexCharts instance
   * @param {HTMLElement} chartEl - The container element
   * @param {Array} series - The data series
   */
  constructor(ctx) {
    this.ctx = ctx;
    this.chart = ctx.chart;
    this.chartEl = ctx.chartEl;
    this.series = ctx.series;
    this.chartTypes = [
      {
        id: "candlestick",
        name: "Candlestick",
        icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="6" y1="5" x2="6" y2="19" />
          <rect x="4" y="7" width="4" height="6" fill="currentColor" />
          <line x1="12" y1="5" x2="12" y2="19" />
          <rect x="10" y="12" width="4" height="4" fill="currentColor" />
          <line x1="18" y1="5" x2="18" y2="19" />
          <rect x="16" y="9" width="4" height="5" fill="currentColor" />
        </svg>`,
      },
      {
        id: "heikinashi",
        name: "Heikin-Ashi",
        icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="5" y1="6" x2="5" y2="13" />
          <rect x="10" y="7" width="4" height="5" fill="currentColor" />
          <line x1="12" y1="8" x2="12" y2="15" />
          <rect x="3" y="9" width="4" height="5" fill="currentColor" />
          <line x1="19" y1="10" x2="19" y2="17" />
          <rect x="17" y="11" width="4" height="5" fill="currentColor" />
        </svg>`,
      },
      {
        id: "ohlc",
        name: "OHLC",
        icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="6" y1="5" x2="6" y2="19" />
          <line x1="4" y1="7" x2="6" y2="7" />
          <line x1="6" y1="13" x2="8" y2="13" />
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="10" y1="10" x2="12" y2="10" />
          <line x1="12" y1="16" x2="14" y2="16" />
          <line x1="18" y1="5" x2="18" y2="19" />
          <line x1="16" y1="8" x2="18" y2="8" />
          <line x1="18" y1="14" x2="20" y2="14" />
        </svg>`,
      },
      {
        id: "stepline",
        name: "Step Line",
        icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 13h4v-4h4v-4h4v8h6" />
        </svg>`,
      },
      {
        id: "line",
        name: "Line",
        icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 17l6-6 4 4 8-8"/>
        </svg>`,
      },
      {
        id: "area",
        name: "Area",
        icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 17l6-6 4 4 8-8v10H3z" fill="currentColor" fill-opacity="0.2"/>
          <path d="M3 17l6-6 4 4 8-8"/>
        </svg>`,
      },
      {
        id: "bar",
        name: "Column",
        icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="4" y="8" width="4" height="8" fill="currentColor" stroke="none"/>
          <rect x="10" y="7" width="4" height="9" fill="currentColor" stroke="none"/>
          <rect x="16" y="11" width="4" height="5" fill="currentColor" stroke="none"/>
        </svg>`,
      },
    ];
    this.currentType = "candlestick";
    this.originalSeries = [...this.series]; // Store original data

    this.init();
  }

  /**
   * Convert regular candle data to Heikin-Ashi format
   * @param {Array} series - Array of candlestick data points
   * @returns {Array} - Transformed Heikin-Ashi data
   */
  _convertToHeikinAshi(series) {
    if (!series || series.length === 0) return [];

    const result = [];
    let prevHA = null;

    for (let i = 0; i < series.length; i++) {
      const curr = series[i];
      const timestamp = curr.x;
      const [open, high, low, close] = curr.y;

      let haOpen, haClose, haHigh, haLow;

      // Calculate Heikin-Ashi values
      if (prevHA === null) {
        // First candle
        haOpen = (open + close) / 2;
        haClose = (open + high + low + close) / 4;
        haHigh = Math.max(high, haOpen, haClose);
        haLow = Math.min(low, haOpen, haClose);
      } else {
        // Subsequent candles
        haOpen = (prevHA.open + prevHA.close) / 2;
        haClose = (open + high + low + close) / 4;
        haHigh = Math.max(high, haOpen, haClose);
        haLow = Math.min(low, haOpen, haClose);
      }

      const haPoint = {
        x: timestamp,
        y: [haOpen, haHigh, haLow, haClose],
        open: haOpen,
        close: haClose,
      };

      result.push(haPoint);
      prevHA = haPoint;
    }

    return result;
  }

  _getBoxTooltip(w, seriesIndex, dataPointIndex, labels, chartType) {
    const o = w.globals.seriesCandleO[seriesIndex][dataPointIndex];
    const h = w.globals.seriesCandleH[seriesIndex][dataPointIndex];
    const m = w.globals.seriesCandleM[seriesIndex][dataPointIndex];
    const l = w.globals.seriesCandleL[seriesIndex][dataPointIndex];
    const c = w.globals.seriesCandleC[seriesIndex][dataPointIndex];

    if (
      w.config.series[seriesIndex].type &&
      w.config.series[seriesIndex].type !== chartType
    ) {
      return `<div class="apexcharts-custom-tooltip">
          ${
            w.config.series[seriesIndex].name
              ? w.config.series[seriesIndex].name
              : "series-" + (seriesIndex + 1)
          }: <strong>${w.globals.series[seriesIndex][dataPointIndex]}</strong>
        </div>`;
    } else {
      return (
        `<div class="apexcharts-tooltip-box apexcharts-tooltip-${w.config.chart.type}">` +
        `<div>${labels[0]}: <span class="value">` +
        o.toFixed(2) +
        "</span></div>" +
        `<div>${labels[1]}: <span class="value">` +
        h.toFixed(2) +
        "</span></div>" +
        (m
          ? `<div>${labels[2]}: <span class="value">` +
            m.toFixed(2) +
            "</span></div>"
          : "") +
        `<div>${labels[3]}: <span class="value">` +
        l.toFixed(2) +
        "</span></div>" +
        `<div>${labels[4]}: <span class="value">` +
        c.toFixed(2) +
        "</span></div>" +
        "</div>"
      );
    }
  }

  /**
   * Initialize the chart type dropdown
   */
  init() {
    // Create the dropdown wrapper
    const chartSwitchWrapper = document.createElement("div");
    chartSwitchWrapper.classList.add("apexstock-chart-type-wrapper");

    // Create the trigger button
    const trigger = document.createElement("button");
    trigger.classList.add("apexstock-chart-type-trigger");
    trigger.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>';
    trigger.title = "Change Chart Type";

    chartSwitchWrapper.appendChild(trigger);

    // Create the dropdown container
    const dropdown = document.createElement("div");
    dropdown.classList.add("apexstock-chart-type-dropdown");

    // Add chart type options to dropdown
    this.chartTypes.forEach((type) => {
      const option = document.createElement("div");
      option.classList.add("apexstock-chart-type-option");
      option.dataset.type = type.id;
      option.innerHTML = `<span class="chart-icon">${type.icon}</span><span class="chart-text">${type.name}</span>`;

      // Highlight the currently selected chart type
      if (type.id === this.currentType) {
        option.classList.add("active");
      }

      // Add click event to change chart type
      option.addEventListener("click", () => {
        this.changeChartType(type.id);
        dropdown.style.display = "none";

        // Update active state
        document
          .querySelectorAll(".apexstock-chart-type-option")
          .forEach((el) => {
            el.classList.remove("active");
          });
        option.classList.add("active");
      });

      dropdown.appendChild(option);
    });

    chartSwitchWrapper.appendChild(dropdown);

    // Toggle dropdown on trigger click
    trigger.addEventListener("click", () => {
      dropdown.style.display =
        dropdown.style.display === "block" ? "none" : "block";
    });

    // Close dropdown when clicking outside
    document.addEventListener("click", (e) => {
      if (!chartSwitchWrapper.contains(e.target)) {
        dropdown.style.display = "none";
      }
    });

    // Find the toolbar or parent element to insert the chart type dropdown
    // Look for the export button to position this next to it
    const toolbarEl = this.ctx.primaryToolbarLeft;
    if (toolbarEl) {
      toolbarEl.insertBefore(chartSwitchWrapper, toolbarEl.firstChild);
    }
  }

  /**
   * Change the chart type
   * @param {string} type - The chart type to switch to
   */
  changeChartType(type) {
    if (type === this.currentType) return;

    this.currentType = type;
    let newSeries = [];

    // Prepare the data for the selected chart type
    if (type === "candlestick" || type === "ohlc") {
      // Use the original candlestick data
      newSeries = [
        {
          name: "Price",
          type: "candlestick",
          data: this.originalSeries,
        },
      ];
    } else if (type === "heikinashi") {
      // Convert to Heikin-Ashi and use candlestick type for rendering
      const heikinAshiData = this._convertToHeikinAshi(this.originalSeries);
      newSeries = [
        {
          name: "Heikin-Ashi",
          type: "candlestick",
          data: heikinAshiData,
        },
      ];
    } else if (type === "line" || type === "stepline") {
      // Use close prices for line chart
      newSeries = [
        {
          name: "Price",
          type: "line",
          data: this.originalSeries.map((point) => ({
            x: point.x,
            y: point.y[3], // Close price
          })),
        },
      ];
    } else if (type === "area") {
      // Use close prices for area chart
      newSeries = [
        {
          name: "Price",
          type: "area",
          data: this.originalSeries.map((point) => ({
            x: point.x,
            y: point.y[3], // Close price
          })),
        },
      ];
    } else if (type === "bar") {
      // Use close prices for column chart
      newSeries = [
        {
          name: "Price",
          type: "bar",
          data: this.originalSeries.map((point) => ({
            x: point.x,
            y: point.y[3], // Close price
          })),
        },
      ];
    }

    // Filter out any indicators that might be in the series
    const indicators = this.chart.w.config.series.filter(
      (s) =>
        s.name !== "Price" && s.name !== "Heikin-Ashi" && s.name !== undefined
    );

    // Custom tooltip labels for Heikin-Ashi
    const tooltipLabels =
      type === "heikinashi"
        ? ["HA-Open", "HA-High", "", "HA-Low", "HA-Close"]
        : ["Open", "High", "", "Low", "Close"];

    // Update the chart with new series type
    this.chart.updateOptions(
      {
        series: [...newSeries, ...indicators],
        chart: {
          type: (() => {
            if (["candlestick", "heikinashi", "ohlc"].includes(type)) {
              return "candlestick";
            } else if (["line", "stepline"].includes(type)) {
              return "line";
            } else {
              return type;
            }
          })(),
        },
        tooltip: {
          custom: ({ seriesIndex, dataPointIndex, w }) => {
            if (
              type === "candlestick" ||
              type === "heikinashi" ||
              type === "ohlc"
            ) {
              return this._getBoxTooltip(
                w,
                seriesIndex,
                dataPointIndex,
                tooltipLabels,
                "candlestick"
              );
            } else {
              return `<div class="apexcharts-custom-tooltip">
                ${
                  w.config.series[seriesIndex].name
                    ? w.config.series[seriesIndex].name
                    : "series-" + (seriesIndex + 1)
                }: <strong>${
                w.globals.series[seriesIndex][dataPointIndex]
              }</strong>
                </div>`;
            }
          },
        },
        // Add custom colors for Heikin-Ashi candles to make them distinct
        plotOptions: {
          candlestick: {
            type,
            colors: {
              upward: type === "heikinashi" ? "#34D399" : "#00B746", // Different green for Heikin-Ashi
              downward: type === "heikinashi" ? "#F87171" : "#EF403C", // Different red for Heikin-Ashi
            },
          },
        },
        stroke: {
          curve: type === "stepline" ? "stepline" : "monotoneCubic",
        },
      },
      true,
      false,
      false
    );
  }
}
