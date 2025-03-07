// ApexStock.js – an extension library built on top of ApexCharts for stock charts
class ApexStock {
  /**
   * @param {HTMLElement} chartEl - The container element where the charts will be rendered.
   * @param {Object} chartOptions - The ApexCharts options object.
   */
  constructor(chartEl, chartOptions) {
    this.chartEl = chartEl;
    // Total height is provided via chartOptions.chart.height (assumed numeric, e.g. 600)
    this.totalHeight = chartOptions.chart.height || 350;

    // Clear any existing content and create two sub-containers:
    // one for the main chart and one for the indicator charts.
    this.chartEl.innerHTML = "";
    this.mainChartDiv = document.createElement("div");
    this.indicatorContainer = document.createElement("div");
    this.mainChartDiv.classList.add("apexstock-main-chart");
    this.indicatorContainer.classList.add("apexstock-indicator-container");
    // Initially, if no indicator is added, main chart gets full height.
    this.mainChartDiv.style.height = this.totalHeight + "px";
    this.indicatorContainer.style.height = "0px";
    this.chartEl.appendChild(this.mainChartDiv);
    this.chartEl.appendChild(this.indicatorContainer);

    // Store references to indicator charts
    this.indicatorCharts = [];

    // Extract stock-chart–specific settings from plotOptions.stockChart.
    const stockChartOptions = chartOptions.plotOptions && chartOptions.plotOptions.stockChart || {};
    this.series = chartOptions.series[0].data || [];
    this.indicators = stockChartOptions.indicators || ["Moving Average", "RSI", "Bollinger Bands", "MACD"];
    // Always add "Volumes" to the dropdown options if not already included.
    if (!this.indicators.includes("Volumes")) {
      this.indicators.push("Volumes");
    }

    // Process volumes data.
    // Option 1: Use volumes provided explicitly
    // Option 2: Derive volumes from each OHLC point if property 'v' exists.
    if (stockChartOptions.volumes) {
      this.volumesData = stockChartOptions.volumes;
    } else {
      this.volumesData = this.series.map(point => point.v ? {
        x: point.x,
        y: point.v
      } : null).filter(x => x !== null);
    }

    // Merge the provided chartOptions with defaults for a candlestick chart.
    // Set the chart type to 'candlestick' and the height to the total height.
    this.mainChartOptions = Object.assign({}, chartOptions, {
      chart: Object.assign({}, chartOptions.chart, {
        type: "candlestick",
        height: this.totalHeight
      }),
      series: [{
        name: "Price",
        data: this.series
      }],
      xaxis: {
        type: "datetime"
      },
      // Initially, we have a single y-axis for the candlestick.
      yaxis: [{
        opposite: false,
        title: {
          text: "Price"
        }
      }],
      legend: {
        show: false
      }
    });

    // Create the main candlestick chart instance.
    this.chart = new ApexCharts(this.mainChartDiv, this.mainChartOptions);
  }

  /**
   * Render the main chart and setup additional UI controls.
   */
  render() {
    // Render the main candlestick chart.
    this.chart.render();

    // Create the indicator dropdown and the trendline button.
    this.addIndicatorDropdown();
    // this.addTrendlineOption();
  }

  /**
   * Adds a dropdown control (positioned at the top left) to let the user add indicator charts.
   */
  addIndicatorDropdown() {
    const dropdown = document.createElement("select");
    dropdown.id = "indicatorDropdown";
    dropdown.style.position = "absolute";
    dropdown.style.top = "0px";
    dropdown.style.left = "10px";
    dropdown.style.zIndex = "1000";
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.innerText = "Select Indicator";
    dropdown.appendChild(defaultOption);
    this.indicators.forEach(indicator => {
      const option = document.createElement("option");
      option.value = indicator;
      option.innerText = indicator;
      dropdown.appendChild(option);
    });

    // Insert the dropdown above the chart container.
    this.chartEl.parentNode.insertBefore(dropdown, this.chartEl);
    dropdown.addEventListener("change", e => {
      const selected = e.target.value;
      this.updateIndicator(selected);
    });
  }

  /**
   * Adds a button (positioned at the top left) to toggle drawing a trendline on the main chart.
   */
  addTrendlineOption() {
    const button = document.createElement("button");
    button.id = "trendlineBtn";
    button.innerText = "Toggle Trendline";
    button.style.position = "absolute";
    button.style.top = "0px";
    button.style.left = "150px";
    button.style.zIndex = "1000";
    this.chartEl.parentNode.insertBefore(button, this.chartEl);
    button.addEventListener("click", () => {
      // Toggle a simple trendline annotation on the main chart.
      this.chart.updateOptions({
        annotations: {
          xaxis: [{
            x: this.series[0].x,
            x2: this.series[this.series.length - 1].x,
            borderColor: "#00E396",
            fillColor: "#00E396",
            opacity: 0.2,
            label: {
              borderColor: "#00E396",
              style: {
                color: "#fff",
                background: "#00E396"
              },
              text: "Trendline"
            }
          }]
        }
      });
    });
  }

  /**
   * Helper function to compute the new heights for the main chart and indicator charts.
   * @param {number} newIndicatorCount - Total count of indicator charts (existing + new one)
   * @returns {Object} - An object with newMainHeight, indicatorContainerHeight, and indicatorHeight.
   */
  computeHeights(newIndicatorCount) {
    const newMainHeight = Math.floor(0.6 * this.totalHeight);
    const indicatorContainerHeight = Math.floor(0.4 * this.totalHeight);
    const indicatorHeight = Math.floor(indicatorContainerHeight / newIndicatorCount);
    return {
      newMainHeight,
      indicatorContainerHeight,
      indicatorHeight
    };
  }

  /**
   * Updates the heights of all charts based on the current number of indicators.
   * This is called whenever a new indicator is added or removed.
   */
  updateAllChartHeights() {
    const indicatorCount = this.indicatorContainer.children.length;
    if (indicatorCount === 0) {
      // If no indicators, main chart gets full height
      this.mainChartDiv.style.height = this.totalHeight + "px";
      this.indicatorContainer.style.height = "0px";
      this.chart.updateOptions({
        chart: {
          height: this.totalHeight
        }
      }, false, true);
      return;
    }
    const {
      newMainHeight,
      indicatorContainerHeight,
      indicatorHeight
    } = this.computeHeights(indicatorCount);

    // Update main chart height
    this.mainChartDiv.style.height = newMainHeight + "px";
    this.indicatorContainer.style.height = indicatorContainerHeight + "px";
    this.chart.updateOptions({
      chart: {
        height: newMainHeight
      }
    }, false, false);

    // Update all indicator chart heights
    for (let i = 0; i < indicatorCount; i++) {
      const indicatorDiv = this.indicatorContainer.children[i];
      indicatorDiv.style.height = indicatorHeight + "px";

      // Update the chart height if there's a chart instance stored
      if (this.indicatorCharts[i]) {
        this.indicatorCharts[i].updateOptions({
          chart: {
            height: indicatorHeight
          }
        }, false, false);
      }
    }
  }

  /**
   * Adds a new indicator chart below the main chart.
   * For most indicators, a new chart is created.
   * However, for "Volumes", the volume series is added to the main chart on an opposite y-axis.
   * For "Bollinger Bands", the bands are added directly to the main chart series without modifying the chart height.
   * @param {string} indicator - The indicator name (e.g. "Moving Average", "RSI", "Volumes", "Bollinger Bands", "MACD").
   */
  updateIndicator(indicator) {
    if (!indicator) return;
    if (indicator === "Volumes") {
      // For volumes, update the main chart to include a volume series on an opposite y-axis.
      if (!this.volumesData || this.volumesData.length === 0) {
        console.warn("No volumes data available.");
        document.getElementById("indicatorDropdown").value = "";
        return;
      }

      // Check if volume series is already added (by checking the current series length).
      const currentSeries = this.chart.w.globals.series;
      if (currentSeries && currentSeries.length > 1) {
        // Assume volumes already added.
        document.getElementById("indicatorDropdown").value = "";
        return;
      }

      // Prepare the volume series.
      const volumeSeries = {
        name: "Volumes",
        type: "column",
        data: this.volumesData
      };

      // Update the main chart series: first series remains candlestick, second is volumes.
      const newSeries = [{
        name: "Price",
        data: this.series
      }, volumeSeries];

      // Update yaxis configuration to have two axes.
      const newYaxis = [{
        opposite: false,
        title: {
          text: "Price"
        }
      }, {
        opposite: true,
        title: {
          text: "Volume"
        }
      }];
      this.chart.updateOptions({
        yaxis: newYaxis
      });
      this.chart.updateSeries(newSeries);
      document.getElementById("indicatorDropdown").value = "";
      return;
    } else if (indicator === "Bollinger Bands") {
      // Bollinger Bands are added to the main chart without modifying the main chart height.
      const period = 20;
      const stdDev = 2;
      const {
        upper,
        lower
      } = this.calculateBollingerBands(this.series, period, stdDev);

      // Append Bollinger Bands as a rangeArea series to the main chart's series.
      this.chart.updateSeries([...this.chart.w.config.series, {
        name: "Bollinger Bands",
        type: "rangeArea",
        data: upper.map((value, index) => ({
          x: this.series[index].x,
          y: [lower[index], value]
        })),
        color: "rgba(0, 114, 255, 0.08)"
      }]);
      document.getElementById("indicatorDropdown").value = "";
      return;
    } else if (indicator === "Moving Average") {
      // Calculate a simple moving average (SMA) using the close price (4th element of y).
      const maData = this.calculateMovingAverage(this.series, 10);
      var indicatorChartOptions = {
        chart: {
          type: "line",
          toolbar: {
            show: false
          },
          parentHeightOffset: 0
        },
        series: [{
          name: "Moving Average",
          data: maData.map((value, index) => ({
            x: this.series[index].x,
            y: value
          }))
        }],
        xaxis: {
          type: "datetime",
          labels: {
            show: false
          }
        },
        yaxis: {
          title: {
            text: "MA"
          }
        },
        stroke: {
          width: 1,
          colors: "#7D57C2"
        }
      };
    } else if (indicator === "RSI") {
      // Calculate a simple RSI with a period of 14.
      const rsiData = this.calculateRSI(this.series, 14);
      var indicatorChartOptions = {
        chart: {
          type: "line",
          toolbar: {
            show: false
          },
          parentHeightOffset: 0
        },
        series: [{
          name: "RSI",
          data: rsiData.map((value, index) => ({
            x: this.series[index].x,
            y: value
          }))
        }],
        xaxis: {
          type: "datetime",
          labels: {
            show: false
          },
          axisTicks: {
            show: false
          }
        },
        yaxis: {
          min: 0,
          max: 100,
          title: {
            text: "RSI"
          }
        },
        stroke: {
          width: 1,
          colors: "#7D57C2"
        }
      };
    } else if (indicator === "MACD") {
      // Calculate MACD with standard parameters.
      const {
        macd,
        signal,
        histogram
      } = this.calculateMACD(this.series);
      const me = this;
      var indicatorChartOptions = {
        chart: {
          type: "line",
          toolbar: {
            show: false
          },
          parentHeightOffset: 0
        },
        series: [{
          name: "MACD",
          type: "line",
          data: macd.map((value, index) => ({
            x: this.series[index].x,
            y: me.truncateNumber(value)
          })),
          color: "#008FFB"
        }, {
          name: "Signal",
          type: "line",
          data: signal.map((value, index) => ({
            x: this.series[index].x,
            y: me.truncateNumber(value)
          })),
          color: "#FF4560"
        }, {
          name: "Histogram",
          type: "bar",
          data: histogram.map((value, index) => ({
            x: this.series[index].x,
            y: me.truncateNumber(value)
          }))
        }],
        xaxis: {
          type: "datetime",
          labels: {
            show: false
          }
        },
        yaxis: {
          title: {
            text: "MACD"
          }
        },
        stroke: {
          width: [1, 1, 0]
        },
        legend: {
          show: false
        },
        plotOptions: {
          bar: {
            colors: {
              ranges: [{
                from: 0.1,
                to: 100,
                color: "#00E396"
              }, {
                from: -100,
                to: 0,
                color: "#FF4560"
              }]
            }
          }
        }
      };
    }

    // For non-Bollinger Bands indicators, create a new div for the indicator chart.
    const indicatorDiv = document.createElement("div");
    indicatorDiv.dataset.indicator = indicator;
    indicatorDiv.style.width = "100%";
    this.indicatorContainer.appendChild(indicatorDiv);

    // Recalculate and update all chart heights.
    this.updateAllChartHeights();

    // Set the height for the new indicator chart in its options.
    if (!indicatorChartOptions.chart) indicatorChartOptions.chart = {};
    const {
      indicatorHeight
    } = this.computeHeights(this.indicatorContainer.children.length);
    indicatorChartOptions.chart.height = indicatorHeight;

    // Render the indicator chart in the new div.
    const chart = new ApexCharts(indicatorDiv, indicatorChartOptions);
    chart.render();

    // Store reference to the chart instance.
    this.indicatorCharts.push(chart);

    // Reset the dropdown to its default option.
    document.getElementById("indicatorDropdown").value = "";
  }

  /**
   * Calculates a simple moving average (SMA) for the given OHLC series.
   * Uses the closing price (4th element of the y-array).
   * @param {Array} series - The OHLC series.
   * @param {number} period - The number of data points for the average.
   * @returns {Array} - An array containing the SMA values (null for indices with insufficient data).
   */
  calculateMovingAverage(series, period) {
    const ma = [];
    for (let i = 0; i < series.length; i++) {
      if (i < period - 1) {
        ma.push(null);
      } else {
        let sum = 0;
        for (let j = i - period + 1; j <= i; j++) {
          sum += series[j].y[3]; // close price
        }
        ma.push(this.truncateNumber(sum / period));
      }
    }
    return ma;
  }

  /**
   * Calculates the Relative Strength Index (RSI) for the given OHLC series.
   * Uses the closing price (4th element of the y-array).
   * @param {Array} series - The OHLC series.
   * @param {number} period - The period to use for RSI calculation.
   * @returns {Array} - An array of RSI values (null for indices with insufficient data).
   */
  calculateRSI(series, period) {
    const rsi = [];
    let gains = 0;
    let losses = 0;
    for (let i = 0; i < series.length; i++) {
      const price = series[i].y[3];
      if (i === 0) {
        rsi.push(null);
      } else {
        const change = price - series[i - 1].y[3];
        const gain = change > 0 ? change : 0;
        const loss = change < 0 ? -change : 0;
        if (i < period) {
          gains += gain;
          losses += loss;
          if (i === period - 1) {
            const avgGain = gains / period;
            const avgLoss = losses / period;
            const rsVal = avgLoss === 0 ? 0 : avgGain / avgLoss;
            const rsiValue = avgLoss === 0 ? 100 : 100 - 100 / (1 + rsVal);
            rsi.push(this.truncateNumber(rsiValue));
          } else {
            rsi.push(null);
          }
        } else {
          let sumGain = 0;
          let sumLoss = 0;
          for (let j = i - period + 1; j <= i; j++) {
            const delta = series[j].y[3] - series[j - 1].y[3];
            sumGain += delta > 0 ? delta : 0;
            sumLoss += delta < 0 ? -delta : 0;
          }
          const avgGain = sumGain / period;
          const avgLoss = sumLoss / period;
          const rsVal = avgLoss === 0 ? 0 : avgGain / avgLoss;
          const rsiValue = avgLoss === 0 ? 100 : 100 - 100 / (1 + rsVal);
          rsi.push(this.truncateNumber(rsiValue));
        }
      }
    }
    return rsi;
  }

  /**
   * Calculates Bollinger Bands for the given OHLC series.
   * @param {Array} series - The OHLC series.
   * @param {number} period - The period for the moving average.
   * @param {number} stdDev - The standard deviation multiplier.
   * @returns {Object} - An object with middle, upper, and lower band arrays.
   */
  calculateBollingerBands(series, period, stdDev) {
    const middle = this.calculateMovingAverage(series, period);
    const upper = [];
    const lower = [];
    for (let i = 0; i < series.length; i++) {
      if (i < period - 1) {
        upper.push(null);
        lower.push(null);
      } else {
        let sum = 0;
        for (let j = i - period + 1; j <= i; j++) {
          const deviation = series[j].y[3] - middle[i];
          sum += deviation * deviation;
        }
        const stdDevValue = Math.sqrt(sum / period);
        upper.push(this.truncateNumber(middle[i] + stdDev * stdDevValue));
        lower.push(this.truncateNumber(middle[i] - stdDev * stdDevValue));
      }
    }
    return {
      middle,
      upper,
      lower
    };
  }

  /**
   * Calculates MACD for the given OHLC series.
   * @param {Array} series - The OHLC series.
   * @param {number} fastPeriod - The period for the fast EMA (default: 12).
   * @param {number} slowPeriod - The period for the slow EMA (default: 26).
   * @param {number} signalPeriod - The period for the signal line (default: 9).
   * @returns {Object} - An object with macd, signal, and histogram arrays.
   */
  calculateMACD(series) {
    let fastPeriod = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 12;
    let slowPeriod = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 26;
    let signalPeriod = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 9;
    // Calculate EMAs
    const fastEMA = this.calculateEMA(series, fastPeriod);
    const slowEMA = this.calculateEMA(series, slowPeriod);

    // Calculate MACD line
    const macd = [];
    for (let i = 0; i < series.length; i++) {
      if (i < slowPeriod - 1) {
        macd.push(null);
      } else {
        macd.push(fastEMA[i] - slowEMA[i]);
      }
    }

    // Calculate signal line (EMA of MACD)
    const signal = [];
    let signalSum = 0;
    let validCount = 0;
    for (let i = 0; i < macd.length; i++) {
      if (i < slowPeriod - 1 + signalPeriod - 1) {
        signal.push(null);
      } else {
        if (validCount < signalPeriod) {
          signalSum += macd[i - (signalPeriod - 1) + validCount];
          validCount++;
          if (validCount === signalPeriod) {
            signal.push(signalSum / signalPeriod);
          } else {
            signal.push(null);
          }
        } else {
          const multiplier = 2 / (signalPeriod + 1);
          signal.push(macd[i] * multiplier + signal[i - 1] * (1 - multiplier));
        }
      }
    }

    // Calculate histogram
    const histogram = [];
    for (let i = 0; i < series.length; i++) {
      if (i < slowPeriod - 1 + signalPeriod - 1) {
        histogram.push(null);
      } else {
        histogram.push(macd[i] - signal[i]);
      }
    }
    return {
      macd,
      signal,
      histogram
    };
  }

  /**
   * Calculates Exponential Moving Average (EMA) for the given OHLC series.
   * @param {Array} series - The OHLC series.
   * @param {number} period - The period for the EMA.
   * @returns {Array} - An array of EMA values.
   */
  calculateEMA(series, period) {
    const ema = [];
    const multiplier = 2 / (period + 1);

    // Calculate first SMA as starting point
    let sum = 0;
    for (let i = 0; i < period; i++) {
      sum += series[i].y[3]; // close price
    }
    const sma = sum / period;
    for (let i = 0; i < series.length; i++) {
      if (i < period - 1) {
        ema.push(null);
      } else if (i === period - 1) {
        ema.push(this.truncateNumber(sma));
      } else {
        ema.push(this.truncateNumber(series[i].y[3] * multiplier + ema[i - 1] * (1 - multiplier)));
      }
    }
    return ema;
  }
  truncateNumber(val) {
    if (val === null) return val;
    return Number(val.toFixed(2));
  }
}

// Expose ApexStock to the global scope.
window.ApexStock = ApexStock;
//# sourceMappingURL=apexstock.esm.js.map
