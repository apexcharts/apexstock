export default TextAnnotationManager;
declare class TextAnnotationManager {
    /**
     * @param {HTMLElement} chartDiv - The chart container element
     * @param {SVGElement} svgOverlay - The SVG overlay element
     * @param {Object} coordinateConverter - The coordinate converter utility
     * @param {Function} onTextCreated - Callback when text is created
     */
    constructor(chartDiv: HTMLElement, svgOverlay: SVGElement, coordinateConverter: any, onTextCreated: Function);
    svgOverlay: SVGElement;
    chartDiv: HTMLElement;
    coordinateConverter: any;
    onTextCreated: Function;
    isEditing: boolean;
    clickX: number;
    clickY: number;
    currentGroup: SVGGElement;
    currentData: {
        fontSize: number;
        fontFamily: string;
        fontWeight: string;
        fontStyle: string;
        textDecoration: string;
        color: string;
        backgroundColor: string;
        backgroundOpacity: number;
        id: string;
        type: string;
        x: any;
        y: any;
        clickX: number;
        clickY: number;
        text: string;
    };
    editor: HTMLDivElement;
    toolbar: HTMLDivElement;
    textStyle: {
        fontSize: number;
        fontFamily: string;
        fontWeight: string;
        fontStyle: string;
        textDecoration: string;
        color: string;
        backgroundColor: string;
        backgroundOpacity: number;
    };
    /**
     * Handle clicks outside the editor
     * @param {MouseEvent} e - Mouse event
     */
    handleOutsideClick(e: MouseEvent): void;
    /**
     * Creates a new text annotation at the specified position
     * @param {number} x - Screen x coordinate
     * @param {number} y - Screen y coordinate
     * @param {Object} dataPoint - Data coordinates
     * @param {string} color - Text color
     * @returns {Object} - Created element and data
     */
    createTextAnnotation(x: number, y: number, dataPoint: any, color: string): any;
    /**
     * Creates the formatting toolbar
     */
    createToolbar(): void;
    /**
     * Start editing a text annotation
     */
    startEditing(): void;
    /**
     * Display the formatting toolbar
     * @param {number} x - Screen X position
     * @param {number} y - Screen Y position
     */
    showToolbar(x: number, y: number): void;
    /**
     * Finish editing and commit the text annotation
     */
    finishEditing(): void;
    /**
     * Create the SVG text element from the edited content
     */
    createSvgText(): void;
    /**
     * Cancel editing and discard changes
     */
    cancelEditing(): void;
    /**
     * Clean up UI elements after editing
     */
    cleanup(): void;
    /**
     * Toggle a style property between two values
     * @param {string} property - Style property to toggle
     * @param {*} value1 - First possible value
     * @param {*} value2 - Second possible value
     */
    toggleStyle(property: string, value1: any, value2: any): void;
    /**
     * Set a style property to a specific value
     * @param {string} property - Style property to set
     * @param {*} value - Value to set
     */
    setStyle(property: string, value: any): void;
    /**
     * Redraw a text element based on its data
     * @param {Object} data - The text annotation data
     * @returns {SVGElement} - The redrawn text element
     */
    redrawTextElement(data: any): SVGElement;
    /**
     * Clean up resources
     */
    destroy(): void;
}
