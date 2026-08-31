export default SelectedElementPopup;
declare class SelectedElementPopup {
    /**
     * Creates a popup menu for interacting with selected elements
     * @param {HTMLElement} chartDiv - The chart container element
     * @param {Function} deleteCallback - Callback function when delete is clicked
     * @param {Function} styleChangeCallback - Callback function when styles are changed
     */
    constructor(chartDiv: HTMLElement, deleteCallback: Function, styleChangeCallback: Function);
    chartDiv: HTMLElement;
    deleteCallback: Function;
    styleChangeCallback: Function;
    popupElement: HTMLDivElement;
    currentElement: any;
    currentElementData: any;
    strokeColorPicker: HTMLInputElement;
    fillColorPicker: HTMLInputElement;
    fillOpacitySlider: HTMLInputElement;
    isDarkTheme: boolean;
    /**
     * Creates the popup DOM element
     */
    createPopup(): void;
    _boundOutsideMouseDown: (e: any) => void;
    /**
     * Configure the popup based on element type
     * @param {Object} elementData - Data of the selected element
     */
    configureForElement(elementData: any): void;
    /**
     * Shows the popup at the specified position
     * @param {number} x - X coordinate for popup (in client coordinates)
     * @param {number} y - Y coordinate for popup (in client coordinates)
     * @param {Object} element - The selected element
     * @param {Object} elementData - The element data
     */
    show(x: number, y: number, element: any, elementData: any): void;
    /**
     * Position the popup so it does not sit on top of the element it belongs to.
     *
     * The popup is ~220px wide and the pointer that opened it is usually ON the
     * drawing, so anchoring at the pointer covered the selection: styling
     * controls landed over the drawing's own resize handles and swallowed the
     * clicks meant for them. Tries below, above, right, then left of the
     * element's box, taking the first that fits inside the chart; if none does,
     * falls back to the roomiest side and clamps.
     *
     * @param {DOMRect} bbox - The selected element's client rect.
     * @param {DOMRect} chartRect - The chart container's client rect.
     * @param {DOMRect} popupRect - The popup's own client rect.
     * @returns {{left: number, top: number}} Chart-relative position.
     */
    placeClearOf(bbox: DOMRect, chartRect: DOMRect, popupRect: DOMRect): {
        left: number;
        top: number;
    };
    /**
     * The pointer-anchored placement, used when there is no element to measure.
     * @param {number} x @param {number} y
     * @param {DOMRect} chartRect @param {DOMRect} popupRect
     * @returns {{left: number, top: number}} Chart-relative position.
     */
    placeAtPointer(x: number, y: number, chartRect: DOMRect, popupRect: DOMRect): {
        left: number;
        top: number;
    };
    /** Keep a position inside the chart container. @private */
    private clamp;
    /**
     * Hides the popup
     */
    hide(): void;
    /**
     * Destroys the popup and removes event listeners
     */
    destroy(): void;
}
