// ElementInteractionManager.js - Manages hovering, selection, and interaction with drawing elements
import SelectedElementPopup from "../components/SelectedElementPopup";
import Utils from "../utils/Utils";

export default class ElementInteractionManager {
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
    this.activeElementForDrag = null;

    // Visual feedback elements
    this.hoverOutline = null;
    this.selectionOutline = null;
    this.elementPopup = null;

    // Bind methods to maintain context
    this.handleElementMouseOver = this.handleElementMouseOver.bind(this);
    this.handleElementMouseOut = this.handleElementMouseOut.bind(this);
    this.handleElementClick = this.handleElementClick.bind(this);
    this.handleElementMouseDown = this.handleElementMouseDown.bind(this);
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.deleteSelectedElement = this.deleteSelectedElement.bind(this);

    // Initialize
    this.createVisualElements();
    this.elementPopup = new SelectedElementPopup(
      this.chartEl,
      this.deleteSelectedElement.bind(this),
      (element, elementData, styleChanges) => {
        if (
          this.context &&
          typeof this.context.handleStyleChange === "function"
        ) {
          this.context.handleStyleChange(element, elementData, styleChanges);
        } else {
          const index = this.elements.findIndex(
            (item) => item.data && item.data.id === elementData.id
          );

          if (index !== -1) {
            // Update element data with new styles
            if (styleChanges.stroke) {
              this.elements[index].data.color = styleChanges.stroke;
              this.elements[index].element.setAttribute(
                "stroke",
                styleChanges.stroke
              );
            }
            if (styleChanges.fill) {
              this.elements[index].data.fill = styleChanges.fill;
              this.elements[index].element.setAttribute(
                "fill",
                styleChanges.fill
              );
            }

            if (styleChanges.fillOpacity !== undefined) {
              this.elements[index].data.fillOpacity = styleChanges.fillOpacity;
              this.elements[index].element.setAttribute(
                "fill-opacity",
                styleChanges.fillOpacity
              );
            }
          }
        }
      }
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

    // Add global event listeners for dragging
    window.addEventListener("mousemove", this.handleMouseMove);
    window.addEventListener("mouseup", this.handleMouseUp);
  }

  /**
   * Activate interaction for all drawing elements
   */
  activateInteraction() {
    // Ensure all elements have IDs before adding event listeners
    this.ensureElementIds();

    // Re-add global event listeners for mousemove and mouseup
    window.addEventListener("mousemove", this.handleMouseMove);
    window.addEventListener("mouseup", this.handleMouseUp);

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
        item.element.addEventListener("mousedown", this.handleElementMouseDown);

        // Make sure each individual element has pointer events enabled
        // while keeping the SVG overlay pointer-events:none to allow chart interaction
        item.element.style.pointerEvents = "all";

        // Set cursor for better UX
        item.element.style.cursor = "move";
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
        item.element.removeEventListener(
          "mousedown",
          this.handleElementMouseDown
        );
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
      Utils.error("Error updating hover outline:", err);
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
   * Handle direct mousedown on element for immediate dragging
   * @param {MouseEvent} e - Mouse event
   */
  handleElementMouseDown(e) {
    // Get the target element
    const targetElement = e.currentTarget;
    const elementId = targetElement.dataset.elementId;

    if (!elementId) {
      Utils.warn("Clicked element has no ID:", targetElement);
      return;
    }

    // If this is the already selected element, let the normal mousedown handler take over
    if (elementId === this.selectedElementId) {
      this.handleMouseDown(e);
      return;
    }

    // Hide the popup if it's visible
    if (this.elementPopup) {
      this.elementPopup.hide();
    }

    // Store which element is being directly dragged (without selection)
    this.activeElementForDrag = targetElement;

    const rect = this.svgOverlay.getBoundingClientRect();
    this.moveStartX = e.clientX - rect.left;
    this.moveStartY = e.clientY - rect.top;

    // Get the element data using the ID
    const elementItem = this.getElementById(elementId);
    if (!elementItem || !elementItem.data) {
      Utils.warn("Could not find element data for ID:", elementId);
      return;
    }

    // Store the initial position of the element for relative movement
    this.storeElementStartPosition(elementItem.data);

    this.isMoving = true;

    e.stopPropagation();
    e.preventDefault();
  }

  /**
   * Handle element click to select an element
   * @param {MouseEvent} e - Mouse event
   */
  handleElementClick(e) {
    // If we were just dragging, don't process the click (to avoid selecting after drag)
    if (this.isMoving) {
      e.stopPropagation();
      return;
    }

    // Get the target element
    const targetElement = e.currentTarget;
    const elementId = targetElement.dataset.elementId;

    if (!elementId) {
      Utils.warn("Clicked element has no ID:", targetElement);
      return;
    }

    // If clicking on the already selected element, treat as a move
    if (elementId === this.selectedElementId) {
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
      const elementData = this.getElementById(elementId)?.data;

      this.elementPopup.show(
        e.clientX + 10,
        e.clientY - 10,
        this.selectedElement,
        elementData
      );
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
      Utils.error("Error updating selection outline:", err);
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
      Utils.warn(
        "Could not find element data for ID:",
        this.selectedElementId
      );
      return;
    }

    // Store the initial position of the element for relative movement
    this.storeElementStartPosition(elementItem.data);

    this.isMoving = true;

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
    if (!this.isMoving) return;

    // Determine which element is being moved
    const targetElementId =
      this.selectedElementId ||
      (this.activeElementForDrag
        ? this.activeElementForDrag.dataset.elementId
        : null);

    if (!targetElementId) return;

    const rect = this.svgOverlay.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    const deltaX = currentX - this.moveStartX;
    const deltaY = currentY - this.moveStartY;

    // Use the CoordinateConverter to get data space delta
    const dataSpaceDelta = this.coordinateConverter.screenDeltaToDataDelta(
      deltaX,
      deltaY
    );

    // Get the element data using the ID
    const elementItem = this.getElementById(targetElementId);
    if (!elementItem || !elementItem.data) {
      Utils.warn("Could not find element data for ID:", targetElementId);
      return;
    }

    // Update the element data based on its type
    this.moveElement(
      elementItem.data,
      dataSpaceDelta.x,
      dataSpaceDelta.y,
      deltaX,
      deltaY
    );

    // Redraw all elements with the updated positions
    this.redrawElements();

    // Update the selection outline if this is a selected element
    if (this.selectedElement && targetElementId === this.selectedElementId) {
      this.updateSelectionOutline();
    }

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

    // If this was a direct drag (without selection), clear the active drag element
    if (this.activeElementForDrag) {
      this.activeElementForDrag = null;
    }
    // If this was a selected element being moved, show the popup again
    else if (this.selectedElement && this.elementPopup) {
      this.elementPopup.show(e.clientX + 10, e.clientY - 10);
    }

    // Only call stopPropagation if we had an actual event
    // This function might be called programmatically during cleanup
    if (e && e.stopPropagation) {
      e.stopPropagation();
    }
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

    // Find the element by ID
    const index = this.getElementIndexById(this.selectedElementId);
    if (index === -1) {
      Utils.warn(
        "Element to delete not found with ID:",
        this.selectedElementId
      );
      return;
    }

    const item = this.elements[index];

    // Special handling for tooltip elements
    if (item && item.data && item.data.type === "tooltip") {
      // Use the ID to find the exact element in the DOM
      let selectors = [
        `.apexstock-tooltip-annotation[data-element-id="${this.selectedElementId}"]`,
        `.apexstock-tooltip-annotation[data-tooltip-id="${this.selectedElementId}"]`,
      ];

      selectors.forEach((selector) => {
        const domElements = document.querySelectorAll(selector);
        domElements.forEach((element) => {
          if (element && element.parentNode) {
            element.parentNode.removeChild(element);
          }
        });
      });

      // Also remove from the tooltip manager's Map
      if (this.context && this.context.tooltipAnnotationManager) {
        this.context.tooltipAnnotationManager.tooltipElements.delete(
          this.selectedElementId
        );
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

    window.removeEventListener("mousemove", this.handleMouseMove);
    window.removeEventListener("mouseup", this.handleMouseUp);

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
