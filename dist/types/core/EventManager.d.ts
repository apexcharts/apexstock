export default EventManager;
declare class EventManager {
    /**
     * @param {ApexCharts} chart - The ApexCharts instance
     * @param {HTMLElement} chartDiv - The chart container element
     * @param {SVGElement} svgOverlay - The SVG overlay element
     * @param {Function} mouseDownHandler - Handler for mouse down events
     * @param {Function} mouseMoveHandler - Handler for mouse move events
     * @param {Function} mouseUpHandler - Handler for mouse up events
     * @param {Function} resizeHandler - Handler for resize events
     * @param {Function} wheelHandler - Handler for wheel events
     * @param {Function} redrawHandler - Handler for redrawing elements
     * @param {Function} syncOverlayPosition - Function to sync overlay position
     */
    constructor(chart: any, chartDiv: HTMLElement, svgOverlay: SVGElement, mouseDownHandler: Function, mouseMoveHandler: Function, mouseUpHandler: Function, resizeHandler: Function, wheelHandler: Function, redrawHandler: Function, syncOverlayPosition: Function);
    chart: any;
    chartDiv: HTMLElement;
    svgOverlay: SVGElement;
    syncOverlayPosition: Function;
    boundMouseDown: Function;
    boundMouseMove: Function;
    boundMouseUp: Function;
    boundResize: Function;
    boundWheelEvent: Function;
    redrawElements: Function;
    /**
     * Initializes event listeners for drawing
     */
    initEventListeners(): void;
    /**
     * Sets up listeners for chart events to sync overlay and redraw elements
     */
    listenForChartEvents(): void;
    mutationObserver: MutationObserver;
    /**
     * Clean up event listeners and resources
     */
    destroy(): void;
}
