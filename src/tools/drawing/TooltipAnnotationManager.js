import Utils from "../../utils/Utils";

// TooltipAnnotationManager.js - Manages pinned tooltip annotations
export default class TooltipAnnotationManager {
  /**
   * @param {HTMLElement} chartDiv - The chart container element
   * @param {SVGElement} svgOverlay - The SVG overlay element
   * @param {Object} coordinateConverter - The coordinate converter utility
   * @param {Function} onTooltipCreated - Callback when a tooltip is created
   */
  constructor(chartDiv, svgOverlay, coordinateConverter, onTooltipCreated) {
    this.chartDiv = chartDiv;
    this.svgOverlay = svgOverlay;
    this.coordinateConverter = coordinateConverter;
    this.onTooltipCreated = onTooltipCreated;
    this.tooltipElements = new Map(); // Store references to tooltip elements with their ids
  }

  /**
   * Creates a tooltip annotation from an existing tooltip
   * @param {HTMLElement} originalTooltip - The original tooltip element to clone
   * @param {number} x - Screen X coordinate
   * @param {number} y - Screen Y coordinate
   * @param {Object} dataPoint - The data point information
   * @returns {Object} - The created tooltip element and its data
   */
  createTooltipAnnotation(originalTooltip, x, y, dataPoint) {
    if (!originalTooltip) return null;

    // Create a group for the tooltip
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.classList.add("apexstock-tooltip-annotation");

    // Generate a truly unique ID for this tooltip using UUID v4-like pattern
    const id = Utils.generateUniqueId("tooltip");
    group.dataset.tooltipId = id;

    // Create data object
    const tooltipData = {
      id, // Add a unique ID
      type: "tooltip",
      x: dataPoint.x,
      y: dataPoint.y,
      clickX: x,
      clickY: y,
      tooltipContent: originalTooltip.innerHTML,
      tooltipWidth: originalTooltip.offsetWidth,
      tooltipHeight: originalTooltip.offsetHeight,
    };

    // Create SVG elements
    this.createSvgTooltip(group, tooltipData);

    // Add to SVG
    this.svgOverlay.appendChild(group);

    // Store reference to this tooltip element
    this.tooltipElements.set(id, group);

    // Notify parent
    if (this.onTooltipCreated) {
      this.onTooltipCreated(group, tooltipData);
    }

    return {
      element: group,
      data: tooltipData,
    };
  }

  /**
   * Creates SVG elements for the tooltip
   * @param {SVGElement} group - The group element to add tooltip elements to
   * @param {Object} data - The tooltip data
   */
  createSvgTooltip(group, data) {
    // Create background rectangle
    const background = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "rect"
    );
    background.setAttribute("x", data.clickX);
    background.setAttribute("y", data.clickY);
    background.setAttribute("width", data.tooltipWidth);
    background.setAttribute("height", data.tooltipHeight);
    background.setAttribute("rx", "3");
    background.setAttribute("fill", "white");
    background.setAttribute("fill-opacity", "0.95");
    background.setAttribute("stroke", "#e9ecef");
    background.setAttribute("stroke-width", "1");

    // Create foreignObject to hold the HTML content
    const foreignObject = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "foreignObject"
    );
    foreignObject.setAttribute("x", data.clickX);
    foreignObject.setAttribute("y", data.clickY);
    foreignObject.setAttribute("width", data.tooltipWidth);
    foreignObject.setAttribute("height", data.tooltipHeight);

    // Create div inside foreignObject to hold tooltip content
    const tooltipDiv = document.createElement("div");
    tooltipDiv.style.width = "100%";
    tooltipDiv.style.height = "100%";
    tooltipDiv.style.padding = "6px 8px";
    tooltipDiv.style.fontFamily = "Helvetica, Arial, sans-serif";
    tooltipDiv.style.fontSize = "12px";
    tooltipDiv.style.color = "#373d3f";
    tooltipDiv.style.pointerEvents = "none";
    tooltipDiv.innerHTML = data.tooltipContent;

    // Add elements to the DOM
    foreignObject.appendChild(tooltipDiv);
    group.appendChild(background);
    group.appendChild(foreignObject);

    // Add a timestamp indicator
    const timestampBar = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "line"
    );
    timestampBar.setAttribute("x1", data.clickX);
    timestampBar.setAttribute("y1", data.clickY + data.tooltipHeight);
    timestampBar.setAttribute("x2", data.clickX);
    timestampBar.setAttribute("y2", data.clickY + data.tooltipHeight + 20);
    timestampBar.setAttribute("stroke", "#b0bec5");
    timestampBar.setAttribute("stroke-width", "1");
    timestampBar.setAttribute("stroke-dasharray", "2,2");
    group.appendChild(timestampBar);
  }

  redrawTooltipElement(data) {
    // Create new group
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.classList.add("apexstock-tooltip-annotation");

    // Preserve tooltip ID if it exists
    if (data.id) {
      group.dataset.tooltipId = data.id;
    } else {
      const tooltipId = Utils.generateUniqueId("tooltip");
      group.dataset.tooltipId = tooltipId;
      data.id = tooltipId;
    }

    // Store original position from data
    const x =
      data.clickX !== undefined
        ? data.clickX
        : this.coordinateConverter.dataToScreen(data.x, data.y).x;

    const y =
      data.clickY !== undefined
        ? data.clickY
        : this.coordinateConverter.dataToScreen(data.x, data.y).y;

    // Update data with current positions
    const updatedData = {
      ...data,
      clickX: x,
      clickY: y,
    };

    // Create SVG elements
    this.createSvgTooltip(group, updatedData);

    // Update reference in our Map
    this.tooltipElements.set(data.id, group);

    return group;
  }

  /**
   * Removes a tooltip from the DOM
   * @param {SVGElement} element - The tooltip element to remove
   * @param {string} [id] - Optional tooltip ID to ensure exact match
   */
  removeTooltip(element, id) {
    if (!element) return;

    // Get tooltip ID from element
    const tooltipId = element.dataset.tooltipId;

    // Validate ID match if provided
    if (id && tooltipId !== id) {
      console.warn(`Tooltip ID mismatch! Expected: ${id}, Found: ${tooltipId}`);

      // Find the correct element with the specified ID
      const correctElement = document.querySelector(
        `.apexstock-tooltip-annotation[data-tooltip-id="${id}"]`
      );
      if (correctElement && correctElement.parentNode) {
        console.log(`Removing tooltip with correct ID: ${id}`);
        correctElement.parentNode.removeChild(correctElement);
        this.tooltipElements.delete(id);
        return;
      }
    }

    // Remove the specified element from DOM
    if (element && element.parentNode) {
      element.parentNode.removeChild(element);
    }

    // Remove from our Map
    if (tooltipId) {
      this.tooltipElements.delete(tooltipId);
    }
  }

  /**
   * Removes a tooltip by its unique ID
   * @param {string} id - The tooltip's unique ID
   * @returns {boolean} - Whether the tooltip was found and removed
   */
  removeTooltipById(id) {
    if (!id) return false;

    // Find element by ID
    const element = document.querySelector(
      `.apexstock-tooltip-annotation[data-tooltip-id="${id}"]`
    );
    if (element && element.parentNode) {
      element.parentNode.removeChild(element);
      this.tooltipElements.delete(id);
      return true;
    }

    return false;
  }

  /**
   * Clean up all tooltips
   */
  cleanup() {
    // Remove all tooltip elements from the DOM
    this.tooltipElements.forEach((element) => {
      if (element && element.parentNode) {
        element.parentNode.removeChild(element);
      }
    });

    // Clear the Map
    this.tooltipElements.clear();
  }
}
