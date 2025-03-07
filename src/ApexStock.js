// ApexStock.js – an extension library built on top of ApexCharts for stock charts
class ApexStock {
  /**
   * @param {HTMLElement} chartEl - The container element where the charts will be rendered.
   * @param {Object} chartOptions - The ApexCharts options object.
   *   Expected configuration example:
   *     {
   *       chart: {
   *         id: "myMainChart",         // (optional) main chart id; default: "apexstock-main-chart"
   *         height: 600,
   *       },
   *       series: [{
   *         data: [ { x: new Date(...), y: [open, high, low, close], v: volume }, ... ]
   *       }],
   *       plotOptions: {
   *         stockChart: {
   *           indicators: {
   *             movingaverage: {
   *               show: true,
   *               // additional options for the moving average indicator chart
   *             },
   *             rsi: {
   *               enabled: true
   *             },
   *             bollingerbands: {
   *               enabled: true,
   *               chartOptions: {
   *                 fill: {
   *                   color: "rgba(0, 114, 255, 0.08)"
   *                 }
   *               }
   *             },
   *             macd: {
   *               enabled: true
   *             }
   *           }
   *         }
   *       }
   *     }
   */
  constructor(chartEl, chartOptions) {
    this.chartEl = chartEl;
    // Total height for the main chart is provided via chartOptions.chart.height
    this.totalHeight = chartOptions.chart.height || 350;

    if (!chartOptions.chart.id) {
      chartOptions.chart.id = "apexstock-main-chart";
    }

    // Assign an ID to the main chart container.
    this.mainChartId = chartOptions.chart.id;

    // Clear any existing content and create sub-containers.
    this.chartEl.innerHTML = "";
    // Main chart container
    this.mainChartDiv = document.createElement("div");
    this.mainChartDiv.id = this.mainChartId;
    this.mainChartDiv.classList.add("apexstock-main-chart");
    this.mainChartDiv.style.height = this.totalHeight + "px";

    // Indicator container (for indicators that render in separate charts)
    this.indicatorContainer = document.createElement("div");
    this.indicatorContainer.classList.add("apexstock-indicator-container");
    // Initially, if no indicator is added, indicator container gets 0 height.
    this.indicatorContainer.style.height = "0px";

    this.chartEl.appendChild(this.mainChartDiv);

    this.chartEl.appendChild(this.indicatorContainer);

    // Store references to indicator chart instances.
    this.indicatorCharts = [];

    // Process stock-chart–specific settings.
    const stockChartOptions =
      (chartOptions.plotOptions && chartOptions.plotOptions.stockChart) || {};

    // Main OHLC series.
    this.series = chartOptions.series[0].data || [];

    // Process indicators configuration.
    // Allow indicators to be passed as an object.
    if (
      typeof stockChartOptions.indicators === "object" &&
      !Array.isArray(stockChartOptions.indicators)
    ) {
      this.indicators = stockChartOptions.indicators;
    } else if (Array.isArray(stockChartOptions.indicators)) {
      // If passed as array, convert to object with default options.
      this.indicators = {};
      stockChartOptions.indicators.forEach((ind) => {
        this.indicators[ind.toLowerCase()] = { enabled: true };
      });
    } else {
      // Default indicator settings.
      this.indicators = {
        movingaverage: { show: true },
        rsi: { enabled: true },
        bollingerbands: { enabled: true },
        macd: { enabled: true },
      };
    }
    // Always add "volumes" if not already present.
    if (!("volumes" in this.indicators)) {
      this.indicators.volumes = { enabled: true };
    }

    // Process volumes data.
    if (stockChartOptions.volumes) {
      this.volumesData = stockChartOptions.volumes;
    } else {
      this.volumesData = this.series
        .map((point) => (point.v ? { x: point.x, y: point.v } : null))
        .filter((x) => x !== null);
    }

    // Merge provided chartOptions with defaults for the main candlestick chart.
    this.mainChartOptions = Object.assign({}, chartOptions, {
      chart: Object.assign({}, chartOptions.chart, {
        type: "candlestick",
        height: this.totalHeight,
        id: this.mainChartId,
      }),
      series: [
        {
          name: "Price",
          data: this.series,
        },
      ],
      xaxis: {
        type: "datetime",
      },
      yaxis: [
        {
          opposite: false,
          title: { text: "Price" },
        },
      ],
      legend: {
        show: false,
      },
    });

    // Create the main candlestick chart.
    console.log(this.mainChartOptions);
    this.chart = new ApexCharts(this.mainChartDiv, this.mainChartOptions);
  }

  /**
   * Render the main chart and setup additional UI controls.
   */
  render() {
    // Render the main candlestick chart.
    this.chart.render();

    // Create the indicator dropdown.
    this.addIndicatorDropdown();
    // (Optional: add trendline option if desired)
    // this.addTrendlineOption();
  }

  /**
   * Adds a dropdown (positioned at the top left) to let the user add indicator charts.
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

    // Populate dropdown from the keys of the indicators object.
    Object.keys(this.indicators).forEach((key) => {
      const displayName =
        key === "rsi" || key === "macd" || key === "volumes"
          ? key.toUpperCase()
          : key
              .replace(/([A-Z])/g, " $1")
              .replace(/^./, (str) => str.toUpperCase());
      const option = document.createElement("option");
      option.value = key;
      option.innerText = displayName;
      dropdown.appendChild(option);
    });

    // Insert the dropdown above the chart container.
    this.chartEl.parentNode.insertBefore(dropdown, this.chartEl);

    dropdown.addEventListener("change", (e) => {
      const selected = e.target.value;
      this.updateIndicator(selected.replace(/\s+/g, ""));
    });
  }

  /**
   * (Optional) Adds a button to toggle a trendline on the main chart.
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
      this.chart.updateOptions({
        annotations: {
          xaxis: [
            {
              x: this.series[0].x,
              x2: this.series[this.series.length - 1].x,
              borderColor: "#00E396",
              fillColor: "#00E396",
              opacity: 0.2,
              label: {
                borderColor: "#00E396",
                style: { color: "#fff", background: "#00E396" },
                text: "Trendline",
              },
            },
          ],
        },
      });
    });
  }

  /**
   * Helper function to compute new heights for main and indicator charts.
   * @param {number} newIndicatorCount - Total count of indicator charts (existing + new one)
   * @returns {Object} - { newMainHeight, indicatorContainerHeight, indicatorHeight }
   */
  computeHeights(newIndicatorCount) {
    const newMainHeight = Math.floor(0.6 * this.totalHeight);
    const indicatorContainerHeight = Math.floor(0.4 * this.totalHeight);
    const indicatorHeight = Math.floor(
      indicatorContainerHeight / newIndicatorCount
    );
    return { newMainHeight, indicatorContainerHeight, indicatorHeight };
  }

  /**
   * Updates the heights of all charts based on current indicator count.
   */
  updateAllChartHeights() {
    const indicatorCount = this.indicatorContainer.children.length;
    if (indicatorCount === 0) {
      this.mainChartDiv.style.height = this.totalHeight + "px";
      this.indicatorContainer.style.height = "0px";
      this.chart.updateOptions(
        { chart: { height: this.totalHeight } },
        false,
        true
      );
      return;
    }

    const { newMainHeight, indicatorContainerHeight, indicatorHeight } =
      this.computeHeights(indicatorCount);
    this.mainChartDiv.style.height = newMainHeight + "px";
    this.indicatorContainer.style.height = indicatorContainerHeight + "px";
    this.chart.updateOptions(
      { chart: { height: newMainHeight } },
      false,
      false
    );

    for (let i = 0; i < indicatorCount; i++) {
      const indicatorDiv = this.indicatorContainer.children[i];
      indicatorDiv.style.height = indicatorHeight + "px";
      if (this.indicatorCharts[i]) {
        this.indicatorCharts[i].updateOptions(
          { chart: { height: indicatorHeight } },
          false,
          false
        );
      }
    }
  }

  /**
   * Adds an indicator – either as a new chart or (for Volumes and Bollinger Bands)
   * directly to the main chart.
   * @param {string} indicatorKey - The key for the indicator (e.g., "movingaverage", "rsi", "bollingerbands", "macd", "volumes").
   */
  updateIndicator(indicatorKey) {
    if (!indicatorKey) return;

    // Normalize key to lower-case.
    indicatorKey = indicatorKey.toLowerCase();

    // Handle Volumes indicator: add as an extra series to the main chart.
    if (indicatorKey === "volumes") {
      if (!this.volumesData || this.volumesData.length === 0) {
        console.warn("No volumes data available.");
        document.getElementById("indicatorDropdown").value = "";
        return;
      }
      const currentSeries = this.chart.w.globals.series;
      if (currentSeries && currentSeries.length > 1) {
        document.getElementById("indicatorDropdown").value = "";
        return;
      }
      const volumeSeries = {
        name: "Volumes",
        type: "column",
        data: this.volumesData,
      };
      const newSeries = [{ name: "Price", data: this.series }, volumeSeries];
      const newYaxis = [
        { opposite: false, title: { text: "Price" } },
        { opposite: true, title: { text: "Volume" } },
      ];
      this.chart.updateOptions({ yaxis: newYaxis });
      this.chart.updateSeries(newSeries);
      document.getElementById("indicatorDropdown").value = "";
      return;
    }
    // Handle Bollinger Bands: add to main chart without changing its height.
    else if (indicatorKey === "bollingerbands") {
      const period = 20,
        stdDev = 2;
      const { upper, lower } = this.calculateBollingerBands(
        this.series,
        period,
        stdDev
      );
      let bbSeries = {
        name: "Bollinger Bands",
        type: "rangeArea",
        data: upper.map((value, index) => ({
          x: this.series[index].x,
          y: [lower[index], value],
        })),
        color: "rgba(0, 114, 255, 0.08)",
      };
      if (this.indicators.bollingerbands?.chartOptions) {
        bbSeries = Object.assign(
          {},
          bbSeries,
          this.indicators.bollingerbands.chartOptions
        );
      }
      this.chart.updateSeries([...this.chart.w.config.series, bbSeries]);
      document.getElementById("indicatorDropdown").value = "";
      return;
    }
    // For other indicators (Moving Average, RSI, MACD), create a new indicator chart.
    let indicatorChartOptions = {};
    // For Moving Average.
    if (indicatorKey === "movingaverage") {
      const maData = this.calculateMovingAverage(this.series, 10);
      const defaultSeries = [
        {
          name: "Moving Average",
          data: maData.map((value, index) => ({
            x: this.series[index].x,
            y: value,
          })),
        },
      ];
      indicatorChartOptions = {
        chart: {
          type: "line",
          toolbar: { show: false },
          parentHeightOffset: 0,
        },
        series: defaultSeries,
        xaxis: { type: "datetime", labels: { show: false } },
        yaxis: { title: { text: "MA" } },
        stroke: { width: 1, colors: "#7D57C2" },
      };

      if (this.indicators.movingaverage?.chartOptions) {
        indicatorChartOptions = Object.assign(
          {},
          indicatorChartOptions,
          this.indicators.movingaverage.chartOptions
        );
        if (!indicatorChartOptions.series) {
          indicatorChartOptions.series = defaultSeries;
        }
      }
    } else if (indicatorKey === "rsi") {
      const rsiData = this.calculateRSI(this.series, 14);
      const defaultSeries = [
        {
          name: "RSI",
          data: rsiData.map((value, index) => ({
            x: this.series[index].x,
            y: value,
          })),
        },
      ];
      indicatorChartOptions = {
        chart: {
          type: "line",
          toolbar: { show: false },
          parentHeightOffset: 0,
        },
        series: defaultSeries,
        xaxis: {
          type: "datetime",
          labels: { show: false },
          axisTicks: { show: false },
        },
        yaxis: { min: 0, max: 100, title: { text: "RSI" } },
        stroke: { width: 1, colors: "#7D57C2" },
      };
      if (this.indicators.rsi?.chartOptions) {
        indicatorChartOptions = Object.assign(
          {},
          indicatorChartOptions,
          this.indicators.rsi.chartOptions
        );
        if (!indicatorChartOptions.series) {
          indicatorChartOptions.series = defaultSeries;
        }
      }
    } else if (indicatorKey === "macd") {
      const { macd, signal, histogram } = this.calculateMACD(this.series);
      const defaultSeries = [
        {
          name: "MACD",
          type: "line",
          data: macd.map((value, index) => ({
            x: this.series[index].x,
            y: this.truncateNumber(value),
          })),
          color: "#008FFB",
        },
        {
          name: "Signal",
          type: "line",
          data: signal.map((value, index) => ({
            x: this.series[index].x,
            y: this.truncateNumber(value),
          })),
          color: "#FF4560",
        },
        {
          name: "Histogram",
          type: "bar",
          data: histogram.map((value, index) => ({
            x: this.series[index].x,
            y: this.truncateNumber(value),
          })),
        },
      ];
      indicatorChartOptions = {
        chart: {
          type: "line",
          toolbar: { show: false },
          parentHeightOffset: 0,
        },
        series: defaultSeries,
        xaxis: { type: "datetime", labels: { show: false } },
        yaxis: { title: { text: "MACD" } },
        stroke: { width: [1, 1, 0] },
        legend: { show: false },
        plotOptions: {
          bar: {
            colors: {
              ranges: [
                { from: 0.1, to: 100, color: "#00E396" },
                { from: -100, to: 0, color: "#FF4560" },
              ],
            },
          },
        },
      };
      if (this.indicators.macd.chartOptions) {
        indicatorChartOptions = Object.assign(
          {},
          indicatorChartOptions,
          this.indicators.macd.chartOptions
        );
        if (!indicatorChartOptions.series) {
          indicatorChartOptions.series = defaultSeries;
        }
      }
    }

    // Create a new div for the indicator chart.
    const indicatorDiv = document.createElement("div");
    indicatorDiv.dataset.indicator = indicatorKey;
    indicatorDiv.style.width = "100%";
    this.indicatorContainer.appendChild(indicatorDiv);

    // Recalculate and update all chart heights.
    this.updateAllChartHeights();

    // Set the height for the new indicator chart in its options.
    if (!indicatorChartOptions.chart) indicatorChartOptions.chart = {};
    const { indicatorHeight } = this.computeHeights(
      this.indicatorContainer.children.length
    );
    indicatorChartOptions.chart.height = indicatorHeight;

    console.log(indicatorChartOptions);

    // Render the indicator chart in the new div.
    const chartInstance = new ApexCharts(indicatorDiv, indicatorChartOptions);
    chartInstance.render();
    this.indicatorCharts.push(chartInstance);

    document.getElementById("indicatorDropdown").value = "";
  }

  /**
   * Calculates a simple moving average (SMA) using the close price.
   */
  calculateMovingAverage(series, period) {
    const ma = [];
    for (let i = 0; i < series.length; i++) {
      if (i < period - 1) {
        ma.push(null);
      } else {
        let sum = 0;
        for (let j = i - period + 1; j <= i; j++) {
          sum += series[j].y[3];
        }
        ma.push(this.truncateNumber(sum / period));
      }
    }
    return ma;
  }

  /**
   * Calculates RSI using the close price.
   */
  calculateRSI(series, period) {
    const rsi = [];
    let gains = 0,
      losses = 0;
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
          let sumGain = 0,
            sumLoss = 0;
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
   */
  calculateBollingerBands(series, period, stdDev) {
    const middle = this.calculateMovingAverage(series, period);
    const upper = [],
      lower = [];
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
    return { middle, upper, lower };
  }

  /**
   * Calculates MACD for the given OHLC series.
   */
  calculateMACD(series, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    const fastEMA = this.calculateEMA(series, fastPeriod);
    const slowEMA = this.calculateEMA(series, slowPeriod);
    const macd = [];
    for (let i = 0; i < series.length; i++) {
      if (i < slowPeriod - 1) {
        macd.push(null);
      } else {
        macd.push(fastEMA[i] - slowEMA[i]);
      }
    }
    const signal = [];
    let signalSum = 0,
      validCount = 0;
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
    const histogram = [];
    for (let i = 0; i < series.length; i++) {
      if (i < slowPeriod - 1 + signalPeriod - 1) {
        histogram.push(null);
      } else {
        histogram.push(macd[i] - signal[i]);
      }
    }
    return { macd, signal, histogram };
  }

  /**
   * Calculates EMA for the given OHLC series.
   */
  calculateEMA(series, period) {
    const ema = [];
    const multiplier = 2 / (period + 1);
    let sum = 0;
    for (let i = 0; i < period; i++) {
      sum += series[i].y[3];
    }
    const sma = sum / period;
    for (let i = 0; i < series.length; i++) {
      if (i < period - 1) {
        ema.push(null);
      } else if (i === period - 1) {
        ema.push(this.truncateNumber(sma));
      } else {
        ema.push(
          this.truncateNumber(
            series[i].y[3] * multiplier + ema[i - 1] * (1 - multiplier)
          )
        );
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
