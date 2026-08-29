// SelectedElementPopup.js - Creates a popup for selected elements with options
/** Gap in px between a selected element and its popup. */
const POPUP_GAP = 8;

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

    // Check if we're in dark mode
    this.isDarkTheme =
      document.body.classList.contains("dark-mode") ||
      document.querySelector(".apexstock-theme-dark") !== null;

    if (this.isDarkTheme) {
      this.popupElement.classList.add("apexstock-theme-dark");
    }

    // Create toolbar container for styling options
    const styleToolbar = document.createElement("div");
    styleToolbar.className = "apexstock-style-toolbar";

    // Create stroke color picker container
    const strokeContainer = document.createElement("div");
    strokeContainer.className = "apexstock-color-container";

    // Stroke color label
    const strokeLabel = document.createElement("label");
    strokeLabel.textContent = "Outline";
    strokeContainer.appendChild(strokeLabel);

    // Stroke color picker
    this.strokeColorPicker = document.createElement("input");
    this.strokeColorPicker.type = "color";
    this.strokeColorPicker.className = "apexstock-stroke-color-picker";
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

    // Fill color label
    const fillLabel = document.createElement("label");
    fillLabel.textContent = "Fill";
    fillContainer.appendChild(fillLabel);

    // Fill color picker
    this.fillColorPicker = document.createElement("input");
    this.fillColorPicker.type = "color";
    this.fillColorPicker.className = "apexstock-fill-color-picker";
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

    // Opacity label
    const opacityLabel = document.createElement("label");
    opacityLabel.textContent = "Opacity";
    opacityContainer.appendChild(opacityLabel);

    // Opacity slider container for better control
    const sliderContainer = document.createElement("div");

    // Opacity slider
    this.fillOpacitySlider = document.createElement("input");
    this.fillOpacitySlider.type = "range";
    this.fillOpacitySlider.min = "0";
    this.fillOpacitySlider.max = "100";
    this.fillOpacitySlider.value = "50";
    this.fillOpacitySlider.className = "apexstock-opacity-slider";

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
    divider.className = "apexstock-divider";

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

    // Add elements to popup
    this.popupElement.appendChild(styleToolbar);
    this.popupElement.appendChild(divider);
    this.popupElement.appendChild(deleteButton);

    // Add popup to chart container
    this.chartDiv.appendChild(this.popupElement);

    // Close popup when clicking outside. Keep a reference so destroy() can
    // remove it (otherwise it leaks the popup across SPA unmounts).
    this._boundOutsideMouseDown = (e) => {
      if (
        this.popupElement &&
        this.popupElement.style.display === "block" &&
        !this.popupElement.contains(e.target)
      ) {
        this.hide();
      }
    };
    document.addEventListener("mousedown", this._boundOutsideMouseDown);

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

    this.currentElement = element;
    this.currentElementData = elementData;

    this.configureForElement(elementData);

    // Measure before placing: the popup's height depends on which controls the
    // element type shows.
    this.popupElement.style.display = "block";
    const popupRect = this.popupElement.getBoundingClientRect();

    const bbox =
      element && typeof element.getBoundingClientRect === "function"
        ? element.getBoundingClientRect()
        : null;

    const pos = bbox
      ? this.placeClearOf(bbox, chartRect, popupRect)
      : this.placeAtPointer(x, y, chartRect, popupRect);

    this.popupElement.style.left = `${pos.left}px`;
    this.popupElement.style.top = `${pos.top}px`;
  }

  /**
   * Position the popup so it does not sit on top of the element it belongs to.
   *
   * The popup is ~220px wide and the pointer that opened it is usually ON the
   * drawing, so anchoring at the pointer covered the selection: styling
   * controls landed over the drawing's own resize handles and swallowed the
   * clicks meant for them. Tries below, above, right, then left of the
   * element's box, taking the first that fits inside the chart; if none does,
   * falls back to the roomiest side and clamps.
   *
   * @param {DOMRect} bbox - The selected element's client rect.
   * @param {DOMRect} chartRect - The chart container's client rect.
   * @param {DOMRect} popupRect - The popup's own client rect.
   * @returns {{left: number, top: number}} Chart-relative position.
   */
  placeClearOf(bbox, chartRect, popupRect) {
    const gap = POPUP_GAP;
    const w = popupRect.width;
    const h = popupRect.height;
    const left = bbox.left - chartRect.left;
    const top = bbox.top - chartRect.top;
    const right = bbox.right - chartRect.left;
    const bottom = bbox.bottom - chartRect.top;

    const fits = (l, t) =>
      l >= 0 && t >= 0 && l + w <= chartRect.width && t + h <= chartRect.height;

    const candidates = [
      { left, top: bottom + gap }, // below
      { left, top: top - h - gap }, // above
      { left: right + gap, top }, // right
      { left: left - w - gap, top }, // left
    ];
    const clear = candidates.find((c) => fits(c.left, c.top));
    if (clear) return clear;

    // Nothing clears it (a drawing spanning most of the chart): keep the popup
    // on screen and accept the overlap, favouring the side with more room.
    const below = chartRect.height - bottom;
    return this.clamp(
      { left, top: below > top ? bottom + gap : top - h - gap },
      chartRect,
      popupRect
    );
  }

  /**
   * The pointer-anchored placement, used when there is no element to measure.
   * @param {number} x @param {number} y
   * @param {DOMRect} chartRect @param {DOMRect} popupRect
   * @returns {{left: number, top: number}} Chart-relative position.
   */
  placeAtPointer(x, y, chartRect, popupRect) {
    return this.clamp(
      { left: x - chartRect.left, top: y - chartRect.top },
      chartRect,
      popupRect
    );
  }

  /** Keep a position inside the chart container. @private */
  clamp(pos, chartRect, popupRect) {
    return {
      left: Math.max(0, Math.min(pos.left, chartRect.width - popupRect.width)),
      top: Math.max(0, Math.min(pos.top, chartRect.height - popupRect.height)),
    };
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
    if (this._boundOutsideMouseDown) {
      document.removeEventListener("mousedown", this._boundOutsideMouseDown);
      this._boundOutsideMouseDown = null;
    }
    if (this.popupElement && this.popupElement.parentNode) {
      this.popupElement.parentNode.removeChild(this.popupElement);
    }
  }
}

export default SelectedElementPopup;
