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
import { getDrawingTool } from "./DrawingToolRegistry";

// Tools drawn interactively via the data-space model (seed on mousedown, update
// data coords on drag, render through redrawElements) rather than the legacy
// screen-space factory path used by line/brush/rectangle/circle/ellipse/text.
const INTERACTIVE_DATA_TOOLS = new Set([
  "ray",
  "hline",
  "vline",
  "fib",
  "measure",
]);

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
      ray: true,
      hline: true,
      vline: true,
      fib: true,
      measure: true,
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

    // rAF-throttled drag updater: coalesces high-frequency mousemove work
    // (coordinate conversion + DOM mutation) into one update per frame.
    this.throttledDrawMove = Utils.rafThrottle(this.drawMove.bind(this));

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

    // Escape cancels an in-progress drawing (bound once for clean removal).
    this._boundEscapeKey = this.handleEscapeKey.bind(this);
    document.addEventListener("keydown", this._boundEscapeKey);
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
    } else if (INTERACTIVE_DATA_TOOLS.has(this.currentTool)) {
      // Data-model tools: seed a data-space record, add it as an in-progress
      // element (flagged so it is not selectable mid-draw), and render it. The
      // drag updates its data coords and re-renders via redrawElements().
      const data = this._seedInteractiveData(this.currentTool, this.startPoint);
      if (data) {
        this._interimItem = { element: null, data };
        this.elements.push(this._interimItem);
        this.currentElement = null;
        this.currentElementData = data;
        this.redrawElements();
      }
      e.preventDefault();
      e.stopPropagation(); // block chart pan/zoom while drawing
      return;
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
    if (!this.isDrawing || !this.currentTool) return;

    // Skip for text - text is handled by TextAnnotationManager with inline editing
    if (this.currentTool === "text") return;

    // Data-model tools drive an in-progress element in this.elements (no live
    // this.currentElement); the legacy factory tools need a live element.
    if (!this.currentElement && !INTERACTIVE_DATA_TOOLS.has(this.currentTool))
      return;

    // Prevent default to avoid text selection during drawing. This must run
    // synchronously, so it stays here rather than in the throttled body below.
    e.preventDefault();

    // Only stop propagation for specific tools that should block chart interaction
    if (this.currentTool === "brush" || this.currentTool === "highlighter") {
      e.stopPropagation();
    }

    // Coalesce the expensive coordinate conversion + DOM update into a single
    // update per animation frame (see constructor: this.throttledDrawMove).
    this.throttledDrawMove(e);
  }

  /**
   * Performs the actual element update for a drawing drag. Invoked at most
   * once per animation frame via the rAF-throttled wrapper.
   * @param {MouseEvent} e - The most recent mouse move event
   */
  drawMove(e) {
    if (!this.isDrawing) return;
    if (
      !this.currentElement &&
      !(
        this.currentElementData &&
        INTERACTIVE_DATA_TOOLS.has(this.currentElementData.type)
      )
    )
      return;

    // Get mouse position relative to overlay. The overlay is a stable container
    // (it doesn't move during a drag), so reuse its rect for 100ms to avoid a
    // layout reflow on every drag frame.
    const rect = Utils.cachedRect(this.overlayWrapper);
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
  }

  /**
   * Updates the current element during drawing
   * @param {number} x - Current x position
   * @param {number} y - Current y position
   * @param {Object} dataPoint - Current data point with x, y coordinates
   */
  updateElement(x, y, dataPoint) {
    // Data-model tools: update the record's coordinates and re-render.
    if (
      this.currentElementData &&
      INTERACTIVE_DATA_TOOLS.has(this.currentElementData.type)
    ) {
      this._updateInteractiveData(
        this.currentElementData.type,
        this.currentElementData,
        dataPoint
      );
      this.redrawElements();
      return;
    }

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
   * Seed the data-space record for an interactive data-model tool at the start
   * of a draw (start == end). Coordinates are updated during the drag.
   * @param {string} tool - One of INTERACTIVE_DATA_TOOLS.
   * @param {{dataX:number, dataY:number}} startPoint
   * @returns {object|null} the seed drawing record, flagged `_drawing`.
   */
  _seedInteractiveData(tool, startPoint) {
    const dataX = startPoint.dataX;
    const dataY = startPoint.dataY;
    const base = {
      color: this.drawingColor,
      width: this.drawingWidth,
      _drawing: true,
    };
    switch (tool) {
      case "ray":
        return { ...base, type: "ray", x1: dataX, y1: dataY, x2: dataX, y2: dataY };
      case "hline":
        return { ...base, type: "hline", y: dataY };
      case "vline":
        return { ...base, type: "vline", x: dataX };
      case "fib":
        return {
          ...base,
          type: "fib",
          fibType: "retracement",
          x1: dataX,
          y1: dataY,
          x2: dataX,
          y2: dataY,
          levels: [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1],
          showLabels: true,
        };
      case "measure":
        return {
          ...base,
          type: "measure",
          x1: dataX,
          y1: dataY,
          x2: dataX,
          y2: dataY,
          upColor: "#26a69a",
          downColor: "#ef5350",
          fillOpacity: 0.2,
          showLabel: true,
        };
      default:
        return null;
    }
  }

  /**
   * Update an interactive data-model record's coordinates from the pointer's
   * current data-space position during a drag.
   * @param {string} tool
   * @param {object} data - The in-progress drawing record (mutated).
   * @param {{x:number, y:number}} dataPoint
   */
  _updateInteractiveData(tool, data, dataPoint) {
    switch (tool) {
      case "ray":
      case "fib":
      case "measure":
        data.x2 = dataPoint.x;
        data.y2 = dataPoint.y;
        break;
      case "hline":
        data.y = dataPoint.y;
        break;
      case "vline":
        data.x = dataPoint.x;
        break;
    }
  }

  /**
   * Abort an in-progress drawing (Escape). Removes the half-drawn element and
   * resets state without committing it to the elements array. No-op if no draw
   * is active.
   */
  cancelDrawing() {
    if (!this.isDrawing) return;

    this.isDrawing = false;

    // Drop any drag update still queued for the next frame.
    if (this.throttledDrawMove) {
      this.throttledDrawMove.cancel();
    }

    // Data-model tools: drop the in-progress element from the model and redraw.
    if (
      this.currentElementData &&
      INTERACTIVE_DATA_TOOLS.has(this.currentElementData.type)
    ) {
      const idx = this.elements.indexOf(this._interimItem);
      if (idx !== -1) this.elements.splice(idx, 1);
      this._interimItem = null;
      this.currentElement = null;
      this.currentElementData = null;
      this.redrawElements();
      return;
    }

    // Remove the uncommitted element from the DOM (text is owned by the
    // TextAnnotationManager and handled by its own Escape handler).
    if (
      this.currentElement &&
      this.currentTool !== "text" &&
      this.currentElement.parentNode
    ) {
      this.currentElement.parentNode.removeChild(this.currentElement);
    }

    this.currentElement = null;
    this.currentElementData = null;
  }

  /**
   * Document-level Escape handler: cancels an in-progress drawing.
   * @param {KeyboardEvent} e - Keyboard event
   */
  handleEscapeKey(e) {
    if (e.key === "Escape" && this.isDrawing) {
      this.cancelDrawing();
      e.preventDefault();
    }
  }

  /**
   * Handle mouseup event to finish drawing
   */
  handleMouseUp() {
    if (!this.isDrawing) return;

    this.isDrawing = false;

    // Drop any drag update still queued for the next frame.
    if (this.throttledDrawMove) {
      this.throttledDrawMove.cancel();
    }

    // Data-model tools: finalize the in-progress element (already in the model).
    if (
      this.currentElementData &&
      INTERACTIVE_DATA_TOOLS.has(this.currentElementData.type)
    ) {
      delete this.currentElementData._drawing;
      if (!this.currentElementData.id) {
        this.currentElementData.id = Utils.generateUniqueId(
          this.currentElementData.type
        );
      }
      // Re-render without the in-progress flag so it becomes selectable, and
      // wire up interaction listeners.
      this.redrawElements();
      this.currentElement = null;
      this.currentElementData = null;
      this._interimItem = null;
      return;
    }

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

    // Build all elements off-DOM and attach them in a single append to avoid
    // a reflow per drawn element.
    const fragment = document.createDocumentFragment();

    // Redraw each element
    this.elements.forEach((item) => {
      const data = item.data;
      let element;

      // Hidden drawings stay in the model (so they round-trip through state)
      // but are not rendered.
      if (data.visible === false) {
        item.element = null;
        return;
      }

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
          if (data.dashArray != null) {
            element.setAttribute("stroke-dasharray", data.dashArray);
          }
          break;

        case "ray": {
          // A half-line from (x1,y1) through (x2,y2), extended to the grid edge.
          element = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "line"
          );
          const rp1 = this.coordinateConverter.dataToScreen(data.x1, data.y1);
          const rp2 = this.coordinateConverter.dataToScreen(data.x2, data.y2);
          const far = this._extendToBounds(rp1, rp2);
          element.setAttribute("x1", rp1.x);
          element.setAttribute("y1", rp1.y);
          element.setAttribute("x2", far.x);
          element.setAttribute("y2", far.y);
          element.setAttribute("stroke", data.color);
          element.setAttribute("stroke-width", data.width);
          if (data.dashArray != null) {
            element.setAttribute("stroke-dasharray", data.dashArray);
          }
          break;
        }

        case "measure": {
          // A measurement box between two anchor points, labeled with the
          // price change, percent change, and number of bars spanned. Tinted
          // green when the move is up, red when down.
          element = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "g"
          );
          const ma = this.coordinateConverter.dataToScreen(data.x1, data.y1);
          const mb = this.coordinateConverter.dataToScreen(data.x2, data.y2);
          const up = data.y2 >= data.y1;
          const tint = up ? data.upColor : data.downColor;
          const left = Math.min(ma.x, mb.x);
          const right = Math.max(ma.x, mb.x);
          const top = Math.min(ma.y, mb.y);
          const bottom = Math.max(ma.y, mb.y);

          const rect = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "rect"
          );
          rect.setAttribute("x", left);
          rect.setAttribute("y", top);
          rect.setAttribute("width", Math.abs(right - left));
          rect.setAttribute("height", Math.abs(bottom - top));
          rect.setAttribute("fill", tint);
          rect.setAttribute("fill-opacity", data.fillOpacity);
          rect.setAttribute("stroke", tint);
          rect.setAttribute("stroke-width", data.width);
          element.appendChild(rect);

          if (data.showLabel !== false) {
            const dPrice = data.y2 - data.y1;
            const dPct = data.y1 !== 0 ? (dPrice / data.y1) * 100 : 0;
            const series = Array.isArray(this.ctx.series) ? this.ctx.series : [];
            const lo = Math.min(data.x1, data.x2);
            const hi = Math.max(data.x1, data.x2);
            const bars = series.filter(
              (pt) => pt && typeof pt.x === "number" && pt.x >= lo && pt.x <= hi
            ).length;
            const sign = dPrice >= 0 ? "+" : "";
            const parts = [
              `${sign}${Utils.truncateNumber(dPrice)} (${sign}${Utils.truncateNumber(dPct)}%)`,
            ];
            if (bars > 0) parts.push(`${bars} bars`);

            const label = document.createElementNS(
              "http://www.w3.org/2000/svg",
              "text"
            );
            label.setAttribute("x", (left + right) / 2);
            label.setAttribute("y", top - 4);
            label.setAttribute("text-anchor", "middle");
            label.setAttribute("fill", tint);
            label.setAttribute("font-size", "11");
            label.textContent = parts.join("  ·  ");
            element.appendChild(label);
          }
          break;
        }

        case "fib": {
          // Fibonacci retracement/extension: a group of horizontal level lines
          // between the two anchor prices, spanning the anchors' time range,
          // each labeled with its ratio.
          element = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "g"
          );
          const fa = this.coordinateConverter.dataToScreen(data.x1, data.y1);
          const fb = this.coordinateConverter.dataToScreen(data.x2, data.y2);
          const xLeft = Math.min(fa.x, fb.x);
          const xRight = Math.max(fa.x, fb.x);
          const levels = Array.isArray(data.levels) ? data.levels : [];
          levels.forEach((r) => {
            const price = data.y1 + (data.y2 - data.y1) * r;
            const y = this.coordinateConverter.dataToScreen(data.x1, price).y;

            const line = document.createElementNS(
              "http://www.w3.org/2000/svg",
              "line"
            );
            line.setAttribute("x1", xLeft);
            line.setAttribute("y1", y);
            line.setAttribute("x2", xRight);
            line.setAttribute("y2", y);
            line.setAttribute("stroke", data.color);
            line.setAttribute("stroke-width", data.width);
            if (data.dashArray != null) {
              line.setAttribute("stroke-dasharray", data.dashArray);
            }
            element.appendChild(line);

            if (data.showLabels !== false) {
              const label = document.createElementNS(
                "http://www.w3.org/2000/svg",
                "text"
              );
              label.setAttribute("x", xRight + 4);
              label.setAttribute("y", y - 2);
              label.setAttribute("fill", data.color);
              label.setAttribute("font-size", "10");
              label.textContent = `${(r * 100).toFixed(1)}%`;
              element.appendChild(label);
            }
          });
          break;
        }

        case "hline": {
          // A price level spanning the full grid width.
          element = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "line"
          );
          const b = this.coordinateConverter.getChartBounds();
          const y = this.coordinateConverter.dataToScreen(b.xaxis, data.y).y;
          element.setAttribute("x1", b.leftMargin);
          element.setAttribute("y1", y);
          element.setAttribute("x2", b.leftMargin + b.gridWidth);
          element.setAttribute("y2", y);
          element.setAttribute("stroke", data.color);
          element.setAttribute("stroke-width", data.width);
          if (data.dashArray != null) {
            element.setAttribute("stroke-dasharray", data.dashArray);
          }
          break;
        }

        case "vline": {
          // A time marker spanning the full grid height.
          element = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "line"
          );
          const b = this.coordinateConverter.getChartBounds();
          const x = this.coordinateConverter.dataToScreen(data.x, b.yaxis).x;
          element.setAttribute("x1", x);
          element.setAttribute("y1", b.translateY);
          element.setAttribute("x2", x);
          element.setAttribute("y2", b.translateY + b.gridHeight);
          element.setAttribute("stroke", data.color);
          element.setAttribute("stroke-width", data.width);
          if (data.dashArray != null) {
            element.setAttribute("stroke-dasharray", data.dashArray);
          }
          break;
        }

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

        default: {
          // Custom drawing tools registered via ApexStock.registerDrawingTool.
          const tool = getDrawingTool(data.type);
          if (tool) {
            const helpers = {
              svgNS: "http://www.w3.org/2000/svg",
              dataToScreen: (x, y) =>
                this.coordinateConverter.dataToScreen(x, y),
              screenToData: (x, y) =>
                this.coordinateConverter.screenToData(x, y),
              getChartBounds: () => this.coordinateConverter.getChartBounds(),
              extendToBounds: (p1, p2) => this._extendToBounds(p1, p2),
            };
            try {
              element = tool.render(data, helpers);
            } catch (err) {
              Utils.warn(
                `Drawing tool "${data.type}" render() threw:`,
                err
              );
            }
          }
          break;
        }
      }

      if (element) {
        // Ensure element has its ID as a data attribute
        if (data.id) {
          element.dataset.elementId = data.id;
        }

        // Locked drawings (and the in-progress one during a live draw) render
        // but cannot be selected or dragged.
        if (data.locked || data._drawing) {
          element.style.pointerEvents = "none";
          if (data.locked) element.dataset.locked = "true";
        }

        fragment.appendChild(element);
        // Update the element reference in the elements array
        item.element = element;
      }
    });

    // Single DOM write for all redrawn elements.
    this.drawingGroup.appendChild(fragment);

    // Recreate the visual elements for the element interaction manager
    if (this.elementInteractionManager) {
      this.elementInteractionManager.createVisualElements();
      this.elementInteractionManager.updateElementEventListeners();
    }
  }

  /**
   * Given a ray's first two screen points, return the point where the ray
   * (from p1 through p2) exits the chart's grid rectangle. Used to render an
   * open-ended ray. Falls back to p2 for a degenerate (zero-length) ray.
   * @param {{x:number,y:number}} p1 - Ray origin (screen space).
   * @param {{x:number,y:number}} p2 - A second point defining direction.
   * @returns {{x:number,y:number}} the exit point on the grid boundary.
   */
  _extendToBounds(p1, p2) {
    const b = this.coordinateConverter.getChartBounds();
    const left = b.leftMargin;
    const top = b.translateY;
    const right = b.leftMargin + b.gridWidth;
    const bottom = b.translateY + b.gridHeight;

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    if (dx === 0 && dy === 0) return p2;

    // Largest forward scale t (>= 0) that keeps the point inside the grid rect.
    let tMax = Infinity;
    if (dx > 0) tMax = Math.min(tMax, (right - p1.x) / dx);
    else if (dx < 0) tMax = Math.min(tMax, (left - p1.x) / dx);
    if (dy > 0) tMax = Math.min(tMax, (bottom - p1.y) / dy);
    else if (dy < 0) tMax = Math.min(tMax, (top - p1.y) / dy);

    if (!Number.isFinite(tMax) || tMax < 0) return p2;
    return { x: p1.x + dx * tMax, y: p1.y + dy * tMax };
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
    // Drop any pending throttled drag update
    if (this.throttledDrawMove) {
      this.throttledDrawMove.cancel();
    }

    // Remove the Escape key listener
    if (this._boundEscapeKey) {
      document.removeEventListener("keydown", this._boundEscapeKey);
    }

    // Clean up event listeners
    this.eventManager.destroy();

    // Clean up the overlay manager (removes its window resize listener)
    if (this.overlayManager && typeof this.overlayManager.destroy === "function") {
      this.overlayManager.destroy();
    }

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
