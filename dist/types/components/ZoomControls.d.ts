/**
 * ZoomControls component for ApexStock
 * Adds zoom in and zoom out buttons to the chart
 */
export default class ZoomControls {
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
     * Zoom in on the chart
     */
    zoomIn(): void;
    /**
     * Zoom out on the chart
     */
    zoomOut(): void;
    /**
     * Clean up resources
     */
    destroy(): void;
}
