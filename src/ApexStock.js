import Indicators from "./Indicators";
import Utils from "./utils/Utils";
import Drawing from "./DrawingTools";

class ApexStock {
  /**
   * @param {HTMLElement} chartEl - The container element where the charts will be rendered.
   * @param {Object} chartOptions - The ApexCharts options object.
   */
  constructor(chartEl, chartOptions) {
    this.chartEl = chartEl;
    this.totalHeight = chartOptions.chart.height || 350;

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

    this.indicatorChartMap = {};
    this.FIBLEVELS = [0, 0.236, 0.382, 0.5, 0.618, 1];

    const stockChartOptions =
      (chartOptions.plotOptions && chartOptions.plotOptions.stockChart) || {};
    this.series = chartOptions.series[0].data || [];

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

    this.volumesData = this.series
      .map((point) => (point.v ? { x: point.x, y: point.v } : null))
      .filter((x) => x !== null);

    this.mainChartOptions = Object.assign({}, chartOptions, {
      chart: Object.assign({}, chartOptions.chart, {
        type: "candlestick",
        height: this.totalHeight,
        id: this.mainChartId,
        group: this.groupID,
        toolbar: {
          show: false,
        },
        animations: {
          enabled: false,
        },
      }),
      series: [{ name: "Price", data: this.series }],
      xaxis: { type: "datetime" },
      yaxis: [
        {
          tooltip: {
            enabled: true,
            offsetX: -20,
          },
          title: { text: "Price" },
        },
      ],
      legend: { show: false },
    });

    console.log(this.mainChartOptions);
    this.chart = new ApexCharts(this.mainChartDiv, this.mainChartOptions);
  }

  render() {
    this.chart.render();
    this.addCustomIndicatorDropdown();
    new Drawing(this.chart, this.chartEl, this.series);
  }

  randomId() {
    return (Math.random() + 1).toString(36).substring(4);
  }

  addCustomIndicatorDropdown() {
    const wrapper = document.createElement("div");
    wrapper.classList.add("apexstock-custom-select-wrapper");

    const trigger = document.createElement("div");
    trigger.classList.add("apexstock-custom-select-trigger");
    trigger.innerText = "Select Indicator";
    wrapper.appendChild(trigger);

    const optionsContainer = document.createElement("div");
    optionsContainer.classList.add("apexstock-custom-options");

    Object.keys(this.indicators).forEach((key) => {
      const displayName =
        key === "rsi" || key === "macd"
          ? key.toUpperCase()
          : key
              .replace(/([A-Z])/g, " $1")
              .replace(/^./, (str) => str.toUpperCase());
      const option = document.createElement("div");
      option.classList.add("apexstock-custom-option");
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
          ".apexstock-custom-option.selected"
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
      const defaultSeries = [{ name: "Volumes", data: this.volumesData }];
      indicatorChartOptions = {
        chart: {
          type: "area",
          toolbar: { show: false },
          parentHeightOffset: 0,
          id: "volume" + this.groupID,
          group: this.groupID,
          animations: { enabled: false },
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
        fill: { type: "solid", opacity: 0.2 },
      };
      if (this.indicators.volumes?.chartOptions) {
        indicatorChartOptions = Object.assign(
          {},
          indicatorChartOptions,
          this.indicators.volumes.chartOptions
        );
        if (!indicatorChartOptions.series)
          indicatorChartOptions.series = defaultSeries;
      }
    } else if (indicatorKey === "bollinger bands") {
      const period = 20,
        stdDev = 2;
      const { upper, lower } = Indicators.calculateBollingerBands(
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
      const currentSeries = this.chart.w.config.series.filter(
        (s) => s.name !== "Bollinger Bands"
      );
      this.chart.updateSeries([...currentSeries, bbSeries]);
      this.indicatorChartMap[indicatorKey] = true;
      return;
    } else if (indicatorKey === "moving average") {
      const maData = Indicators.calculateMovingAverage(this.series, 10);
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
        if (!indicatorChartOptions.series)
          indicatorChartOptions.series = defaultSeries;
      }
    } else if (indicatorKey === "rsi") {
      const rsiData = Indicators.calculateRSI(this.series, 14);
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
        if (!indicatorChartOptions.series)
          indicatorChartOptions.series = defaultSeries;
      }
    } else if (indicatorKey === "macd") {
      const { macd, signal, histogram } = Indicators.calculateMACD(this.series);
      const defaultSeries = [
        {
          name: "MACD",
          type: "line",
          data: macd.map((value, index) => ({
            x: this.series[index].x,
            y: Utils.truncateNumber(value),
          })),
          color: "#008FFB",
        },
        {
          name: "Signal",
          type: "line",
          data: signal.map((value, index) => ({
            x: this.series[index].x,
            y: Utils.truncateNumber(value),
          })),
          color: "#FF4560",
        },
        {
          name: "Histogram",
          type: "bar",
          data: histogram.map((value, index) => ({
            x: this.series[index].x,
            y: Utils.truncateNumber(value),
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
        if (!indicatorChartOptions.series)
          indicatorChartOptions.series = defaultSeries;
      }
    } else if (indicatorKey === "exponential moving average") {
      const emaData = Indicators.calculateEMA(this.series, 10);
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
    } else if (indicatorKey === "fibonacci retracements") {
      const levels = Indicators.calculateFibonacciRetracements(this.series);
      const annotations = levels.map((level, l) => ({
        id: "fib-anno-" + this.FIBLEVELS[l].toString().replace(/\./g, ""),
        y: level,
        borderColor: "#FF9900",
        label: {
          text: `${Math.round(
            ((level - Math.min(...this.series.map((pt) => pt.y[2]))) /
              (Math.max(...this.series.map((pt) => pt.y[1])) -
                Math.min(...this.series.map((pt) => pt.y[2])))) *
              100
          )}%`,
        },
      }));
      this.chart.updateOptions({ annotations: { yaxis: annotations } });
      this.indicatorChartMap[indicatorKey] = true;
      return;
    } else if (indicatorKey === "price volume trend") {
      const pvtData = Indicators.calculatePVT(this.series);
      const defaultSeries = [{ name: "PVT", data: pvtData }];
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
    } else if (indicatorKey === "stochastic oscillator") {
      const { k, d } = Indicators.calculateStochastic(this.series, 14, 3);
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
    } else if (indicatorKey === "standard deviation indicator") {
      const stdData = Indicators.calculateStdDevIndicator(this.series, 14);
      const defaultSeries = [{ name: "Std Dev", data: stdData }];
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
    } else if (indicatorKey === "average directional index") {
      const adxData = Indicators.calculateADX(this.series, 14);
      const defaultSeries = [{ name: "ADX", data: adxData }];
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
    } else if (indicatorKey === "chaikin oscillator") {
      const chaikin = Indicators.calculateChaikinOsc(this.series);
      const defaultSeries = [{ name: "Chaikin Osc", data: chaikin }];
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
    } else if (indicatorKey === "commodity channel index") {
      const cciData = Indicators.calculateCCI(this.series, 20);
      const defaultSeries = [{ name: "CCI", data: cciData }];
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
    } else if (indicatorKey === "trend strength index") {
      const tsiData = Indicators.calculateTSI(this.series, 25, 13);
      const defaultSeries = [{ name: "TSI", data: tsiData }];
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
    } else if (indicatorKey === "accelerator oscillator") {
      const acData = Indicators.calculateAcceleratorOsc(this.series);
      const defaultSeries = [{ name: "AC", data: acData }];
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
    } else if (indicatorKey === "bollinger bands %b") {
      const bb = Indicators.calculateBollingerBands(this.series, 20, 2);
      const bBPercent = Indicators.calculateBBPercent(
        this.series,
        bb.lower,
        bb.upper
      );
      const defaultSeries = [{ name: "Bollinger %B", data: bBPercent }];
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
    } else if (indicatorKey === "bollinger bands width") {
      const bb = Indicators.calculateBollingerBands(this.series, 20, 2);
      const bBWidth = Indicators.calculateBBWidth(
        this.series,
        bb.middle,
        bb.upper,
        bb.lower
      );
      const defaultSeries = [{ name: "Bollinger Width", data: bBWidth }];
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
    } else if (indicatorKey === "linear regression") {
      const lrData = Indicators.calculateLinearRegression(this.series, 30);
      const defaultSeries = [{ name: "Linear Regression", data: lrData }];
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
    } else if (indicatorKey === "ichimoku cloud indicator") {
      const ichimoku = Indicators.calculateIchimoku(this.series);
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
    } else if (indicatorKey === "fibonacci retracements") {
      this.FIBLEVELS.forEach((level) => {
        this.chart.removeAnnotation(
          "fib-anno-" + level.toString().replace(/\./g, "")
        );
      });
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
    return Indicators.calculateMovingAverage(series, period);
  }

  calculateRSI(series, period) {
    return Indicators.calculateRSI(series, period);
  }

  calculateBollingerBands(series, period, stdDev) {
    return Indicators.calculateBollingerBands(series, period, stdDev);
  }

  calculateMACD(series, fastPeriod, slowPeriod, signalPeriod) {
    return Indicators.calculateMACD(
      series,
      fastPeriod,
      slowPeriod,
      signalPeriod
    );
  }

  calculateEMA(series, period) {
    return Indicators.calculateEMA(series, period);
  }

  calculateFibonacciRetracements(series) {
    return Indicators.calculateFibonacciRetracements(series);
  }

  calculatePVT(series) {
    return Indicators.calculatePVT(series);
  }

  calculateStochastic(series, period, smoothPeriod) {
    return Indicators.calculateStochastic(series, period, smoothPeriod);
  }

  calculateStdDevIndicator(series, period) {
    return Indicators.calculateStdDevIndicator(series, period);
  }

  calculateADX(series, period) {
    return Indicators.calculateADX(series, period);
  }

  calculateChaikinOsc(series) {
    return Indicators.calculateChaikinOsc(series);
  }

  calculateEMAFromArray(arr, period) {
    return Indicators.calculateEMAFromArray(arr, period);
  }

  calculateSMAFromArray(arr, period) {
    return Indicators.calculateSMAFromArray(arr, period);
  }

  calculateBBPercent(series, lower, upper) {
    return Indicators.calculateBBPercent(series, lower, upper);
  }

  calculateBBWidth(series, middle, upper, lower) {
    return Indicators.calculateBBWidth(series, middle, upper, lower);
  }

  calculateLinearRegression(series, period) {
    return Indicators.calculateLinearRegression(series, period);
  }

  calculateIchimoku(series) {
    return Indicators.calculateIchimoku(series);
  }
}

window.ApexStock = ApexStock;
