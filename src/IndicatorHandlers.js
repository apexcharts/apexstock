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

    // Define common chart properties for all indicator charts
    const commonChartOptions = {
      chart: {
        toolbar: { show: false },
        parentHeightOffset: 0,
        animations: { enabled: false },
        group: context.groupID,
        events: {
          zoomed: context.handleZoom.bind(context),
          scrolled: context.handleScroll.bind(context),
          beforeResetZoom: context.handleBeforeResetZoom.bind(context),
        },
        toolbar: {
          show: false,
          autoSelected: "pan", // accepts -> zoom, pan, selection
        },
        zoom: {
          enabled: true,
          type: "x",
          autoScaleYaxis: true,
          allowMouseWheelZoom: true,
        },
      },
      xaxis: {
        labels: { show: false },
        axisTicks: { show: false },
        tooltip: {
          enabled: false,
        },
      },
      yaxis: context.mainChartOptions.yaxis[0],
      stroke: { width: 1 },
      legend: { show: false },
      dataLabels: { enabled: false },
      grid: context.mainChartOptions.grid,
      tooltip: {
        x: {
          show: false,
        },
        marker: {
          show: false,
        },
        theme: "dark",
        cssClass: "",
        style: {
          fontSize: "11px",
        },
      },
    };

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
        ...commonChartOptions,
        chart: {
          ...commonChartOptions.chart,
          type: "area",
          id: "volume" + context.groupID,
        },
        series: defaultSeries,
        yaxis: {
          ...commonChartOptions.yaxis,
          title: { text: "Volume" },
        },
        stroke: {
          ...commonChartOptions.stroke,
          curve: "linestep",
        },
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
        ...commonChartOptions,
        chart: {
          ...commonChartOptions.chart,
          type: "line",
          id: "rsi" + context.groupID,
        },
        series: defaultSeries,
        yaxis: {
          ...commonChartOptions.yaxis,
          min: 0,
          max: 100,
          title: { text: "RSI" },
        },
        stroke: {
          ...commonChartOptions.stroke,
          colors: "#7D57C2",
        },
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
        ...commonChartOptions,
        chart: {
          ...commonChartOptions.chart,
          type: "line",
          id: "macd" + context.groupID,
        },
        series: defaultSeries,
        yaxis: {
          ...commonChartOptions.yaxis,
          title: { text: "MACD" },
        },
        stroke: {
          ...commonChartOptions.stroke,
          width: [1, 1, 0],
        },
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
        ...commonChartOptions,
        chart: {
          ...commonChartOptions.chart,
          type: "line",
          id: "pvt" + context.groupID,
        },
        series: defaultSeries,
        yaxis: {
          ...commonChartOptions.yaxis,
          title: { text: "PVT" },
        },
        stroke: {
          ...commonChartOptions.stroke,
          colors: "#0099CC",
        },
      };
    } else if (indicatorKey === "stochastic oscillator") {
      const { k, d } = context.calculateStochastic(context.series, 14, 3);
      const defaultSeries = [
        { name: "Stochastic %K", data: k },
        { name: "Stochastic %D", data: d },
      ];
      indicatorChartOptions = {
        ...commonChartOptions,
        chart: {
          ...commonChartOptions.chart,
          type: "line",
          id: "stochastic" + context.groupID,
        },
        series: defaultSeries,
        yaxis: {
          ...commonChartOptions.yaxis,
          title: { text: "Stochastic" },
        },
        stroke: {
          ...commonChartOptions.stroke,
          colors: ["#33CC33", "#FF9933"],
        },
      };
    } else if (indicatorKey === "standard deviation indicator") {
      const stdData = context.calculateStdDevIndicator(context.series, 14);
      const defaultSeries = [{ name: "Std Dev", data: stdData }];
      indicatorChartOptions = {
        ...commonChartOptions,
        chart: {
          ...commonChartOptions.chart,
          type: "line",
          id: "stddev" + context.groupID,
        },
        series: defaultSeries,
        yaxis: {
          ...commonChartOptions.yaxis,
          title: { text: "Std Dev" },
        },
        stroke: {
          ...commonChartOptions.stroke,
          colors: "#CC33FF",
        },
      };
    } else if (indicatorKey === "average directional index") {
      const adxData = context.calculateADX(context.series, 14);
      const defaultSeries = [{ name: "ADX", data: adxData }];
      indicatorChartOptions = {
        ...commonChartOptions,
        chart: {
          ...commonChartOptions.chart,
          type: "line",
          id: "adx" + context.groupID,
        },
        series: defaultSeries,
        yaxis: {
          ...commonChartOptions.yaxis,
          title: { text: "ADX" },
        },
        stroke: {
          ...commonChartOptions.stroke,
          colors: "#9900CC",
        },
      };
    } else if (indicatorKey === "chaikin oscillator") {
      const chaikin = context.calculateChaikinOsc(context.series);
      const defaultSeries = [{ name: "Chaikin Osc", data: chaikin }];
      indicatorChartOptions = {
        ...commonChartOptions,
        chart: {
          ...commonChartOptions.chart,
          type: "line",
          id: "chaikin" + context.groupID,
        },
        series: defaultSeries,
        yaxis: {
          ...commonChartOptions.yaxis,
          title: { text: "Chaikin" },
        },
        stroke: {
          ...commonChartOptions.stroke,
          colors: "#CC3333",
        },
      };
    } else if (indicatorKey === "commodity channel index") {
      const cciData = context.calculateCCI(context.series, 20);
      const defaultSeries = [{ name: "CCI", data: cciData }];
      indicatorChartOptions = {
        ...commonChartOptions,
        chart: {
          ...commonChartOptions.chart,
          type: "line",
          id: "cci" + context.groupID,
        },
        series: defaultSeries,
        yaxis: {
          ...commonChartOptions.yaxis,
          title: { text: "CCI" },
        },
        stroke: {
          ...commonChartOptions.stroke,
          colors: "#FF6600",
        },
      };
    } else if (indicatorKey === "trend strength index") {
      const tsiData = context.calculateTSI(context.series, 25, 13);
      const defaultSeries = [{ name: "TSI", data: tsiData.tsi }];
      indicatorChartOptions = {
        ...commonChartOptions,
        chart: {
          ...commonChartOptions.chart,
          type: "line",
          id: "tsi" + context.groupID,
        },
        series: defaultSeries,
        yaxis: {
          ...commonChartOptions.yaxis,
          title: { text: "TSI" },
        },
        stroke: {
          ...commonChartOptions.stroke,
          colors: "#0066CC",
        },
      };
    } else if (indicatorKey === "accelerator oscillator") {
      const acData = context.calculateAcceleratorOsc(context.series);
      const defaultSeries = [{ name: "AC", data: acData }];
      indicatorChartOptions = {
        ...commonChartOptions,
        chart: {
          ...commonChartOptions.chart,
          type: "line",
          id: "ac" + context.groupID,
        },
        series: defaultSeries,
        yaxis: {
          ...commonChartOptions.yaxis,
          title: { text: "AC" },
        },
        stroke: {
          ...commonChartOptions.stroke,
          colors: "#009900",
        },
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
        ...commonChartOptions,
        chart: {
          ...commonChartOptions.chart,
          type: "line",
          id: "bbb" + context.groupID,
        },
        series: defaultSeries,
        yaxis: {
          ...commonChartOptions.yaxis,
          title: { text: "%B" },
        },
        stroke: {
          ...commonChartOptions.stroke,
          colors: "#6600CC",
        },
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
        ...commonChartOptions,
        chart: {
          ...commonChartOptions.chart,
          type: "line",
          id: "bbw" + context.groupID,
        },
        series: defaultSeries,
        yaxis: {
          ...commonChartOptions.yaxis,
          title: { text: "Width" },
        },
        stroke: {
          ...commonChartOptions.stroke,
          colors: "#CC0066",
        },
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
