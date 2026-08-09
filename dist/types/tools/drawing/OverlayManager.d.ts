export default OverlayManager;
declare class OverlayManager {
    /**
     * @param {HTMLElement} chartDiv - The chart container element
     */
    constructor(chartDiv: HTMLElement);
    chartDiv: HTMLElement;
    overlayWrapper: HTMLDivElement;
    svgOverlay: SVGSVGElement;
    defs: SVGDefsElement;
    drawingGroup: SVGGElement;
    /**
     * Sets up the SVG overlay for drawing
     */
    setupSVGOverlay(): void;
    _boundResize: () => void;
    /** Remove the resize listener and detach the overlay wrapper from the DOM. */
    destroy(): void;
    /**
     * Synchronizes the overlay position with the chart
     */
    syncOverlayPosition(): void;
}
