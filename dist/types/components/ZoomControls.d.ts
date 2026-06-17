/**
 * ZoomControls component for ApexStock
 * Adds zoom in and zoom out buttons to the chart
 */
export default class ZoomControls {
    /** Fraction of the visible range each zoom-in/out click adds or removes. */
    static ZOOM_FACTOR: number;
    /**
     * Creates zoom control buttons
     * @param {import("../ApexStock.js").default} context - The ApexStock instance
     */
    constructor(context: import("../ApexStock.js").default);
    context: import("../ApexStock.js").default;
    chartEl: HTMLElement;
    chart: any;
    controlsContainer: HTMLDivElement;
    zoomInButton: HTMLButtonElement;
    zoomOutButton: HTMLButtonElement;
    /**
     * Initialize zoom controls
     */
    init(): void;
    /**
     * Create the container for zoom controls
     */
    createContainer(): void;
    /**
     * Create zoom in and zoom out buttons
     */
    createButtons(): void;
    /**
     * Add event listeners to the zoom buttons
     */
    addEventListeners(): void;
    /**
     * Apply a new visible range to the main chart and all indicator panes.
     * `minX`/`maxX` are in the axis's own value space (timestamps for a
     * numeric/datetime axis, data indices for a category axis) — the same space
     * `getCurrentZoomState()` reports and `zoomX()` expects.
     * @param {number} minX
     * @param {number} maxX
     */
    applyRange(minX: number, maxX: number): void;
    /**
     * Zoom in on the chart (shrink the visible range around its center).
     */
    zoomIn(): void;
    /**
     * Zoom out on the chart (grow the visible range, bounded by the full data).
     */
    zoomOut(): void;
    /**
     * Clean up resources
     */
    destroy(): void;
}
