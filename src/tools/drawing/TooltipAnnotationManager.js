// TooltipAnnotationManager.js - Manages pinned tooltip annotations
import Utils from "../../utils/Utils";

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

    // Ensure we have valid data coordinates using the coordinate converter
    if (!dataPoint || isNaN(dataPoint.x) || isNaN(dataPoint.y)) {
      dataPoint = this.coordinateConverter.screenToData(x, y);

      // If still invalid, return null
      if (!dataPoint || isNaN(dataPoint.x) || isNaN(dataPoint.y)) {
        console.warn("Could not determine data coordinates for tooltip");
        return null;
      }
    }

    // Create a group for the tooltip
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.classList.add("apexstock-tooltip-annotation");

    // Generate a truly unique ID for this tooltip
    const id = Utils.generateUniqueId("tooltip");
    group.dataset.tooltipId = id;
    group.dataset.elementId = id; // Add both for consistency

    // Create data object
    const tooltipData = {
      id,
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

    // Store in our map
    this.tooltipElements.set(id, group);

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
    // Always use the coordinate converter to get current screen position
    const screenPos = this.coordinateConverter.dataToScreen(data.x, data.y);

    // Calculate tooltip position - ensure it's centered on the data point
    const tooltipX = screenPos.x - data.tooltipWidth / 2;
    const tooltipY = screenPos.y - data.tooltipHeight - 10; // Position above the point with a small gap

    // Check if we're in dark mode by looking for the theme class on the chart element or its parent
    const isDarkMode =
      this.chartDiv.classList.contains("apexstock-theme-dark") ||
      this.chartDiv.parentNode.classList.contains("apexstock-theme-dark");

    // Create background rectangle
    const background = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "rect"
    );
    background.setAttribute("x", tooltipX);
    background.setAttribute("y", tooltipY);
    background.setAttribute("width", data.tooltipWidth);
    background.setAttribute("height", data.tooltipHeight);
    background.setAttribute("rx", "3");

    // Apply styles inline to ensure they're included during export
    if (isDarkMode) {
      background.setAttribute("fill", "#343a40");
      background.setAttribute("stroke", "#495057");
    } else {
      background.setAttribute("fill", "white");
      background.setAttribute("stroke", "#e9ecef");
    }

    background.setAttribute("fill-opacity", "0.75");
    background.setAttribute("stroke-width", "1");

    // Create foreignObject to hold the HTML content
    const foreignObject = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "foreignObject"
    );
    foreignObject.setAttribute("x", tooltipX);
    foreignObject.setAttribute("y", tooltipY);
    foreignObject.setAttribute("width", data.tooltipWidth);
    foreignObject.setAttribute("height", data.tooltipHeight);

    // Create div inside foreignObject to hold tooltip content
    const tooltipDiv = document.createElement("div");
    tooltipDiv.style.width = "100%";
    tooltipDiv.style.height = "100%";
    tooltipDiv.style.padding = "6px 8px";
    tooltipDiv.style.fontFamily = "Helvetica, Arial, sans-serif";
    tooltipDiv.style.fontSize = "12px";

    tooltipDiv.style.color = isDarkMode ? "#f8f9fa" : "#373d3f";
    tooltipDiv.style.pointerEvents = "none";
    tooltipDiv.innerHTML = data.tooltipContent;

    // Add elements to the DOM
    foreignObject.appendChild(tooltipDiv);
    group.appendChild(background);
    group.appendChild(foreignObject);

    // Add a timestamp indicator (vertical line connecting tooltip to data point)
    const timestampBar = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "line"
    );
    timestampBar.setAttribute("x1", screenPos.x);
    timestampBar.setAttribute("y1", tooltipY + data.tooltipHeight);
    timestampBar.setAttribute("x2", screenPos.x);
    timestampBar.setAttribute("y2", screenPos.y);

    // Use theme-appropriate color for the connecting line
    timestampBar.setAttribute("stroke", isDarkMode ? "#6c757d" : "#b0bec5");
    timestampBar.setAttribute("stroke-width", "1");
    timestampBar.setAttribute("stroke-dasharray", "2,2");
    group.appendChild(timestampBar);

    // Add a small circle to mark the exact data point
    const marker = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "circle"
    );
    marker.setAttribute("cx", screenPos.x);
    marker.setAttribute("cy", screenPos.y);
    marker.setAttribute("r", "3");

    // Apply theme-appropriate color to marker
    marker.setAttribute("fill", isDarkMode ? "#6c757d" : "#b0bec5");
    marker.setAttribute("stroke", isDarkMode ? "#343a40" : "white");
    marker.setAttribute("stroke-width", "1");
    group.appendChild(marker);

    // Update data with current screen position for reference
    data.currentScreenX = screenPos.x;
    data.currentScreenY = screenPos.y;
  }

  /**
   * Redraws a tooltip element based on its data coordinates
   * @param {Object} data - The tooltip data
   * @returns {SVGElement} - The redrawn tooltip element
   */
  redrawTooltipElement(data) {
    // Create new group
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.classList.add("apexstock-tooltip-annotation");

    // Preserve tooltip ID if it exists
    if (data.id) {
      group.dataset.tooltipId = data.id;
      group.dataset.elementId = data.id; // Add both attributes for consistency
    } else {
      const tooltipId = Utils.generateUniqueId("tooltip");
      group.dataset.tooltipId = tooltipId;
      group.dataset.elementId = tooltipId;
      data.id = tooltipId;
    }

    // Force refresh coordinate converter bounds to ensure accurate positioning
    this.coordinateConverter.refreshBounds();

    // Create SVG elements using data coordinates for proper positioning
    this.createSvgTooltip(group, data);

    // Update reference in our Map
    this.tooltipElements.set(data.id, group);

    return group;
  }

  /**
   * Updates the position of a tooltip based on chart changes
   * @param {string} id - The tooltip ID
   * @returns {boolean} - Whether the update was successful
   */
  updateTooltipPosition(id) {
    // Find the tooltip element
    const tooltipGroup = this.tooltipElements.get(id);
    if (!tooltipGroup) return false;

    // Find the data for this tooltip
    const tooltipData = this.getTooltipDataFromElement(tooltipGroup);
    if (!tooltipData) return false;

    // Create new tooltip with updated position
    const updatedGroup = this.redrawTooltipElement(tooltipData);

    // Replace the old tooltip with the new one
    if (tooltipGroup.parentNode) {
      tooltipGroup.parentNode.replaceChild(updatedGroup, tooltipGroup);
      return true;
    }

    return false;
  }

  /**
   * Extract tooltip data from a tooltip element
   * @param {SVGElement} element - The tooltip element
   * @returns {Object|null} - The tooltip data or null if not found
   */
  getTooltipDataFromElement(element) {
    if (!element) return null;

    const id = element.dataset.tooltipId || element.dataset.elementId;
    if (!id) return null;

    // Find data from the elements we know about
    for (const item of this.tooltipElements.values()) {
      if (
        item.dataset &&
        (item.dataset.tooltipId === id || item.dataset.elementId === id)
      ) {
        // Extract data from element attributes
        const foreignObject = item.querySelector("foreignObject");
        const rect = item.querySelector("rect");
        const circle = item.querySelector("circle");

        if (!foreignObject || !rect || !circle) continue;

        const tooltipX = parseFloat(circle.getAttribute("cx"));
        const tooltipY = parseFloat(circle.getAttribute("cy"));

        // Convert screen coordinates to data coordinates
        const dataPoint = this.coordinateConverter.screenToData(
          tooltipX,
          tooltipY
        );

        return {
          id,
          type: "tooltip",
          x: dataPoint.x,
          y: dataPoint.y,
          clickX: tooltipX,
          clickY: tooltipY,
          tooltipContent: foreignObject.querySelector("div").innerHTML,
          tooltipWidth: parseFloat(rect.getAttribute("width")),
          tooltipHeight: parseFloat(rect.getAttribute("height")),
        };
      }
    }

    return null;
  }

  /**
   * Removes a tooltip from the DOM
   * @param {SVGElement} element - The tooltip element to remove
   * @param {string} [id] - Optional tooltip ID to ensure exact match
   */
  removeTooltip(element, id) {
    if (!element) return;

    // Get tooltip ID from element
    const tooltipId = element.dataset.tooltipId || element.dataset.elementId;

    // Validate ID match if provided
    if (id && tooltipId !== id) {
      console.warn(`Tooltip ID mismatch! Expected: ${id}, Found: ${tooltipId}`);

      // Find the correct element with the specified ID
      const correctElement = document.querySelector(
        `.apexstock-tooltip-annotation[data-tooltip-id="${id}"], .apexstock-tooltip-annotation[data-element-id="${id}"]`
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

    // Find element by ID - try both element-id and tooltip-id attributes
    const element = document.querySelector(
      `.apexstock-tooltip-annotation[data-tooltip-id="${id}"], .apexstock-tooltip-annotation[data-element-id="${id}"]`
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
    this.tooltipElements.forEach((element, id) => {
      if (element && element.parentNode) {
        element.parentNode.removeChild(element);
      }
    });

    // Clear the Map
    this.tooltipElements.clear();
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.cleanup();
  }
}
