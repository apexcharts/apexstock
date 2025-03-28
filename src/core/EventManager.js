// EventManager.js - Manages all event listeners for drawing tools
class EventManager {
  /**
   * @param {ApexCharts} chart - The ApexCharts instance
   * @param {HTMLElement} chartDiv - The chart container element
   * @param {SVGElement} svgOverlay - The SVG overlay element
   * @param {Function} mouseDownHandler - Handler for mouse down events
   * @param {Function} mouseMoveHandler - Handler for mouse move events
   * @param {Function} mouseUpHandler - Handler for mouse up events
   * @param {Function} resizeHandler - Handler for resize events
   * @param {Function} wheelHandler - Handler for wheel events
   * @param {Function} redrawHandler - Handler for redrawing elements
   * @param {Function} syncOverlayPosition - Function to sync overlay position
   */
  constructor(
    chart,
    chartDiv,
    svgOverlay,
    mouseDownHandler,
    mouseMoveHandler,
    mouseUpHandler,
    resizeHandler,
    wheelHandler,
    redrawHandler,
    syncOverlayPosition
  ) {
    this.chart = chart;
    this.chartDiv = chartDiv;
    this.svgOverlay = svgOverlay;
    this.syncOverlayPosition = syncOverlayPosition;
    this.intervalId = null;

    // Bind the handlers to preserve context
    this.boundMouseDown = mouseDownHandler;
    this.boundMouseMove = mouseMoveHandler;
    this.boundMouseUp = mouseUpHandler;
    this.boundResize = resizeHandler;
    this.boundWheelEvent = wheelHandler;
    this.redrawElements = redrawHandler;

    this.initEventListeners();
    this.listenForChartEvents();
  }

  /**
   * Initializes event listeners for drawing
   */
  initEventListeners() {
    // Listen for chart events directly on the SVG overlay
    this.svgOverlay.addEventListener("mousedown", this.boundMouseDown);
    window.addEventListener("mousemove", this.boundMouseMove);
    window.addEventListener("mouseup", this.boundMouseUp);
    window.addEventListener("resize", this.boundResize);

    // Add wheel event listeners to both chart and overlay
    this.chartDiv.addEventListener("wheel", this.boundWheelEvent);
    this.svgOverlay.addEventListener("wheel", this.boundWheelEvent);
  }

  /**
   * Sets up listeners for chart events to sync overlay and redraw elements
   */
  listenForChartEvents() {
    // Set up a mutation observer to detect changes in the chart
    const observer = new MutationObserver(() => {
      if (typeof this.syncOverlayPosition === "function") {
        this.syncOverlayPosition();
      }
    });

    observer.observe(this.chartDiv, {
      attributes: true,
      childList: true,
      subtree: true,
    });

    // Use a fallback interval regardless of addEventListener availability
    // This ensures we always sync the overlay position
    this.intervalId = setInterval(() => {
      if (typeof this.syncOverlayPosition === "function") {
        this.syncOverlayPosition();
      }
    }, 1000);

    // Try to listen for chart events if available
    try {
      if (this.chart.addEventListener) {
        this.chart.addEventListener("updated", () => {
          setTimeout(() => {
            if (typeof this.syncOverlayPosition === "function") {
              this.syncOverlayPosition();
            }
            this.redrawElements();
          }, 300);
        });

        this.chart.addEventListener("zoomed", () => {
          this.redrawElements();
        });

        this.chart.addEventListener("scrolled", () => {
          this.redrawElements();
        });
      }
    } catch (err) {
      console.error("Error setting up chart event listeners:", err);
    }
  }

  /**
   * Clean up event listeners and resources
   */
  destroy() {
    this.svgOverlay.removeEventListener("mousedown", this.boundMouseDown);
    window.removeEventListener("mousemove", this.boundMouseMove);
    window.removeEventListener("mouseup", this.boundMouseUp);
    window.removeEventListener("resize", this.boundResize);

    // Remove wheel event listeners
    this.chartDiv.removeEventListener("wheel", this.boundWheelEvent);
    this.svgOverlay.removeEventListener("wheel", this.boundWheelEvent);

    // Clear any intervals
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }
}

export default EventManager;
