import Utils from "../utils/Utils";
/**
 * ZoomControls component for ApexStock
 * Adds zoom in and zoom out buttons to the chart
 */
export default class ZoomControls {
  /** Fraction of the visible range each zoom-in/out click adds or removes. */
  static ZOOM_FACTOR = 0.25;

  /**
   * Creates zoom control buttons
   * @param {import("../ApexStock.js").default} context - The ApexStock instance
   */
  constructor(context) {
    this.context = context;
    this.chartEl = context.chartEl;
    this.chart = context.chart;
    this.controlsContainer = null;
    this.zoomInButton = null;
    this.zoomOutButton = null;

    // Initialize the zoom controls
    this.init();
  }

  /**
   * Initialize zoom controls
   */
  init() {
    // Create container for zoom buttons
    this.createContainer();

    // Create zoom buttons
    this.createButtons();

    // Add event listeners
    this.addEventListeners();
  }

  /**
   * Create the container for zoom controls
   */
  createContainer() {
    this.controlsContainer = document.createElement("div");
    this.controlsContainer.className = "apexstock-zoom-controls";
    this.controlsContainer.setAttribute("role", "group");
    this.controlsContainer.setAttribute("aria-label", "Chart zoom controls");

    this.chartEl.appendChild(this.controlsContainer);
  }

  /**
   * Create zoom in and zoom out buttons
   */
  createButtons() {
    // Create zoom in button
    this.zoomInButton = document.createElement("button");
    this.zoomInButton.className = "apexstock-zoom-in";
    this.zoomInButton.type = "button";
    this.zoomInButton.setAttribute("aria-label", "Zoom in");
    this.zoomInButton.innerHTML = "+";

    // Create zoom out button
    this.zoomOutButton = document.createElement("button");
    this.zoomOutButton.className = "apexstock-zoom-out";
    this.zoomOutButton.type = "button";
    this.zoomOutButton.setAttribute("aria-label", "Zoom out");
    this.zoomOutButton.innerHTML = "−";

    // Add buttons to container
    this.controlsContainer.appendChild(this.zoomInButton);
    this.controlsContainer.appendChild(this.zoomOutButton);
  }

  /**
   * Add event listeners to the zoom buttons
   */
  addEventListeners() {
    // Zoom in button click handler
    this.zoomInButton.addEventListener("click", () => {
      this.zoomIn();
    });

    // Zoom out button click handler
    this.zoomOutButton.addEventListener("click", () => {
      this.zoomOut();
    });
  }

  /**
   * Apply a new visible range to the main chart and all indicator panes.
   * `minX`/`maxX` are in the axis's own value space (timestamps for a
   * numeric/datetime axis, data indices for a category axis) — the same space
   * `getCurrentZoomState()` reports and `zoomX()` expects.
   * @param {number} minX
   * @param {number} maxX
   */
  applyRange(minX, maxX) {
    if (!(maxX > minX)) return;
    this.chart.zoomX(minX, maxX);
    this.context.applyZoomToAllCharts({ minX, maxX });
  }

  /**
   * Zoom in on the chart (shrink the visible range around its center).
   */
  zoomIn() {
    if (!this.chart) return;

    try {
      const currentZoom = this.context.getCurrentZoomState();
      if (!currentZoom) return;

      const { minX, maxX } = currentZoom;
      const range = maxX - minX;
      if (!(range > 0)) return;

      // Shrink toward the center. The new range is a subset of the current one,
      // so no clamping is needed. The previous code clamped to `dataPoints` (an
      // index count), which is meaningless against a timestamp range and made
      // the buttons no-op on numeric/datetime axes.
      const padding = (range * ZoomControls.ZOOM_FACTOR) / 2;
      this.applyRange(minX + padding, maxX - padding);
    } catch (err) {
      Utils.error("Error during zoom in:", err);
    }
  }

  /**
   * Zoom out on the chart (grow the visible range, bounded by the full data).
   */
  zoomOut() {
    if (!this.chart) return;

    try {
      const currentZoom = this.context.getCurrentZoomState();
      if (!currentZoom) return;

      const { minX, maxX } = currentZoom;
      const range = maxX - minX;
      if (!(range > 0)) return;

      const padding = (range * ZoomControls.ZOOM_FACTOR) / 2;

      // Clamp to the chart's full data extent, expressed in the SAME value space
      // as the zoom state (ApexCharts exposes it as initialMinX/initialMaxX).
      const g = this.chart.w.globals;
      const fullMin =
        typeof g.initialMinX === "number" ? g.initialMinX : minX - padding;
      const fullMax =
        typeof g.initialMaxX === "number" ? g.initialMaxX : maxX + padding;

      this.applyRange(
        Math.max(fullMin, minX - padding),
        Math.min(fullMax, maxX + padding)
      );
    } catch (err) {
      Utils.error("Error during zoom out:", err);
    }
  }

  /**
   * Clean up resources
   */
  destroy() {
    if (this.controlsContainer && this.controlsContainer.parentNode) {
      this.controlsContainer.parentNode.removeChild(this.controlsContainer);
    }

    this.controlsContainer = null;
    this.zoomInButton = null;
    this.zoomOutButton = null;
  }
}
