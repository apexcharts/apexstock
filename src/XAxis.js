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
    this.resizeObserver = null;

    // Create the axis container
    this.createAxisElement();

    // Initial render
    this.render();

    // Add resize listener for repositioning
    this.setupResizeListener();
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
   * Creates the DOM elements for the x-axis
   */
  createAxisElement() {
    // Add custom styles
    this.addStyles();

    // Create the axis container
    this.axisElement = document.createElement("div");
    this.axisElement.classList.add("apexstock-xaxis");
    this.axisElement.style.width = "100%";
    this.axisElement.style.height = "30px";
    this.axisElement.style.position = "absolute";
    this.axisElement.style.overflow = "hidden"; // Prevent scrollbars

    // Create the ticks container
    this.ticksContainer = document.createElement("div");
    this.ticksContainer.classList.add("apexstock-xaxis-ticks");
    this.ticksContainer.style.position = "absolute";
    this.ticksContainer.style.height = "100%";
    this.ticksContainer.style.overflow = "hidden"; // Prevent scrollbars
    // We'll set width and position in updatePosition()

    this.axisElement.appendChild(this.ticksContainer);

    // Append the axis after the indicator container
    if (this.context.chartEl && this.context.indicatorContainer) {
      this.context.chartEl.appendChild(this.axisElement);
    }
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
      // This can happen during initial rendering or after chart updates
      setTimeout(() => this.updatePosition(), 50);
      return;
    }

    // Get the bounding rectangle of the graphical element
    const graphicalRect = graphicalElement.getBoundingClientRect();
    const containerRect = this.axisElement.parentNode.getBoundingClientRect();

    // Calculate positions relative to the container
    const leftOffset = graphicalRect.left - containerRect.left;
    const width = graphicalRect.width;

    this.ticksContainer.style.width = "100%";

    // Set the top border to align with the chart area
    const borderWidth = getComputedStyle(this.axisElement).borderTopWidth;
    const borderOffset = parseInt(borderWidth || "0", 10);
    this.axisElement.style.paddingLeft = `${leftOffset - borderOffset}px`;
    this.axisElement.style.paddingRight = `${
      containerRect.width - (leftOffset + width) - borderOffset
    }px`;

    // Check if the chart's zoom has changed
    const xaxis = chartElement.querySelector(".apexcharts-xaxis");
    if (xaxis) {
      // Apply the same transform as the chart's xaxis for proper alignment
      const transform = window.getComputedStyle(xaxis).transform;
      if (transform && transform !== "none") {
        this.ticksContainer.style.transform = transform;
      } else {
        this.ticksContainer.style.transform = "";
      }
    }
  }

  /**
   * Adds CSS styles for the X-axis
   */
  addStyles() {
    const styleId = "apexstock-xaxis-styles";
    if (document.getElementById(styleId)) return;

    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      .apexstock-xaxis {
        position: absolute;
        border-top: 1px solid #eee;
        margin-top: 5px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        box-sizing: border-box;
      }
      
      .apexstock-xaxis-ticks {
        box-sizing: border-box;
      }
      
      .apexstock-xaxis-tick {
        position: absolute;
        transform: translateX(-50%);
        text-align: center;
        white-space: nowrap;
        top: 0;
      }
      
      .apexstock-xaxis-tickmark {
        width: 1px;
        height: 6px;
        margin: 0 auto 4px;
        background-color: #888;
      }
      
      .apexstock-xaxis-label {
        font-size: 11px;
        color: #666;
        padding: 0 4px;
      }
    `;

    document.head.appendChild(style);
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
   * Prepare for rendering - legacy method kept for API compatibility
   */
  prepareForTransition() {
    // This method is kept for API compatibility but no longer does any fading
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

      const tickElement = document.createElement("div");
      tickElement.classList.add("apexstock-xaxis-tick");
      tickElement.style.left = `${tick.position}%`;

      const tickMark = document.createElement("div");
      tickMark.classList.add("apexstock-xaxis-tickmark");

      const tickLabel = document.createElement("div");
      tickLabel.classList.add("apexstock-xaxis-label");
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
      tickElement.classList.add("apexstock-xaxis-tick");
      tickElement.style.left = "50%";

      const tickMark = document.createElement("div");
      tickMark.classList.add("apexstock-xaxis-tickmark");

      const tickLabel = document.createElement("div");
      tickLabel.classList.add("apexstock-xaxis-label");
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
    // Position the x-axis at the bottom of all charts
    if (this.context.indicatorContainer) {
      const top =
        this.context.indicatorContainer.offsetTop +
        this.context.indicatorContainer.offsetHeight;

      this.axisElement.style.top = `${top - 20}px`;
    }

    // Ensure the axis is visible
    this.axisElement.style.display = "block";

    // Update position and width
    this.updatePosition();

    // Re-render with current range
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

    // Remove the axis element from the DOM
    if (this.axisElement && this.axisElement.parentNode) {
      this.axisElement.parentNode.removeChild(this.axisElement);
    }

    this.axisElement = null;
    this.ticksContainer = null;
  }
}
