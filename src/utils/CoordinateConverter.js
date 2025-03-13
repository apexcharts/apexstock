// CoordinateConverter.js - Handles coordinate conversions between screen and data space
class CoordinateConverter {
  /**
   * @param {ApexCharts} chart - The ApexCharts instance
   * @param {HTMLElement} chartDiv - The chart container element
   */
  constructor(chart, chartDiv) {
    this.chart = chart;
    this.chartDiv = chartDiv;
  }

  /**
   * Converts screen coordinates to data coordinates
   * @param {number} x - Screen x coordinate
   * @param {number} y - Screen y coordinate
   * @returns {Object|null} - Data coordinates or null if outside chart
   */
  screenToData(x, y) {
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
        console.warn("Could not access chart axis values:", err);
        // Fallback to arbitrary values if chart values aren't available
        return { x, y };
      }

      // Get chart margins - these might not be available in all versions/states
      let leftMargin, translateY, gridWidth, gridHeight;

      try {
        leftMargin = this.chart.w.globals.translateX;
        translateY = this.chart.w.globals.translateY;
        gridWidth = this.chart.w.globals.gridWidth;
        gridHeight = this.chart.w.globals.gridHeight;
      } catch (err) {
        console.warn("Could not access chart grid values:", err);
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

      // Convert screen coordinates to data coordinates
      const xRatio = (x - leftMargin) / gridWidth;
      const yRatio = (y - translateY) / gridHeight;

      const dataX = xaxis + (xaxisMax - xaxis) * xRatio;
      const dataY = yaxisMax - (yaxisMax - yaxis) * yRatio;

      // Validate output
      if (isNaN(dataX) || isNaN(dataY)) {
        console.warn("Invalid data coordinates calculated:", dataX, dataY);
        return { x, y }; // fallback to screen coordinates
      }

      return { x: dataX, y: dataY };
    } catch (err) {
      console.error("Error converting screen to data coordinates:", err);
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
        console.warn("Could not access chart axis values:", err);
        // If we can't get the chart's internal values, just return the data values
        return { x: dataX, y: dataY };
      }

      // Get chart margins - these might not be available in all versions/states
      let leftMargin, translateY, gridWidth, gridHeight;

      try {
        leftMargin = this.chart.w.globals.translateX;
        translateY = this.chart.w.globals.translateY;
        gridWidth = this.chart.w.globals.gridWidth;
        gridHeight = this.chart.w.globals.gridHeight;
      } catch (err) {
        console.warn("Could not access chart grid values:", err);
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

      // Convert data coordinates to screen coordinates
      const xRatio = (dataX - xaxis) / (xaxisMax - xaxis);
      const yRatio = (yaxisMax - dataY) / (yaxisMax - yaxis);

      const screenX = leftMargin + gridWidth * xRatio;
      const screenY = translateY + gridHeight * yRatio;

      // Validate output
      if (isNaN(screenX) || isNaN(screenY)) {
        console.warn(
          "Invalid screen coordinates calculated:",
          screenX,
          screenY
        );
        return { x: dataX, y: dataY }; // fallback to data coordinates
      }

      return { x: screenX, y: screenY };
    } catch (err) {
      console.error("Error converting data to screen coordinates:", err);
      // In case of any error, return the data coordinates
      return { x: dataX, y: dataY };
    }
  }
}

export default CoordinateConverter;
