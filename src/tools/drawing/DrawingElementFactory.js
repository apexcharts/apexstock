import Utils from "../../utils/Utils";

// DrawingElementFactory.js - Factory for creating different drawing elements
class DrawingElementFactory {
  constructor(startPoint, color, width) {
    this.startPoint = startPoint;
    this.color = color;
    this.width = width;
    this.fillColor = "#ffffff"; // Default fill color
    this.fillOpacity = 0.5; // Default fill opacity
  }

  /**
   * Sets the fill color for shapes
   * @param {string} color - Fill color
   */
  setFillColor(color) {
    this.fillColor = color;
    return this;
  }

  /**
   * Sets the fill opacity for shapes
   * @param {number} opacity - Fill opacity (0-1)
   */
  setFillOpacity(opacity) {
    this.fillOpacity = opacity;
    return this;
  }

  /**
   * Creates a new SVG element based on the specified tool
   * @param {string} toolType - Type of drawing tool
   * @returns {Object|null} - The created element and its data
   */
  createElement(toolType) {
    switch (toolType) {
      case "line":
        return this.createLine();
      case "brush":
        return this.createBrush();
      case "highlighter":
        return this.createHighlighter();
      case "rectangle":
        return this.createRectangle();
      case "circle":
        return this.createCircle();
      case "ellipse":
        return this.createEllipse();
      // Text is now handled by TextAnnotationManager
      default:
        return null;
    }
  }

  /**
   * Creates a line element
   * @returns {Object} - The line element and its data
   */
  createLine() {
    const element = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "line"
    );
    element.setAttribute("x1", this.startPoint.x);
    element.setAttribute("y1", this.startPoint.y);
    element.setAttribute("x2", this.startPoint.x);
    element.setAttribute("y2", this.startPoint.y);
    element.setAttribute("stroke", this.color);
    element.setAttribute("stroke-width", this.width);

    const id = Utils.generateUniqueId("line");
    element.dataset.elementId = id;

    const data = {
      id,
      type: "line",
      x1: this.startPoint.dataX,
      y1: this.startPoint.dataY,
      x2: this.startPoint.dataX,
      y2: this.startPoint.dataY,
      color: this.color,
      width: this.width,
    };

    return { element, data };
  }

  /**
   * Creates a brush element
   * @returns {Object} - The brush element and its data
   */
  createBrush() {
    const element = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "path"
    );
    element.setAttribute("d", `M ${this.startPoint.x} ${this.startPoint.y}`);
    element.setAttribute("fill", "none");
    element.setAttribute("stroke", this.color);
    element.setAttribute("stroke-width", this.width);
    element.setAttribute("stroke-linecap", "round");
    element.setAttribute("stroke-linejoin", "round");

    const id = Utils.generateUniqueId("brush");
    element.dataset.elementId = id;

    const data = {
      id,
      type: "brush",
      points: [{ x: this.startPoint.dataX, y: this.startPoint.dataY }],
      color: this.color,
      width: this.width,
    };

    return { element, data };
  }

  /**
   * Creates a highlighter element
   * @returns {Object} - The highlighter element and its data
   */
  createHighlighter() {
    const element = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "path"
    );
    element.setAttribute("d", `M ${this.startPoint.x} ${this.startPoint.y}`);
    element.setAttribute("fill", "none");
    element.setAttribute("stroke", this.color);
    element.setAttribute("stroke-width", this.width * 3);
    element.setAttribute("stroke-linecap", "round");
    element.setAttribute("stroke-linejoin", "round");
    element.setAttribute("stroke-opacity", "0.3");

    const id = Utils.generateUniqueId("highlighter");
    element.dataset.elementId = id;

    const data = {
      id,
      type: "highlighter",
      points: [{ x: this.startPoint.dataX, y: this.startPoint.dataY }],
      color: this.color,
      width: this.width * 3,
      opacity: 0.3,
    };

    return { element, data };
  }

  /**
   * Creates a rectangle element
   * @returns {Object} - The rectangle element and its data
   */
  createRectangle() {
    const element = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "rect"
    );
    element.setAttribute("x", this.startPoint.x);
    element.setAttribute("y", this.startPoint.y);
    element.setAttribute("width", "0");
    element.setAttribute("height", "0");
    element.setAttribute("stroke", this.color);
    element.setAttribute("stroke-width", this.width);
    element.setAttribute("fill", this.fillColor);
    element.setAttribute("fill-opacity", this.fillOpacity);

    const id = Utils.generateUniqueId("rectangle");
    element.dataset.elementId = id;

    const data = {
      id,
      type: "rectangle",
      x: this.startPoint.dataX,
      y: this.startPoint.dataY,
      width: 0,
      height: 0,
      color: this.color,
      strokeWidth: this.width,
      fill: this.fillColor,
      fillOpacity: this.fillOpacity,
    };

    return { element, data };
  }

  /**
   * Creates a circle element
   * @returns {Object} - The circle element and its data
   */
  createCircle() {
    const element = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "circle"
    );
    element.setAttribute("cx", this.startPoint.x);
    element.setAttribute("cy", this.startPoint.y);
    element.setAttribute("r", "0");
    element.setAttribute("stroke", this.color);
    element.setAttribute("stroke-width", this.width);
    element.setAttribute("fill", this.fillColor);
    element.setAttribute("fill-opacity", this.fillOpacity);

    const id = Utils.generateUniqueId("circle");
    element.dataset.elementId = id;

    const data = {
      id,
      type: "circle",
      cx: this.startPoint.dataX,
      cy: this.startPoint.dataY,
      r: 0,
      color: this.color,
      strokeWidth: this.width,
      fill: this.fillColor,
      fillOpacity: this.fillOpacity,
    };

    return { element, data };
  }

  /**
   * Creates an ellipse element
   * @returns {Object} - The ellipse element and its data
   */
  createEllipse() {
    const element = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "ellipse"
    );
    element.setAttribute("cx", this.startPoint.x);
    element.setAttribute("cy", this.startPoint.y);
    element.setAttribute("rx", "0");
    element.setAttribute("ry", "0");
    element.setAttribute("stroke", this.color);
    element.setAttribute("stroke-width", this.width);
    element.setAttribute("fill", this.fillColor);
    element.setAttribute("fill-opacity", this.fillOpacity);

    const id = Utils.generateUniqueId("ellipse");
    element.dataset.elementId = id;

    const data = {
      id,
      type: "ellipse",
      cx: this.startPoint.dataX,
      cy: this.startPoint.dataY,
      rx: 0,
      ry: 0,
      color: this.color,
      strokeWidth: this.width,
      fill: this.fillColor,
      fillOpacity: this.fillOpacity,
    };

    return { element, data };
  }
}

export default DrawingElementFactory;
