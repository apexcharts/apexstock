export default DrawingElementFactory;
declare class DrawingElementFactory {
    constructor(startPoint: any, color: any, width: any);
    startPoint: any;
    color: any;
    width: any;
    fillColor: string;
    fillOpacity: number;
    /**
     * Sets the fill color for shapes
     * @param {string} color - Fill color
     */
    setFillColor(color: string): this;
    /**
     * Sets the fill opacity for shapes
     * @param {number} opacity - Fill opacity (0-1)
     */
    setFillOpacity(opacity: number): this;
    /**
     * Creates a new SVG element based on the specified tool
     * @param {string} toolType - Type of drawing tool
     * @returns {Object|null} - The created element and its data
     */
    createElement(toolType: string): any | null;
    /**
     * Creates a line element
     * @returns {Object} - The line element and its data
     */
    createLine(): any;
    /**
     * Creates a brush element
     * @returns {Object} - The brush element and its data
     */
    createBrush(): any;
    /**
     * Creates a highlighter element
     * @returns {Object} - The highlighter element and its data
     */
    createHighlighter(): any;
    /**
     * Creates a rectangle element
     * @returns {Object} - The rectangle element and its data
     */
    createRectangle(): any;
    /**
     * Creates a circle element
     * @returns {Object} - The circle element and its data
     */
    createCircle(): any;
    /**
     * Creates an ellipse element
     * @returns {Object} - The ellipse element and its data
     */
    createEllipse(): any;
}
