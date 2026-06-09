export default class ElementInteractionManager {
    /**
     * @param {HTMLElement} chartEl - The chart container element
     * @param {SVGElement} svgOverlay - The SVG overlay element
     * @param {SVGElement} drawingGroup - The group containing all drawing elements
     * @param {Array} elements - Reference to the array of drawing elements
     * @param {Function} redrawElements - Function to redraw all elements
     * @param {Object} coordinateConverter - The coordinate converter utility
     */
    constructor(chartEl: HTMLElement, svgOverlay: SVGElement, drawingGroup: SVGElement, elements: any[], redrawElements: Function, coordinateConverter: any);
    chartEl: HTMLElement;
    svgOverlay: SVGElement;
    drawingGroup: SVGElement;
    elements: any[];
    redrawElements: Function;
    coordinateConverter: any;
    hoveredElement: EventTarget;
    hoveredElementId: any;
    selectedElement: EventTarget;
    selectedElementId: any;
    isMoving: boolean;
    moveStartX: number;
    moveStartY: number;
    elementStartX: number;
    elementStartY: number;
    activeElementForDrag: EventTarget;
    hoverOutline: SVGRectElement;
    selectionOutline: SVGRectElement;
    elementPopup: SelectedElementPopup;
    /**
     * Handle element mouse over event
     * @param {MouseEvent} e - Mouse event
     */
    handleElementMouseOver(e: MouseEvent): void;
    /**
     * Handle element mouse out event
     */
    handleElementMouseOut(): void;
    /**
     * Handle element click to select an element
     * @param {MouseEvent} e - Mouse event
     */
    handleElementClick(e: MouseEvent): void;
    /**
     * Handle direct mousedown on element for immediate dragging
     * @param {MouseEvent} e - Mouse event
     */
    handleElementMouseDown(e: MouseEvent): void;
    /**
     * Handle mouse down for moving elements
     * @param {MouseEvent} e - Mouse event
     */
    handleMouseDown(e: MouseEvent): void;
    /**
     * Handle mouse move for moving elements
     * @param {MouseEvent} e - Mouse event
     */
    handleMouseMove(e: MouseEvent): void;
    /**
     * Handle mouse up to finish moving
     * @param {MouseEvent} e - Mouse event
     */
    handleMouseUp(e: MouseEvent): void;
    /**
     * Handle key down events (for delete)
     * @param {KeyboardEvent} e - Keyboard event
     */
    handleKeyDown(e: KeyboardEvent): void;
    /**
     * Delete the currently selected element
     */
    deleteSelectedElement(): void;
    /**
     * Ensures all elements in the elements array have unique IDs
     */
    ensureElementIds(): void;
    /**
     * Finds an element in the elements array by ID
     * @param {string} id - The element ID to find
     * @returns {Object|null} - The element object or null if not found
     */
    getElementById(id: string): any | null;
    /**
     * Finds the index of an element in the elements array by ID
     * @param {string} id - The element ID to find
     * @returns {number} - The element index or -1 if not found
     */
    getElementIndexById(id: string): number;
    /**
     * Creates visual elements for hover and selection feedback
     */
    createVisualElements(): void;
    /**
     * Attach event listeners
     */
    attachEventListeners(): void;
    /**
     * Activate interaction for all drawing elements
     */
    activateInteraction(): void;
    /**
     * Deactivate interaction mode
     */
    deactivateInteraction(): void;
    /**
     * Update the hover outline around the hovered element
     */
    updateHoverOutline(): void;
    /**
     * Clear the current hover state
     */
    clearHover(): void;
    /**
     * Update the selection outline around the selected element
     */
    updateSelectionOutline(): void;
    /**
     * Clear the current selection
     */
    clearSelection(): void;
    /**
     * Store the starting position of the element based on its type
     * @param {Object} elementData - Data of the selected element
     */
    storeElementStartPosition(elementData: any): void;
    elementStartX2: any;
    elementStartY2: any;
    elementStartDataX: any;
    elementStartDataY: any;
    elementStartPoints: any;
    /**
     * Move the selected element based on its type
     * @param {Object} elementData - The element data to update
     * @param {number} dataSpaceDeltaX - X change in data space
     * @param {number} dataSpaceDeltaY - Y change in data space
     * @param {number} screenDeltaX - X change in screen space
     * @param {number} screenDeltaY - Y change in screen space
     */
    moveElement(elementData: any, dataSpaceDeltaX: number, dataSpaceDeltaY: number, screenDeltaX: number, screenDeltaY: number): void;
    /**
     * Update event listeners after elements array changes
     */
    updateElementEventListeners(): void;
    /**
     * Clean up event listeners and resources
     */
    destroy(): void;
}
import SelectedElementPopup from "../components/SelectedElementPopup";
