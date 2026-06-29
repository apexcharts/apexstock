/**
 * Custom X-Axis component for ApexStock
 * Provides a customizable time-based X-axis that adapts to different zoom levels
 */
export default class XAxis {
    /**
     * Creates a new XAxis instance
     * @param {import("../ApexStock.js").default} context - The ApexStock instance
     */
    constructor(context: import("../ApexStock.js").default);
    context: import("../ApexStock.js").default;
    axisElement: HTMLDivElement;
    ticksContainer: HTMLDivElement;
    tooltipElement: HTMLDivElement;
    resizeObserver: ResizeObserver;
    mouseTracker: any;
    isPanning: boolean;
    /**
     * Set up listeners for window resize and chart container size changes
     */
    setupResizeListener(): void;
    /**
     * Sets up mouse tracking for the tooltip
     */
    setupMouseTracking(): void;
    /**
     * Handles mouse movement and updates tooltip position and content
     * @param {MouseEvent} e - Mouse event
     */
    handleMouseMove(e: MouseEvent): void;
    handleMouseLeave(): void;
    handleMouseDown(e: any): void;
    handleMouseUp(e: any): void;
    /**
     * Updates event listeners for all charts when indicators change
     * This method should be called whenever indicators are added or removed
     */
    updateEventListeners(): void;
    _listenerTargets: any[];
    /**
     * Removes all event listeners from main chart and indicator charts
     */
    removeAllEventListeners(): void;
    /**
     * Finds the data point index that the user is currently hovering over
     * @param {number} relativePercent - Mouse position as percentage of chart width
     * @returns {number|null} - Data point index or null if not found
     */
    findNearestDataPointIndex(relativePercent: number): number | null;
    /**
     * Gets the timestamp for a data point
     * @param {number} index - Data point index
     * @returns {number} - Timestamp in milliseconds
     */
    getDataPointTimestamp(index: number): number;
    /**
     * Creates the DOM elements for the x-axis
     */
    createAxisElement(): void;
    /**
     * Updates the position and width of the X-axis to align with the chart area
     */
    updatePosition(): void;
    ensureXAxisIsLast(): void;
    /**
     * Determines the appropriate tick interval based on the current range
     * @returns {Object} The tick interval and format information
     */
    getTickInterval(): any;
    /**
     * Formats a date according to the specified format
     * @param {Date} date - The date to format
     * @param {string} format - The format string
     * @returns {string} The formatted date string
     */
    formatDate(date: Date, format: string): string;
    /**
     * Calculates tick positions and values
     * @returns {Array} Array of tick objects with position and label
     */
    calculateTicks(): any[];
    /**
     * Generates ticks with a specific interval
     * @param {number} min - The minimum timestamp
     * @param {number} max - The maximum timestamp
     * @param {number} interval - The interval between ticks in milliseconds
     * @param {string} format - The date format to use
     * @returns {Array} Array of tick objects
     */
    generateTicksWithInterval(min: number, max: number, interval: number, format: string): any[];
    /**
     * Generates evenly spaced ticks regardless of time intervals
     * @param {number} min - The minimum timestamp
     * @param {number} max - The maximum timestamp
     * @param {number} count - The number of ticks to generate
     * @param {string} format - The date format to use
     * @returns {Array} Array of tick objects
     */
    generateEvenlySpacedTicks(min: number, max: number, count: number, format: string): any[];
    /**
     * Renders the x-axis with tick marks
     */
    render(): void;
    /**
     * Updates the x-axis height and visibility based on chart configuration
     */
    updateHeight(): void;
    /**
     * Clean up resources and event listeners
     */
    destroy(): void;
}
