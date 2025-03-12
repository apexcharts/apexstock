// OverlayManager.js - Manages the SVG overlay for drawing
class OverlayManager {
  /**
   * @param {HTMLElement} chartDiv - The chart container element
   */
  constructor(chartDiv) {
    this.chartDiv = chartDiv;
    this.overlayWrapper = null;
    this.svgOverlay = null;
    this.defs = null;
    this.drawingGroup = null;

    this.setupSVGOverlay();
  }

  /**
   * Sets up the SVG overlay for drawing
   */
  setupSVGOverlay() {
    // Create a wrapper for the SVG overlay that's outside the chart elements
    this.overlayWrapper = document.createElement("div");
    this.overlayWrapper.className = "apexstock-drawing-overlay-wrapper";

    // Place the wrapper directly on the chart's parent to avoid being removed on chart updates
    this.chartDiv.parentNode.appendChild(this.overlayWrapper);

    // Create SVG container that will overlay the chart
    this.svgOverlay = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "svg"
    );
    this.svgOverlay.setAttribute("class", "apexstock-drawing-overlay");
    this.overlayWrapper.appendChild(this.svgOverlay);

    // Create defs for markers or patterns if needed
    this.defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    this.svgOverlay.appendChild(this.defs);

    // Create a group element to contain all drawings
    this.drawingGroup = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "g"
    );
    this.svgOverlay.appendChild(this.drawingGroup);

    // Force initial sync of overlay dimensions
    setTimeout(() => {
      this.syncOverlayPosition();
    }, 100);

    // Add resize listener
    window.addEventListener("resize", () => {
      this.syncOverlayPosition();
    });
  }

  /**
   * Synchronizes the overlay position with the chart
   */
  syncOverlayPosition() {
    if (!this.chartDiv || !this.overlayWrapper) return;

    try {
      // Get the chart's position
      const chartRect = this.chartDiv.getBoundingClientRect();
      const parentRect = this.chartDiv.parentNode.getBoundingClientRect();

      // Update overlay wrapper dimensions and position to match the chart
      this.overlayWrapper.style.width = chartRect.width + "px";
      this.overlayWrapper.style.height = chartRect.height + "px";
      this.overlayWrapper.style.top = chartRect.top - parentRect.top + "px";
      this.overlayWrapper.style.left = chartRect.left - parentRect.left + "px";

      console.log("Overlay position synced");
    } catch (err) {
      console.error("Error syncing overlay position:", err);
    }
  }
}

export default OverlayManager;
