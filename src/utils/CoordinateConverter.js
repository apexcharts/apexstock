import Utils from "./Utils";
// CoordinateConverter.js - Handles coordinate conversions between screen and data space
class CoordinateConverter {
  /**
   * @param {ApexCharts} chart - The ApexCharts instance
   * @param {HTMLElement} chartDiv - The chart container element
   */
  constructor(chart, chartDiv) {
    this.chart = chart;
    this.chartDiv = chartDiv;
    this.cachedBounds = null;
    this.lastUpdateTime = 0;
  }

  /**
   * Gets the chart bounds with caching for performance
   * @param {boolean} force - Force refresh of bounds
   * @returns {Object} - Chart bounds and dimensions
   */
  getChartBounds(force = false) {
    const now = Date.now();
    // Cache bounds for 100ms to improve performance during drag operations
    if (!force && this.cachedBounds && now - this.lastUpdateTime < 100) {
      return this.cachedBounds;
    }

    try {
      // Get chart dimensions
      const chartRect = this.chartDiv.getBoundingClientRect();

      // Get chart axes min/max values
      let xaxis, xaxisMax, yaxis, yaxisMax;

      // Handle potential missing properties gracefully
      try {
        xaxis = this.chart.w.globals.minX;
        xaxisMax = this.chart.w.globals.maxX;
        yaxis = this.chart.w.globals.minY;
        yaxisMax = this.chart.w.globals.maxY;
      } catch (err) {
        Utils.warn("Could not access chart axis values:", err);
        // Fallback to arbitrary values if chart values aren't available
        this.cachedBounds = {
          xaxis: 0,
          xaxisMax: 100,
          yaxis: 0,
          yaxisMax: 100,
          leftMargin: 0,
          translateY: 0,
          gridWidth: chartRect.width,
          gridHeight: chartRect.height,
          chartRect,
        };
        this.lastUpdateTime = now;
        return this.cachedBounds;
      }

      // Get chart margins - these might not be available in all versions/states
      let leftMargin, translateY, gridWidth, gridHeight;

      try {
        leftMargin = this.chart.w.globals.translateX;
        translateY = this.chart.w.globals.translateY;
        gridWidth = this.chart.w.globals.gridWidth;
        gridHeight = this.chart.w.globals.gridHeight;
      } catch (err) {
        Utils.warn("Could not access chart grid values:", err);
        // If we can't get the chart's internal dimensions, use the element dimensions
        leftMargin = 0;
        translateY = 0;
        gridWidth = chartRect.width;
        gridHeight = chartRect.height;
      }

      // If any values are still undefined, use fallbacks
      if (leftMargin === undefined || isNaN(leftMargin)) leftMargin = 60; // typical margin
      if (translateY === undefined || isNaN(translateY)) translateY = 20;
      if (gridWidth === undefined || isNaN(gridWidth))
        gridWidth = chartRect.width - leftMargin;
      if (gridHeight === undefined || isNaN(gridHeight))
        gridHeight = chartRect.height - translateY;

      this.cachedBounds = {
        xaxis,
        xaxisMax,
        yaxis,
        yaxisMax,
        leftMargin,
        translateY,
        gridWidth,
        gridHeight,
        chartRect,
      };

      this.lastUpdateTime = now;
      return this.cachedBounds;
    } catch (err) {
      Utils.error("Error getting chart bounds:", err);
      return {
        xaxis: 0,
        xaxisMax: 100,
        yaxis: 0,
        yaxisMax: 100,
        leftMargin: 0,
        translateY: 0,
        gridWidth: 100,
        gridHeight: 100,
        chartRect: { width: 100, height: 100 },
      };
    }
  }

  /**
   * Converts screen coordinates to data coordinates
   * @param {number} x - Screen x coordinate
   * @param {number} y - Screen y coordinate
   * @returns {Object|null} - Data coordinates or null if outside chart
   */
  screenToData(x, y) {
    try {
      const bounds = this.getChartBounds();

      // Convert screen coordinates to data coordinates
      const xRatio = (x - bounds.leftMargin) / bounds.gridWidth;
      const yRatio = (y - bounds.translateY) / bounds.gridHeight;

      const dataX = bounds.xaxis + (bounds.xaxisMax - bounds.xaxis) * xRatio;
      const dataY = bounds.yaxisMax - (bounds.yaxisMax - bounds.yaxis) * yRatio;

      // Validate output
      if (isNaN(dataX) || isNaN(dataY)) {
        Utils.warn("Invalid data coordinates calculated:", dataX, dataY);
        return { x, y }; // fallback to screen coordinates
      }

      return { x: dataX, y: dataY };
    } catch (err) {
      Utils.error("Error converting screen to data coordinates:", err);
      // Return the screen coordinates as fallback
      return { x, y };
    }
  }

  /**
   * Converts data coordinates to screen coordinates
   * @param {number} dataX - Data x coordinate
   * @param {number} dataY - Data y coordinate
   * @returns {Object} - Screen coordinates
   */
  dataToScreen(dataX, dataY) {
    try {
      const bounds = this.getChartBounds();

      // Convert data coordinates to screen coordinates
      const xRatio = (dataX - bounds.xaxis) / (bounds.xaxisMax - bounds.xaxis);
      const yRatio =
        (bounds.yaxisMax - dataY) / (bounds.yaxisMax - bounds.yaxis);

      const screenX = bounds.leftMargin + bounds.gridWidth * xRatio;
      const screenY = bounds.translateY + bounds.gridHeight * yRatio;

      // Validate output
      if (isNaN(screenX) || isNaN(screenY)) {
        Utils.warn(
          "Invalid screen coordinates calculated:",
          screenX,
          screenY
        );
        return { x: dataX, y: dataY }; // fallback to data coordinates
      }

      return { x: screenX, y: screenY };
    } catch (err) {
      Utils.error("Error converting data to screen coordinates:", err);
      // In case of any error, return the data coordinates
      return { x: dataX, y: dataY };
    }
  }

  /**
   * Converts a delta in screen space to data space
   * @param {number} screenDeltaX - X delta in screen space
   * @param {number} screenDeltaY - Y delta in screen space
   * @returns {Object} - Delta in data space
   */
  screenDeltaToDataDelta(screenDeltaX, screenDeltaY) {
    try {
      const bounds = this.getChartBounds();

      // Calculate ratios
      const xRatio = (bounds.xaxisMax - bounds.xaxis) / bounds.gridWidth;
      const yRatio = (bounds.yaxisMax - bounds.yaxis) / bounds.gridHeight;

      // Convert deltas
      const dataDeltaX = screenDeltaX * xRatio;
      const dataDeltaY = -screenDeltaY * yRatio; // Invert Y for chart coordinates

      return { x: dataDeltaX, y: dataDeltaY };
    } catch (err) {
      Utils.error("Error converting screen delta to data delta:", err);
      return { x: 0, y: 0 };
    }
  }

  /**
   * Force update of cached bounds
   */
  refreshBounds() {
    this.getChartBounds(true);
  }

  /**
   * Calculates the distance between two points in data space
   * @param {Object} point1 - First point with x, y coordinates
   * @param {Object} point2 - Second point with x, y coordinates
   * @returns {number} - Distance between points
   */
  getDataDistance(point1, point2) {
    return Math.sqrt(
      Math.pow(point2.x - point1.x, 2) + Math.pow(point2.y - point1.y, 2)
    );
  }

  /**
   * Creates a singleton instance of the converter
   * @param {ApexCharts} chart - The ApexCharts instance
   * @param {HTMLElement} chartDiv - The chart container element
   * @returns {CoordinateConverter} - Singleton instance
   */
  static getInstance(chart, chartDiv) {
    if (
      !CoordinateConverter.instance ||
      CoordinateConverter.instance.chart !== chart ||
      CoordinateConverter.instance.chartDiv !== chartDiv
    ) {
      CoordinateConverter.instance = new CoordinateConverter(chart, chartDiv);
    }
    return CoordinateConverter.instance;
  }
}

export default CoordinateConverter;
