// DrawingElementFactory.js - Factory for creating different drawing elements
class DrawingElementFactory {
  /**
   * @param {Object} startPoint - Starting point coordinates
   * @param {string} color - Drawing color
   * @param {number} width - Drawing width
   */
  constructor(startPoint, color, width) {
    this.startPoint = startPoint;
    this.color = color;
    this.width = width;
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

    const data = {
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

    const data = {
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

    const data = {
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
    element.setAttribute("fill", "none");

    const data = {
      type: "rectangle",
      x: this.startPoint.dataX,
      y: this.startPoint.dataY,
      width: 0,
      height: 0,
      color: this.color,
      strokeWidth: this.width,
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
    element.setAttribute("fill", "none");

    const data = {
      type: "circle",
      cx: this.startPoint.dataX,
      cy: this.startPoint.dataY,
      r: 0,
      color: this.color,
      strokeWidth: this.width,
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
    element.setAttribute("fill", "none");

    const data = {
      type: "ellipse",
      cx: this.startPoint.dataX,
      cy: this.startPoint.dataY,
      rx: 0,
      ry: 0,
      color: this.color,
      strokeWidth: this.width,
    };

    return { element, data };
  }
}

export default DrawingElementFactory;
