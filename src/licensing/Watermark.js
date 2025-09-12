/**
 * Watermark utility for ApexStock
 * Handles watermark display and removal
 */
export default class Watermark {
  static WATERMARK_CLASS = "apexstock-watermark";
  static WATERMARK_TEXT = "Powered by apexcharts.com";

  /**
   * Add watermark to a container element
   */
  static add(container) {
    // Remove existing watermark if any
    this.remove(container);

    const watermark = document.createElement("div");

    watermark.className = this.WATERMARK_CLASS;
    watermark.textContent = this.WATERMARK_TEXT;

    // Ensure container has relative positioning
    if (getComputedStyle(container).position === "static") {
      container.style.position = "relative";
    }

    container.appendChild(watermark);
  }

  /**
   * Check if watermark exists in container
   */
  static exists(container) {
    return !!container.querySelector(`.${this.WATERMARK_CLASS}`);
  }

  /**
   * Remove watermark from a container element
   */
  static remove(container) {
    const existingWatermark = container.querySelector(
      `.${this.WATERMARK_CLASS}`
    );

    if (existingWatermark) {
      existingWatermark.remove();
    }
  }
}
