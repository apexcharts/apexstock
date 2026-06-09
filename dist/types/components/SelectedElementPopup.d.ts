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
     * Hides the popup
     */
    hide(): void;
    /**
     * Destroys the popup and removes event listeners
     */
    destroy(): void;
}
