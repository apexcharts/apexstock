/**
 * ChartSwitch component for ApexStock
 * Allows switching between different chart types (line, area, candle, column)
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
      { id: "candlestick", name: "Candlestick", icon: "💹" },
      { id: "line", name: "Line", icon: "📈" },
      { id: "area", name: "Area", icon: "🏔️" },
      { id: "bar", name: "Column", icon: "📊" },
    ];
    this.currentType = "candlestick";

    this.init();
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
        o +
        "</span></div>" +
        `<div>${labels[1]}: <span class="value">` +
        h +
        "</span></div>" +
        (m
          ? `<div>${labels[2]}: <span class="value">` + m + "</span></div>"
          : "") +
        `<div>${labels[3]}: <span class="value">` +
        l +
        "</span></div>" +
        `<div>${labels[4]}: <span class="value">` +
        c +
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
      option.innerHTML = `${type.icon} ${type.name}`;

      // Highlight the currently selected chart type
      if (type.id === this.currentType) {
        option.classList.add("active");
        option.style.backgroundColor = "#f0f0f0";
      }

      // Add hover effect
      option.addEventListener("mouseover", () => {
        option.style.backgroundColor = "#f5f5f5";
      });
      option.addEventListener("mouseout", () => {
        if (type.id !== this.currentType) {
          option.style.backgroundColor = "";
        } else {
          option.style.backgroundColor = "#f0f0f0";
        }
      });

      // Add click event to change chart type
      option.addEventListener("click", () => {
        this.changeChartType(type.id);
        dropdown.style.display = "none";

        // Update active state
        document
          .querySelectorAll(".apexstock-chart-type-option")
          .forEach((el) => {
            el.classList.remove("active");
            el.style.backgroundColor = "";
          });
        option.classList.add("active");
        option.style.backgroundColor = "#f0f0f0";
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
    if (type === "candlestick") {
      // Use the original candlestick data
      newSeries = [
        {
          name: "Price",
          type: "candlestick",
          data: this.series,
        },
      ];
    } else if (type === "line") {
      // Use close prices for line chart
      newSeries = [
        {
          name: "Price",
          type: "line",
          data: this.series.map((point) => ({
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
          data: this.series.map((point) => ({
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
          data: this.series.map((point) => ({
            x: point.x,
            y: point.y[3], // Close price
          })),
        },
      ];
    }

    // Filter out any indicators that might be in the series
    const indicators = this.chart.w.config.series.filter(
      (s) => s.name !== "Price" && s.name !== undefined
    );

    // Update the chart with new series type
    this.chart.updateOptions(
      {
        series: [...newSeries, ...indicators],
        chart: {
          type: type === "candlestick" ? "candlestick" : type,
        },
        tooltip: {
          custom: ({ seriesIndex, dataPointIndex, w }) => {
            const value = w.config.series[seriesIndex].data[dataPointIndex].y;

            return type === "candlestick"
              ? this._getBoxTooltip(
                  w,
                  seriesIndex,
                  dataPointIndex,
                  ["Open", "High", "", "Low", "Close"],
                  "candlestick"
                )
              : `<div class="apexcharts-custom-tooltip">
              ${
                w.config.series[seriesIndex].name
                  ? w.config.series[seriesIndex].name
                  : "series-" + (seriesIndex + 1)
              }: <strong>${
                  w.globals.series[seriesIndex][dataPointIndex]
                }</strong>
               </div>`;
          },
        },
      },
      true,
      false
    );
  }
}
