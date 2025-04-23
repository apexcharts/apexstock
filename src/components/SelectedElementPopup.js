// SelectedElementPopup.js - Creates a popup for selected elements with options
class SelectedElementPopup {
  /**
   * Creates a popup menu for interacting with selected elements
   * @param {HTMLElement} chartDiv - The chart container element
   * @param {Function} deleteCallback - Callback function when delete is clicked
   * @param {Function} styleChangeCallback - Callback function when styles are changed
   */
  constructor(chartDiv, deleteCallback, styleChangeCallback) {
    this.chartDiv = chartDiv;
    this.deleteCallback = deleteCallback;
    this.styleChangeCallback = styleChangeCallback;
    this.popupElement = null;
    this.currentElement = null;
    this.currentElementData = null;
    this.strokeColorPicker = null;
    this.fillColorPicker = null;
    this.fillOpacitySlider = null;
    this.isDarkTheme = false;

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

    // Check if we're in dark mode
    this.isDarkTheme =
      document.body.classList.contains("dark-mode") ||
      document.querySelector(".apexstock-theme-dark") !== null;

    // Create toolbar container for styling options
    const styleToolbar = document.createElement("div");
    styleToolbar.className = "apexstock-style-toolbar";
    styleToolbar.style.display = "flex";
    styleToolbar.style.flexWrap = "wrap";
    styleToolbar.style.gap = "8px";
    styleToolbar.style.marginBottom = "8px";
    styleToolbar.style.padding = "4px";

    // Create stroke color picker container
    const strokeContainer = document.createElement("div");
    strokeContainer.className = "apexstock-color-container";
    strokeContainer.style.display = "flex";
    strokeContainer.style.flexDirection = "column";
    strokeContainer.style.alignItems = "center";

    // Stroke color label
    const strokeLabel = document.createElement("label");
    strokeLabel.textContent = "Outline";
    strokeLabel.style.fontSize = "10px";
    strokeLabel.style.marginBottom = "2px";
    strokeContainer.appendChild(strokeLabel);

    // Stroke color picker
    this.strokeColorPicker = document.createElement("input");
    this.strokeColorPicker.type = "color";
    this.strokeColorPicker.className = "apexstock-stroke-color-picker";
    this.strokeColorPicker.style.width = "24px";
    this.strokeColorPicker.style.height = "24px";
    this.strokeColorPicker.style.padding = "0";
    this.strokeColorPicker.style.border = "1px solid #ccc";
    this.strokeColorPicker.style.borderRadius = "2px";
    this.strokeColorPicker.style.cursor = "pointer";
    this.strokeColorPicker.value = "#000000";

    this.strokeColorPicker.addEventListener("input", (e) => {
      const currentData = this.currentElementData;
      const currentElement = this.currentElement;

      if (currentData && this.styleChangeCallback) {
        this.styleChangeCallback(currentElement, currentData, {
          stroke: e.target.value,
        });
      }
      e.stopPropagation();
    });

    strokeContainer.appendChild(this.strokeColorPicker);

    // Create fill color picker container
    const fillContainer = document.createElement("div");
    fillContainer.className = "apexstock-color-container";
    fillContainer.style.display = "flex";
    fillContainer.style.flexDirection = "column";
    fillContainer.style.alignItems = "center";

    // Fill color label
    const fillLabel = document.createElement("label");
    fillLabel.textContent = "Fill";
    fillLabel.style.fontSize = "10px";
    fillLabel.style.marginBottom = "2px";
    fillContainer.appendChild(fillLabel);

    // Fill color picker
    this.fillColorPicker = document.createElement("input");
    this.fillColorPicker.type = "color";
    this.fillColorPicker.className = "apexstock-fill-color-picker";
    this.fillColorPicker.style.width = "24px";
    this.fillColorPicker.style.height = "24px";
    this.fillColorPicker.style.padding = "0";
    this.fillColorPicker.style.border = "1px solid #ccc";
    this.fillColorPicker.style.borderRadius = "2px";
    this.fillColorPicker.style.cursor = "pointer";
    this.fillColorPicker.value = "#ffffff";

    this.fillColorPicker.addEventListener("input", (e) => {
      const currentData = this.currentElementData;
      const currentElement = this.currentElement;

      if (currentData && this.styleChangeCallback) {
        this.styleChangeCallback(currentElement, currentData, {
          fill: e.target.value,
        });
      }
      e.stopPropagation();
    });

    fillContainer.appendChild(this.fillColorPicker);

    // Create opacity slider container
    const opacityContainer = document.createElement("div");
    opacityContainer.className = "apexstock-opacity-container";
    opacityContainer.style.display = "flex";
    opacityContainer.style.flexDirection = "column";
    opacityContainer.style.alignItems = "center";

    // Opacity label
    const opacityLabel = document.createElement("label");
    opacityLabel.textContent = "Opacity";
    opacityLabel.style.fontSize = "10px";
    opacityLabel.style.marginBottom = "2px";
    opacityContainer.appendChild(opacityLabel);

    // Opacity slider container for better control
    const sliderContainer = document.createElement("div");
    sliderContainer.style.display = "flex";
    sliderContainer.style.alignItems = "center";

    // Opacity slider
    this.fillOpacitySlider = document.createElement("input");
    this.fillOpacitySlider.type = "range";
    this.fillOpacitySlider.min = "0";
    this.fillOpacitySlider.max = "100";
    this.fillOpacitySlider.value = "50";
    this.fillOpacitySlider.className = "apexstock-opacity-slider";
    this.fillOpacitySlider.style.width = "60px";
    this.fillOpacitySlider.style.height = "8px";
    this.fillOpacitySlider.style.margin = "0";

    this.fillOpacitySlider.addEventListener("input", (e) => {
      const currentData = this.currentElementData;
      const currentElement = this.currentElement;

      if (currentData && this.styleChangeCallback) {
        const opacity = parseInt(e.target.value) / 100;
        this.styleChangeCallback(currentElement, currentData, {
          fillOpacity: opacity,
        });
      }
      e.stopPropagation();
    });

    sliderContainer.appendChild(this.fillOpacitySlider);
    opacityContainer.appendChild(sliderContainer);

    // Add color pickers and opacity to toolbar
    styleToolbar.appendChild(strokeContainer);
    styleToolbar.appendChild(fillContainer);
    styleToolbar.appendChild(opacityContainer);

    // Add divider
    const divider = document.createElement("div");
    divider.style.width = "100%";
    divider.style.height = "1px";
    divider.style.backgroundColor = this.isDarkTheme ? "#444" : "#ddd";
    divider.style.margin = "4px 0";

    // Create delete button
    const deleteButton = document.createElement("button");
    deleteButton.className = "apexstock-element-delete-btn";
    deleteButton.innerHTML = "🗑 Delete";
    deleteButton.style.display = "flex";
    deleteButton.style.alignItems = "center";
    deleteButton.style.padding = "6px 12px";
    deleteButton.style.width = "100%";
    deleteButton.style.background = "none";
    deleteButton.style.border = "none";
    deleteButton.style.textAlign = "left";
    deleteButton.style.cursor = "pointer";
    deleteButton.style.borderRadius = "3px";
    deleteButton.style.color = this.isDarkTheme ? "#e0e0e0" : "#333";

    // Add click handler
    deleteButton.addEventListener("click", (e) => {
      if (typeof this.deleteCallback === "function") {
        this.deleteCallback();
      }
      this.hide();
      e.stopPropagation();
    });

    // Add elements to popup
    this.popupElement.appendChild(styleToolbar);
    this.popupElement.appendChild(divider);
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

    // Prevent click events from closing the popup
    this.popupElement.addEventListener("click", (e) => {
      e.stopPropagation();
    });
  }

  /**
   * Configure the popup based on element type
   * @param {Object} elementData - Data of the selected element
   */
  configureForElement(elementData) {
    if (!elementData) return;

    this.currentElementData = elementData;

    // Configure controls based on element type
    switch (elementData.type) {
      case "line":
      case "brush":
      case "highlighter":
        // These only have stroke color
        this.strokeColorPicker.value = elementData.color || "#000000";
        this.strokeColorPicker.parentElement.style.display = "flex";
        this.fillColorPicker.parentElement.style.display = "none";
        this.fillOpacitySlider.parentElement.parentElement.style.display =
          "none";
        break;

      case "rectangle":
      case "circle":
      case "ellipse":
        // These have stroke and fill
        this.strokeColorPicker.value = elementData.color || "#000000";
        this.fillColorPicker.value = elementData.fill || "#ffffff";
        this.fillOpacitySlider.value = Math.round(
          (elementData.fillOpacity || 0.5) * 100
        );
        this.strokeColorPicker.parentElement.style.display = "flex";
        this.fillColorPicker.parentElement.style.display = "flex";
        this.fillOpacitySlider.parentElement.parentElement.style.display =
          "flex";
        break;

      case "text":
        // Text has text color (stroke) and background color (fill)
        this.strokeColorPicker.value = elementData.color || "#000000";
        this.fillColorPicker.value = elementData.backgroundColor || "#ffffff";
        this.fillOpacitySlider.value = Math.round(
          (elementData.backgroundOpacity || 0.7) * 100
        );
        this.strokeColorPicker.parentElement.style.display = "flex";
        this.fillColorPicker.parentElement.style.display = "flex";
        this.fillOpacitySlider.parentElement.parentElement.style.display =
          "flex";

        // Change labels for text
        this.strokeColorPicker.parentElement.querySelector(
          "label"
        ).textContent = "Text";
        this.fillColorPicker.parentElement.querySelector("label").textContent =
          "Background";
        break;

      case "tooltip":
        // Tooltips don't have customizable styles
        this.strokeColorPicker.parentElement.style.display = "none";
        this.fillColorPicker.parentElement.style.display = "none";
        this.fillOpacitySlider.parentElement.parentElement.style.display =
          "none";
        break;
    }
  }

  /**
   * Shows the popup at the specified position
   * @param {number} x - X coordinate for popup (in client coordinates)
   * @param {number} y - Y coordinate for popup (in client coordinates)
   * @param {Object} element - The selected element
   * @param {Object} elementData - The element data
   */
  show(x, y, element, elementData) {
    const chartRect = this.chartDiv.getBoundingClientRect();

    const relativeX = x - chartRect.left;
    const relativeY = y - chartRect.top;

    this.currentElement = element;
    this.currentElementData = elementData;

    this.configureForElement(elementData);

    this.popupElement.style.position = "absolute";
    this.popupElement.style.left = `${relativeX}px`;
    this.popupElement.style.top = `${relativeY}px`;
    this.popupElement.style.display = "block";
    this.popupElement.style.zIndex = "1000"; // Ensure popup is above other elements

    // Ensure popup is fully visible in the viewport
    const popupRect = this.popupElement.getBoundingClientRect();

    // Adjust horizontal position if needed
    if (popupRect.right > chartRect.right) {
      this.popupElement.style.left = `${relativeX - popupRect.width}px`;
    }

    // Adjust vertical position if needed
    if (popupRect.bottom > chartRect.bottom) {
      this.popupElement.style.top = `${relativeY - popupRect.height}px`;
    }
  }

  /**
   * Hides the popup
   */
  hide() {
    if (this.popupElement) {
      this.popupElement.style.display = "none";
      this.currentElement = null;
      this.currentElementData = null;
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
