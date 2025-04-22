// DrawingTools.js - Core class for the drawing tools
import EventManager from "../../core/EventManager";
import OverlayManager from "../drawing/OverlayManager";
import ToolbarManager from "../../core/ToolbarManager";
import DrawingElementFactory from "../drawing/DrawingElementFactory";
import CoordinateConverter from "../../utils/CoordinateConverter";
import TextAnnotationManager from "./TextAnnotationManager";
import TooltipAnnotationManager from "./TooltipAnnotationManager";
import ElementInteractionManager from "../../core/ElementInteractionManager";
import Utils from "../../utils/Utils";

export default class DrawingTools {
  constructor(ctx) {
    this.chart = ctx.chart;
    this.chartEl = ctx.chartEl;
    this.isDrawing = false;
    this.currentTool = null;
    this.elements = [];
    this.currentElement = null;
    this.startPoint = null;
    this.drawingColor = "#008FFB";
    this.drawingWidth = 2;
    this.currentElementData = null;
    this.tooltipPinningEnabled = true; // Enable tooltip pinning by default
    this.drawingColor = "#008FFB"; // Stroke color
    this.drawingWidth = 2;
    this.fillColor = "#ffffff"; // Fill color for shapes
    this.fillOpacity = 0.5; // Fill opacity
    this.ctx = ctx;

    // Get drawing tools configuration from chartOptions
    const stockChartOptions =
      (ctx.chartOptions.plotOptions &&
        ctx.chartOptions.plotOptions.stockChart) ||
      {};
    this.drawingToolsConfig = ctx.chartOptions.drawingTools || {};

    // Set default tools if not specified in configuration
    this.availableTools = {
      line: true,
      brush: true,
      highlighter: true,
      rectangle: true,
      circle: true,
      ellipse: true,
      text: true,
      pin: true, // For tooltip annotations
      clear: true, // Always allow clearing
    };

    // Override defaults with user configuration
    if (this.drawingToolsConfig) {
      Object.keys(this.availableTools).forEach((tool) => {
        if (this.drawingToolsConfig[tool] !== undefined) {
          this.availableTools[tool] = !!this.drawingToolsConfig[tool];
        }
      });
    }

    // Initialize the coordinate converter using the shared instance
    this.coordinateConverter = CoordinateConverter.getInstance(
      this.chart,
      this.chartEl
    );

    // Initialize the overlay manager
    this.overlayManager = new OverlayManager(this.chartEl);
    this.svgOverlay = this.overlayManager.svgOverlay;
    this.drawingGroup = this.overlayManager.drawingGroup;
    this.overlayWrapper = this.overlayManager.overlayWrapper;

    // Initialize the text annotation manager
    this.textAnnotationManager = new TextAnnotationManager(
      this.chartEl,
      this.svgOverlay,
      this.coordinateConverter,
      this.handleTextCreated.bind(this)
    );

    // Initialize the tooltip annotation manager
    this.tooltipAnnotationManager = new TooltipAnnotationManager(
      this.chartEl,
      this.svgOverlay,
      this.coordinateConverter,
      this.handleTooltipCreated.bind(this)
    );

    // Initialize the toolbar manager
    this.toolbarManager = new ToolbarManager(
      ctx,
      this.chartEl,
      this.drawingColor,
      this.drawingWidth,
      this.handleToolClick.bind(this),
      this.clearAllDrawings.bind(this),
      this.availableTools
    );
    this.toolbarContainer = this.toolbarManager.toolbarContainer;

    // Initialize the event manager
    this.eventManager = new EventManager(
      this.chart,
      this.chartEl,
      this.svgOverlay,
      this.handleMouseDown.bind(this),
      this.handleMouseMove.bind(this),
      this.handleMouseUp.bind(this),
      this.handleResize.bind(this),
      this.handleWheelEvent.bind(this),
      this.redrawElements.bind(this),
      this.overlayManager.syncOverlayPosition.bind(this.overlayManager)
    );

    // Add property setters
    this.toolbarManager.onColorChange = (color) => {
      this.drawingColor = color;
    };

    this.toolbarManager.onWidthChange = (width) => {
      this.drawingWidth = width;
    };

    // Initialize the element interaction manager (always on)
    this.elementInteractionManager = new ElementInteractionManager(
      this.chartEl,
      this.svgOverlay,
      this.drawingGroup,
      this.elements,
      this.redrawElements.bind(this),
      this.coordinateConverter
    );

    // Add tooltip click handler
    this.setupTooltipPinningHandler();
  }

  /**
   * Set up handler for pinning tooltips on click
   */
  setupTooltipPinningHandler() {
    // Find the main chart element
    const mainChartEl = document.getElementById(this.chart.w.globals.chartID);
    if (!mainChartEl) return;

    // Add click listener to handle tooltip pinning
    mainChartEl.addEventListener(
      "dblclick",
      this.handleTooltipPinning.bind(this)
    );
  }

  /**
   * Handle click event for pinning tooltips
   * @param {MouseEvent} e - Click event
   */
  handleTooltipPinning(e) {
    if (!this.tooltipPinningEnabled) return;

    // Check if a tooltip is currently showing
    const tooltip = document.querySelector(
      ".apexcharts-tooltip:not(.apexcharts-tooltip-hidden)"
    );
    if (!tooltip) return;

    // Get mouse position relative to overlay
    const rect = this.overlayWrapper.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Convert screen coordinates to chart data coordinates using our coordinate converter
    const dataPoint = this.coordinateConverter.screenToData(x, y);
    if (!dataPoint) return;

    // Create a tooltip annotation
    const tooltipResult = this.tooltipAnnotationManager.createTooltipAnnotation(
      tooltip,
      x,
      y,
      { x: dataPoint.x, y: dataPoint.y }
    );

    // Add the tooltip to the drawingGroup
    if (tooltipResult && tooltipResult.element) {
      this.drawingGroup.appendChild(tooltipResult.element);

      // Now add to elements array
      this.elements.push({
        element: tooltipResult.element,
        data: tooltipResult.data,
      });

      // Update element interaction manager
      if (this.elementInteractionManager) {
        this.elementInteractionManager.updateElementEventListeners();
      }
    }
  }

  /**
   * Handles mousewheel events to deactivate the drawing mode
   * @param {WheelEvent} e - Wheel event
   */
  handleWheelEvent(e) {
    if (this.currentTool) {
      this.deactivateAllTools();
    }
    // Allow the event to propagate for chart zooming
  }

  /**
   * Handles mouse down event to start drawing
   * @param {MouseEvent} e - Mouse event
   */
  handleMouseDown(e) {
    // Check if we're in drawing mode
    if (!this.currentTool || this.svgOverlay.dataset.drawingMode !== "true")
      return;

    // If we're clicking on an existing element, let the interaction manager handle it
    if (e.target !== this.svgOverlay) {
      // Check if the target is one of our drawing elements
      for (const item of this.elements) {
        if (item.element === e.target || item.element.contains(e.target)) {
          return; // Let element interaction manager handle it
        }
      }
    }

    // Get mouse position relative to overlay
    const rect = this.overlayWrapper.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Convert screen coordinates to chart data coordinates using our coordinate converter
    const dataPoint = this.coordinateConverter.screenToData(x, y);

    if (!dataPoint) {
      // Fall back to using screen coordinates
      this.isDrawing = true;
      this.startPoint = { x, y, dataX: x, dataY: y };
    } else {
      this.isDrawing = true;
      this.startPoint = { x, y, dataX: dataPoint.x, dataY: dataPoint.y };
    }

    // Handle text tool separately with inline editing
    if (this.currentTool === "text") {
      // Use the text annotation manager for inline editing
      const textResult = this.textAnnotationManager.createTextAnnotation(
        x,
        y,
        { x: this.startPoint.dataX, y: this.startPoint.dataY },
        this.drawingColor
      );

      // Store the element and data
      this.currentElement = textResult.element;
      this.currentElementData = textResult.data;

      // Add element to drawing group
      this.drawingGroup.appendChild(this.currentElement);
    } else {
      // Create a new element based on the selected tool
      this.createNewElement();
    }

    // Prevent text selection while drawing
    e.preventDefault();

    // Don't prevent event propagation for zoom/pan
    // Only stop propagation for specific tools that should block chart interaction
    if (
      this.currentTool !== "line" &&
      this.currentTool !== "rectangle" &&
      this.currentTool !== "circle" &&
      this.currentTool !== "ellipse"
    ) {
      e.stopPropagation();
    }
  }

  /**
   * Creates a new SVG element based on the current tool
   */
  createNewElement() {
    const factory = new DrawingElementFactory(
      this.startPoint,
      this.drawingColor,
      this.drawingWidth
    )
      .setFillColor(this.fillColor)
      .setFillOpacity(this.fillOpacity);

    const result = factory.createElement(this.currentTool);

    if (result) {
      this.currentElement = result.element;
      this.currentElementData = result.data;
      this.drawingGroup.appendChild(this.currentElement);
    }
  }

  /**
   * Handles mouse move event for drawing
   * @param {MouseEvent} e - Mouse event
   */
  handleMouseMove(e) {
    if (!this.isDrawing || !this.currentTool || !this.currentElement) return;

    // Skip for text - text is handled by TextAnnotationManager with inline editing
    if (this.currentTool === "text") return;

    // Get mouse position relative to overlay
    const rect = this.overlayWrapper.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Convert screen coordinates to chart data coordinates
    const dataPoint = this.coordinateConverter.screenToData(x, y);

    if (!dataPoint) {
      // Fall back to using screen coordinates
      this.updateElement(x, y, { x, y });
    } else {
      // Update the current element based on the current tool
      this.updateElement(x, y, dataPoint);
    }

    // Prevent default to avoid text selection during drawing
    e.preventDefault();

    // Only stop propagation for specific tools that should block chart interaction
    if (this.currentTool === "brush" || this.currentTool === "highlighter") {
      e.stopPropagation();
    }
  }

  /**
   * Updates the current element during drawing
   * @param {number} x - Current x position
   * @param {number} y - Current y position
   * @param {Object} dataPoint - Current data point with x, y coordinates
   */
  updateElement(x, y, dataPoint) {
    if (!this.currentElement || !this.currentElementData) return;

    // Skip for text - text is handled by TextAnnotationManager with inline editing
    if (this.currentElementData.type === "text") return;

    switch (this.currentElementData.type) {
      case "line":
        this.currentElement.setAttribute("x2", x);
        this.currentElement.setAttribute("y2", y);
        this.currentElementData.x2 = dataPoint.x;
        this.currentElementData.y2 = dataPoint.y;
        break;

      case "brush":
      case "highlighter":
        const path = this.currentElement.getAttribute("d");
        this.currentElement.setAttribute("d", `${path} L ${x} ${y}`);
        this.currentElementData.points.push({ x: dataPoint.x, y: dataPoint.y });
        break;

      case "rectangle":
        const width = x - this.startPoint.x;
        const height = y - this.startPoint.y;

        const rectX = width < 0 ? x : this.startPoint.x;
        const rectY = height < 0 ? y : this.startPoint.y;

        this.currentElement.setAttribute("x", rectX);
        this.currentElement.setAttribute("y", rectY);
        this.currentElement.setAttribute("width", Math.abs(width));
        this.currentElement.setAttribute("height", Math.abs(height));

        // Use our coordinate converter to get the data coordinates for the rectangle
        const startDataPoint = this.coordinateConverter.screenToData(
          this.startPoint.x,
          this.startPoint.y
        );

        this.currentElementData.x = Math.min(startDataPoint.x, dataPoint.x);
        this.currentElementData.y = Math.min(startDataPoint.y, dataPoint.y);
        this.currentElementData.width = Math.abs(
          dataPoint.x - startDataPoint.x
        );
        this.currentElementData.height = Math.abs(
          dataPoint.y - startDataPoint.y
        );
        break;

      case "circle":
        // Calculate radius in screen space
        const dx = x - this.startPoint.x;
        const dy = y - this.startPoint.y;
        const radius = Math.sqrt(dx * dx + dy * dy);
        this.currentElement.setAttribute("r", radius);

        // Calculate data space radius using our coordinate converter
        const dataRadius = this.coordinateConverter.getDataDistance(
          { x: this.startPoint.dataX, y: this.startPoint.dataY },
          dataPoint
        );
        this.currentElementData.r = dataRadius;
        break;

      case "ellipse":
        const rx = Math.abs(x - this.startPoint.x);
        const ry = Math.abs(y - this.startPoint.y);
        this.currentElement.setAttribute("rx", rx);
        this.currentElement.setAttribute("ry", ry);

        // Calculate data space radii
        const startDataPoint2 = this.coordinateConverter.screenToData(
          this.startPoint.x,
          this.startPoint.y
        );
        const dataRx = Math.abs(dataPoint.x - startDataPoint2.x);
        const dataRy = Math.abs(dataPoint.y - startDataPoint2.y);
        this.currentElementData.rx = dataRx;
        this.currentElementData.ry = dataRy;
        break;
    }
  }

  /**
   * Handle mouseup event to finish drawing
   */
  handleMouseUp() {
    if (!this.isDrawing) return;

    this.isDrawing = false;

    // For text tool, the elements are handled by TextAnnotationManager
    if (this.currentElement && this.currentTool !== "text") {
      // Ensure the element has a unique ID in data
      if (this.currentElementData && !this.currentElementData.id) {
        const elementId = Utils.generateUniqueId(
          this.currentElementData.type || "element"
        );
        this.currentElementData.id = elementId;

        // Also set ID on DOM element for reference
        if (this.currentElement) {
          this.currentElement.dataset.elementId = elementId;
        }
      }

      // Add to elements array
      this.elements.push({
        element: this.currentElement,
        data: this.currentElementData,
      });

      this.currentElement = null;
      this.currentElementData = null;

      // Update element interaction manager with the new element
      if (this.elementInteractionManager) {
        this.elementInteractionManager.updateElementEventListeners();
      }
    }
  }

  /**
   * Callback for when text is created and confirmed by TextAnnotationManager
   * @param {SVGElement} element - The text element
   * @param {Object} data - The text data
   */
  handleTextCreated(element, data) {
    if (element && data) {
      // Check if element with this ID already exists
      const existingIndex = this.elements.findIndex(
        (item) => item.data && item.data.id === data.id
      );

      if (existingIndex >= 0) {
        // Update existing element
        this.elements[existingIndex].element = element;
        this.elements[existingIndex].data = data;
      } else {
        // Add as new element
        this.elements.push({
          element: element,
          data: data,
        });
      }

      // Update element interaction manager with the new element
      if (this.elementInteractionManager) {
        this.elementInteractionManager.updateElementEventListeners();
      }
    }
  }

  /**
   * Callback for when tooltip is created by TooltipAnnotationManager
   * @param {SVGElement} element - The tooltip element
   * @param {Object} data - The tooltip data
   */
  handleTooltipCreated(element, data) {
    if (element && data) {
      // Check if element with this ID already exists
      const existingIndex = this.elements.findIndex(
        (item) => item.data && item.data.id === data.id
      );

      if (existingIndex >= 0) {
        // Update existing element
        this.elements[existingIndex].element = element;
        this.elements[existingIndex].data = data;
      } else {
        // Add as new element
        this.elements.push({
          element: element,
          data: data,
        });
      }

      // Update element interaction manager with the new element
      if (this.elementInteractionManager) {
        this.elementInteractionManager.updateElementEventListeners();
      }
    }
  }

  /**
   * Handles window resize to adjust the SVG overlay
   */
  handleResize() {
    // Force refresh coordinate converter bounds
    this.coordinateConverter.refreshBounds();

    // Redraw all elements when the window is resized
    this.redrawElements();
  }

  /**
   * Redraws all elements based on their data coordinates
   */
  redrawElements() {
    // Clear existing drawings
    while (this.drawingGroup.firstChild) {
      this.drawingGroup.removeChild(this.drawingGroup.firstChild);
    }

    // Redraw each element
    this.elements.forEach((item) => {
      const data = item.data;
      let element;

      switch (data.type) {
        case "line":
          element = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "line"
          );
          const start = this.coordinateConverter.dataToScreen(data.x1, data.y1);
          const end = this.coordinateConverter.dataToScreen(data.x2, data.y2);
          element.setAttribute("x1", start.x);
          element.setAttribute("y1", start.y);
          element.setAttribute("x2", end.x);
          element.setAttribute("y2", end.y);
          element.setAttribute("stroke", data.color);
          element.setAttribute("stroke-width", data.width);
          break;

        case "brush":
        case "highlighter":
          element = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "path"
          );
          let pathData = "";
          data.points.forEach((point, index) => {
            const screenPoint = this.coordinateConverter.dataToScreen(
              point.x,
              point.y
            );
            pathData +=
              index === 0
                ? `M ${screenPoint.x} ${screenPoint.y}`
                : ` L ${screenPoint.x} ${screenPoint.y}`;
          });
          element.setAttribute("d", pathData);
          element.setAttribute("fill", "none");
          element.setAttribute("stroke", data.color);
          element.setAttribute("stroke-width", data.width);
          element.setAttribute("stroke-linecap", "round");
          element.setAttribute("stroke-linejoin", "round");
          if (data.type === "highlighter") {
            element.setAttribute("stroke-opacity", data.opacity);
          }
          break;

        case "rectangle":
          element = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "rect"
          );
          const rectTopLeft = this.coordinateConverter.dataToScreen(
            data.x,
            data.y
          );
          const rectBottomRight = this.coordinateConverter.dataToScreen(
            data.x + data.width,
            data.y + data.height
          );

          // Calculate width and height
          const rectWidth = Math.abs(rectBottomRight.x - rectTopLeft.x);
          const rectHeight = Math.abs(rectBottomRight.y - rectTopLeft.y);

          // Determine the actual top-left corner based on which point has smaller coordinates
          const rectX = Math.min(rectTopLeft.x, rectBottomRight.x);
          const rectY = Math.min(rectTopLeft.y, rectBottomRight.y);

          element.setAttribute("x", rectX);
          element.setAttribute("y", rectY);
          element.setAttribute("width", rectWidth);
          element.setAttribute("height", rectHeight);
          element.setAttribute("stroke", data.color);
          element.setAttribute("stroke-width", data.strokeWidth);
          element.setAttribute("fill", data.fill || this.fillColor);
          element.setAttribute(
            "fill-opacity",
            data.fillOpacity || this.fillOpacity
          );

          break;

        case "circle":
          element = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "circle"
          );
          const center = this.coordinateConverter.dataToScreen(
            data.cx,
            data.cy
          );

          // Calculate screen radius based on a point at distance r from center
          const radiusPoint = this.coordinateConverter.dataToScreen(
            data.cx + data.r,
            data.cy
          );
          const screenRadius = Math.abs(radiusPoint.x - center.x);

          element.setAttribute("cx", center.x);
          element.setAttribute("cy", center.y);
          element.setAttribute("r", screenRadius);
          element.setAttribute("stroke", data.color);
          element.setAttribute("stroke-width", data.strokeWidth);
          element.setAttribute("fill", data.fill || this.fillColor);
          element.setAttribute(
            "fill-opacity",
            data.fillOpacity || this.fillOpacity
          );
          break;

        case "ellipse":
          element = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "ellipse"
          );
          const ellipseCenter = this.coordinateConverter.dataToScreen(
            data.cx,
            data.cy
          );

          // Calculate screen radii
          const rxPoint = this.coordinateConverter.dataToScreen(
            data.cx + data.rx,
            data.cy
          );
          const ryPoint = this.coordinateConverter.dataToScreen(
            data.cx,
            data.cy + data.ry
          );
          const screenRx = Math.abs(rxPoint.x - ellipseCenter.x);
          const screenRy = Math.abs(ryPoint.y - ellipseCenter.y);

          element.setAttribute("cx", ellipseCenter.x);
          element.setAttribute("cy", ellipseCenter.y);
          element.setAttribute("rx", screenRx);
          element.setAttribute("ry", screenRy);
          element.setAttribute("stroke", data.color);
          element.setAttribute("stroke-width", data.strokeWidth);
          element.setAttribute("fill", data.fill || this.fillColor);
          element.setAttribute(
            "fill-opacity",
            data.fillOpacity || this.fillOpacity
          );
          break;

        case "text":
          // Use TextAnnotationManager to handle text element creation
          element = this.textAnnotationManager.redrawTextElement(data);
          break;

        case "tooltip":
          // Use TooltipAnnotationManager to handle tooltip element creation
          element = this.tooltipAnnotationManager.redrawTooltipElement(data);
          break;
      }

      if (element) {
        // Ensure element has its ID as a data attribute
        if (data.id) {
          element.dataset.elementId = data.id;
        }

        this.drawingGroup.appendChild(element);
        // Update the element reference in the elements array
        item.element = element;
      }
    });

    // Recreate the visual elements for the element interaction manager
    if (this.elementInteractionManager) {
      this.elementInteractionManager.createVisualElements();
      this.elementInteractionManager.updateElementEventListeners();
    }
  }

  /**
   * Handles tool button clicks
   * @param {string} toolName - Name of the tool clicked
   */
  handleToolClick(toolName) {
    if (toolName === "clear") {
      this.clearAllDrawings();
      return;
    }

    // Toggle tooltip pinning when "pin" tool is clicked
    if (toolName === "pin") {
      this.tooltipPinningEnabled = !this.tooltipPinningEnabled;

      // Highlight the pin button if tooltip pinning is enabled
      this.toolbarContainer
        .querySelectorAll(".apexstock-drawing-tool")
        .forEach((btn) => {
          if (btn.dataset.tool === "pin") {
            if (this.tooltipPinningEnabled) {
              btn.classList.add("active");
            } else {
              btn.classList.remove("active");
            }
          }
        });
      return;
    }

    // If the same tool is clicked again, deactivate it
    if (this.currentTool === toolName) {
      this.deactivateAllTools();
      return;
    }

    // Highlight the active tool button
    this.toolbarContainer
      .querySelectorAll(".apexstock-drawing-tool")
      .forEach((btn) => {
        if (btn.dataset.tool === toolName) {
          btn.classList.add("active");
        } else if (["clear", "pin"].indexOf(btn.dataset.tool) === -1) {
          btn.classList.remove("active");
        }
      });

    // Set the current tool
    this.currentTool = toolName;

    // When a drawing tool is active, we need to capture all events on the SVG overlay
    this.svgOverlay.classList.add("active-drawing");

    // Enable pointer events for drawing
    this.svgOverlay.style.pointerEvents = "all";
    this.overlayWrapper.style.pointerEvents = "all";

    this.svgOverlay.dataset.drawingMode = "true";
  }

  /**
   * Deactivates all drawing tools and hides the overlay
   */
  deactivateAllTools() {
    // Deselect all tool buttons except pin
    this.toolbarContainer
      .querySelectorAll(".apexstock-drawing-tool")
      .forEach((btn) => {
        if (btn.dataset.tool !== "pin") {
          btn.classList.remove("active");
        }
      });

    // Reset the current tool
    this.currentTool = null;

    // Disable drawing mode
    this.svgOverlay.classList.remove("active-drawing");

    // Disable pointer events to allow chart zooming/panning
    this.svgOverlay.style.pointerEvents = "none";
    this.overlayWrapper.style.pointerEvents = "none";

    this.svgOverlay.dataset.drawingMode = "false";
  }

  /**
   * Clear all drawings
   */
  clearAllDrawings() {
    // First, identify all tooltip IDs to ensure they're properly cleaned up
    const tooltipIds = this.elements
      .filter(
        (item) => item.data && item.data.type === "tooltip" && item.data.id
      )
      .map((item) => item.data.id);

    // Clear the elements array
    this.elements = [];

    // Clear the drawing group - remove all child elements
    while (this.drawingGroup.firstChild) {
      this.drawingGroup.removeChild(this.drawingGroup.firstChild);
    }

    // Find and remove any tooltip annotations that might be outside the drawing group
    // by using their specific IDs
    tooltipIds.forEach((id) => {
      if (this.tooltipAnnotationManager) {
        this.tooltipAnnotationManager.removeTooltipById(id);
      }
    });

    // Additional cleanup for any remaining tooltips
    if (this.tooltipAnnotationManager) {
      this.tooltipAnnotationManager.cleanup();
    }

    // Recreate element interaction manager
    if (this.elementInteractionManager) {
      // First, destroy the current instance
      this.elementInteractionManager.destroy();

      // Then create a new instance with the cleared elements array
      this.elementInteractionManager = new ElementInteractionManager(
        this.chartEl,
        this.svgOverlay,
        this.drawingGroup,
        this.elements,
        this.redrawElements.bind(this),
        this.coordinateConverter
      );
    }

    // Make sure the chart can be zoomed/panned if no tool is currently active
    if (!this.currentTool) {
      this.svgOverlay.style.pointerEvents = "none";
      this.overlayWrapper.style.pointerEvents = "none";
    }
  }

  handleStyleChange(element, elementData, styleChanges) {
    // Find the element in our array
    const index = this.elements.findIndex(
      (item) => item.data && item.data.id === elementData.id
    );

    if (index !== -1) {
      // Update data with new styles
      if (styleChanges.stroke) {
        this.elements[index].data.color = styleChanges.stroke;
      }
      if (styleChanges.fill) {
        this.elements[index].data.fill = styleChanges.fill;
      }
      if (styleChanges.fillOpacity !== undefined) {
        this.elements[index].data.fillOpacity = styleChanges.fillOpacity;
      }

      // Redraw all elements
      this.redrawElements();
    }
  }

  /**
   * Toggle tooltip pinning functionality
   * @param {boolean} enabled - Whether tooltip pinning should be enabled
   */
  toggleTooltipPinning(enabled) {
    this.tooltipPinningEnabled = enabled;
  }

  /**
   * Clean up event listeners and resources
   */
  destroy() {
    // Clean up event listeners
    this.eventManager.destroy();

    // Clean up text annotation manager
    this.textAnnotationManager.destroy();

    // Clean up element interaction manager
    if (this.elementInteractionManager) {
      this.elementInteractionManager.destroy();
    }

    // Remove tooltip click handler
    const mainChartEl = document.getElementById(this.chart.w.globals.chartID);
    if (mainChartEl) {
      mainChartEl.removeEventListener(
        "dblclick",
        this.handleTooltipPinning.bind(this)
      );
    }

    // Remove the SVG overlay wrapper
    if (this.overlayWrapper && this.overlayWrapper.parentNode) {
      this.overlayWrapper.parentNode.removeChild(this.overlayWrapper);
    }

    // Remove the toolbar
    if (this.toolbarContainer && this.toolbarContainer.parentNode) {
      this.toolbarContainer.parentNode.removeChild(this.toolbarContainer);
    }
  }
}
