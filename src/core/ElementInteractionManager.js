// ElementInteractionManager.js - Manages hovering, selection, and interaction with drawing elements
import SelectedElementPopup from "../components/SelectedElementPopup";
import Utils from "../utils/Utils";

class ElementInteractionManager {
  /**
   * @param {HTMLElement} chartEl - The chart container element
   * @param {SVGElement} svgOverlay - The SVG overlay element
   * @param {SVGElement} drawingGroup - The group containing all drawing elements
   * @param {Array} elements - Reference to the array of drawing elements
   * @param {Function} redrawElements - Function to redraw all elements
   * @param {Object} coordinateConverter - The coordinate converter utility
   */
  constructor(
    chartEl,
    svgOverlay,
    drawingGroup,
    elements,
    redrawElements,
    coordinateConverter
  ) {
    this.chartEl = chartEl;
    this.svgOverlay = svgOverlay;
    this.drawingGroup = drawingGroup;
    this.elements = elements;
    this.redrawElements = redrawElements;
    this.coordinateConverter = coordinateConverter;

    // Interaction state
    this.hoveredElement = null;
    this.hoveredElementId = null;
    this.selectedElement = null;
    this.selectedElementId = null;
    this.isMoving = false;
    this.moveStartX = 0;
    this.moveStartY = 0;
    this.elementStartX = 0;
    this.elementStartY = 0;

    // Visual feedback elements
    this.hoverOutline = null;
    this.selectionOutline = null;
    this.elementPopup = null;

    // Bind methods to maintain context
    this.handleElementMouseOver = this.handleElementMouseOver.bind(this);
    this.handleElementMouseOut = this.handleElementMouseOut.bind(this);
    this.handleElementClick = this.handleElementClick.bind(this);
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.deleteSelectedElement = this.deleteSelectedElement.bind(this);

    // Initialize
    this.createVisualElements();
    this.elementPopup = new SelectedElementPopup(
      this.chartEl,
      this.deleteSelectedElement
    );
    this.attachEventListeners();
    this.activateInteraction();

    // Ensure all elements have IDs (for existing elements)
    this.ensureElementIds();
  }

  /**
   * Ensures all elements in the elements array have unique IDs
   */
  ensureElementIds() {
    this.elements.forEach((item) => {
      if (!item.data.id) {
        item.data.id = Utils.generateUniqueId(item.data.type || "element");

        // Also set ID on DOM element for reference
        if (item.element) {
          item.element.dataset.elementId = item.data.id;
        }
      }
    });
  }

  /**
   * Finds an element in the elements array by ID
   * @param {string} id - The element ID to find
   * @returns {Object|null} - The element object or null if not found
   */
  getElementById(id) {
    if (!id) return null;
    return this.elements.find((item) => item.data && item.data.id === id);
  }

  /**
   * Finds the index of an element in the elements array by ID
   * @param {string} id - The element ID to find
   * @returns {number} - The element index or -1 if not found
   */
  getElementIndexById(id) {
    if (!id) return -1;
    return this.elements.findIndex((item) => item.data && item.data.id === id);
  }

  /**
   * Creates visual elements for hover and selection feedback
   */
  createVisualElements() {
    // Create hover outline
    this.hoverOutline = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "rect"
    );
    this.hoverOutline.setAttribute("fill", "none");
    this.hoverOutline.setAttribute("stroke", "#1E90FF");
    this.hoverOutline.setAttribute("stroke-width", "1");
    this.hoverOutline.setAttribute("stroke-dasharray", "2,2");
    this.hoverOutline.setAttribute("pointer-events", "none");
    this.hoverOutline.style.display = "none";
    this.drawingGroup.appendChild(this.hoverOutline);

    // Create selection outline
    this.selectionOutline = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "rect"
    );
    this.selectionOutline.setAttribute("fill", "none");
    this.selectionOutline.setAttribute("stroke", "#FF4500");
    this.selectionOutline.setAttribute("stroke-width", "2");
    this.selectionOutline.setAttribute("pointer-events", "none");
    this.selectionOutline.style.display = "none";
    this.drawingGroup.appendChild(this.selectionOutline);
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // Listen for keyboard events for delete functionality
    document.addEventListener("keydown", this.handleKeyDown);
  }

  /**
   * Activate interaction for all drawing elements
   */
  activateInteraction() {
    // Ensure all elements have IDs before adding event listeners
    this.ensureElementIds();

    // Add hover and click event listeners to each drawing element
    for (const item of this.elements) {
      if (item.element) {
        // Ensure the element has an ID attribute for quick reference
        if (item.data && item.data.id) {
          item.element.dataset.elementId = item.data.id;
        }

        // Add mouse event listeners
        item.element.addEventListener("mouseover", this.handleElementMouseOver);
        item.element.addEventListener("mouseout", this.handleElementMouseOut);
        item.element.addEventListener("click", this.handleElementClick);

        // Make sure each individual element has pointer events enabled
        // while keeping the SVG overlay pointer-events:none to allow chart interaction
        item.element.style.pointerEvents = "all";

        // Set cursor for better UX
        item.element.style.cursor = "pointer";
      }
    }
  }

  /**
   * Deactivate interaction mode
   */
  deactivateInteraction() {
    // Clear current hover and selection
    this.clearHover();
    this.clearSelection();

    // Hide the popup
    if (this.elementPopup) {
      this.elementPopup.hide();
    }

    // Remove event listeners from drawing elements
    for (const item of this.elements) {
      if (item.element) {
        item.element.removeEventListener(
          "mouseover",
          this.handleElementMouseOver
        );
        item.element.removeEventListener(
          "mouseout",
          this.handleElementMouseOut
        );
        item.element.removeEventListener("click", this.handleElementClick);
        item.element.style.pointerEvents = "none";
        item.element.style.cursor = "";
      }
    }
  }

  /**
   * Handle element mouse over event
   * @param {MouseEvent} e - Mouse event
   */
  handleElementMouseOver(e) {
    // If we're already moving an element, ignore hover events
    if (this.isMoving) return;

    // Get the element ID from the dataset
    const targetElement = e.currentTarget;
    const elementId = targetElement.dataset.elementId;

    // Ignore if the element is already selected
    if (elementId === this.selectedElementId) return;

    // Set hover state
    this.hoveredElement = targetElement;
    this.hoveredElementId = elementId;

    // Show hover outline
    this.updateHoverOutline();
  }

  /**
   * Handle element mouse out event
   */
  handleElementMouseOut() {
    // Clear hover state and outline
    this.clearHover();
  }

  /**
   * Update the hover outline around the hovered element
   */
  updateHoverOutline() {
    if (!this.hoveredElement) return;

    try {
      // Get the bounding box of the hovered element
      const bbox = this.hoveredElement.getBBox();

      // Update hover outline
      this.hoverOutline.setAttribute("x", bbox.x - 2);
      this.hoverOutline.setAttribute("y", bbox.y - 2);
      this.hoverOutline.setAttribute("width", bbox.width + 4);
      this.hoverOutline.setAttribute("height", bbox.height + 4);
      this.hoverOutline.style.display = "block";
    } catch (err) {
      console.error("Error updating hover outline:", err);
    }
  }

  /**
   * Clear the current hover state
   */
  clearHover() {
    this.hoveredElement = null;
    this.hoveredElementId = null;
    this.hoverOutline.style.display = "none";
  }

  /**
   * Handle element click to select an element
   * @param {MouseEvent} e - Mouse event
   */
  handleElementClick(e) {
    // Get the target element
    const targetElement = e.currentTarget;
    const elementId = targetElement.dataset.elementId;

    if (!elementId) {
      console.warn("Clicked element has no ID:", targetElement);
      return;
    }

    // If clicking on the already selected element, treat as a move
    if (elementId === this.selectedElementId) {
      this.handleMouseDown(e);
      return;
    }

    // If we have a previously selected element, clear it
    if (this.selectedElement) {
      this.clearSelection();
    }

    // Set selection state
    this.selectedElement = targetElement;
    this.selectedElementId = elementId;

    // Show selection outline
    this.updateSelectionOutline();

    // Position and show the popup
    if (this.elementPopup) {
      this.elementPopup.show(e.clientX + 10, e.clientY - 10);
    }

    e.stopPropagation();
  }

  /**
   * Update the selection outline around the selected element
   */
  updateSelectionOutline() {
    if (!this.selectedElement) return;

    try {
      // Get the bounding box of the selected element
      const bbox = this.selectedElement.getBBox();

      // Update selection outline
      this.selectionOutline.setAttribute("x", bbox.x - 2);
      this.selectionOutline.setAttribute("y", bbox.y - 2);
      this.selectionOutline.setAttribute("width", bbox.width + 4);
      this.selectionOutline.setAttribute("height", bbox.height + 4);
      this.selectionOutline.style.display = "block";
    } catch (err) {
      console.error("Error updating selection outline:", err);
    }
  }

  /**
   * Clear the current selection
   */
  clearSelection() {
    this.selectedElement = null;
    this.selectedElementId = null;
    this.selectionOutline.style.display = "none";

    // Hide the popup
    if (this.elementPopup) {
      this.elementPopup.hide();
    }
  }

  /**
   * Handle mouse down for moving elements
   * @param {MouseEvent} e - Mouse event
   */
  handleMouseDown(e) {
    if (!this.selectedElement || !this.selectedElementId) return;

    const rect = this.svgOverlay.getBoundingClientRect();
    this.moveStartX = e.clientX - rect.left;
    this.moveStartY = e.clientY - rect.top;

    // Get the element data using the ID
    const elementItem = this.getElementById(this.selectedElementId);
    if (!elementItem || !elementItem.data) {
      console.warn(
        "Could not find element data for ID:",
        this.selectedElementId
      );
      return;
    }

    // Store the initial position of the element for relative movement
    this.storeElementStartPosition(elementItem.data);

    this.isMoving = true;

    // Add global mouse move and up handlers for dragging
    window.addEventListener("mousemove", this.handleMouseMove);
    window.addEventListener("mouseup", this.handleMouseUp);

    // Hide popup during movement
    if (this.elementPopup) {
      this.elementPopup.hide();
    }

    e.stopPropagation();
  }

  /**
   * Store the starting position of the element based on its type
   * @param {Object} elementData - Data of the selected element
   */
  storeElementStartPosition(elementData) {
    if (!elementData) return;

    switch (elementData.type) {
      case "line":
        this.elementStartX = elementData.x1;
        this.elementStartY = elementData.y1;
        this.elementStartX2 = elementData.x2;
        this.elementStartY2 = elementData.y2;
        break;

      case "rectangle":
        this.elementStartX = elementData.x;
        this.elementStartY = elementData.y;
        break;

      case "circle":
        this.elementStartX = elementData.cx;
        this.elementStartY = elementData.cy;
        break;

      case "ellipse":
        this.elementStartX = elementData.cx;
        this.elementStartY = elementData.cy;
        break;

      case "text":
        this.elementStartX = elementData.clickX;
        this.elementStartY = elementData.clickY;
        this.elementStartDataX = elementData.x;
        this.elementStartDataY = elementData.y;
        break;

      case "tooltip":
        this.elementStartX = elementData.clickX;
        this.elementStartY = elementData.clickY;
        this.elementStartDataX = elementData.x;
        this.elementStartDataY = elementData.y;
        break;

      case "brush":
      case "highlighter":
        // For path-based elements, store all points
        this.elementStartPoints = elementData.points.map((p) => ({
          x: p.x,
          y: p.y,
        }));
        break;
    }
  }

  /**
   * Handle mouse move for moving elements
   * @param {MouseEvent} e - Mouse event
   */
  handleMouseMove(e) {
    if (!this.isMoving || !this.selectedElement || !this.selectedElementId)
      return;

    const rect = this.svgOverlay.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    const deltaX = currentX - this.moveStartX;
    const deltaY = currentY - this.moveStartY;

    // Calculate data space delta
    const startScreenPoint = { x: this.moveStartX, y: this.moveStartY };
    const currentScreenPoint = { x: currentX, y: currentY };

    const startDataPoint = this.coordinateConverter.screenToData(
      startScreenPoint.x,
      startScreenPoint.y
    );

    const currentDataPoint = this.coordinateConverter.screenToData(
      currentScreenPoint.x,
      currentScreenPoint.y
    );

    if (!startDataPoint || !currentDataPoint) return;

    const dataSpaceDeltaX = currentDataPoint.x - startDataPoint.x;
    const dataSpaceDeltaY = currentDataPoint.y - startDataPoint.y;

    // Get the element data using the ID
    const elementItem = this.getElementById(this.selectedElementId);
    if (!elementItem || !elementItem.data) {
      console.warn(
        "Could not find element data for ID:",
        this.selectedElementId
      );
      return;
    }

    // Update the element data based on its type
    this.moveElement(
      elementItem.data,
      dataSpaceDeltaX,
      dataSpaceDeltaY,
      deltaX,
      deltaY
    );

    // Redraw all elements with the updated positions
    this.redrawElements();

    // Update the selection outline
    this.updateSelectionOutline();

    e.stopPropagation();
    e.preventDefault();
  }

  /**
   * Move the selected element based on its type
   * @param {Object} elementData - The element data to update
   * @param {number} dataSpaceDeltaX - X change in data space
   * @param {number} dataSpaceDeltaY - Y change in data space
   * @param {number} screenDeltaX - X change in screen space
   * @param {number} screenDeltaY - Y change in screen space
   */
  moveElement(
    elementData,
    dataSpaceDeltaX,
    dataSpaceDeltaY,
    screenDeltaX,
    screenDeltaY
  ) {
    if (!elementData) return;

    switch (elementData.type) {
      case "line":
        // Move both endpoints of the line
        elementData.x1 = this.elementStartX + dataSpaceDeltaX;
        elementData.y1 = this.elementStartY + dataSpaceDeltaY;
        elementData.x2 = this.elementStartX2 + dataSpaceDeltaX;
        elementData.y2 = this.elementStartY2 + dataSpaceDeltaY;
        break;

      case "rectangle":
        // Move the rectangle
        elementData.x = this.elementStartX + dataSpaceDeltaX;
        elementData.y = this.elementStartY + dataSpaceDeltaY;
        break;

      case "circle":
        // Move the circle center
        elementData.cx = this.elementStartX + dataSpaceDeltaX;
        elementData.cy = this.elementStartY + dataSpaceDeltaY;
        break;

      case "ellipse":
        // Move the ellipse center
        elementData.cx = this.elementStartX + dataSpaceDeltaX;
        elementData.cy = this.elementStartY + dataSpaceDeltaY;
        break;

      case "text":
        // Move the text element
        elementData.clickX = this.elementStartX + screenDeltaX;
        elementData.clickY = this.elementStartY + screenDeltaY;
        elementData.x = this.elementStartDataX + dataSpaceDeltaX;
        elementData.y = this.elementStartDataY + dataSpaceDeltaY;
        break;

      case "tooltip":
        // Move the tooltip element
        elementData.clickX = this.elementStartX + screenDeltaX;
        elementData.clickY = this.elementStartY + screenDeltaY;
        elementData.x = this.elementStartDataX + dataSpaceDeltaX;
        elementData.y = this.elementStartDataY + dataSpaceDeltaY;
        break;

      case "brush":
      case "highlighter":
        // Move all points of the path
        elementData.points = this.elementStartPoints.map((p) => ({
          x: p.x + dataSpaceDeltaX,
          y: p.y + dataSpaceDeltaY,
        }));
        break;
    }
  }

  /**
   * Handle mouse up to finish moving
   * @param {MouseEvent} e - Mouse event
   */
  handleMouseUp(e) {
    if (!this.isMoving) return;

    this.isMoving = false;

    // Remove global mouse handlers
    window.removeEventListener("mousemove", this.handleMouseMove);
    window.removeEventListener("mouseup", this.handleMouseUp);

    // After moving, show the popup again
    if (this.selectedElement && this.elementPopup) {
      this.elementPopup.show(e.clientX + 10, e.clientY - 10);
    }

    e.stopPropagation();
  }

  /**
   * Handle key down events (for delete)
   * @param {KeyboardEvent} e - Keyboard event
   */
  handleKeyDown(e) {
    // Delete or Backspace key
    if (
      (e.key === "Delete" || e.key === "Backspace") &&
      this.selectedElementId
    ) {
      this.deleteSelectedElement();
      e.preventDefault();
    }
  }

  /**
   * Delete the currently selected element
   */
  deleteSelectedElement() {
    if (!this.selectedElementId) return;

    console.log(this.selectedElementId);

    // Find the element by ID
    const index = this.getElementIndexById(this.selectedElementId);
    if (index === -1) {
      console.warn(
        "Element to delete not found with ID:",
        this.selectedElementId
      );
      return;
    }

    const item = this.elements[index];

    // Special handling for tooltip elements
    if (item && item.data && item.data.type === "tooltip") {
      // Use the ID to find the exact element in the DOM
      const selector = `.apexstock-tooltip-annotation[data-element-id="${this.selectedElementId}"]`;
      const domElement = document.querySelector(selector);

      if (domElement && domElement.parentNode) {
        console.log(`Removing tooltip with ID: ${this.selectedElementId}`);
        domElement.parentNode.removeChild(domElement);
      } else if (item.element && item.element.parentNode) {
        console.log(`Removing tooltip element reference`);
        item.element.parentNode.removeChild(item.element);
      }
    } else {
      // Standard removal for non-tooltip elements
      if (item && item.element && item.element.parentNode) {
        item.element.parentNode.removeChild(item.element);
      }
    }

    // Remove from the elements array
    this.elements.splice(index, 1);

    // Clear selection
    this.clearSelection();

    // Redraw remaining elements
    this.redrawElements();

    // Update event listeners for the remaining elements
    this.updateElementEventListeners();
  }

  /**
   * Update event listeners after elements array changes
   */
  updateElementEventListeners() {
    // Re-activate interaction to ensure indices are correct
    this.deactivateInteraction();
    this.activateInteraction();
  }

  /**
   * Clean up event listeners and resources
   */
  destroy() {
    this.deactivateInteraction();
    document.removeEventListener("keydown", this.handleKeyDown);

    // Remove visual elements
    if (this.hoverOutline && this.hoverOutline.parentNode) {
      this.hoverOutline.parentNode.removeChild(this.hoverOutline);
    }

    if (this.selectionOutline && this.selectionOutline.parentNode) {
      this.selectionOutline.parentNode.removeChild(this.selectionOutline);
    }

    // Destroy popup
    if (this.elementPopup) {
      this.elementPopup.destroy();
      this.elementPopup = null;
    }
  }
}

export default ElementInteractionManager;
