export default class TooltipAnnotationManager {
    /**
     * @param {HTMLElement} chartDiv - The chart container element
     * @param {SVGElement} svgOverlay - The SVG overlay element
     * @param {Object} coordinateConverter - The coordinate converter utility
     * @param {Function} onTooltipCreated - Callback when a tooltip is created
     */
    constructor(chartDiv: HTMLElement, svgOverlay: SVGElement, coordinateConverter: any, onTooltipCreated: Function);
    chartDiv: HTMLElement;
    svgOverlay: SVGElement;
    coordinateConverter: any;
    onTooltipCreated: Function;
    tooltipElements: Map<any, any>;
    /**
     * Creates a tooltip annotation from an existing tooltip
     * @param {HTMLElement} originalTooltip - The original tooltip element to clone
     * @param {number} x - Screen X coordinate
     * @param {number} y - Screen Y coordinate
     * @param {Object} dataPoint - The data point information
     * @returns {Object} - The created tooltip element and its data
     */
    createTooltipAnnotation(originalTooltip: HTMLElement, x: number, y: number, dataPoint: any): any;
    /**
     * Creates SVG elements for the tooltip
     * @param {SVGElement} group - The group element to add tooltip elements to
     * @param {Object} data - The tooltip data
     */
    createSvgTooltip(group: SVGElement, data: any): void;
    /**
     * Redraws a tooltip element based on its data coordinates
     * @param {Object} data - The tooltip data
     * @returns {SVGElement} - The redrawn tooltip element
     */
    redrawTooltipElement(data: any): SVGElement;
    /**
     * Updates the position of a tooltip based on chart changes
     * @param {string} id - The tooltip ID
     * @returns {boolean} - Whether the update was successful
     */
    updateTooltipPosition(id: string): boolean;
    /**
     * Extract tooltip data from a tooltip element
     * @param {SVGElement} element - The tooltip element
     * @returns {Object|null} - The tooltip data or null if not found
     */
    getTooltipDataFromElement(element: SVGElement): any | null;
    /**
     * Removes a tooltip from the DOM
     * @param {SVGElement} element - The tooltip element to remove
     * @param {string} [id] - Optional tooltip ID to ensure exact match
     */
    removeTooltip(element: SVGElement, id?: string): void;
    /**
     * Removes a tooltip by its unique ID
     * @param {string} id - The tooltip's unique ID
     * @returns {boolean} - Whether the tooltip was found and removed
     */
    removeTooltipById(id: string): boolean;
    /**
     * Clean up all tooltips
     */
    cleanup(): void;
    /**
     * Clean up resources
     */
    destroy(): void;
}
