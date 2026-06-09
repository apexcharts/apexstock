export default CoordinateConverter;
declare class CoordinateConverter {
    /**
     * Creates a singleton instance of the converter
     * @param {ApexCharts} chart - The ApexCharts instance
     * @param {HTMLElement} chartDiv - The chart container element
     * @returns {CoordinateConverter} - Singleton instance
     */
    static getInstance(chart: any, chartDiv: HTMLElement): CoordinateConverter;
    /**
     * @param {ApexCharts} chart - The ApexCharts instance
     * @param {HTMLElement} chartDiv - The chart container element
     */
    constructor(chart: any, chartDiv: HTMLElement);
    chart: any;
    chartDiv: HTMLElement;
    cachedBounds: {
        xaxis: number;
        xaxisMax: number;
        yaxis: number;
        yaxisMax: number;
        leftMargin: number;
        translateY: number;
        gridWidth: number;
        gridHeight: number;
        chartRect: DOMRect;
    } | {
        xaxis: any;
        xaxisMax: any;
        yaxis: any;
        yaxisMax: any;
        leftMargin: any;
        translateY: any;
        gridWidth: any;
        gridHeight: any;
        chartRect: DOMRect;
    };
    lastUpdateTime: number;
    /**
     * Gets the chart bounds with caching for performance
     * @param {boolean} force - Force refresh of bounds
     * @returns {Object} - Chart bounds and dimensions
     */
    getChartBounds(force?: boolean): any;
    /**
     * Converts screen coordinates to data coordinates
     * @param {number} x - Screen x coordinate
     * @param {number} y - Screen y coordinate
     * @returns {Object|null} - Data coordinates or null if outside chart
     */
    screenToData(x: number, y: number): any | null;
    /**
     * Converts data coordinates to screen coordinates
     * @param {number} dataX - Data x coordinate
     * @param {number} dataY - Data y coordinate
     * @returns {Object} - Screen coordinates
     */
    dataToScreen(dataX: number, dataY: number): any;
    /**
     * Converts a delta in screen space to data space
     * @param {number} screenDeltaX - X delta in screen space
     * @param {number} screenDeltaY - Y delta in screen space
     * @returns {Object} - Delta in data space
     */
    screenDeltaToDataDelta(screenDeltaX: number, screenDeltaY: number): any;
    /**
     * Force update of cached bounds
     */
    refreshBounds(): void;
    /**
     * Calculates the distance between two points in data space
     * @param {Object} point1 - First point with x, y coordinates
     * @param {Object} point2 - Second point with x, y coordinates
     * @returns {number} - Distance between points
     */
    getDataDistance(point1: any, point2: any): number;
}
