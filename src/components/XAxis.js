import Utils from "../utils/Utils";
/**
 * Custom X-Axis component for ApexStock
 * Provides a customizable time-based X-axis that adapts to different zoom levels
 */
export default class XAxis {
  /**
   * Creates a new XAxis instance
   * @param {import("../ApexStock.js").default} context - The ApexStock instance
   */
  constructor(context) {
    this.context = context;
    this.axisElement = null;
    this.ticksContainer = null;
    this.tooltipElement = null;
    this.resizeObserver = null;
    this.mouseTracker = null;
    this.isPanning = false;

    // Create the axis container
    this.createAxisElement();

    // Initial render
    this.render();

    // Add resize listener for repositioning
    this.setupResizeListener();

    // Setup mouse tracking for tooltip
    this.setupMouseTracking();
  }

  /**
   * Set up listeners for window resize and chart container size changes
   */
  setupResizeListener() {
    // Debounce function to limit how often the resize handler fires
    const debounce = (fn, delay) => {
      let timeoutId;
      return function (...args) {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => {
          fn.apply(this, args);
        }, delay);
      };
    };

    // Handle window resize. Keep a reference so destroy() can remove it
    // (an inline handler would leak this instance across SPA unmounts).
    this._boundWindowResize = debounce(() => {
      this.updatePosition();
    }, 100);
    window.addEventListener("resize", this._boundWindowResize);

    // Use ResizeObserver if available to monitor chart container size changes
    if (typeof ResizeObserver !== "undefined" && this.context.chartEl) {
      this.resizeObserver = new ResizeObserver(
        debounce(() => {
          this.updatePosition();
        }, 100)
      );

      this.resizeObserver.observe(this.context.chartEl);
    }
  }

  /**
   * Sets up mouse tracking for the tooltip
   */
  setupMouseTracking() {
    if (!this.context.chartEl) return;

    // Find the main chart
    const mainChartElement = document.getElementById(this.context.mainChartId);
    if (!mainChartElement) return;

    // Create tooltip element that stays at the bottom of the axis
    this.tooltipElement = document.createElement("div");
    this.tooltipElement.classList.add("apexstock-xaxis-tooltip");

    // Add tooltip to the axis element
    this.axisElement.appendChild(this.tooltipElement);

    // Bind the event handlers to preserve 'this' context
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseLeave = this.handleMouseLeave.bind(this);
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);

    // Set up initial event listeners
    this.updateEventListeners();
  }

  /**
   * Updates event listeners for all charts when indicators change
   * This method should be called whenever indicators are added or removed
   */
  updateEventListeners() {
    // First, remove all existing event listeners to avoid duplicates
    this.removeAllEventListeners();

    // Track every element we attach to, so teardown targets exactly those
    // instead of scanning the whole document (see removeAllEventListeners).
    this._listenerTargets = [];
    const attach = (el) => {
      el.addEventListener("mousemove", this.handleMouseMove);
      el.addEventListener("mousedown", this.handleMouseDown);
      el.addEventListener("mouseup", this.handleMouseUp);
      el.addEventListener("mouseleave", this.handleMouseLeave);
      this._listenerTargets.push(el);
    };

    // Main chart
    const mainChartElement = document.getElementById(this.context.mainChartId);
    if (mainChartElement) attach(mainChartElement);

    // All current indicator charts
    if (
      this.context.indicatorChartMap &&
      Object.keys(this.context.indicatorChartMap).length
    ) {
      Object.keys(this.context.indicatorChartMap).forEach((key) => {
        const chart = this.context.indicatorChartMap[key];

        if (chart && chart.opts && chart.opts.chart && chart.opts.chart.id) {
          const indicatorElement = document.getElementById(
            `apexcharts${chart.opts.chart.id}`
          );
          if (indicatorElement) attach(indicatorElement);
        }
      });
    }
  }

  /**
   * Removes all event listeners from main chart and indicator charts
   */
  removeAllEventListeners() {
    // Remove from exactly the elements we attached to (tracked in
    // updateEventListeners), instead of a document-wide `querySelectorAll`
    // scan on every indicator change. removeEventListener on a since-detached
    // node is a harmless no-op, so this also covers removed indicator panes.
    if (this._listenerTargets) {
      this._listenerTargets.forEach((element) => {
        element.removeEventListener("mousemove", this.handleMouseMove);
        element.removeEventListener("mouseleave", this.handleMouseLeave);
        element.removeEventListener("mousedown", this.handleMouseDown);
        element.removeEventListener("mouseup", this.handleMouseUp);
      });
      this._listenerTargets = [];
    }
  }

  /**
   * Handles mouse movement and updates tooltip position and content
   * @param {MouseEvent} e - Mouse event
   */
  handleMouseMove(e) {
    if (!this.context.xaxisRange) return;

    const chartElement = document.getElementById(this.context.mainChartId);
    if (!chartElement) return;

    // Get the xcrosshairs element from ApexCharts, which follows the cursor position
    const xcrosshair = chartElement.querySelector(".apexcharts-xcrosshairs");
    if (!xcrosshair) {
      this.tooltipElement.style.display = "none";
      return;
    }

    // Check if crosshair is visible (ApexCharts hides it when outside the chart area)
    const crosshairDisplay = window.getComputedStyle(xcrosshair).display;
    if (crosshairDisplay === "none" || this.isPanning) {
      this.tooltipElement.style.display = "none";
      return;
    }

    // Calculate relative position for finding data point
    const graphicalElement = chartElement.querySelector(
      ".apexcharts-inner.apexcharts-graphical"
    );
    if (!graphicalElement) return;

    const graphicalRect = Utils.cachedRect(graphicalElement);
    const relativePercent =
      (e.clientX - graphicalRect.left) / graphicalRect.width;

    // Get the data point index directly from ApexCharts context if available
    let dataPointIndex = this.findNearestDataPointIndex(relativePercent);
    let timestamp, formattedDate;

    if (dataPointIndex !== null) {
      // Use the data point's x value
      timestamp = this.getDataPointTimestamp(dataPointIndex);

      // If timestamp is valid, format it
      if (timestamp) {
        const date = new Date(timestamp);
        if (!isNaN(date.getTime())) {
          formattedDate = this.formatDate(date, this.crosshairFormat());
        } else {
          formattedDate = "Invalid date";
        }
      } else {
        formattedDate = "No data";
      }
    } else {
      this.handleMouseLeave();
      return;
    }

    // Update tooltip content
    this.tooltipElement.textContent = formattedDate;
    // flex, not block: the chip centres its text over the full height of the
    // axis strip (see the stylesheet).
    this.tooltipElement.style.display = "flex";

    // Where the crosshair actually is, in the axis strip's own coordinates.
    //
    // The obvious source is the crosshair's `x1` attribute, but that is a
    // coordinate inside the plot group, whose origin sits wherever ApexCharts
    // put the plot. The chip is a child of the axis strip, whose origin is the
    // widget's left edge. The two only coincide when nothing is drawn to the
    // left of the plot, so any left-hand y-axis shifted the chip left by the
    // width of the gutter: a few pixels on a normal chart, and 140+ on a
    // comparison chart, which stacks a percentage axis and a price axis there.
    // Measuring the rendered crosshair instead is origin-independent and
    // survives whatever transforms sit between the two.
    const axisRect = this.axisElement.getBoundingClientRect();
    const crosshairRect = xcrosshair.getBoundingClientRect();
    const crosshairX =
      crosshairRect.left + crosshairRect.width / 2 - axisRect.left;
    if (!Number.isFinite(crosshairX)) return;

    // Keep the chip inside the strip so its ends are never clipped. Clamping
    // against the strip rather than the plot lets it stay centred on the
    // crosshair further into the gutter, where there is room for it.
    const tooltipHalfWidth = this.tooltipElement.offsetWidth / 2;
    let tooltipLeft = crosshairX;
    if (axisRect.width > tooltipHalfWidth * 2) {
      tooltipLeft = Math.min(
        Math.max(crosshairX, tooltipHalfWidth),
        axisRect.width - tooltipHalfWidth
      );
    }

    this.tooltipElement.style.left = `${tooltipLeft}px`;
  }

  handleMouseDown(e) {
    this.isPanning = true;
  }

  handleMouseUp(e) {
    this.isPanning = false;
  }

  handleMouseLeave() {
    this.tooltipElement.style.display = "none";
  }

  /**
   * Finds the data point index that the user is currently hovering over
   * @param {number} relativePercent - Mouse position as percentage of chart width
   * @returns {number|null} - Data point index or null if not found
   */
  findNearestDataPointIndex(relativePercent) {
    try {
      // Try to access ApexCharts global context to get the captured data point index
      if (
        this.context.chart &&
        this.context.chart.w &&
        typeof this.context.chart.w.globals.capturedDataPointIndex !==
          "undefined"
      ) {
        // Use the index directly from ApexCharts
        const capturedIndex =
          this.context.chart.w.globals.capturedDataPointIndex;

        // Check if the index is valid
        if (capturedIndex !== null && capturedIndex >= 0) {
          return capturedIndex;
        }
      }

      // Fallback to previous implementation if ApexCharts context is not available
      if (!this.context.series || !this.context.series.length) return null;

      // Get chart series
      const series = this.context.series[0];
      if (!series || !series.data || !series.data.length) return null;

      // Get first and last x values to calculate the range
      const firstPoint = series.data[0];
      const lastPoint = series.data[series.data.length - 1];

      if (!firstPoint || !lastPoint) return null;

      // Get x values (timestamps)
      const firstX =
        firstPoint.x instanceof Date ? firstPoint.x.getTime() : firstPoint.x;
      const lastX =
        lastPoint.x instanceof Date ? lastPoint.x.getTime() : lastPoint.x;

      if (isNaN(firstX) || isNaN(lastX)) return null;

      // Calculate the approximate x value based on relative position
      const targetX = firstX + (lastX - firstX) * relativePercent;

      // Find the closest data point
      let closestIndex = 0;
      let closestDistance = Number.MAX_VALUE;

      for (let i = 0; i < series.data.length; i++) {
        const point = series.data[i];
        if (!point) continue;

        const pointX = point.x instanceof Date ? point.x.getTime() : point.x;
        if (isNaN(pointX)) continue;

        const distance = Math.abs(pointX - targetX);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = i;
        }
      }

      return closestIndex;
    } catch (error) {
      Utils.warn("Error finding nearest data point:", error);
      return null;
    }
  }

  /**
   * Gets the timestamp for a data point
   * @param {number} index - Data point index
   * @returns {number} - Timestamp in milliseconds
   */
  getDataPointTimestamp(index) {
    try {
      if (!this.context.series || !this.context.series.length) {
        return this.context.xaxisRange.min;
      }

      const series = this.context.series;

      if (!series[index]) {
        return this.context.xaxisRange.min;
      }

      const point = series[index];

      if (!point) return this.context.xaxisRange.min;

      if (typeof point.x !== "undefined") {
        return new Date(point.x).getTime();
      }
    } catch (error) {
      Utils.warn("Error getting data point timestamp:", error);
      return this.context.xaxisRange.min;
    }
  }

  /**
   * Creates the DOM elements for the x-axis
   */
  createAxisElement() {
    // Create the axis container
    this.axisElement = document.createElement("div");
    this.axisElement.classList.add("apexstock-xaxis");
    this.axisElement.style.width = "100%";
    this.axisElement.style.height = "30px";
    this.axisElement.style.overflow = "hidden";
    this.axisElement.style.boxSizing = "border-box";
    this.axisElement.style.zIndex = "999"; // Ensure it's above other elements
    // The surface and rule come from the stylesheet, NOT from an inline color
    // read here. This runs once, at creation, so an inline color could never
    // follow updateTheme(): the axis stayed a white band under a dark chart for
    // the life of the instance. The tokens also mean a theme preset retints it,
    // which a value copied from `colors.toolbar` never did.

    // Create the ticks container
    this.ticksContainer = document.createElement("div");
    this.ticksContainer.style.position = "absolute";
    this.ticksContainer.style.height = "100%";
    this.ticksContainer.style.width = "100%";
    this.ticksContainer.style.overflow = "hidden";
    this.ticksContainer.style.boxSizing = "border-box";

    this.axisElement.appendChild(this.ticksContainer);
  }

  /**
   * Updates the position and width of the X-axis to align with the chart area
   */
  updatePosition() {
    // Find the chart graphical element to use as reference
    if (!this.context.mainChartId) return;
    // The retry below reschedules itself until the chart's SVG appears, so it can
    // outlive the document that owns it (a torn-down test environment, a removed
    // iframe). Stop instead of throwing.
    if (typeof document === "undefined") return;

    const chartElement = document.getElementById(this.context.mainChartId);
    if (!chartElement) return;

    const graphicalElement = chartElement.querySelector(
      ".apexcharts-inner.apexcharts-graphical"
    );
    if (!graphicalElement) {
      // If not found immediately, try again after a short delay
      setTimeout(() => this.updatePosition(), 50);
      return;
    }

    // Get the bounding rectangles for positioning
    const graphicalRect = graphicalElement.getBoundingClientRect();
    const axisRect = this.axisElement.getBoundingClientRect();

    // Calculate offset
    const leftOffset = graphicalRect.left - axisRect.left;
    const rightOffset = axisRect.right - graphicalRect.right;

    // Apply padding to align tick marks with chart
    this.axisElement.style.paddingLeft = Math.max(0, leftOffset) + "px";
    this.axisElement.style.paddingRight = Math.max(0, rightOffset) + "px";

    // Apply the same transform as the chart's xaxis for proper alignment
    const xaxis = chartElement.querySelector(".apexcharts-xaxis");
    if (xaxis) {
      const transform = window.getComputedStyle(xaxis).transform;
      if (transform && transform !== "none") {
        this.ticksContainer.style.transform = transform;
      } else {
        this.ticksContainer.style.transform = "";
      }
    }
  }

  ensureXAxisIsLast() {
    // Ensure the x-axis is the last element in the chart container
    if (
      this.context.chartEl &&
      this.axisElement &&
      this.axisElement.parentNode
    ) {
      // Check if it's already the last child
      if (this.context.chartEl.lastChild !== this.axisElement) {
        // Remove and re-append to make it last
        this.axisElement.parentNode.removeChild(this.axisElement);
        this.context.chartEl.appendChild(this.axisElement);
      }
    }
  }

  /**
   * Determines the appropriate tick interval based on the current range
   * @returns {Object} The tick interval and format information
   */
  getTickInterval() {
    const range = this.context.xaxisRange;
    const rangeInMs = range.max - range.min;
    const rangeInMinutes = rangeInMs / (60 * 1000);
    const rangeInHours = rangeInMinutes / 60;
    const rangeInDays = rangeInHours / 24;
    const rangeInMonths = rangeInDays / 30; // Approximation
    const rangeInYears = rangeInMonths / 12; // Approximation

    // Try to keep between 5-10 ticks on the axis
    // Define intervals based on range
    if (rangeInMinutes <= 120) {
      // 0-2 hours: show minutes (1, 2, 5, or 10-minute intervals)
      let minuteInterval = 1;
      if (rangeInMinutes > 20) minuteInterval = 5;
      if (rangeInMinutes > 60) minuteInterval = 10;

      return {
        interval: minuteInterval * 60 * 1000,
        format: "HH:mm",
        label: "time",
      };
    } else if (rangeInHours <= 24) {
      // 2-24 hours: show hourly intervals
      let hourInterval = 1;
      if (rangeInHours > 12) hourInterval = 2;

      return {
        interval: hourInterval * 60 * 60 * 1000,
        format: "HH:mm",
        label: "time",
      };
    } else if (rangeInHours <= 72) {
      // 1-3 days: show 4-hour or 6-hour intervals
      const hourInterval = rangeInHours > 48 ? 6 : 4;
      return {
        interval: hourInterval * 60 * 60 * 1000,
        format: "MMM DD HH:mm",
        label: "datetime",
      };
    } else if (rangeInDays <= 28) {
      // 3-14 days: show daily intervals
      return {
        interval: 24 * 60 * 60 * 1000,
        format: "MMM DD",
        label: "date",
      };
    } else if (rangeInDays <= 90) {
      // 2 weeks to 2 months: show weekly intervals
      return {
        interval: 7 * 24 * 60 * 60 * 1000,
        format: "MMM DD",
        label: "date",
      };
    } else if (rangeInDays <= 365) {
      // 2-12 months: show monthly intervals
      return {
        interval: 30 * 24 * 60 * 60 * 1000,
        format: "MMM YYYY",
        label: "month",
      };
    } else if (rangeInYears <= 3) {
      // 1-3 years: show quarterly intervals
      return {
        interval: 3 * 30 * 24 * 60 * 60 * 1000,
        format: "MMM YYYY",
        label: "quarter",
      };
    } else {
      // > 3 years: show yearly intervals
      return {
        interval: 365 * 24 * 60 * 60 * 1000,
        format: "YYYY",
        label: "year",
      };
    }
  }

  /**
   * Build one axis tick: a mark and its label, positioned at `left`.
   *
   * The colors live in the stylesheet rather than being read from
   * `context.colors` here. Ticks are only rebuilt on a render, so an inline
   * color meant a theme switch left the labels in the old palette until the
   * next zoom or pan: after switching to dark they stayed near-black on the
   * dark strip.
   *
   * @param {string} label - The formatted date.
   * @param {string} left - CSS left offset (a percentage).
   * @returns {HTMLDivElement}
   */
  static buildTick(label, left) {
    const tick = document.createElement("div");
    tick.className = "apexstock-xaxis-tick";
    tick.style.left = left;

    const mark = document.createElement("div");
    mark.className = "apexstock-xaxis-tick-mark";

    const text = document.createElement("div");
    text.className = "apexstock-xaxis-tick-label";
    text.textContent = label;

    tick.appendChild(mark);
    tick.appendChild(text);
    return tick;
  }

  /**
   * The crosshair label's date format, chosen from the data's own bar spacing.
   *
   * Deliberately not from the zoom level: minute bars are still minute bars
   * when the view is zoomed out to a year. And a daily series carries one
   * timestamp per day, so printing a time on it is noise at best. With bars
   * stamped at UTC midnight and read in any other zone it is worse than noise:
   * a bar that is simply March 5th was labelled "Mar 05, 2024 05:30".
   *
   * Cached on the series identity, since this runs on every pointer move.
   *
   * @returns {string} A format string for {@link XAxis#formatDate}.
   */
  crosshairFormat() {
    const series = this.context.series;
    const n = Array.isArray(series) ? series.length : 0;
    const key = n
      ? `${n}:${Number(new Date(series[0].x))}:${Number(new Date(series[n - 1].x))}`
      : "0";
    if (this._crosshairFormatKey !== key) {
      this._crosshairFormatKey = key;
      this._crosshairFormatValue = XAxis.hasIntradayBars(series)
        ? "MMM DD, YYYY · HH:mm"
        : "MMM DD, YYYY";
    }
    return this._crosshairFormatValue;
  }

  /**
   * Whether consecutive bars sit less than a day apart.
   * @param {Array<{x: *}>} series
   * @returns {boolean}
   */
  static hasIntradayBars(series) {
    if (!Array.isArray(series) || series.length < 2) return false;
    const DAY = 24 * 60 * 60 * 1000;
    // The smallest gap is the bar interval. A leading sample is enough: a
    // series does not change resolution partway through.
    const limit = Math.min(series.length, 50);
    for (let i = 1; i < limit; i++) {
      const gap =
        Number(new Date(series[i].x)) - Number(new Date(series[i - 1].x));
      if (gap > 0 && gap < DAY) return true;
    }
    return false;
  }

  /**
   * Formats a date according to the specified format
   * @param {Date} date - The date to format
   * @param {string} format - The format string
   * @returns {string} The formatted date string
   */
  formatDate(date, format) {
    const pad = (num) => String(num).padStart(2, "0");

    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    const hours = date.getHours();
    const minutes = date.getMinutes();

    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    return format
      .replace("YYYY", year)
      .replace("MMM", monthNames[month])
      .replace("MM", pad(month + 1))
      .replace("DD", pad(day))
      .replace("HH", pad(hours))
      .replace("mm", pad(minutes));
  }

  /**
   * Calculates tick positions and values
   * @returns {Array} Array of tick objects with position and label
   */
  calculateTicks() {
    const range = this.context.xaxisRange;
    if (!range || isNaN(range.min) || isNaN(range.max)) {
      Utils.warn("Invalid range for calculating ticks:", range);
      return [];
    }

    // Get initial interval based on range
    let { interval, format } = this.getTickInterval();

    // Ensure interval is valid
    if (!interval || interval <= 0) {
      Utils.warn("Invalid interval for calculating ticks:", interval);
      return [];
    }

    // First attempt with the calculated interval
    let ticks = this.generateTicksWithInterval(
      range.min,
      range.max,
      interval,
      format
    );

    // If we don't have at least 5 ticks, adjust the interval
    if (ticks.length < 5) {
      // Calculate a new interval to get approximately 5-10 ticks
      const rangeSpan = range.max - range.min;
      interval = Math.floor(rangeSpan / 5);

      // Regenerate ticks with the new interval
      ticks = this.generateTicksWithInterval(
        range.min,
        range.max,
        interval,
        format
      );

      // If still not enough ticks, add evenly spaced ticks
      if (ticks.length < 5) {
        return this.generateEvenlySpacedTicks(range.min, range.max, 5, format);
      }
    }

    // Limit the number of ticks if there are too many
    if (ticks.length > 10) {
      const step = Math.ceil(ticks.length / 8);
      return ticks.filter((_, i) => i % step === 0);
    }

    return ticks;
  }

  /**
   * Generates ticks with a specific interval
   * @param {number} min - The minimum timestamp
   * @param {number} max - The maximum timestamp
   * @param {number} interval - The interval between ticks in milliseconds
   * @param {string} format - The date format to use
   * @returns {Array} Array of tick objects
   */
  generateTicksWithInterval(min, max, interval, format) {
    const ticks = [];

    // Round down to the nearest interval
    let currentTick = Math.floor(min / interval) * interval;

    // Add ticks within the range
    while (currentTick <= max) {
      if (currentTick >= min) {
        const position = ((currentTick - min) / (max - min)) * 100;
        const date = new Date(currentTick);

        // Skip invalid dates
        if (isNaN(date.getTime())) {
          currentTick += interval;
          continue;
        }

        ticks.push({
          position,
          label: this.formatDate(date, format),
          timestamp: currentTick,
        });
      }
      currentTick += interval;
    }

    return ticks;
  }

  /**
   * Generates evenly spaced ticks regardless of time intervals
   * @param {number} min - The minimum timestamp
   * @param {number} max - The maximum timestamp
   * @param {number} count - The number of ticks to generate
   * @param {string} format - The date format to use
   * @returns {Array} Array of tick objects
   */
  generateEvenlySpacedTicks(min, max, count, format) {
    const ticks = [];
    const range = max - min;

    // Always include the min and max points
    ticks.push({
      position: 0,
      label: this.formatDate(new Date(min), format),
      timestamp: min,
    });

    // Generate evenly spaced ticks between min and max
    for (let i = 1; i < count - 1; i++) {
      const timestamp = min + (range * i) / (count - 1);
      ticks.push({
        position: (i / (count - 1)) * 100,
        label: this.formatDate(new Date(timestamp), format),
        timestamp,
      });
    }

    ticks.push({
      position: 100,
      label: this.formatDate(new Date(max), format),
      timestamp: max,
    });

    return ticks;
  }

  /**
   * Renders the x-axis with tick marks
   */
  render() {
    if (!this.ticksContainer || !this.context.xaxisRange) return;

    // Ensure we have valid min/max values
    if (
      isNaN(this.context.xaxisRange.min) ||
      isNaN(this.context.xaxisRange.max)
    ) {
      Utils.warn("Invalid xaxisRange values:", this.context.xaxisRange);
      return;
    }

    // Update position and width based on the chart graphical element
    this.updatePosition();

    // Get the container width for boundary checks
    const containerWidth = this.ticksContainer.offsetWidth;
    if (!containerWidth) return; // Skip if container has no width

    // Clear previous ticks
    this.ticksContainer.innerHTML = "";

    const ticks = this.calculateTicks();
    if (!ticks.length) return; // Skip if no ticks

    // Prevent duplicate labels
    const usedLabels = new Set();
    const minSpacing = 30; // Minimum spacing between ticks in pixels
    let lastPixelPosition = -minSpacing * 2; // Initialize with a negative position

    // Create and position ticks
    ticks.forEach((tick) => {
      // Skip ticks outside the valid position range
      if (tick.position < 0 || tick.position > 100) return;

      // Calculate the pixel position
      const pixelPosition = (tick.position / 100) * containerWidth;

      // Skip ticks that would be outside the container with a buffer of 30px
      // This prevents labels from being cut off at the edges
      if (pixelPosition < 30 || pixelPosition > containerWidth - 30) {
        return;
      }

      // Skip if this tick is too close to the previous one
      if (pixelPosition - lastPixelPosition < minSpacing) {
        return;
      }

      // Skip if this label has already been used
      if (usedLabels.has(tick.label)) {
        return;
      }

      // Track this label and position
      usedLabels.add(tick.label);
      lastPixelPosition = pixelPosition;

      // Create tick element with inline styles
      this.ticksContainer.appendChild(
        XAxis.buildTick(tick.label, `${tick.position}%`)
      );
    });

    // Make sure we have at least one tick showing
    if (!this.ticksContainer.children.length && ticks.length) {
      // If no ticks were rendered (all were out of bounds),
      // at least show the middle tick
      const middleTick = ticks[Math.floor(ticks.length / 2)];

      this.ticksContainer.appendChild(XAxis.buildTick(middleTick.label, "50%"));
    }
  }

  /**
   * Updates the x-axis height and visibility based on chart configuration
   */
  updateHeight() {
    // First ensure the chart container exists
    if (!this.context.chartEl) return;

    // If the axis element is already in the DOM, remove it
    if (this.axisElement.parentNode) {
      this.axisElement.parentNode.removeChild(this.axisElement);
    }

    // Sits in normal flow directly under the chart. It must NOT be pulled up
    // over the plot: ApexCharts reserves a band below the grid for x-axis
    // labels, and even with those turned off the band is not empty, because the
    // bottom y-axis label is centred on the last gridline and so hangs half of
    // its height into it. A -15px margin used to close that band, which sliced
    // every bottom-most axis label in two (and made the widget 15px shorter
    // than the height that was asked for).
    this.axisElement.style.position = "relative";
    this.axisElement.style.marginTop = "0px";

    // Always append the axis as the LAST child of the chart container
    // This ensures it will be below all other elements
    this.context.chartEl.appendChild(this.axisElement);

    // Ensure the axis is visible
    this.axisElement.style.display = "block";

    // Update position and render
    this.updatePosition();
    this.render();
  }

  /**
   * Clean up resources and event listeners
   */
  destroy() {
    // Remove the window resize listener
    if (this._boundWindowResize) {
      window.removeEventListener("resize", this._boundWindowResize);
      this._boundWindowResize = null;
    }

    // Remove resize observer if it exists
    if (this.resizeObserver && this.context.chartEl) {
      this.resizeObserver.unobserve(this.context.chartEl);
      this.resizeObserver = null;
    }

    // Remove all event listeners
    this.removeAllEventListeners();

    // Remove the axis element from the DOM
    if (this.axisElement && this.axisElement.parentNode) {
      this.axisElement.parentNode.removeChild(this.axisElement);
    }

    // Remove tooltip element if it exists
    if (this.tooltipElement && this.tooltipElement.parentNode) {
      this.tooltipElement.parentNode.removeChild(this.tooltipElement);
    }

    this.axisElement = null;
    this.ticksContainer = null;
    this.tooltipElement = null;
  }
}
