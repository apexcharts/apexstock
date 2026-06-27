import SettingsControl from "../components/SettingsControl";

/**
 * ChartSwitch component for ApexStock
 * Allows switching between different chart types (line, area, candle, column, heikin-ashi, renko)
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
        id: "renko",
        name: "Renko",
        icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="5" width="4" height="4" fill="currentColor" />
          <rect x="7" y="8" width="4" height="4" fill="currentColor" />
          <rect x="11" y="11" width="4" height="4" fill="currentColor" />
          <rect x="15" y="14" width="4" height="4" fill="currentColor" />
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
    this.originalSeries = [...this.series];

    // Default Renko brick size (in percentage)
    this.renkoBrickSize = 0.3;
    this.renkoSettingsControl = null;

    this.init();
  }

  initializeRenkoSettings() {
    // Create the settings control only if it doesn't exist
    if (!this.renkoSettingsControl) {
      this.renkoSettingsControl = new SettingsControl(this.ctx.chartEl, {
        position: "top-left",
        theme: this.ctx.theme,
        controls: [
          {
            id: "brick-size",
            type: "number",
            label: "Brick Size (%)",
            value: this.renkoBrickSize,
            defaultValue: 0.3,
            min: 0.01,
            max: 10,
            step: 0.01,
            helpText: "Size of each brick as percentage of price",
          },
        ],
        onChange: (controlId, value) => {
          if (controlId === "brick-size") {
            this.renkoBrickSize = value;

            // Redraw the Renko chart with new brick size if currently selected
            if (this.currentType === "renko") {
              const temp = this.currentType;
              this.currentType = null; // Reset to force redraw
              this.changeChartType(temp);
            }
          }
        },
      });
    }
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

  /**
   * Convert regular candle data to Renko format, preserving all original timestamps
   * @param {Array} series - Array of candlestick data points
   * @param {number} brickSize - Brick size in percentage of the price
   * @returns {Array} - Transformed Renko data with same length as original series
   */
  _convertToRenko(series, brickSize = 1) {
    if (!series || series.length === 0) return [];

    // Create result array with same length as original
    const result = new Array(series.length).fill(null);

    // Get initial price from the first candle close
    const firstClose = series[0].y[3];

    // Calculate absolute brick size based on percentage of initial price
    const absoluteBrickSize = (brickSize / 100) * firstClose;

    let currentBrickOpen = firstClose;
    let currentBrickClose = firstClose;
    let lastDirection = 0; // 0: initial, 1: up, -1: down

    // Add the first brick at index 0
    result[0] = {
      x: series[0].x,
      y: [
        currentBrickOpen,
        currentBrickOpen,
        currentBrickClose,
        currentBrickClose,
      ],
      open: currentBrickOpen,
      close: currentBrickClose,
    };

    // Map to track which timestamps already have bricks
    const filledTimestamps = new Set([series[0].x]);

    // Process each candle
    for (let i = 1; i < series.length; i++) {
      const curr = series[i];
      const timestamp = curr.x;
      const currClose = curr.y[3];

      // Calculate how many bricks we need to draw
      const priceDiff = currClose - currentBrickClose;

      if (Math.abs(priceDiff) >= absoluteBrickSize) {
        // Calculate number of bricks
        const numBricks = Math.floor(Math.abs(priceDiff) / absoluteBrickSize);
        const direction = priceDiff > 0 ? 1 : -1;

        // Find the next available index for placing bricks
        let brickIndex = i;

        // Only add bricks if we have a reversal or continuing in the same direction
        if (lastDirection === 0 || direction === lastDirection) {
          // Continuing in the same direction
          for (let j = 0; j < numBricks; j++) {
            currentBrickOpen = currentBrickClose;
            currentBrickClose =
              currentBrickOpen + direction * absoluteBrickSize;

            // Find next unfilled index
            while (
              brickIndex < series.length &&
              filledTimestamps.has(series[brickIndex].x)
            ) {
              brickIndex++;
            }

            // Only add if we have space
            if (brickIndex < series.length) {
              result[brickIndex] = {
                x: series[brickIndex].x,
                y: [
                  currentBrickOpen,
                  Math.max(currentBrickOpen, currentBrickClose),
                  Math.min(currentBrickOpen, currentBrickClose),
                  currentBrickClose,
                ],
                open: currentBrickOpen,
                close: currentBrickClose,
              };

              filledTimestamps.add(series[brickIndex].x);
            }
          }
        } else {
          // Reversal - need at least two bricks to reverse
          if (numBricks >= 2) {
            // First, complete the reversal brick
            currentBrickOpen = currentBrickClose;
            currentBrickClose =
              currentBrickOpen + direction * absoluteBrickSize;

            // Find next unfilled index
            while (
              brickIndex < series.length &&
              filledTimestamps.has(series[brickIndex].x)
            ) {
              brickIndex++;
            }

            // Only add if we have space
            if (brickIndex < series.length) {
              result[brickIndex] = {
                x: series[brickIndex].x,
                y: [
                  currentBrickOpen,
                  Math.max(currentBrickOpen, currentBrickClose),
                  Math.min(currentBrickOpen, currentBrickClose),
                  currentBrickClose,
                ],
                open: currentBrickOpen,
                close: currentBrickClose,
              };

              filledTimestamps.add(series[brickIndex].x);
            }

            // Then add any additional bricks in the new direction
            for (let j = 1; j < numBricks; j++) {
              currentBrickOpen = currentBrickClose;
              currentBrickClose =
                currentBrickOpen + direction * absoluteBrickSize;

              // Find next unfilled index
              brickIndex++;
              while (
                brickIndex < series.length &&
                filledTimestamps.has(series[brickIndex].x)
              ) {
                brickIndex++;
              }

              // Only add if we have space
              if (brickIndex < series.length) {
                result[brickIndex] = {
                  x: series[brickIndex].x,
                  y: [
                    currentBrickOpen,
                    Math.max(currentBrickOpen, currentBrickClose),
                    Math.min(currentBrickOpen, currentBrickClose),
                    currentBrickClose,
                  ],
                  open: currentBrickOpen,
                  close: currentBrickClose,
                };

                filledTimestamps.add(series[brickIndex].x);
              }
            }
          }
        }

        lastDirection = direction;
      }

      // For timestamps without a new brick, set each to the current brick's values if not already filled
      if (!filledTimestamps.has(timestamp)) {
        result[i] = {
          x: timestamp,
          y: null, // Use null for y-values to indicate no price action at this timestamp
          open: null,
          close: null,
        };

        filledTimestamps.add(timestamp);
      }
    }

    // For any remaining unfilled indices, use their timestamp with null values
    for (let i = 0; i < result.length; i++) {
      if (result[i] === null) {
        result[i] = {
          x: series[i].x,
          y: null,
          open: null,
          close: null,
        };
      }
    }

    return result;
  }

  /**
   * Generate tooltip content for box-style charts (candlestick, Heikin-Ashi, Renko)
   * @param {Object} w - ApexCharts w object
   * @param {number} seriesIndex - Series index
   * @param {number} dataPointIndex - Data point index
   * @param {Array} labels - Array of labels for OHLC values
   * @param {string} chartType - Chart type
   * @returns {string} - HTML content for tooltip
   */
  _getBoxTooltip(w, seriesIndex, dataPointIndex, labels, chartType) {
    const o = w.globals.seriesCandleO[seriesIndex][dataPointIndex];
    const h = w.globals.seriesCandleH[seriesIndex][dataPointIndex];
    const m = w.globals.seriesCandleM
      ? w.globals.seriesCandleM[seriesIndex][dataPointIndex]
      : null;
    const l = w.globals.seriesCandleL[seriesIndex][dataPointIndex];
    const c = w.globals.seriesCandleC[seriesIndex][dataPointIndex];

    if (
      o === null ||
      o === undefined ||
      h === null ||
      l === null ||
      c === null
    ) {
      return ""; // Return empty tooltip for null values
    }

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
    dropdown.setAttribute("role", "listbox");
    dropdown.setAttribute("aria-label", "Chart type");

    // The trigger is a <button> (already focusable; Enter/Space natively fire
    // click), so we only add the ARIA state + ArrowDown/Escape below.
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");

    // Select a chart type (shared by mouse click and keyboard).
    const selectType = (option) => {
      this.changeChartType(option.dataset.type);
      dropdown.querySelectorAll(".apexstock-chart-type-option").forEach((el) => {
        el.classList.remove("active");
        el.setAttribute("aria-selected", "false");
      });
      option.classList.add("active");
      option.setAttribute("aria-selected", "true");
    };

    // Add chart type options to dropdown
    this.chartTypes.forEach((type) => {
      const option = document.createElement("div");
      option.classList.add("apexstock-chart-type-option");
      option.dataset.type = type.id;
      option.setAttribute("role", "option");
      option.setAttribute("tabindex", "-1");
      option.innerHTML = `<span class="chart-icon">${type.icon}</span><span class="chart-text">${type.name}</span>`;

      // Highlight the currently selected chart type
      const isActive = type.id === this.currentType;
      if (isActive) option.classList.add("active");
      option.setAttribute("aria-selected", isActive ? "true" : "false");

      option.addEventListener("click", () => {
        selectType(option);
        closeDropdown();
      });

      dropdown.appendChild(option);
    });

    chartSwitchWrapper.appendChild(dropdown);

    // --- Open/close + keyboard (ARIA listbox pattern) ---
    const getOptions = () =>
      Array.from(dropdown.querySelectorAll(".apexstock-chart-type-option"));
    const isOpen = () => dropdown.style.display === "block";
    const focusOption = (idx) => {
      const opts = getOptions();
      if (!opts.length) return;
      const i = Math.max(0, Math.min(idx, opts.length - 1));
      opts.forEach((o, n) => o.setAttribute("tabindex", n === i ? "0" : "-1"));
      opts[i].focus();
    };
    const closeDropdown = (returnFocus) => {
      dropdown.style.display = "none";
      trigger.setAttribute("aria-expanded", "false");
      if (returnFocus) trigger.focus();
    };
    const openDropdown = (focusActive) => {
      dropdown.style.display = "block";
      trigger.setAttribute("aria-expanded", "true");
      if (focusActive) {
        const opts = getOptions();
        const sel = opts.findIndex((o) => o.classList.contains("active"));
        focusOption(sel >= 0 ? sel : 0);
      }
    };

    // Toggle dropdown on trigger click (Enter/Space reach here via the button).
    trigger.addEventListener("click", () => {
      if (isOpen()) closeDropdown();
      else openDropdown(false);
    });
    trigger.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        openDropdown(true);
      } else if (e.key === "Escape" && isOpen()) {
        e.preventDefault();
        closeDropdown();
      }
    });

    // Arrow / Home / End / Enter / Space / Escape / Tab within the listbox.
    dropdown.addEventListener("keydown", (e) => {
      const opts = getOptions();
      const current = opts.indexOf(document.activeElement);
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          focusOption(current + 1);
          break;
        case "ArrowUp":
          e.preventDefault();
          focusOption(current - 1);
          break;
        case "Home":
          e.preventDefault();
          focusOption(0);
          break;
        case "End":
          e.preventDefault();
          focusOption(opts.length - 1);
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          if (current >= 0) {
            selectType(opts[current]);
            closeDropdown(true);
          }
          break;
        case "Escape":
          e.preventDefault();
          closeDropdown(true);
          break;
        case "Tab":
          closeDropdown();
          break;
      }
    });

    // Close dropdown when clicking outside
    document.addEventListener("click", (e) => {
      if (!chartSwitchWrapper.contains(e.target)) {
        closeDropdown();
      }
    });

    // Find the toolbar or parent element to insert the chart type dropdown
    // Look for the export button to position this next to it
    const toolbarEl = this.ctx.primaryToolbarLeft;
    if (toolbarEl) {
      toolbarEl.insertBefore(chartSwitchWrapper, toolbarEl.firstChild);
    }
  }

  updateTheme(theme) {
    if (this.renkoSettingsControl) {
      this.renkoSettingsControl.updateTheme(theme);
    }
  }

  /**
   * Change the chart type
   * @param {string} type - The chart type to switch to
   */
  changeChartType(type) {
    if (type === this.currentType) return;
    this.originalSeries = [...this.ctx.series];

    // Save current zoom state before changing chart type
    const zoomState = this.ctx.getCurrentZoomState();

    this.currentType = type;

    if (type === "renko") {
      this.initializeRenkoSettings();
      this.renkoSettingsControl.show();
    } else if (this.renkoSettingsControl) {
      this.renkoSettingsControl.hide();
    }

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
    } else if (type === "renko") {
      // Convert to Renko and use candlestick type for rendering
      const renkoData = this._convertToRenko(
        this.originalSeries,
        this.renkoBrickSize
      );
      newSeries = [
        {
          name: "Renko",
          type: "candlestick",
          data: renkoData,
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
        s.name !== "Price" &&
        s.name !== "Heikin-Ashi" &&
        s.name !== "Renko" &&
        s.name !== undefined
    );

    // Custom tooltip labels for different chart types
    let tooltipLabels;
    if (type === "heikinashi") {
      tooltipLabels = ["HA-Open", "HA-High", "", "HA-Low", "HA-Close"];
    } else if (type === "renko") {
      tooltipLabels = [
        "Renko-Open",
        "Renko-High",
        "",
        "Renko-Low",
        "Renko-Close",
      ];
    } else {
      tooltipLabels = ["Open", "High", "", "Low", "Close"];
    }

    // Special options for Renko charts to handle null values
    const chartOptions = {
      series: [...newSeries, ...indicators],
      chart: {
        type: (() => {
          if (["candlestick", "heikinashi", "renko", "ohlc"].includes(type)) {
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
          // Skip showing tooltip for null values in Renko chart
          if (
            type === "renko" &&
            (!w.globals.seriesCandleO[seriesIndex][dataPointIndex] ||
              w.globals.seriesCandleO[seriesIndex][dataPointIndex] === null)
          ) {
            return "";
          }

          if (
            type === "candlestick" ||
            type === "heikinashi" ||
            type === "renko" ||
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
          }: <strong>${w.globals.series[seriesIndex][dataPointIndex]}</strong>
          </div>`;
          }
        },
      },
      // Add custom colors for different chart types
      plotOptions: {
        candlestick: {
          type,
          colors: {
            upward: "#34D399", // Different green for different types
            downward: "#F87171", // Different red for different types
          },
        },
      },
      stroke: {
        curve: type === "stepline" ? "stepline" : "monotoneCubic",
      },
      fill: {
        opacity: type === "area" ? 0.3 : 1,
      },
    };

    // For Renko chart with null values, add special handling
    if (type === "renko") {
      chartOptions.plotOptions.candlestick.renkoBrickSize = this.renkoBrickSize;
      chartOptions.plotOptions.candlestick.handleNulls = true;

      // Customize tooltip further for Renko
      chartOptions.tooltip.x = {
        format: "dd MMM yyyy",
        formatter: function (val, opts) {
          return new Date(val).toLocaleString();
        },
      };
    }

    // Update the chart with new series type
    this.chart.updateOptions(chartOptions, true, false, false).then(() => {
      this.ctx.applyZoomToAllCharts(zoomState);
      // Re-apply trading price lines so they survive the chart-type switch.
      if (this.ctx.tradingOverlays) this.ctx.tradingOverlays.reapply();
    });
  }

  destroy() {
    if (this.renkoSettingsControl) {
      this.renkoSettingsControl.destroy();
      this.renkoSettingsControl = null;
    }
  }
}
