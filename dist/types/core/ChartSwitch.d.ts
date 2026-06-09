/**
 * ChartSwitch component for ApexStock
 * Allows switching between different chart types (line, area, candle, column, heikin-ashi, renko)
 */
export default class ChartSwitch {
    /**
     * @param {ApexCharts} chart - The ApexCharts instance
     * @param {HTMLElement} chartEl - The container element
     * @param {Array} series - The data series
     */
    constructor(ctx: any);
    ctx: any;
    chart: any;
    chartEl: any;
    series: any;
    chartTypes: {
        id: string;
        name: string;
        icon: string;
    }[];
    currentType: string;
    originalSeries: any[];
    renkoBrickSize: number;
    renkoSettingsControl: SettingsControl;
    initializeRenkoSettings(): void;
    /**
     * Convert regular candle data to Heikin-Ashi format
     * @param {Array} series - Array of candlestick data points
     * @returns {Array} - Transformed Heikin-Ashi data
     */
    _convertToHeikinAshi(series: any[]): any[];
    /**
     * Convert regular candle data to Renko format, preserving all original timestamps
     * @param {Array} series - Array of candlestick data points
     * @param {number} brickSize - Brick size in percentage of the price
     * @returns {Array} - Transformed Renko data with same length as original series
     */
    _convertToRenko(series: any[], brickSize?: number): any[];
    /**
     * Generate tooltip content for box-style charts (candlestick, Heikin-Ashi, Renko)
     * @param {Object} w - ApexCharts w object
     * @param {number} seriesIndex - Series index
     * @param {number} dataPointIndex - Data point index
     * @param {Array} labels - Array of labels for OHLC values
     * @param {string} chartType - Chart type
     * @returns {string} - HTML content for tooltip
     */
    _getBoxTooltip(w: any, seriesIndex: number, dataPointIndex: number, labels: any[], chartType: string): string;
    /**
     * Initialize the chart type dropdown
     */
    init(): void;
    updateTheme(theme: any): void;
    /**
     * Change the chart type
     * @param {string} type - The chart type to switch to
     */
    changeChartType(type: string): void;
    destroy(): void;
}
import SettingsControl from "../components/SettingsControl";
