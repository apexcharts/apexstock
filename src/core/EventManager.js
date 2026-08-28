import Utils from "../utils/Utils";
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

    // Keep a reference so we can disconnect on destroy()
    this.mutationObserver = observer;

    // Try to listen for chart events if available
    try {
      if (this.chart.addEventListener) {
        // `updated` fires once per animation frame while a wheel/pinch zoom is
        // in progress. This used to schedule the reposition on a 300ms timer,
        // which both queued one redraw per frame and landed 300ms after the
        // geometry it was reading, so drawings visibly trailed the plot. A
        // single rAF instead coalesces the whole gesture's frames into one
        // redraw each, timed against layout that is already up to date
        // (ApexStock renders with animations off, so nothing is still moving).
        this.chart.addEventListener("updated", () => {
          this.scheduleReposition();
        });

        this.chart.addEventListener("zoomed", () => {
          this.refreshBoundsAndRedraw();
        });

        this.chart.addEventListener("scrolled", () => {
          this.refreshBoundsAndRedraw();
        });
      }
    } catch (err) {
      Utils.error("Error setting up chart event listeners:", err);
    }
  }

  /**
   * Reposition the drawing overlay on the next animation frame, coalescing any
   * number of calls made in the same frame into one redraw.
   * @returns {void}
   */
  scheduleReposition() {
    if (this._cancelReposition) return;
    const run = () => {
      this._cancelReposition = null;
      if (typeof this.syncOverlayPosition === "function") {
        this.syncOverlayPosition();
      }
      this.redrawElements();
    };
    // Keep the canceller rather than the raw id: a rAF handle and a timeout
    // handle are both plain numbers, so cancelling the wrong one would reach
    // into an unrelated task.
    if (typeof requestAnimationFrame === "function") {
      const id = requestAnimationFrame(run);
      this._cancelReposition = () => cancelAnimationFrame(id);
    } else {
      // No rAF (a non-browser host): keep it asynchronous so the caller's
      // update finishes first, as the timer version did.
      const id = setTimeout(run, 0);
      this._cancelReposition = () => clearTimeout(id);
    }
  }

  /** Re-read the axis bounds, then redraw. Shared by `zoomed` and `scrolled`. */
  refreshBoundsAndRedraw() {
    if (typeof this.coordinateConverter?.refreshBounds === "function") {
      this.coordinateConverter.refreshBounds();
    }
    this.redrawElements();
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

    // Drop a pending reposition so it cannot run against a torn-down chart.
    if (this._cancelReposition) {
      this._cancelReposition();
      this._cancelReposition = null;
    }

    // Disconnect the mutation observer
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
    }
  }
}

export default EventManager;
