// IndicatorHandlers.js
// Contains the updateIndicator function and related methods for ApexStock

export default class IndicatorHandlers {
  /**
   * Updates or adds an indicator to the chart
   * @param {string} indicatorKey - The key/name of the indicator to update
   * @param {Object} context - The ApexStock instance
   */
  static updateIndicator(indicatorKey, context) {
    if (!indicatorKey) return;
    indicatorKey = indicatorKey.toLowerCase();

    if (context.indicatorChartMap[indicatorKey]) {
      context.removeIndicator(indicatorKey);
      return;
    }

    let indicatorChartOptions = {};

    // For overlays that are drawn on the main chart
    if (indicatorKey === "bollinger bands") {
      const period = 20,
        stdDev = 2;
      const { upper, lower } = context.calculateBollingerBands(
        context.series,
        period,
        stdDev
      );
      let bbSeries = {
        name: "Bollinger Bands",
        type: "rangeArea",
        data: upper.map((value, index) => ({
          x: context.series[index].x,
          y: [lower[index], value],
        })),
        color: "rgba(0, 114, 255, 0.08)",
      };
      if (context.indicators["bollinger bands"]?.chartOptions) {
        bbSeries = Object.assign(
          {},
          bbSeries,
          context.indicators["bollinger bands"].chartOptions
        );
      }
      const currentSeries = context.chart.w.config.series.filter(
        (s) => s.name !== "Bollinger Bands"
      );
      context.chart.updateSeries([...currentSeries, bbSeries]);
      context.indicatorChartMap[indicatorKey] = true;
      return;
    } else if (indicatorKey === "moving average") {
      const maData = context.calculateMovingAverage(context.series, 10);
      const maSeries = {
        name: "Moving Average",
        type: "line",
        data: maData.map((value, index) => ({
          x: context.series[index].x,
          y: value,
        })),
        color: "#7D57C2",
      };
      const currentSeries = context.chart.w.config.series.filter(
        (s) => s.name !== "Moving Average"
      );
      context.chart.updateSeries([...currentSeries, maSeries]);
      context.indicatorChartMap[indicatorKey] = true;
      return;
    } else if (indicatorKey === "exponential moving average") {
      const emaData = context.calculateEMA(context.series, 10);
      const emaSeries = {
        name: "EMA",
        type: "line",
        data: emaData.map((value, index) => ({
          x: context.series[index].x,
          y: value,
        })),
        color: "#FF9900",
      };
      const currentSeries = context.chart.w.config.series.filter(
        (s) => s.name !== "EMA"
      );
      context.chart.updateSeries([...currentSeries, emaSeries]);
      context.indicatorChartMap[indicatorKey] = true;
      return;
    } else if (indicatorKey === "fibonacci retracements") {
      const levels = context.calculateFibonacciRetracements(context.series);
      const annotations = levels.map((level, l) => ({
        id: "fib-anno-" + context.FIBLEVELS[l].toString().replace(/\./g, ""),
        y: level,
        borderColor: "#FF9900",
        label: {
          text: `${Math.round(
            ((level - Math.min(...context.series.map((pt) => pt.y[2]))) /
              (Math.max(...context.series.map((pt) => pt.y[1])) -
                Math.min(...context.series.map((pt) => pt.y[2])))) *
              100
          )}%`,
        },
      }));
      context.chart.updateOptions({ annotations: { yaxis: annotations } });
      context.indicatorChartMap[indicatorKey] = true;
      return;
    } else if (indicatorKey === "linear regression") {
      const lrData = context.calculateLinearRegression(context.series, 30);

      const lrSeries = {
        name: "Linear Regression",
        type: "line",
        data: lrData.map((value, index) => ({
          x: context.series[index].x,
          y: value.y,
        })),
        color: "#0099FF",
      };
      const currentSeries = context.chart.w.config.series.filter(
        (s) => s.name !== "Linear Regression"
      );

      context.chart.updateSeries([...currentSeries, lrSeries]);
      context.indicatorChartMap[indicatorKey] = true;
      return;
    } else if (indicatorKey === "ichimoku cloud indicator") {
      const ichimoku = context.calculateIchimoku(context.series);
      const tenkanSeries = {
        name: "Tenkan-sen",
        type: "line",
        data: ichimoku.tenkan.map((value, index) => ({
          x: context.series[index].x,
          y: value.y,
        })),
        color: "#FF6600",
      };
      const kijunSeries = {
        name: "Kijun-sen",
        type: "line",
        data: ichimoku.kijun.map((value, index) => ({
          x: context.series[index].x,
          y: value,
        })),
        color: "#0066FF",
      };
      const currentSeries = context.chart.w.config.series.filter(
        (s) => s.name !== "Tenkan-sen" && s.name !== "Kijun-sen"
      );
      context.chart.updateSeries([...currentSeries, tenkanSeries, kijunSeries]);
      context.indicatorChartMap[indicatorKey] = true;
      return;
    }

    // For oscillators that are drawn in separate charts
    if (indicatorKey === "volumes") {
      if (!context.volumesData || context.volumesData.length === 0) {
        console.warn("No volumes data available.");
        return;
      }
      const defaultSeries = [{ name: "Volumes", data: context.volumesData }];
      indicatorChartOptions = {
        chart: {
          type: "area",
          toolbar: { show: false },
          parentHeightOffset: 0,
          id: "volume" + context.groupID,
          group: context.groupID,
          animations: { enabled: false },
        },
        series: defaultSeries,
        xaxis: {
          labels: { show: false },
          axisTicks: { show: false },
        },
        yaxis: { title: { text: "Volume" } },
        stroke: { curve: "linestep", width: 1 },
        dataLabels: { enabled: false },
        fill: { type: "solid", opacity: 0.2 },
      };
      if (context.indicators.volumes?.chartOptions) {
        indicatorChartOptions = Object.assign(
          {},
          indicatorChartOptions,
          context.indicators.volumes.chartOptions
        );
        if (!indicatorChartOptions.series)
          indicatorChartOptions.series = defaultSeries;
      }
    } else if (indicatorKey === "rsi") {
      const rsiData = context.calculateRSI(context.series, 14);
      const defaultSeries = [
        {
          name: "RSI",
          data: rsiData.map((value, index) => ({
            x: context.series[index].x,
            y: value,
          })),
        },
      ];
      indicatorChartOptions = {
        chart: {
          type: "line",
          toolbar: { show: false },
          parentHeightOffset: 0,
          id: "rsi" + context.groupID,
          group: context.groupID,
        },
        series: defaultSeries,
        xaxis: {
          labels: { show: false },
          axisTicks: { show: false },
        },
        yaxis: { min: 0, max: 100, title: { text: "RSI" } },
        stroke: { width: 1, colors: "#7D57C2" },
      };
      if (context.indicators.rsi?.chartOptions) {
        indicatorChartOptions = Object.assign(
          {},
          indicatorChartOptions,
          context.indicators.rsi.chartOptions
        );
        if (!indicatorChartOptions.series)
          indicatorChartOptions.series = defaultSeries;
      }
    } else if (indicatorKey === "macd") {
      const { macd, signal, histogram } = context.calculateMACD(context.series);
      const defaultSeries = [
        {
          name: "MACD",
          type: "line",
          data: macd.map((value, index) => ({
            x: context.series[index].x,
            y: context.Utils.truncateNumber(value),
          })),
          color: "#008FFB",
        },
        {
          name: "Signal",
          type: "line",
          data: signal.map((value, index) => ({
            x: context.series[index].x,
            y: context.Utils.truncateNumber(value),
          })),
          color: "#FF4560",
        },
        {
          name: "Histogram",
          type: "bar",
          data: histogram.map((value, index) => ({
            x: context.series[index].x,
            y: context.Utils.truncateNumber(value),
          })),
        },
      ];
      indicatorChartOptions = {
        chart: {
          type: "line",
          toolbar: { show: false },
          parentHeightOffset: 0,
          id: "macd" + context.groupID,
          group: context.groupID,
        },
        series: defaultSeries,
        xaxis: {
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
      if (context.indicators.macd?.chartOptions) {
        indicatorChartOptions = Object.assign(
          {},
          indicatorChartOptions,
          context.indicators.macd.chartOptions
        );
        if (!indicatorChartOptions.series)
          indicatorChartOptions.series = defaultSeries;
      }
    } else if (indicatorKey === "price volume trend") {
      const pvtData = context.calculatePVT(context.series);
      const defaultSeries = [{ name: "PVT", data: pvtData }];
      indicatorChartOptions = {
        chart: {
          type: "line",
          toolbar: { show: false },
          parentHeightOffset: 0,
          id: "pvt" + context.groupID,
          group: context.groupID,
        },
        series: defaultSeries,
        xaxis: {
          labels: { show: false },
          axisTicks: { show: false },
        },
        yaxis: { title: { text: "PVT" } },
        stroke: { width: 1, colors: "#0099CC" },
      };
    } else if (indicatorKey === "stochastic oscillator") {
      const { k, d } = context.calculateStochastic(context.series, 14, 3);
      const defaultSeries = [
        { name: "Stochastic %K", data: k },
        { name: "Stochastic %D", data: d },
      ];
      indicatorChartOptions = {
        chart: {
          type: "line",
          toolbar: { show: false },
          parentHeightOffset: 0,
          id: "stochastic" + context.groupID,
          group: context.groupID,
        },
        series: defaultSeries,
        xaxis: {
          labels: { show: false },
          axisTicks: { show: false },
        },
        yaxis: { title: { text: "Stochastic" } },
        stroke: { width: 1, colors: ["#33CC33", "#FF9933"] },
      };
    } else if (indicatorKey === "standard deviation indicator") {
      const stdData = context.calculateStdDevIndicator(context.series, 14);
      const defaultSeries = [{ name: "Std Dev", data: stdData }];
      indicatorChartOptions = {
        chart: {
          type: "line",
          toolbar: { show: false },
          parentHeightOffset: 0,
          id: "stddev" + context.groupID,
          group: context.groupID,
        },
        series: defaultSeries,
        xaxis: {
          labels: { show: false },
          axisTicks: { show: false },
        },
        yaxis: { title: { text: "Std Dev" } },
        stroke: { width: 1, colors: "#CC33FF" },
      };
    } else if (indicatorKey === "average directional index") {
      const adxData = context.calculateADX(context.series, 14);
      const defaultSeries = [{ name: "ADX", data: adxData }];
      indicatorChartOptions = {
        chart: {
          type: "line",
          toolbar: { show: false },
          parentHeightOffset: 0,
          id: "adx" + context.groupID,
          group: context.groupID,
        },
        series: defaultSeries,
        xaxis: {
          labels: { show: false },
          axisTicks: { show: false },
        },
        yaxis: { title: { text: "ADX" } },
        stroke: { width: 1, colors: "#9900CC" },
      };
    } else if (indicatorKey === "chaikin oscillator") {
      const chaikin = context.calculateChaikinOsc(context.series);
      const defaultSeries = [{ name: "Chaikin Osc", data: chaikin }];
      indicatorChartOptions = {
        chart: {
          type: "line",
          toolbar: { show: false },
          parentHeightOffset: 0,
          id: "chaikin" + context.groupID,
          group: context.groupID,
        },
        series: defaultSeries,
        xaxis: {
          labels: { show: false },
          axisTicks: { show: false },
        },
        yaxis: { title: { text: "Chaikin" } },
        stroke: { width: 1, colors: "#CC3333" },
      };
    } else if (indicatorKey === "commodity channel index") {
      const cciData = context.calculateCCI(context.series, 20);
      const defaultSeries = [{ name: "CCI", data: cciData }];
      indicatorChartOptions = {
        chart: {
          type: "line",
          toolbar: { show: false },
          parentHeightOffset: 0,
          id: "cci" + context.groupID,
          group: context.groupID,
        },
        series: defaultSeries,
        xaxis: {
          labels: { show: false },
          axisTicks: { show: false },
        },
        yaxis: { title: { text: "CCI" } },
        stroke: { width: 1, colors: "#FF6600" },
      };
    } else if (indicatorKey === "trend strength index") {
      const tsiData = context.calculateTSI(context.series, 25, 13);
      const defaultSeries = [{ name: "TSI", data: tsiData.tsi }];
      indicatorChartOptions = {
        chart: {
          type: "line",
          toolbar: { show: false },
          parentHeightOffset: 0,
          id: "tsi" + context.groupID,
          group: context.groupID,
        },
        series: defaultSeries,
        xaxis: {
          labels: { show: false },
          axisTicks: { show: false },
        },
        yaxis: { title: { text: "TSI" } },
        stroke: { width: 1, colors: "#0066CC" },
      };
    } else if (indicatorKey === "accelerator oscillator") {
      const acData = context.calculateAcceleratorOsc(context.series);
      const defaultSeries = [{ name: "AC", data: acData }];
      indicatorChartOptions = {
        chart: {
          type: "line",
          toolbar: { show: false },
          parentHeightOffset: 0,
          id: "ac" + context.groupID,
          group: context.groupID,
        },
        series: defaultSeries,
        xaxis: {
          labels: { show: false },
          axisTicks: { show: false },
        },
        yaxis: { title: { text: "AC" } },
        stroke: { width: 1, colors: "#009900" },
      };
    } else if (indicatorKey === "bollinger bands %b") {
      const bb = context.calculateBollingerBands(context.series, 20, 2);
      const bBPercent = context.calculateBBPercent(
        context.series,
        bb.lower,
        bb.upper
      );
      const defaultSeries = [{ name: "Bollinger %B", data: bBPercent }];
      indicatorChartOptions = {
        chart: {
          type: "line",
          toolbar: { show: false },
          parentHeightOffset: 0,
          id: "bbb" + context.groupID,
          group: context.groupID,
        },
        series: defaultSeries,
        xaxis: {
          labels: { show: false },
          axisTicks: { show: false },
        },
        yaxis: { title: { text: "%B" } },
        stroke: { width: 1, colors: "#6600CC" },
      };
    } else if (indicatorKey === "bollinger bands width") {
      const bb = context.calculateBollingerBands(context.series, 20, 2);
      const bBWidth = context.calculateBBWidth(
        context.series,
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
          id: "bbw" + context.groupID,
          group: context.groupID,
        },
        series: defaultSeries,
        xaxis: {
          labels: { show: false },
          axisTicks: { show: false },
        },
        yaxis: { title: { text: "Width" } },
        stroke: { width: 1, colors: "#CC0066" },
      };
    }

    // For oscillators (non-overlays), create a separate chart
    if (!context.isOverlay(indicatorKey)) {
      // Create an indicator div for the oscillator
      const indicatorDiv = document.createElement("div");
      indicatorDiv.dataset.indicator = indicatorKey;
      indicatorDiv.style.width = "100%";
      context.indicatorContainer.appendChild(indicatorDiv);

      context.updateAllChartHeights();
      if (!indicatorChartOptions.chart) indicatorChartOptions.chart = {};
      const { indicatorHeight } = context.computeHeights(1); // Always use 1 as we only show one oscillator
      indicatorChartOptions.chart.height = indicatorHeight;

      const chartInstance = new ApexCharts(indicatorDiv, indicatorChartOptions);
      chartInstance.render();
      context.indicatorChartMap[indicatorKey] = chartInstance;
    }
  }

  /**
   * Removes an indicator from the chart
   * @param {string} indicatorKey - The key/name of the indicator to remove
   * @param {Object} context - The ApexStock instance
   */
  static removeIndicator(indicatorKey, context) {
    indicatorKey = indicatorKey.toLowerCase();

    // Handle overlay indicators first
    if (indicatorKey === "bollinger bands") {
      const currentSeries = context.chart.w.config.series;
      const newSeries = currentSeries.filter(
        (s) => s.name !== "Bollinger Bands"
      );
      context.chart.updateSeries(newSeries);
      delete context.indicatorChartMap[indicatorKey];
    } else if (indicatorKey === "fibonacci retracements") {
      context.FIBLEVELS.forEach((level) => {
        context.chart.removeAnnotation(
          "fib-anno-" + level.toString().replace(/\./g, "")
        );
      });
      delete context.indicatorChartMap[indicatorKey];
    } else if (indicatorKey === "moving average") {
      const currentSeries = context.chart.w.config.series;
      const newSeries = currentSeries.filter(
        (s) => s.name !== "Moving Average"
      );
      context.chart.updateSeries(newSeries);
      delete context.indicatorChartMap[indicatorKey];
    } else if (indicatorKey === "exponential moving average") {
      const currentSeries = context.chart.w.config.series;
      const newSeries = currentSeries.filter((s) => s.name !== "EMA");
      context.chart.updateSeries(newSeries);
      delete context.indicatorChartMap[indicatorKey];
    } else if (indicatorKey === "linear regression") {
      const currentSeries = context.chart.w.config.series;
      const newSeries = currentSeries.filter(
        (s) => s.name !== "Linear Regression"
      );
      context.chart.updateSeries(newSeries);
      delete context.indicatorChartMap[indicatorKey];
    } else if (indicatorKey === "ichimoku cloud indicator") {
      const currentSeries = context.chart.w.config.series;
      const newSeries = currentSeries.filter(
        (s) => s.name !== "Tenkan-sen" && s.name !== "Kijun-sen"
      );
      context.chart.updateSeries(newSeries);
      delete context.indicatorChartMap[indicatorKey];
    } else {
      // Handle oscillator indicators
      const chartInstance = context.indicatorChartMap[indicatorKey];
      if (chartInstance && typeof chartInstance !== "boolean") {
        chartInstance.destroy();
        const children = Array.from(context.indicatorContainer.children);
        children.forEach((child) => {
          if (child.dataset.indicator === indicatorKey) {
            context.indicatorContainer.removeChild(child);
          }
        });
        delete context.indicatorChartMap[indicatorKey];

        // If this was the active oscillator, clear it
        if (context.activeOscillator === indicatorKey) {
          context.activeOscillator = null;
        }

        context.updateAllChartHeights();
      }
    }
  }
}
