/**
 * Custom X-Axis component for ApexStock
 * Provides a customizable time-based X-axis that adapts to different zoom levels
 */
export default class XAxis {
  /**
   * Creates a new XAxis instance
   * @param {ApexStock} context - The ApexStock instance
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

    // Handle window resize
    window.addEventListener(
      "resize",
      debounce(() => {
        this.updatePosition();
      }, 100)
    );

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

    // Re-add event listeners to main chart
    const mainChartElement = document.getElementById(this.context.mainChartId);
    if (mainChartElement) {
      mainChartElement.addEventListener("mousemove", this.handleMouseMove);
      mainChartElement.addEventListener("mousedown", this.handleMouseDown);
      mainChartElement.addEventListener("mouseup", this.handleMouseUp);
      mainChartElement.addEventListener("mouseleave", this.handleMouseLeave);
    }

    // Add event listeners to all current indicator charts
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
          if (indicatorElement) {
            indicatorElement.addEventListener(
              "mousemove",
              this.handleMouseMove
            );
            indicatorElement.addEventListener(
              "mouseleave",
              this.handleMouseLeave
            );
            indicatorElement.addEventListener(
              "mousedown",
              this.handleMouseDown
            );
            indicatorElement.addEventListener("mouseup", this.handleMouseUp);
          }
        }
      });
    }
  }

  /**
   * Removes all event listeners from main chart and indicator charts
   */
  removeAllEventListeners() {
    // Remove from main chart
    const mainChartElement = document.getElementById(this.context.mainChartId);
    if (mainChartElement) {
      mainChartElement.removeEventListener("mousemove", this.handleMouseMove);
      mainChartElement.removeEventListener("mouseleave", this.handleMouseLeave);
      mainChartElement.removeEventListener("mousedown", this.handleMouseDown);
      mainChartElement.removeEventListener("mouseup", this.handleMouseUp);
    }

    // Remove from all indicator charts
    // Note: We need to check all chart elements in the DOM that might have our listeners
    // since the indicatorChartMap might have changed
    const chartElements = document.querySelectorAll('[id^="apexcharts"]');
    chartElements.forEach((element) => {
      if (element.id !== this.context.mainChartId) {
        element.removeEventListener("mousemove", this.handleMouseMove);
        element.removeEventListener("mouseleave", this.handleMouseLeave);
        element.removeEventListener("mousedown", this.handleMouseDown);
        element.removeEventListener("mouseup", this.handleMouseUp);
      }
    });
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

    // Get the x1 attribute directly - this is the exact pixel position of the crosshair
    const crosshairX = parseFloat(xcrosshair.getAttribute("x1"));

    // Calculate relative position for finding data point
    const graphicalElement = chartElement.querySelector(
      ".apexcharts-inner.apexcharts-graphical"
    );
    if (!graphicalElement) return;

    const graphicalRect = graphicalElement.getBoundingClientRect();
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
          formattedDate = this.formatDate(date, "MMM DD, YYYY HH:mm");
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
    this.tooltipElement.style.display = "block";

    // Get tooltip width to calculate boundaries
    const tooltipWidth = this.tooltipElement.offsetWidth;
    const tooltipHalfWidth = tooltipWidth / 2;

    // Get the chart area width to determine boundaries
    const chartRect = graphicalElement.getBoundingClientRect();
    const chartWidth = chartRect.width;

    // Calculate the min and max allowed positions for the tooltip center
    // to prevent it from being cut off at the edges
    const minPosition = tooltipHalfWidth;
    const maxPosition = chartWidth - tooltipHalfWidth;

    // Constrain the tooltip position within the bounds
    let tooltipLeft = crosshairX;
    if (tooltipLeft < minPosition) tooltipLeft = minPosition;
    if (tooltipLeft > maxPosition) tooltipLeft = maxPosition;

    // Position tooltip with the adjusted value
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
      console.warn("Error finding nearest data point:", error);
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
      console.warn("Error getting data point timestamp:", error);
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
    this.axisElement.style.borderTop = "1px solid #eee";
    this.axisElement.style.boxSizing = "border-box";
    this.axisElement.style.backgroundColor =
      this.context.colors.toolbar.background;
    this.axisElement.style.zIndex = "999"; // Ensure it's above other elements

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
      console.warn("Invalid range for calculating ticks:", range);
      return [];
    }

    // Get initial interval based on range
    let { interval, format } = this.getTickInterval();

    // Ensure interval is valid
    if (!interval || interval <= 0) {
      console.warn("Invalid interval for calculating ticks:", interval);
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
      console.warn("Invalid xaxisRange values:", this.context.xaxisRange);
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
      const tickElement = document.createElement("div");
      tickElement.style.position = "absolute";
      tickElement.style.transform = "translateX(-50%)";
      tickElement.style.textAlign = "center";
      tickElement.style.whiteSpace = "nowrap";
      tickElement.style.top = "0";
      tickElement.style.left = `${tick.position}%`;

      const tickMark = document.createElement("div");
      tickMark.style.width = "1px";
      tickMark.style.height = "6px";
      tickMark.style.margin = "0 auto 4px";
      tickMark.style.backgroundColor = "#888";

      const tickLabel = document.createElement("div");
      tickLabel.style.fontSize = "11px";
      tickLabel.style.color = this.context.colors.toolbar.text;

      tickLabel.style.padding = "0 4px";
      tickLabel.textContent = tick.label;

      tickElement.appendChild(tickMark);
      tickElement.appendChild(tickLabel);

      this.ticksContainer.appendChild(tickElement);
    });

    // Make sure we have at least one tick showing
    if (!this.ticksContainer.children.length && ticks.length) {
      // If no ticks were rendered (all were out of bounds),
      // at least show the middle tick
      const middleTick = ticks[Math.floor(ticks.length / 2)];

      const tickElement = document.createElement("div");
      tickElement.style.position = "absolute";
      tickElement.style.transform = "translateX(-50%)";
      tickElement.style.textAlign = "center";
      tickElement.style.whiteSpace = "nowrap";
      tickElement.style.top = "0";
      tickElement.style.left = "50%";

      const tickMark = document.createElement("div");
      tickMark.style.width = "1px";
      tickMark.style.height = "6px";
      tickMark.style.margin = "0 auto 4px";
      tickMark.style.backgroundColor = "#888";

      const tickLabel = document.createElement("div");
      tickLabel.style.fontSize = "11px";
      tickLabel.style.color = "#666";
      tickLabel.style.padding = "0 4px";
      tickLabel.textContent = middleTick.label;

      tickElement.appendChild(tickMark);
      tickElement.appendChild(tickLabel);
      this.ticksContainer.appendChild(tickElement);
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

    // Add correct positioning styles
    this.axisElement.style.position = "relative";
    this.axisElement.style.marginTop = "5px";

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
