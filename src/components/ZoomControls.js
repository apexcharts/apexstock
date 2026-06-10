import Utils from "../utils/Utils";
/**
 * ZoomControls component for ApexStock
 * Adds zoom in and zoom out buttons to the chart
 */
export default class ZoomControls {
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
   * Zoom in on the chart
   */
  zoomIn() {
    if (!this.chart) return;

    try {
      const currentZoom = this.context.getCurrentZoomState();
      if (!currentZoom) return;

      const { minX, maxX } = currentZoom;
      const range = maxX - minX;
      const zoomFactor = 0.25; // Zoom in by 25%

      // Calculate new zoom range (centered zoom)
      const newRange = range * (1 - zoomFactor);
      const padding = (range - newRange) / 2;
      const newMinX = Math.max(0, minX + padding);
      const newMaxX = Math.min(
        this.chart.w.globals.dataPoints - 1,
        maxX - padding
      );

      // Apply zoom
      this.chart.zoomX(newMinX, newMaxX);

      // Apply to all charts
      this.context.applyZoomToAllCharts({ minX: newMinX, maxX: newMaxX });
    } catch (err) {
      Utils.error("Error during zoom in:", err);
    }
  }

  /**
   * Zoom out on the chart
   */
  zoomOut() {
    if (!this.chart) return;

    try {
      const currentZoom = this.context.getCurrentZoomState();
      if (!currentZoom) return;

      const { minX, maxX } = currentZoom;
      const range = maxX - minX;
      const zoomFactor = 0.25; // Zoom out by 25%

      // Calculate new zoom range (centered zoom)
      const newRange = range * (1 + zoomFactor);
      const padding = (newRange - range) / 2;
      const newMinX = Math.max(0, minX - padding);
      const newMaxX = Math.min(
        this.chart.w.globals.dataPoints - 1,
        maxX + padding
      );

      // Apply zoom
      this.chart.zoomX(newMinX, newMaxX);

      // Apply to all charts
      this.context.applyZoomToAllCharts({ minX: newMinX, maxX: newMaxX });
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
