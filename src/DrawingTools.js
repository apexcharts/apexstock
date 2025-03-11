import Utils from "./utils/Utils";

class Drawing {
  /**
   * @param {ApexCharts} chart - The ApexCharts instance
   * @param {HTMLElement} chartDiv - The chart container element
   * @param {Array} series - The data series for coordinate transformation
   */
  constructor(chart, chartDiv, series) {
    this.chart = chart;
    this.chartDiv = chartDiv;
    this.series = series;
    this.isDrawing = false;
    this.currentTool = null;
    this.elements = [];
    this.currentElement = null;
    this.startPoint = null;
    this.drawingColor = "#FF5733";
    this.drawingWidth = 2;
    this.undoStack = [];
    this.redoStack = [];

    // Explicitly define the syncOverlayPosition method as a bound function
    this.syncOverlayPosition = function () {
      if (!this.chartDiv || !this.overlayWrapper) return;

      try {
        // Get the chart's position
        const chartRect = this.chartDiv.getBoundingClientRect();
        const parentRect = this.chartDiv.parentNode.getBoundingClientRect();

        // Update overlay wrapper dimensions and position to match the chart
        this.overlayWrapper.style.width = chartRect.width + "px";
        this.overlayWrapper.style.height = chartRect.height + "px";
        this.overlayWrapper.style.top = chartRect.top - parentRect.top + "px";
        this.overlayWrapper.style.left =
          chartRect.left - parentRect.left + "px";

        console.log("Overlay position synced");
      } catch (err) {
        console.error("Error syncing overlay position:", err);
      }
    }.bind(this);

    // Define listenForChartEvents method
    this.listenForChartEvents = function () {
      // Set up a mutation observer to detect changes in the chart
      const observer = new MutationObserver(() => {
        if (typeof this.syncOverlayPosition === "function") {
          this.syncOverlayPosition();
        }
      });

      observer.observe(this.chartDiv, {
        attributes: true,
        childList: true,
        subtree: true,
      });

      // Use a fallback interval regardless of addEventListener availability
      // This ensures we always sync the overlay position
      this.intervalId = setInterval(() => {
        if (typeof this.syncOverlayPosition === "function") {
          this.syncOverlayPosition();
        }
      }, 1000);

      // Try to listen for chart events if available
      try {
        if (this.chart.addEventListener) {
          this.chart.addEventListener("updated", () => {
            setTimeout(() => {
              if (typeof this.syncOverlayPosition === "function") {
                this.syncOverlayPosition();
              }
              this.redrawElements();
            }, 300);
          });

          this.chart.addEventListener("rendered", () => {
            setTimeout(() => {
              if (typeof this.syncOverlayPosition === "function") {
                this.syncOverlayPosition();
              }
              this.redrawElements();
            }, 300);
          });
        }
      } catch (err) {
        console.error("Error setting up chart event listeners:", err);
      }
    }.bind(this);

    // Create SVG overlay for drawing
    this.setupSVGOverlay();

    // Create drawing toolbar
    this.createDrawingToolbar();

    // Initialize event listeners
    this.initEventListeners();

    // Listen for chart updates to reposition overlay
    this.listenForChartEvents();
  }

  /**
   * Sets up the SVG overlay for drawing
   */
  setupSVGOverlay() {
    // Create a wrapper for the SVG overlay that's outside the chart elements
    this.overlayWrapper = document.createElement("div");
    this.overlayWrapper.className = "apexstock-drawing-overlay-wrapper";

    // Place the wrapper directly on the chart's parent to avoid being removed on chart updates
    this.chartDiv.parentNode.appendChild(this.overlayWrapper);

    // Create SVG container that will overlay the chart
    this.svgOverlay = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "svg"
    );
    this.svgOverlay.setAttribute("class", "apexstock-drawing-overlay");
    this.overlayWrapper.appendChild(this.svgOverlay);

    // Create defs for markers or patterns if needed
    this.defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    this.svgOverlay.appendChild(this.defs);

    // Create a group element to contain all drawings
    this.drawingGroup = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "g"
    );
    this.svgOverlay.appendChild(this.drawingGroup);

    // Force initial sync of overlay dimensions
    setTimeout(() => {
      if (typeof this.syncOverlayPosition === "function") {
        this.syncOverlayPosition();
      } else {
        console.error("syncOverlayPosition is not defined as a function");
      }
    }, 100);

    // Add resize listener
    window.addEventListener("resize", () => {
      if (typeof this.syncOverlayPosition === "function") {
        this.syncOverlayPosition();
      }
    });
  }

  /**
   * Creates the drawing toolbar with tools
   */
  createDrawingToolbar() {
    const toolbarContainer = document.createElement("div");
    toolbarContainer.className = "apexstock-drawing-toolbar";

    // Define tools
    const tools = [
      { name: "line", icon: "━", tooltip: "Line" },
      { name: "brush", icon: "✎", tooltip: "Brush" },
      { name: "highlighter", icon: "⚟", tooltip: "Highlighter" },
      { name: "rectangle", icon: "▭", tooltip: "Rectangle" },
      { name: "circle", icon: "◯", tooltip: "Circle" },
      { name: "ellipse", icon: "⬭", tooltip: "Ellipse" },
      { name: "undo", icon: "↩", tooltip: "Undo" },
      { name: "redo", icon: "↪", tooltip: "Redo" },
      { name: "clear", icon: "✕", tooltip: "Clear All" },
    ];

    // Create color picker
    const colorPicker = document.createElement("input");
    colorPicker.type = "color";
    colorPicker.value = this.drawingColor;
    colorPicker.classList.add("apexstock-drawing-color-picker");

    colorPicker.title = "Color";
    colorPicker.addEventListener("input", (e) => {
      this.drawingColor = e.target.value;
    });
    toolbarContainer.appendChild(colorPicker);

    // Create width selector
    const widthSelector = document.createElement("select");
    widthSelector.style.marginRight = "5px";
    widthSelector.style.height = "24px";
    widthSelector.title = "Line Width";
    [1, 2, 3, 5, 8].forEach((width) => {
      const option = document.createElement("option");
      option.value = width;
      option.textContent = width + "px";
      if (width === this.drawingWidth) {
        option.selected = true;
      }
      widthSelector.appendChild(option);
    });
    widthSelector.addEventListener("change", (e) => {
      this.drawingWidth = parseInt(e.target.value);
    });
    toolbarContainer.appendChild(widthSelector);

    // Create tool buttons
    tools.forEach((tool) => {
      const button = document.createElement("button");
      button.className = "apexstock-drawing-tool";
      button.dataset.tool = tool.name;
      button.textContent = tool.icon;
      button.title = tool.tooltip;

      if (
        tool.name === "undo" ||
        tool.name === "redo" ||
        tool.name === "clear"
      ) {
        button.style.marginLeft = tool.name === "undo" ? "10px" : "2px";
      }

      button.addEventListener("click", () => this.handleToolClick(tool.name));
      toolbarContainer.appendChild(button);
    });

    this.chartDiv.parentNode.appendChild(toolbarContainer);
    this.toolbarContainer = toolbarContainer;
  }

  /**
   * Initializes event listeners for drawing
   */
  initEventListeners() {
    this.boundMouseDown = this.handleMouseDown.bind(this);
    this.boundMouseMove = this.handleMouseMove.bind(this);
    this.boundMouseUp = this.handleMouseUp.bind(this);
    this.boundResize = this.handleResize.bind(this);

    // Listen for chart events directly on the SVG overlay
    this.svgOverlay.addEventListener("mousedown", this.boundMouseDown);
    window.addEventListener("mousemove", this.boundMouseMove);
    window.addEventListener("mouseup", this.boundMouseUp);
    window.addEventListener("resize", this.boundResize);

    // Listen for zoom events to update drawings
    if (this.chart.addEventListener) {
      this.chart.addEventListener("zoomed", () => {
        this.redrawElements();
      });

      this.chart.addEventListener("scrolled", () => {
        this.redrawElements();
      });
    }
  }

  /**
   * Handles tool button clicks
   * @param {string} toolName - Name of the tool clicked
   */
  handleToolClick(toolName) {
    console.log("Tool clicked:", toolName);

    if (toolName === "undo") {
      this.undo();
      return;
    } else if (toolName === "redo") {
      this.redo();
      return;
    } else if (toolName === "clear") {
      this.clearAllDrawings();
      return;
    }

    // Highlight the active tool button
    this.toolbarContainer
      .querySelectorAll(".apexstock-drawing-tool")
      .forEach((btn) => {
        if (btn.dataset.tool === toolName) {
          btn.classList.add("active");
        } else if (["undo", "redo", "clear"].indexOf(btn.dataset.tool) === -1) {
          btn.classList.remove("active");
        }
      });

    // Set the current tool
    this.currentTool = toolName;

    // Make sure the SVG overlay allows pointer events ONLY when drawing
    if (this.currentTool) {
      this.svgOverlay.classList.add("active-drawing");
      this.svgOverlay.style.pointerEvents = "all";
    } else {
      this.svgOverlay.classList.remove("active-drawing");
      this.svgOverlay.style.pointerEvents = "none";
    }

    console.log("Current tool set to:", this.currentTool);
  }

  /**
   * Handles mouse down event to start drawing
   * @param {MouseEvent} e - Mouse event
   */
  handleMouseDown(e) {
    if (!this.currentTool) return;

    console.log("Mouse down with tool:", this.currentTool);

    // Get mouse position relative to overlay
    const rect = this.overlayWrapper.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    console.log("Mouse position:", x, y);

    // Convert screen coordinates to chart data coordinates
    const dataPoint = this.screenToData(x, y);
    console.log("Data point:", dataPoint);

    if (!dataPoint) {
      console.log("Invalid data point, using raw coordinates");
      // Fall back to using screen coordinates
      this.isDrawing = true;
      this.startPoint = { x, y, dataX: x, dataY: y };
    } else {
      this.isDrawing = true;
      this.startPoint = { x, y, dataX: dataPoint.x, dataY: dataPoint.y };
    }

    // Create a new element based on the selected tool
    this.createNewElement();

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
   * Handles mouse move event for drawing
   * @param {MouseEvent} e - Mouse event
   */
  handleMouseMove(e) {
    if (!this.isDrawing || !this.currentTool || !this.currentElement) return;

    // Get mouse position relative to overlay
    const rect = this.overlayWrapper.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Convert screen coordinates to chart data coordinates
    const dataPoint = this.screenToData(x, y);

    if (!dataPoint) {
      // Fall back to using screen coordinates
      this.updateElement(x, y, { x, y });
    } else {
      // Update the current element based on the current tool
      this.updateElement(x, y, dataPoint);
    }

    // Only prevent default and stop propagation during actual drawing
    // to avoid interfering with chart zooming/panning
    e.preventDefault();

    // Only stop propagation for specific tools that should block chart interaction
    // For tools like brush/highlighter, we always want to prevent chart zoom/pan
    if (this.currentTool === "brush" || this.currentTool === "highlighter") {
      e.stopPropagation();
    }
  }

  /**
   * Handles mouse up event to finish drawing
   */
  handleMouseUp() {
    if (!this.isDrawing) return;

    this.isDrawing = false;

    if (this.currentElement) {
      // Save the element to undo stack
      this.undoStack.push({
        element: this.currentElement,
        data: this.currentElementData,
      });

      // Clear redo stack when a new element is added
      this.redoStack = [];

      this.elements.push({
        element: this.currentElement,
        data: this.currentElementData,
      });

      this.currentElement = null;
      this.currentElementData = null;

      // Return pointer events to normal state
      this.svgOverlay.classList.remove("active-drawing");
      this.svgOverlay.style.pointerEvents = "none";
    }
  }

  /**
   * Handles window resize to adjust the SVG overlay
   */
  handleResize() {
    // Redraw all elements when the window is resized
    this.redrawElements();
  }

  /**
   * Creates a new SVG element based on the current tool
   */
  createNewElement() {
    let element;

    switch (this.currentTool) {
      case "line":
        element = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "line"
        );
        element.setAttribute("x1", this.startPoint.x);
        element.setAttribute("y1", this.startPoint.y);
        element.setAttribute("x2", this.startPoint.x);
        element.setAttribute("y2", this.startPoint.y);
        element.setAttribute("stroke", this.drawingColor);
        element.setAttribute("stroke-width", this.drawingWidth);
        this.currentElementData = {
          type: "line",
          x1: this.startPoint.dataX,
          y1: this.startPoint.dataY,
          x2: this.startPoint.dataX,
          y2: this.startPoint.dataY,
          color: this.drawingColor,
          width: this.drawingWidth,
        };
        break;

      case "brush":
        element = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "path"
        );
        element.setAttribute(
          "d",
          `M ${this.startPoint.x} ${this.startPoint.y}`
        );
        element.setAttribute("fill", "none");
        element.setAttribute("stroke", this.drawingColor);
        element.setAttribute("stroke-width", this.drawingWidth);
        element.setAttribute("stroke-linecap", "round");
        element.setAttribute("stroke-linejoin", "round");
        this.currentElementData = {
          type: "brush",
          points: [{ x: this.startPoint.dataX, y: this.startPoint.dataY }],
          color: this.drawingColor,
          width: this.drawingWidth,
        };
        break;

      case "highlighter":
        element = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "path"
        );
        element.setAttribute(
          "d",
          `M ${this.startPoint.x} ${this.startPoint.y}`
        );
        element.setAttribute("fill", "none");
        element.setAttribute("stroke", this.drawingColor);
        element.setAttribute("stroke-width", this.drawingWidth * 3);
        element.setAttribute("stroke-linecap", "round");
        element.setAttribute("stroke-linejoin", "round");
        element.setAttribute("stroke-opacity", "0.3");
        this.currentElementData = {
          type: "highlighter",
          points: [{ x: this.startPoint.dataX, y: this.startPoint.dataY }],
          color: this.drawingColor,
          width: this.drawingWidth * 3,
          opacity: 0.3,
        };
        break;

      case "rectangle":
        element = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "rect"
        );
        element.setAttribute("x", this.startPoint.x);
        element.setAttribute("y", this.startPoint.y);
        element.setAttribute("width", "0");
        element.setAttribute("height", "0");
        element.setAttribute("stroke", this.drawingColor);
        element.setAttribute("stroke-width", this.drawingWidth);
        element.setAttribute("fill", "none");
        this.currentElementData = {
          type: "rectangle",
          x: this.startPoint.dataX,
          y: this.startPoint.dataY,
          width: 0,
          height: 0,
          color: this.drawingColor,
          strokeWidth: this.drawingWidth,
        };
        break;

      case "circle":
        element = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "circle"
        );
        element.setAttribute("cx", this.startPoint.x);
        element.setAttribute("cy", this.startPoint.y);
        element.setAttribute("r", "0");
        element.setAttribute("stroke", this.drawingColor);
        element.setAttribute("stroke-width", this.drawingWidth);
        element.setAttribute("fill", "none");
        this.currentElementData = {
          type: "circle",
          cx: this.startPoint.dataX,
          cy: this.startPoint.dataY,
          r: 0,
          color: this.drawingColor,
          strokeWidth: this.drawingWidth,
        };
        break;

      case "ellipse":
        element = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "ellipse"
        );
        element.setAttribute("cx", this.startPoint.x);
        element.setAttribute("cy", this.startPoint.y);
        element.setAttribute("rx", "0");
        element.setAttribute("ry", "0");
        element.setAttribute("stroke", this.drawingColor);
        element.setAttribute("stroke-width", this.drawingWidth);
        element.setAttribute("fill", "none");
        this.currentElementData = {
          type: "ellipse",
          cx: this.startPoint.dataX,
          cy: this.startPoint.dataY,
          rx: 0,
          ry: 0,
          color: this.drawingColor,
          strokeWidth: this.drawingWidth,
        };
        break;
    }

    if (element) {
      this.drawingGroup.appendChild(element);
      this.currentElement = element;
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

        // Calculate data coordinates for the rectangle
        const startPoint = this.screenToData(
          this.startPoint.x,
          this.startPoint.y
        );
        const endPoint = dataPoint;

        this.currentElementData.x = Math.min(startPoint.x, endPoint.x);
        this.currentElementData.y = Math.min(startPoint.y, endPoint.y);
        this.currentElementData.width = Math.abs(endPoint.x - startPoint.x);
        this.currentElementData.height = Math.abs(endPoint.y - startPoint.y);
        break;

      case "circle":
        const dx = x - this.startPoint.x;
        const dy = y - this.startPoint.y;
        const radius = Math.sqrt(dx * dx + dy * dy);
        this.currentElement.setAttribute("r", radius);

        // Calculate data space radius
        const startDataPoint = this.screenToData(
          this.startPoint.x,
          this.startPoint.y
        );
        const dataRadius = Math.sqrt(
          Math.pow(dataPoint.x - startDataPoint.x, 2) +
            Math.pow(dataPoint.y - startDataPoint.y, 2)
        );
        this.currentElementData.r = dataRadius;
        break;

      case "ellipse":
        const rx = Math.abs(x - this.startPoint.x);
        const ry = Math.abs(y - this.startPoint.y);
        this.currentElement.setAttribute("rx", rx);
        this.currentElement.setAttribute("ry", ry);

        // Calculate data space radii
        const startDataPoint2 = this.screenToData(
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
   * Converts screen coordinates to data coordinates
   * @param {number} x - Screen x coordinate
   * @param {number} y - Screen y coordinate
   * @returns {Object|null} - Data coordinates or null if outside chart
   */
  screenToData(x, y) {
    try {
      // Get chart dimensions
      const chartRect = this.chartDiv.getBoundingClientRect();

      // Get chart axes min/max values
      let xaxis, xaxisMax, yaxis, yaxisMax;

      // Handle potential missing properties gracefully
      try {
        xaxis = this.chart.w.globals.minX;
        xaxisMax = this.chart.w.globals.maxX;
        yaxis = this.chart.w.globals.minY;
        yaxisMax = this.chart.w.globals.maxY;
      } catch (err) {
        console.warn("Could not access chart axis values:", err);
        // Fallback to arbitrary values if chart values aren't available
        return { x, y };
      }

      // Get chart margins - these might not be available in all versions/states
      let leftMargin, translateY, gridWidth, gridHeight;

      try {
        leftMargin = this.chart.w.globals.translateX;
        translateY = this.chart.w.globals.translateY;
        gridWidth = this.chart.w.globals.gridWidth;
        gridHeight = this.chart.w.globals.gridHeight;
      } catch (err) {
        console.warn("Could not access chart grid values:", err);
        // If we can't get the chart's internal dimensions, use the element dimensions
        leftMargin = 0;
        translateY = 0;
        gridWidth = chartRect.width;
        gridHeight = chartRect.height;
      }

      // If any values are still undefined, use fallbacks
      if (leftMargin === undefined || isNaN(leftMargin)) leftMargin = 60; // typical margin
      if (translateY === undefined || isNaN(translateY)) translateY = 20;
      if (gridWidth === undefined || isNaN(gridWidth))
        gridWidth = chartRect.width - leftMargin;
      if (gridHeight === undefined || isNaN(gridHeight))
        gridHeight = chartRect.height - translateY;

      // Convert screen coordinates to data coordinates
      const xRatio = (x - leftMargin) / gridWidth;
      const yRatio = (y - translateY) / gridHeight;

      const dataX = xaxis + (xaxisMax - xaxis) * xRatio;
      const dataY = yaxisMax - (yaxisMax - yaxis) * yRatio;

      // Validate output
      if (isNaN(dataX) || isNaN(dataY)) {
        console.warn("Invalid data coordinates calculated:", dataX, dataY);
        return { x, y }; // fallback to screen coordinates
      }

      return { x: dataX, y: dataY };
    } catch (err) {
      console.error("Error converting screen to data coordinates:", err);
      // Return the screen coordinates as fallback
      return { x, y };
    }
  }

  /**
   * Converts data coordinates to screen coordinates
   * @param {number} dataX - Data x coordinate
   * @param {number} dataY - Data y coordinate
   * @returns {Object} - Screen coordinates
   */
  dataToScreen(dataX, dataY) {
    try {
      // Get chart dimensions
      const chartRect = this.chartDiv.getBoundingClientRect();

      // Get chart axes min/max values
      let xaxis, xaxisMax, yaxis, yaxisMax;

      // Handle potential missing properties gracefully
      try {
        xaxis = this.chart.w.globals.minX;
        xaxisMax = this.chart.w.globals.maxX;
        yaxis = this.chart.w.globals.minY;
        yaxisMax = this.chart.w.globals.maxY;
      } catch (err) {
        console.warn("Could not access chart axis values:", err);
        // If we can't get the chart's internal values, just return the data values
        return { x: dataX, y: dataY };
      }

      // Get chart margins - these might not be available in all versions/states
      let leftMargin, translateY, gridWidth, gridHeight;

      try {
        leftMargin = this.chart.w.globals.translateX;
        translateY = this.chart.w.globals.translateY;
        gridWidth = this.chart.w.globals.gridWidth;
        gridHeight = this.chart.w.globals.gridHeight;
      } catch (err) {
        console.warn("Could not access chart grid values:", err);
        // If we can't get the chart's internal dimensions, use the element dimensions
        leftMargin = 0;
        translateY = 0;
        gridWidth = chartRect.width;
        gridHeight = chartRect.height;
      }

      // If any values are still undefined, use fallbacks
      if (leftMargin === undefined || isNaN(leftMargin)) leftMargin = 60; // typical margin
      if (translateY === undefined || isNaN(translateY)) translateY = 20;
      if (gridWidth === undefined || isNaN(gridWidth))
        gridWidth = chartRect.width - leftMargin;
      if (gridHeight === undefined || isNaN(gridHeight))
        gridHeight = chartRect.height - translateY;

      // Convert data coordinates to screen coordinates
      const xRatio = (dataX - xaxis) / (xaxisMax - xaxis);
      const yRatio = (yaxisMax - dataY) / (yaxisMax - yaxis);

      const screenX = leftMargin + gridWidth * xRatio;
      const screenY = translateY + gridHeight * yRatio;

      // Validate output
      if (isNaN(screenX) || isNaN(screenY)) {
        console.warn(
          "Invalid screen coordinates calculated:",
          screenX,
          screenY
        );
        return { x: dataX, y: dataY }; // fallback to data coordinates
      }

      return { x: screenX, y: screenY };
    } catch (err) {
      console.error("Error converting data to screen coordinates:", err);
      // In case of any error, return the data coordinates
      return { x: dataX, y: dataY };
    }
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
          const start = this.dataToScreen(data.x1, data.y1);
          const end = this.dataToScreen(data.x2, data.y2);
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
            const screenPoint = this.dataToScreen(point.x, point.y);
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
          const rectTopLeft = this.dataToScreen(data.x, data.y);
          const rectBottomRight = this.dataToScreen(
            data.x + data.width,
            data.y + data.height
          );
          element.setAttribute("x", rectTopLeft.x);
          element.setAttribute("y", rectTopLeft.y);
          element.setAttribute("width", rectBottomRight.x - rectTopLeft.x);
          element.setAttribute("height", rectBottomRight.y - rectTopLeft.y);
          element.setAttribute("stroke", data.color);
          element.setAttribute("stroke-width", data.strokeWidth);
          element.setAttribute("fill", "none");
          break;

        case "circle":
          element = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "circle"
          );
          const center = this.dataToScreen(data.cx, data.cy);

          // Calculate screen radius based on a point at distance r from center
          const radiusPoint = this.dataToScreen(data.cx + data.r, data.cy);
          const screenRadius = Math.abs(radiusPoint.x - center.x);

          element.setAttribute("cx", center.x);
          element.setAttribute("cy", center.y);
          element.setAttribute("r", screenRadius);
          element.setAttribute("stroke", data.color);
          element.setAttribute("stroke-width", data.strokeWidth);
          element.setAttribute("fill", "none");
          break;

        case "ellipse":
          element = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "ellipse"
          );
          const ellipseCenter = this.dataToScreen(data.cx, data.cy);

          // Calculate screen radii
          const rxPoint = this.dataToScreen(data.cx + data.rx, data.cy);
          const ryPoint = this.dataToScreen(data.cx, data.cy + data.ry);
          const screenRx = Math.abs(rxPoint.x - ellipseCenter.x);
          const screenRy = Math.abs(ryPoint.y - ellipseCenter.y);

          element.setAttribute("cx", ellipseCenter.x);
          element.setAttribute("cy", ellipseCenter.y);
          element.setAttribute("rx", screenRx);
          element.setAttribute("ry", screenRy);
          element.setAttribute("stroke", data.color);
          element.setAttribute("stroke-width", data.strokeWidth);
          element.setAttribute("fill", "none");
          break;
      }

      if (element) {
        this.drawingGroup.appendChild(element);
        // Update the element reference in the elements array
        item.element = element;
      }
    });
  }

  /**
   * Undo the last drawing action
   */
  undo() {
    if (this.undoStack.length === 0) return;

    const lastElement = this.undoStack.pop();
    this.redoStack.push(lastElement);

    // Remove the element from the elements array
    const index = this.elements.findIndex(
      (item) => item.element === lastElement.element
    );
    if (index !== -1) {
      this.elements.splice(index, 1);
    }

    // Redraw all elements
    this.redrawElements();
  }

  /**
   * Redo the last undone drawing action
   */
  redo() {
    if (this.redoStack.length === 0) return;

    const elementToRedo = this.redoStack.pop();
    this.undoStack.push(elementToRedo);

    // Add the element back to the elements array
    this.elements.push(elementToRedo);

    // Redraw all elements
    this.redrawElements();
  }

  /**
   * Clear all drawings
   */
  clearAllDrawings() {
    // Add current elements to undo stack before clearing
    this.undoStack.push(...this.elements);

    // Clear the elements array
    this.elements = [];

    // Clear the drawing group
    while (this.drawingGroup.firstChild) {
      this.drawingGroup.removeChild(this.drawingGroup.firstChild);
    }

    // Clear redo stack
    this.redoStack = [];
  }

  /**
   * Clean up event listeners and resources
   */
  destroy() {
    this.svgOverlay.removeEventListener("mousedown", this.boundMouseDown);
    window.removeEventListener("mousemove", this.boundMouseMove);
    window.removeEventListener("mouseup", this.boundMouseUp);
    window.removeEventListener("resize", this.boundResize);
    window.removeEventListener("resize", this.syncOverlayPosition);

    // Clear any intervals
    if (this.intervalId) {
      clearInterval(this.intervalId);
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

export default Drawing;
