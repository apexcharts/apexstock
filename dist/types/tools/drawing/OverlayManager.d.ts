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
    /**
     * Synchronizes the overlay position with the chart
     */
    syncOverlayPosition(): void;
}
