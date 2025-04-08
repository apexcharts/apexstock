// SelectedElementPopup.js - Creates a popup for selected elements with options
class SelectedElementPopup {
  /**
   * Creates a popup menu for interacting with selected elements
   * @param {HTMLElement} chartDiv - The chart container element
   * @param {Function} deleteCallback - Callback function when delete is clicked
   */
  constructor(chartDiv, deleteCallback) {
    this.chartDiv = chartDiv;
    this.deleteCallback = deleteCallback;
    this.popupElement = null;

    this.createPopup();
  }

  /**
   * Creates the popup DOM element
   */
  createPopup() {
    // Create popup container
    this.popupElement = document.createElement("div");
    this.popupElement.className = "apexstock-element-popup";
    this.popupElement.style.display = "none";

    // Create delete button
    const deleteButton = document.createElement("button");
    deleteButton.className = "apexstock-element-delete-btn";
    deleteButton.innerHTML = "🗑 Delete";

    // Add click handler
    deleteButton.addEventListener("click", (e) => {
      if (typeof this.deleteCallback === "function") {
        this.deleteCallback();
      }
      this.hide();
      e.stopPropagation();
    });

    // Add button to popup
    this.popupElement.appendChild(deleteButton);

    // Add popup to chart container
    this.chartDiv.appendChild(this.popupElement);

    // Close popup when clicking outside
    document.addEventListener("mousedown", (e) => {
      if (
        this.popupElement &&
        this.popupElement.style.display === "block" &&
        !this.popupElement.contains(e.target)
      ) {
        this.hide();
      }
    });
  }

  /**
   * Shows the popup at the specified position
   * @param {number} x - X coordinate for popup
   * @param {number} y - Y coordinate for popup
   */
  show(x, y) {
    // Position the popup
    this.popupElement.style.position = "absolute";
    this.popupElement.style.left = `${x}px`;
    this.popupElement.style.top = `${y}px`;
    this.popupElement.style.display = "block";

    // Ensure popup is fully visible in the viewport
    const rect = this.popupElement.getBoundingClientRect();
    const chartRect = this.chartDiv.getBoundingClientRect();

    // Adjust horizontal position if needed
    if (rect.right > chartRect.right) {
      this.popupElement.style.left = `${x - rect.width}px`;
    }

    // Adjust vertical position if needed
    if (rect.bottom > chartRect.bottom) {
      this.popupElement.style.top = `${y - rect.height}px`;
    }
  }

  /**
   * Hides the popup
   */
  hide() {
    if (this.popupElement) {
      this.popupElement.style.display = "none";
    }
  }

  /**
   * Destroys the popup and removes event listeners
   */
  destroy() {
    if (this.popupElement && this.popupElement.parentNode) {
      this.popupElement.parentNode.removeChild(this.popupElement);
    }
  }
}

export default SelectedElementPopup;
