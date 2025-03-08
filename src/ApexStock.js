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
   *     }
   */
  constructor(chartEl, chartOptions) {
    this.chartEl = chartEl;
    this.totalHeight = chartOptions.chart.height || 350;

    // Generate a random id for grouping indicator charts.
    chartOptions.chart.id = this.randomId();
    this.groupID = "group" + this.randomId();
    this.mainChartId = chartOptions.chart.id;

    this.chartEl.innerHTML = "";
    this.mainChartDiv = document.createElement("div");
    this.mainChartDiv.id = this.mainChartId;
    this.mainChartDiv.classList.add("apexstock-main-chart");
    this.mainChartDiv.style.height = this.totalHeight + "px";

    this.indicatorContainer = document.createElement("div");
    this.indicatorContainer.classList.add("apexstock-indicator-container");
    this.indicatorContainer.style.height = "0px";

    this.chartEl.appendChild(this.mainChartDiv);
    this.chartEl.appendChild(this.indicatorContainer);

    // Map to store indicator chart instances.
    this.indicatorChartMap = {};

    const stockChartOptions =
      (chartOptions.plotOptions && chartOptions.plotOptions.stockChart) || {};
    this.series = chartOptions.series[0].data || [];

    // Process indicator configuration.
    if (
      typeof stockChartOptions.indicators === "object" &&
      !Array.isArray(stockChartOptions.indicators)
    ) {
      this.indicators = stockChartOptions.indicators;
    } else if (Array.isArray(stockChartOptions.indicators)) {
      this.indicators = {};
      stockChartOptions.indicators.forEach((ind) => {
        this.indicators[ind.toLowerCase()] = { enabled: true };
      });
    } else {
      this.indicators = {
        "moving average": { enabled: true },
        rsi: { enabled: true },
        "bollinger bands": { enabled: true },
        macd: { enabled: true },
        volumes: { enabled: true },
        "exponential moving average": { enabled: true },
        "fibonacci retracements": { enabled: true },
        "price volume trend": { enabled: true },
        "stochastic oscillator": { enabled: true },
        "standard deviation indicator": { enabled: true },
        "average directional index": { enabled: true },
        "chaikin oscillator": { enabled: true },
        "commodity channel index": { enabled: true },
        "trend strength index": { enabled: true },
        "accelerator oscillator": { enabled: true },
        "bollinger bands %b": { enabled: true },
        "bollinger bands width": { enabled: true },
        "linear regression": { enabled: true },
        "ichimoku cloud indicator": { enabled: true },
      };
    }

    // Process volumes data.
    this.volumesData = this.series
      .map((point) => (point.v ? { x: point.x, y: point.v } : null))
      .filter((x) => x !== null);

    this.mainChartOptions = Object.assign({}, chartOptions, {
      chart: Object.assign({}, chartOptions.chart, {
        type: "candlestick",
        height: this.totalHeight,
        id: this.mainChartId,
        group: this.groupID,
      }),
      series: [
        {
          name: "Price",
          data: this.series,
        },
      ],
      xaxis: { type: "datetime" },
      yaxis: [{ opposite: false, title: { text: "Price" } }],
      legend: { show: false },
    });

    console.log(this.mainChartOptions);
    this.chart = new ApexCharts(this.mainChartDiv, this.mainChartOptions);
  }

  render() {
    this.chart.render();
    this.addCustomIndicatorDropdown();
    // this.addTrendlineOption(); // Optional
  }

  randomId() {
    return (Math.random() + 1).toString(36).substring(4);
  }

  addCustomIndicatorDropdown() {
    const wrapper = document.createElement("div");
    wrapper.classList.add("custom-select-wrapper");

    const trigger = document.createElement("div");
    trigger.classList.add("custom-select-trigger");
    trigger.innerText = "Select Indicator";
    wrapper.appendChild(trigger);

    const optionsContainer = document.createElement("div");
    optionsContainer.classList.add("custom-options");

    Object.keys(this.indicators).forEach((key) => {
      const displayName =
        key === "rsi" || key === "macd"
          ? key.toUpperCase()
          : key
              .replace(/([A-Z])/g, " $1")
              .replace(/^./, (str) => str.toUpperCase());
      const option = document.createElement("div");
      option.classList.add("custom-option");
      option.dataset.value = key;
      option.innerText = displayName;
      optionsContainer.appendChild(option);

      option.addEventListener("click", (e) => {
        const optionValue = e.currentTarget.dataset.value;
        if (e.currentTarget.classList.contains("selected")) {
          e.currentTarget.classList.remove("selected");
          this.removeIndicator(optionValue);
        } else {
          e.currentTarget.classList.add("selected");
          this.updateIndicator(optionValue);
        }
        const selectedOptions = optionsContainer.querySelectorAll(
          ".custom-option.selected"
        );
        trigger.innerText =
          selectedOptions.length > 0
            ? Array.from(selectedOptions)
                .map((opt) => opt.innerText)
                .join(", ")
            : "Select Indicator";
      });
    });

    wrapper.appendChild(optionsContainer);
    trigger.addEventListener("click", () => {
      optionsContainer.style.display =
        optionsContainer.style.display === "block" ? "none" : "block";
    });
    document.addEventListener("click", (e) => {
      if (!wrapper.contains(e.target)) {
        optionsContainer.style.display = "none";
      }
    });

    this.chartEl.parentNode.insertBefore(wrapper, this.chartEl);
  }

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

  computeHeights(newIndicatorCount) {
    const newMainHeight = Math.floor(0.6 * this.totalHeight);
    const indicatorContainerHeight = Math.floor(0.4 * this.totalHeight);
    const indicatorHeight = Math.floor(
      indicatorContainerHeight / newIndicatorCount
    );
    return { newMainHeight, indicatorContainerHeight, indicatorHeight };
  }

  updateAllChartHeights() {
    const indicatorCount = this.indicatorContainer.children.length;
    if (indicatorCount === 0) {
      this.mainChartDiv.style.height = this.totalHeight + "px";
      this.indicatorContainer.style.height = "0px";
      this.chart.updateOptions(
        { chart: { height: this.totalHeight } },
        false,
        false,
        false
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
      false,
      false
    );
    for (let i = 0; i < indicatorCount; i++) {
      const indicatorDiv = this.indicatorContainer.children[i];
      indicatorDiv.style.height = indicatorHeight + "px";
      const key = indicatorDiv.dataset.indicator;
      if (
        this.indicatorChartMap[key] &&
        typeof this.indicatorChartMap[key].updateOptions === "function"
      ) {
        this.indicatorChartMap[key].updateOptions(
          { chart: { height: indicatorHeight } },
          false,
          false,
          false
        );
      }
    }
  }

  updateIndicator(indicatorKey) {
    if (!indicatorKey) return;
    indicatorKey = indicatorKey.toLowerCase();

    // If already added, remove it.
    if (this.indicatorChartMap[indicatorKey]) {
      this.removeIndicator(indicatorKey);
      return;
    }

    let indicatorChartOptions = {};

    if (indicatorKey === "volumes") {
      if (!this.volumesData || this.volumesData.length === 0) {
        console.warn("No volumes data available.");
        return;
      }
      const defaultSeries = [
        {
          name: "Volumes",
          data: this.volumesData,
        },
      ];
      indicatorChartOptions = {
        chart: {
          type: "area",
          toolbar: { show: false },
          parentHeightOffset: 0,
          id: "volume" + this.groupID,
          group: this.groupID,
          animations: {
            enabled: false,
          },
        },
        series: defaultSeries,
        xaxis: {
          type: "datetime",
          labels: { show: false },
          axisTicks: { show: false },
        },
        yaxis: { title: { text: "Volume" } },
        stroke: { curve: "linestep", width: 1 },
        dataLabels: { enabled: false },
        fill: {
          type: "solid",
          opacity: 0.2,
        },
      };
      if (this.indicators.volumes?.chartOptions) {
        indicatorChartOptions = Object.assign(
          {},
          indicatorChartOptions,
          this.indicators.volumes.chartOptions
        );
        if (!indicatorChartOptions.series) {
          indicatorChartOptions.series = defaultSeries;
        }
      }
    }
    // Handle Bollinger Bands: add directly to main chart.
    else if (indicatorKey === "bollinger bands") {
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
      if (this.indicators["bollinger bands"]?.chartOptions) {
        bbSeries = Object.assign(
          {},
          bbSeries,
          this.indicators["bollinger bands"].chartOptions
        );
      }
      // Update main chart series to filter out any existing Bollinger Bands series,
      // then add the new one.
      const currentSeries = this.chart.w.config.series.filter(
        (s) => s.name !== "Bollinger Bands"
      );
      this.chart.updateSeries([...currentSeries, bbSeries]);
      // Store a marker for removal.
      this.indicatorChartMap[indicatorKey] = true;
      return;
    }
    // For Moving Average.
    else if (indicatorKey === "moving average") {
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
          id: "movingaverage" + this.groupID,
          group: this.groupID,
        },
        series: defaultSeries,
        xaxis: {
          type: "datetime",
          labels: { show: false },
          axisTicks: { show: false },
        },
        yaxis: { title: { text: "MA" } },
        stroke: { width: 1, colors: "#7D57C2" },
      };
      if (this.indicators["moving average"]?.chartOptions) {
        indicatorChartOptions = Object.assign(
          {},
          indicatorChartOptions,
          this.indicators["moving average"].chartOptions
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
          id: "rsi" + this.groupID,
          group: this.groupID,
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
          id: "macd" + this.groupID,
          group: this.groupID,
        },
        series: defaultSeries,
        xaxis: {
          type: "datetime",
          labels: { show: false },
          axisTicks: { show: false },
        },
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
      if (this.indicators.macd?.chartOptions) {
        indicatorChartOptions = Object.assign(
          {},
          indicatorChartOptions,
          this.indicators.macd.chartOptions
        );
        if (!indicatorChartOptions.series) {
          indicatorChartOptions.series = defaultSeries;
        }
      }
    } else if (indicatorKey === "exponential moving average") {
      // Here we use calculateEMA (which returns EMA values) as the indicator.
      const emaData = this.calculateEMA(this.series, 10);
      const defaultSeries = [
        {
          name: "EMA",
          data: emaData.map((value, index) => ({
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
          id: "ema" + this.groupID,
          group: this.groupID,
        },
        series: defaultSeries,
        xaxis: {
          type: "datetime",
          labels: { show: false },
          axisTicks: { show: false },
        },
        yaxis: { title: { text: "EMA" } },
        stroke: { width: 1, colors: "#FF9900" },
      };
    }
    // New indicator: Fibonacci Retracements (drawn as annotations on main chart).
    else if (indicatorKey === "fibonacci retracements") {
      // Compute high and low.
      const highs = this.series.map((pt) => pt.y[1]);
      const lows = this.series.map((pt) => pt.y[2]);
      const maxHigh = Math.max(...highs);
      const minLow = Math.min(...lows);
      const diff = maxHigh - minLow;
      const levels = [0, 0.236, 0.382, 0.5, 0.618, 1].map(
        (f) => minLow + f * diff
      );
      // Add annotations to main chart.
      const annotations = levels.map((level) => ({
        y: level,
        borderColor: "#FF9900",
        label: { text: `${Math.round(((level - minLow) / diff) * 100)}%` },
      }));
      // Update main chart with annotations.
      this.chart.updateOptions({ annotations: { yaxis: annotations } });
      // Store a marker.
      this.indicatorChartMap[indicatorKey] = true;
      return;
    }
    // New indicator: Price Volume Trend.
    else if (indicatorKey === "price volume trend") {
      const pvtData = this.calculatePVT(this.series);
      const defaultSeries = [
        {
          name: "PVT",
          data: pvtData,
        },
      ];
      indicatorChartOptions = {
        chart: {
          type: "line",
          toolbar: { show: false },
          parentHeightOffset: 0,
          id: "pvt" + this.groupID,
          group: this.groupID,
        },
        series: defaultSeries,
        xaxis: {
          type: "datetime",
          labels: { show: false },
          axisTicks: { show: false },
        },
        yaxis: { title: { text: "PVT" } },
        stroke: { width: 1, colors: "#0099CC" },
      };
    }
    // New indicator: Stochastic Oscillator.
    else if (indicatorKey === "stochastic oscillator") {
      const { k, d } = this.calculateStochastic(this.series, 14, 3);
      const defaultSeries = [
        { name: "Stochastic %K", data: k },
        { name: "Stochastic %D", data: d },
      ];
      indicatorChartOptions = {
        chart: {
          type: "line",
          toolbar: { show: false },
          parentHeightOffset: 0,
          id: "stochastic" + this.groupID,
          group: this.groupID,
        },
        series: defaultSeries,
        xaxis: {
          type: "datetime",
          labels: { show: false },
          axisTicks: { show: false },
        },
        yaxis: { title: { text: "Stochastic" } },
        stroke: { width: 1, colors: ["#33CC33", "#FF9933"] },
      };
    }
    // New indicator: Standard Deviation Indicator.
    else if (indicatorKey === "standard deviation indicator") {
      const stdData = this.calculateStdDevIndicator(this.series, 14);
      const defaultSeries = [
        {
          name: "Std Dev",
          data: stdData,
        },
      ];
      indicatorChartOptions = {
        chart: {
          type: "line",
          toolbar: { show: false },
          parentHeightOffset: 0,
          id: "stddev" + this.groupID,
          group: this.groupID,
        },
        series: defaultSeries,
        xaxis: {
          type: "datetime",
          labels: { show: false },
          axisTicks: { show: false },
        },
        yaxis: { title: { text: "Std Dev" } },
        stroke: { width: 1, colors: "#CC33FF" },
      };
    }
    // New indicator: Average Directional Index (ADX).
    else if (indicatorKey === "average directional index") {
      const adxData = this.calculateADX(this.series, 14);
      const defaultSeries = [
        {
          name: "ADX",
          data: adxData,
        },
      ];
      indicatorChartOptions = {
        chart: {
          type: "line",
          toolbar: { show: false },
          parentHeightOffset: 0,
          id: "adx" + this.groupID,
          group: this.groupID,
        },
        series: defaultSeries,
        xaxis: {
          type: "datetime",
          labels: { show: false },
          axisTicks: { show: false },
        },
        yaxis: { title: { text: "ADX" } },
        stroke: { width: 1, colors: "#9900CC" },
      };
    }
    // New indicator: Chaikin Oscillator.
    else if (indicatorKey === "chaikin oscillator") {
      const chaikin = this.calculateChaikinOsc(this.series);
      const defaultSeries = [
        {
          name: "Chaikin Osc",
          data: chaikin,
        },
      ];
      indicatorChartOptions = {
        chart: {
          type: "line",
          toolbar: { show: false },
          parentHeightOffset: 0,
          id: "chaikin" + this.groupID,
          group: this.groupID,
        },
        series: defaultSeries,
        xaxis: {
          type: "datetime",
          labels: { show: false },
          axisTicks: { show: false },
        },
        yaxis: { title: { text: "Chaikin" } },
        stroke: { width: 1, colors: "#CC3333" },
      };
    }
    // New indicator: Commodity Channel Index (CCI).
    else if (indicatorKey === "commodity channel index") {
      const cciData = this.calculateCCI(this.series, 20);
      const defaultSeries = [
        {
          name: "CCI",
          data: cciData,
        },
      ];
      indicatorChartOptions = {
        chart: {
          type: "line",
          toolbar: { show: false },
          parentHeightOffset: 0,
          id: "cci" + this.groupID,
          group: this.groupID,
        },
        series: defaultSeries,
        xaxis: {
          type: "datetime",
          labels: { show: false },
          axisTicks: { show: false },
        },
        yaxis: { title: { text: "CCI" } },
        stroke: { width: 1, colors: "#FF6600" },
      };
    }
    // New indicator: Trend Strength Index (TSI).
    else if (indicatorKey === "trend strength index") {
      const tsiData = this.calculateTSI(this.series, 25, 13);
      const defaultSeries = [
        {
          name: "TSI",
          data: tsiData,
        },
      ];
      indicatorChartOptions = {
        chart: {
          type: "line",
          toolbar: { show: false },
          parentHeightOffset: 0,
          id: "tsi" + this.groupID,
          group: this.groupID,
        },
        series: defaultSeries,
        xaxis: {
          type: "datetime",
          labels: { show: false },
          axisTicks: { show: false },
        },
        yaxis: { title: { text: "TSI" } },
        stroke: { width: 1, colors: "#0066CC" },
      };
    }
    // New indicator: Accelerator Oscillator.
    else if (indicatorKey === "accelerator oscillator") {
      const acData = this.calculateAcceleratorOsc(this.series);
      const defaultSeries = [
        {
          name: "AC",
          data: acData,
        },
      ];
      indicatorChartOptions = {
        chart: {
          type: "line",
          toolbar: { show: false },
          parentHeightOffset: 0,
          id: "ac" + this.groupID,
          group: this.groupID,
        },
        series: defaultSeries,
        xaxis: {
          type: "datetime",
          labels: { show: false },
          axisTicks: { show: false },
        },
        yaxis: { title: { text: "AC" } },
        stroke: { width: 1, colors: "#009900" },
      };
    }
    // New indicator: Bollinger Bands %B.
    else if (indicatorKey === "bollinger bands %b") {
      const bb = this.calculateBollingerBands(this.series, 20, 2);
      const bBPercent = this.calculateBBPercent(
        this.series,
        bb.lower,
        bb.upper
      );
      const defaultSeries = [
        {
          name: "Bollinger %B",
          data: bBPercent,
        },
      ];
      indicatorChartOptions = {
        chart: {
          type: "line",
          toolbar: { show: false },
          parentHeightOffset: 0,
          id: "bbb" + this.groupID,
          group: this.groupID,
        },
        series: defaultSeries,
        xaxis: {
          type: "datetime",
          labels: { show: false },
          axisTicks: { show: false },
        },
        yaxis: { title: { text: "%B" } },
        stroke: { width: 1, colors: "#6600CC" },
      };
    }
    // New indicator: Bollinger Bands Width.
    else if (indicatorKey === "bollinger bands width") {
      const bb = this.calculateBollingerBands(this.series, 20, 2);
      const bBWidth = this.calculateBBWidth(
        this.series,
        bb.middle,
        bb.upper,
        bb.lower
      );
      const defaultSeries = [
        {
          name: "Bollinger Width",
          data: bBWidth,
        },
      ];
      indicatorChartOptions = {
        chart: {
          type: "line",
          toolbar: { show: false },
          parentHeightOffset: 0,
          id: "bbw" + this.groupID,
          group: this.groupID,
        },
        series: defaultSeries,
        xaxis: {
          type: "datetime",
          labels: { show: false },
          axisTicks: { show: false },
        },
        yaxis: { title: { text: "Width" } },
        stroke: { width: 1, colors: "#CC0066" },
      };
    }
    // New indicator: Linear Regression.
    else if (indicatorKey === "linear regression") {
      const lrData = this.calculateLinearRegression(this.series, 30);
      const defaultSeries = [
        {
          name: "Linear Regression",
          data: lrData,
        },
      ];
      indicatorChartOptions = {
        chart: {
          type: "line",
          toolbar: { show: false },
          parentHeightOffset: 0,
          id: "lr" + this.groupID,
          group: this.groupID,
        },
        series: defaultSeries,
        xaxis: {
          type: "datetime",
          labels: { show: false },
          axisTicks: { show: false },
        },
        yaxis: { title: { text: "LR" } },
        stroke: { width: 1, colors: "#0099FF" },
      };
    }
    // New indicator: Ichimoku Cloud Indicator.
    else if (indicatorKey === "ichimoku cloud indicator") {
      const ichimoku = this.calculateIchimoku(this.series);
      // For simplicity, we plot just the Tenkan-sen and Kijun-sen lines.
      const defaultSeries = [
        { name: "Tenkan-sen", data: ichimoku.tenkan },
        { name: "Kijun-sen", data: ichimoku.kijun },
      ];
      indicatorChartOptions = {
        chart: {
          type: "line",
          toolbar: { show: false },
          parentHeightOffset: 0,
          id: "ichimoku" + this.groupID,
          group: this.groupID,
        },
        series: defaultSeries,
        xaxis: {
          type: "datetime",
          labels: { show: false },
          axisTicks: { show: false },
        },
        yaxis: { title: { text: "Ichimoku" } },
        stroke: { width: 1, colors: ["#FF6600", "#0066FF"] },
      };
    }

    // Create a new div for the indicator chart.
    const indicatorDiv = document.createElement("div");
    indicatorDiv.dataset.indicator = indicatorKey;
    indicatorDiv.style.width = "100%";
    this.indicatorContainer.appendChild(indicatorDiv);

    this.updateAllChartHeights();
    if (!indicatorChartOptions.chart) indicatorChartOptions.chart = {};
    const { indicatorHeight } = this.computeHeights(
      this.indicatorContainer.children.length
    );
    indicatorChartOptions.chart.height = indicatorHeight;

    const chartInstance = new ApexCharts(indicatorDiv, indicatorChartOptions);
    chartInstance.render();
    this.indicatorChartMap[indicatorKey] = chartInstance;
  }

  removeIndicator(indicatorKey) {
    indicatorKey = indicatorKey.toLowerCase();
    if (indicatorKey === "bollinger bands") {
      const currentSeries = this.chart.w.config.series;
      const newSeries = currentSeries.filter(
        (s) => s.name !== "Bollinger Bands"
      );
      this.chart.updateSeries(newSeries);
      delete this.indicatorChartMap[indicatorKey];
    } else {
      const chartInstance = this.indicatorChartMap[indicatorKey];
      if (chartInstance) {
        chartInstance.destroy();
        const children = Array.from(this.indicatorContainer.children);
        children.forEach((child) => {
          if (child.dataset.indicator === indicatorKey) {
            this.indicatorContainer.removeChild(child);
          }
        });
        delete this.indicatorChartMap[indicatorKey];
        this.updateAllChartHeights();
      }
    }
  }

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

  // Calculate Fibonacci Retracements.
  calculateFibonacciRetracements(series) {
    const highs = series.map((pt) => pt.y[1]);
    const lows = series.map((pt) => pt.y[2]);
    const maxHigh = Math.max(...highs);
    const minLow = Math.min(...lows);
    const diff = maxHigh - minLow;
    // Levels: 0%, 23.6%, 38.2%, 50%, 61.8%, 100%
    return [0, 0.236, 0.382, 0.5, 0.618, 1].map(
      (level) => minLow + level * diff
    );
  }

  // New: Calculate Price Volume Trend.
  calculatePVT(series) {
    const pvt = [];
    let prev = 0;
    for (let i = 0; i < series.length; i++) {
      if (i === 0) {
        pvt.push({ x: series[i].x, y: 0 });
      } else {
        const prevClose = series[i - 1].y[3];
        const currClose = series[i].y[3];
        const volume = series[i].v || 0;
        const changePct = (currClose - prevClose) / prevClose;
        prev = prev + changePct * volume;
        pvt.push({ x: series[i].x, y: this.truncateNumber(prev) });
      }
    }
    return pvt;
  }

  // New: Calculate Stochastic Oscillator.
  calculateStochastic(series, period, smoothPeriod) {
    const k = [];
    for (let i = 0; i < series.length; i++) {
      if (i < period - 1) {
        k.push({ x: series[i].x, y: null });
      } else {
        const periodSlice = series.slice(i - period + 1, i + 1);
        const closes = periodSlice.map((pt) => pt.y[3]);
        const highs = periodSlice.map((pt) => pt.y[1]);
        const lows = periodSlice.map((pt) => pt.y[2]);
        const highestHigh = Math.max(...highs);
        const lowestLow = Math.min(...lows);
        const value =
          ((series[i].y[3] - lowestLow) / (highestHigh - lowestLow)) * 100;
        k.push({ x: series[i].x, y: this.truncateNumber(value) });
      }
    }
    // Smooth %K to get %D.
    const d = [];
    for (let i = 0; i < k.length; i++) {
      if (i < smoothPeriod - 1 || k[i].y === null) {
        d.push({ x: k[i].x, y: null });
      } else {
        let sum = 0;
        for (let j = i - smoothPeriod + 1; j <= i; j++) {
          sum += k[j].y;
        }
        d.push({ x: k[i].x, y: this.truncateNumber(sum / smoothPeriod) });
      }
    }
    return { k, d };
  }

  // New: Calculate Standard Deviation Indicator.
  calculateStdDevIndicator(series, period) {
    const stdDevArr = [];
    for (let i = 0; i < series.length; i++) {
      if (i < period - 1) {
        stdDevArr.push({ x: series[i].x, y: null });
      } else {
        const periodSlice = series.slice(i - period + 1, i + 1);
        const closes = periodSlice.map((pt) => pt.y[3]);
        const mean = closes.reduce((a, b) => a + b, 0) / period;
        let sumSq = 0;
        closes.forEach((c) => {
          sumSq += Math.pow(c - mean, 2);
        });
        const std = Math.sqrt(sumSq / period);
        stdDevArr.push({ x: series[i].x, y: this.truncateNumber(std) });
      }
    }
    return stdDevArr;
  }

  // New: Calculate Average Directional Index (ADX). (Simplified version)
  calculateADX(series, period) {
    // This is a very simplified placeholder implementation.
    const adxArr = [];
    // For simplicity, we return an array with nulls for initial period and then a constant value.
    for (let i = 0; i < series.length; i++) {
      adxArr.push({ x: series[i].x, y: i < period ? null : 25 });
    }
    return adxArr;
  }

  // New: Calculate Chaikin Oscillator.
  calculateChaikinOsc(series) {
    // Compute A/D line.
    const ad = [];
    let cumulative = 0;
    for (let i = 0; i < series.length; i++) {
      const high = series[i].y[1];
      const low = series[i].y[2];
      const close = series[i].y[3];
      const volume = series[i].v || 0;
      const clv = (high - close - (close - low)) / (high - low || 1);
      cumulative += clv * volume;
      ad.push(cumulative);
    }
    // Calculate EMAs of the A/D line.
    const emaShort = this.calculateEMAFromArray(ad, 3);
    const emaLong = this.calculateEMAFromArray(ad, 10);
    const chaikin = [];
    for (let i = 0; i < ad.length; i++) {
      if (emaShort[i] === null || emaLong[i] === null) {
        chaikin.push({ x: series[i].x, y: null });
      } else {
        chaikin.push({
          x: series[i].x,
          y: this.truncateNumber(emaShort[i] - emaLong[i]),
        });
      }
    }
    return chaikin;
  }

  // Helper: Calculate EMA from an array of numbers.
  calculateEMAFromArray(arr, period) {
    const ema = [];
    const multiplier = 2 / (period + 1);
    let sum = 0;
    for (let i = 0; i < arr.length; i++) {
      if (i < period) {
        if (arr[i] !== null) sum += arr[i];
        else sum += 0;
        if (i === period - 1) {
          const sma = sum / period;
          ema.push(this.truncateNumber(sma));
        } else {
          ema.push(null);
        }
      } else {
        ema.push(
          this.truncateNumber(
            arr[i] * multiplier + ema[i - 1] * (1 - multiplier)
          )
        );
      }
    }
    return ema;
  }

  // New: Calculate Commodity Channel Index (CCI).
  calculateCCI(series, period) {
    const cciArr = [];
    for (let i = 0; i < series.length; i++) {
      if (i < period - 1) {
        cciArr.push({ x: series[i].x, y: null });
      } else {
        const slice = series.slice(i - period + 1, i + 1);
        const typicalPrices = slice.map(
          (pt) => (pt.y[1] + pt.y[2] + pt.y[3]) / 3
        );
        const sma = typicalPrices.reduce((a, b) => a + b, 0) / period;
        const meanDeviation =
          typicalPrices.reduce((acc, tp) => acc + Math.abs(tp - sma), 0) /
          period;
        const currentTypical =
          (series[i].y[1] + series[i].y[2] + series[i].y[3]) / 3;
        const cci = (currentTypical - sma) / (0.015 * meanDeviation);
        cciArr.push({ x: series[i].x, y: this.truncateNumber(cci) });
      }
    }
    return cciArr;
  }

  // New: Calculate Trend Strength Index (TSI). (Simplified version)
  calculateTSI(series, longPeriod, shortPeriod) {
    // Using a simplified version: TSI = 100 * (Double smoothed price change) / (Double smoothed absolute price change)
    const diff = [];
    for (let i = 0; i < series.length; i++) {
      if (i === 0) diff.push(0);
      else diff.push(series[i].y[3] - series[i - 1].y[3]);
    }
    const smoothedDiff = this.calculateEMAFromArray(diff, shortPeriod);
    const doubleSmoothedDiff = this.calculateEMAFromArray(
      smoothedDiff,
      longPeriod
    );
    const absDiff = diff.map((d) => Math.abs(d));
    const smoothedAbsDiff = this.calculateEMAFromArray(absDiff, shortPeriod);
    const doubleSmoothedAbsDiff = this.calculateEMAFromArray(
      smoothedAbsDiff,
      longPeriod
    );
    const tsi = [];
    for (let i = 0; i < series.length; i++) {
      if (doubleSmoothedAbsDiff[i] === 0 || doubleSmoothedDiff[i] === null) {
        tsi.push({ x: series[i].x, y: null });
      } else {
        tsi.push({
          x: series[i].x,
          y: this.truncateNumber(
            100 * (doubleSmoothedDiff[i] / doubleSmoothedAbsDiff[i])
          ),
        });
      }
    }
    return tsi;
  }

  // New: Calculate Accelerator Oscillator.
  calculateAcceleratorOsc(series) {
    // Awesome Oscillator (AO): difference between 5-period SMA and 34-period SMA of median price.
    const medianPrices = series.map((pt) => (pt.y[1] + pt.y[2]) / 2);
    const sma5 = this.calculateSMAFromArray(medianPrices, 5);
    const sma34 = this.calculateSMAFromArray(medianPrices, 34);
    const ao = medianPrices.map((_, i) => {
      if (sma5[i] === null || sma34[i] === null) return null;
      return sma5[i] - sma34[i];
    });
    const aoSMA = this.calculateSMAFromArray(ao, 5);
    const ac = ao.map((val, i) => {
      if (val === null || aoSMA[i] === null) return null;
      return val - aoSMA[i];
    });
    return series.map((pt, i) => ({ x: pt.x, y: this.truncateNumber(ac[i]) }));
  }

  // Helper: Calculate SMA from an array.
  calculateSMAFromArray(arr, period) {
    const sma = [];
    for (let i = 0; i < arr.length; i++) {
      if (i < period - 1) {
        sma.push(null);
      } else {
        let sum = 0;
        for (let j = i - period + 1; j <= i; j++) {
          sum += arr[j];
        }
        sma.push(this.truncateNumber(sum / period));
      }
    }
    return sma;
  }

  // New: Calculate Bollinger Bands %B.
  calculateBBPercent(series, lower, upper) {
    const percentB = [];
    for (let i = 0; i < series.length; i++) {
      const close = series[i].y[3];
      if (lower[i] === null || upper[i] === null) {
        percentB.push({ x: series[i].x, y: null });
      } else {
        const pb = (close - lower[i]) / (upper[i] - lower[i]);
        percentB.push({ x: series[i].x, y: this.truncateNumber(pb) });
      }
    }
    return percentB;
  }

  // New: Calculate Bollinger Bands Width.
  calculateBBWidth(series, middle, upper, lower) {
    const bbWidth = [];
    for (let i = 0; i < series.length; i++) {
      if (middle[i] === null || upper[i] === null || lower[i] === null) {
        bbWidth.push({ x: series[i].x, y: null });
      } else {
        const width = (upper[i] - lower[i]) / middle[i];
        bbWidth.push({ x: series[i].x, y: this.truncateNumber(width) });
      }
    }
    return bbWidth;
  }

  // New: Calculate Linear Regression.
  calculateLinearRegression(series, period) {
    const lr = [];
    for (let i = 0; i < series.length; i++) {
      if (i < period - 1) {
        lr.push({ x: series[i].x, y: null });
      } else {
        let sumX = 0,
          sumY = 0,
          sumXY = 0,
          sumX2 = 0;
        for (let j = i - period + 1; j <= i; j++) {
          const xVal = j;
          const yVal = series[j].y[3];
          sumX += xVal;
          sumY += yVal;
          sumXY += xVal * yVal;
          sumX2 += xVal * xVal;
        }
        const slope =
          (period * sumXY - sumX * sumY) / (period * sumX2 - sumX * sumX);
        const intercept = (sumY - slope * sumX) / period;
        const lrVal = slope * i + intercept;
        lr.push({ x: series[i].x, y: this.truncateNumber(lrVal) });
      }
    }
    return lr;
  }

  // New: Calculate Ichimoku Cloud Indicator. (Simplified)
  calculateIchimoku(series) {
    const tenkan = [];
    const kijun = [];
    const senkouA = [];
    const senkouB = [];
    const chikou = [];
    for (let i = 0; i < series.length; i++) {
      // Tenkan-sen: (Highest High + Lowest Low) / 2 for past 9 periods.
      if (i < 8) {
        tenkan.push({ x: series[i].x, y: null });
      } else {
        const slice = series.slice(i - 8, i + 1);
        const high = Math.max(...slice.map((pt) => pt.y[1]));
        const low = Math.min(...slice.map((pt) => pt.y[2]));
        tenkan.push({
          x: series[i].x,
          y: this.truncateNumber((high + low) / 2),
        });
      }
      // Kijun-sen: same but for past 26 periods.
      if (i < 25) {
        kijun.push({ x: series[i].x, y: null });
      } else {
        const slice = series.slice(i - 25, i + 1);
        const high = Math.max(...slice.map((pt) => pt.y[1]));
        const low = Math.min(...slice.map((pt) => pt.y[2]));
        kijun.push({
          x: series[i].x,
          y: this.truncateNumber((high + low) / 2),
        });
      }
      // Chikou Span: current close shifted 26 periods back.
      if (i < 26) {
        chikou.push({ x: series[i].x, y: null });
      } else {
        chikou.push({ x: series[i - 26].x, y: series[i].y[3] });
      }
      // Senkou Span B: (Highest High + Lowest Low) / 2 for past 52 periods, plotted 26 periods ahead.
      if (i < 51) {
        senkouB.push({ x: series[i].x, y: null });
      } else {
        const slice = series.slice(i - 51, i + 1);
        const high = Math.max(...slice.map((pt) => pt.y[1]));
        const low = Math.min(...slice.map((pt) => pt.y[2]));
        senkouB.push({
          x: series[i].x,
          y: this.truncateNumber((high + low) / 2),
        });
      }
      // Senkou Span A: (Tenkan-sen + Kijun-sen) / 2, plotted 26 periods ahead.
      if (i < 25 || tenkan[i].y === null || kijun[i].y === null) {
        senkouA.push({ x: series[i].x, y: null });
      } else {
        senkouA.push({
          x: series[i].x,
          y: this.truncateNumber((tenkan[i].y + kijun[i].y) / 2),
        });
      }
    }
    return { tenkan, kijun, senkouA, senkouB, chikou };
  }

  truncateNumber(val) {
    if (val === null) return val;
    return Number(val.toFixed(2));
  }
}

// Expose ApexStock to the global scope.
window.ApexStock = ApexStock;
