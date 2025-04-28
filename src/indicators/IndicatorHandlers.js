import Utils from "../utils/Utils";

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
        background: "transparent",
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
        // Apply theme setting
        theme: {
          mode: context.theme,
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
      grid: {
        ...context.mainChartOptions.grid,
        borderColor: context.isDarkTheme ? "#404040" : "#e9ecef",
      },
      theme: context.mainChartOptions.theme,
      tooltip: {
        x: {
          show: false,
        },
        marker: {
          show: false,
        },
        theme: context.theme,
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
        color: context.colors.indicators.bollingerBands,
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
        color: context.colors.indicators.movingAverage,
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
        color: context.colors.indicators.ema,
      };
      const currentSeries = context.chart.w.config.series.filter(
        (s) => s.name !== "EMA"
      );
      context.chart.updateSeries([...currentSeries, emaSeries]);
      context.indicatorChartMap[indicatorKey] = true;
      return;
    } else if (indicatorKey === "fibonacci retracements") {
      // Get the current zoom state
      const zoomState = context.getCurrentZoomState();
      let startIndex = 0;
      let endIndex = context.series.length - 1;

      // If there's an active zoom, use those indices
      if (
        zoomState &&
        zoomState.minX !== undefined &&
        zoomState.maxX !== undefined
      ) {
        startIndex = Math.max(0, Math.floor(zoomState.minX));
        endIndex = Math.min(
          context.series.length - 1,
          Math.ceil(zoomState.maxX)
        );
      }

      // Calculate levels based on the visible range
      const levels = context.calculateFibonacciRetracementsForRange(
        context.series,
        startIndex,
        endIndex
      );

      // Create annotations with the calculated levels
      const annotations = levels.map((level, l) => ({
        id: "fib-anno-" + context.FIBLEVELS[l].toString().replace(/\./g, ""),
        y: level,
        borderColor: context.colors.indicators.fibonacci[l],
        strokeDashArray: 0,
        label: {
          text: `${Utils.truncateNumber(context.FIBLEVELS[l] * 100)}%`,
          textAnchor: "start",
          position: "left",
          style: {
            background: context.colors.indicators.fibonacci[l],
            color: "#fff",
            fontSize: "10px",
          },
        },
      }));

      // Get existing annotations (if any)
      const currentOptions = context.chart.w.config.annotations || {};
      const currentYAxisAnnotations = (currentOptions.yaxis || []).filter(
        (anno) => !anno.id || !anno.id.startsWith("fib-anno-")
      );

      // Merge new Fibonacci annotations with existing annotations
      const updatedAnnotations = {
        ...currentOptions,
        yaxis: [...currentYAxisAnnotations, ...annotations],
      };

      // Update the chart with merged annotations
      context.chart.updateOptions({ annotations: updatedAnnotations });

      // Store the indicator in the map, but use a special object with update method
      context.indicatorChartMap[indicatorKey] = {
        // This special update method will be called when zoom or scroll occurs
        update: function () {
          // When called, calculate new Fibonacci levels based on current zoom
          const currentZoom = context.getCurrentZoomState();
          let newStartIndex = 0;
          let newEndIndex = context.series.length - 1;

          if (
            currentZoom &&
            currentZoom.minX !== undefined &&
            currentZoom.maxX !== undefined
          ) {
            newStartIndex = Math.max(0, Math.floor(currentZoom.minX));
            newEndIndex = Math.min(
              context.series.length - 1,
              Math.ceil(currentZoom.maxX)
            );
          }

          const newLevels = context.calculateFibonacciRetracementsForRange(
            context.series,
            newStartIndex,
            newEndIndex
          );

          // Remove old Fibonacci annotations
          context.FIBLEVELS.forEach((level) => {
            const id = "fib-anno-" + level.toString().replace(/\./g, "");
            context.chart.removeAnnotation(id);
          });

          // Create and add new annotations
          newLevels.forEach((level, i) => {
            const id =
              "fib-anno-" + context.FIBLEVELS[i].toString().replace(/\./g, "");
            context.chart.addYaxisAnnotation({
              id: id,
              y: level,
              borderColor: context.colors.indicators.fibonacci[i],
              strokeDashArray: 0,
              label: {
                text: `${Utils.truncateNumber(context.FIBLEVELS[i] * 100)}%`,
                textAnchor: "start",
                position: "left",
                style: {
                  background: context.colors.indicators.fibonacci[i],
                  color: "#fff",
                  fontSize: "10px",
                },
              },
            });
          });
        },
      };

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
        color: context.colors.indicators.tenkanSen,
      };
      const kijunSeries = {
        name: "Kijun-sen",
        type: "line",
        data: ichimoku.kijun.map((value, index) => ({
          x: context.series[index].x,
          y: value,
        })),
        color: context.colors.indicators.kijunSen,
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
      const defaultSeries = [
        {
          name: "Volumes",
          data: context.volumesData,
          color: context.colors.indicators.volume,
        },
      ];
      indicatorChartOptions = {
        ...commonChartOptions,
        chart: {
          ...commonChartOptions.chart,
          type: "area",
          id: "volume" + context.groupID,
        },
        series: defaultSeries,
        stroke: {
          ...commonChartOptions.stroke,
          curve: "linestep",
          colors: [context.colors.indicators.volume],
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
          color: context.colors.indicators.rsi,
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
        },
        stroke: {
          ...commonChartOptions.stroke,
          colors: [context.colors.indicators.rsi],
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
          color: context.colors.indicators.macd,
        },
        {
          name: "Signal",
          type: "line",
          data: signal.map((value, index) => ({
            x: context.series[index].x,
            y: context.Utils.truncateNumber(value),
          })),
          color: context.colors.indicators.signal,
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
        stroke: {
          ...commonChartOptions.stroke,
          width: [1, 1, 0],
          colors: [
            context.colors.indicators.macd,
            context.colors.indicators.signal,
          ],
        },
        plotOptions: {
          bar: {
            colors: {
              ranges: [
                {
                  from: 0.1,
                  to: 100,
                  color: context.colors.indicators.histogramPositive,
                },
                {
                  from: -100,
                  to: 0,
                  color: context.colors.indicators.histogramNegative,
                },
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
      const defaultSeries = [
        {
          name: "PVT",
          data: pvtData,
          color: context.colors.indicators.pvt,
        },
      ];
      indicatorChartOptions = {
        ...commonChartOptions,
        chart: {
          ...commonChartOptions.chart,
          type: "line",
          id: "pvt" + context.groupID,
        },
        series: defaultSeries,
        stroke: {
          ...commonChartOptions.stroke,
          colors: [context.colors.indicators.pvt],
        },
      };
    } else if (indicatorKey === "stochastic oscillator") {
      const { k, d } = context.calculateStochastic(context.series, 14, 3);
      const defaultSeries = [
        {
          name: "Stochastic %K",
          data: k,
          color: context.colors.indicators.stochasticK,
        },
        {
          name: "Stochastic %D",
          data: d,
          color: context.colors.indicators.stochasticD,
        },
      ];
      indicatorChartOptions = {
        ...commonChartOptions,
        chart: {
          ...commonChartOptions.chart,
          type: "line",
          id: "stochastic" + context.groupID,
        },
        series: defaultSeries,
        stroke: {
          ...commonChartOptions.stroke,
          colors: [
            context.colors.indicators.stochasticK,
            context.colors.indicators.stochasticD,
          ],
        },
      };
    } else if (indicatorKey === "standard deviation indicator") {
      const stdData = context.calculateStdDevIndicator(context.series, 14);
      const defaultSeries = [
        {
          name: "Std Dev",
          data: stdData,
          color: context.colors.indicators.stdDev,
        },
      ];
      indicatorChartOptions = {
        ...commonChartOptions,
        chart: {
          ...commonChartOptions.chart,
          type: "line",
          id: "stddev" + context.groupID,
        },
        series: defaultSeries,
        stroke: {
          ...commonChartOptions.stroke,
          colors: [context.colors.indicators.stdDev],
        },
      };
    } else if (indicatorKey === "average directional index") {
      const adxData = context.calculateADX(context.series, 14);
      const defaultSeries = [
        {
          name: "ADX",
          data: adxData,
          color: context.colors.indicators.adx,
        },
      ];
      indicatorChartOptions = {
        ...commonChartOptions,
        chart: {
          ...commonChartOptions.chart,
          type: "line",
          id: "adx" + context.groupID,
        },
        series: defaultSeries,
        stroke: {
          ...commonChartOptions.stroke,
          colors: [context.colors.indicators.adx],
        },
      };
    } else if (indicatorKey === "chaikin oscillator") {
      const chaikin = context.calculateChaikinOsc(context.series);
      const defaultSeries = [
        {
          name: "Chaikin Osc",
          data: chaikin,
          color: context.colors.indicators.chaikin,
        },
      ];
      indicatorChartOptions = {
        ...commonChartOptions,
        chart: {
          ...commonChartOptions.chart,
          type: "line",
          id: "chaikin" + context.groupID,
        },
        series: defaultSeries,
        stroke: {
          ...commonChartOptions.stroke,
          colors: [context.colors.indicators.chaikin],
        },
      };
    } else if (indicatorKey === "commodity channel index") {
      const cciData = context.calculateCCI(context.series, 20);
      const defaultSeries = [
        {
          name: "CCI",
          data: cciData,
          color: context.colors.indicators.cci,
        },
      ];
      indicatorChartOptions = {
        ...commonChartOptions,
        chart: {
          ...commonChartOptions.chart,
          type: "line",
          id: "cci" + context.groupID,
        },
        series: defaultSeries,
        stroke: {
          ...commonChartOptions.stroke,
          colors: [context.colors.indicators.cci],
        },
      };
    } else if (indicatorKey === "trend strength index") {
      const tsiData = context.calculateTSI(context.series, 25, 13);
      const defaultSeries = [
        {
          name: "TSI",
          data: tsiData.tsi,
          color: context.colors.indicators.tsi,
        },
      ];
      indicatorChartOptions = {
        ...commonChartOptions,
        chart: {
          ...commonChartOptions.chart,
          type: "line",
          id: "tsi" + context.groupID,
        },
        series: defaultSeries,
        stroke: {
          ...commonChartOptions.stroke,
          colors: [context.colors.indicators.tsi],
        },
      };
    } else if (indicatorKey === "accelerator oscillator") {
      const acData = context.calculateAcceleratorOsc(context.series);
      const defaultSeries = [
        {
          name: "AC",
          data: acData,
          color: context.colors.indicators.ac,
        },
      ];
      indicatorChartOptions = {
        ...commonChartOptions,
        chart: {
          ...commonChartOptions.chart,
          type: "line",
          id: "ac" + context.groupID,
        },
        series: defaultSeries,
        stroke: {
          ...commonChartOptions.stroke,
          colors: [context.colors.indicators.ac],
        },
      };
    } else if (indicatorKey === "bollinger bands %b") {
      const bb = context.calculateBollingerBands(context.series, 20, 2);
      const bBPercent = context.calculateBBPercent(
        context.series,
        bb.lower,
        bb.upper
      );
      const defaultSeries = [
        {
          name: "Bollinger %B",
          data: bBPercent,
          color: context.colors.indicators.bPercent,
        },
      ];
      indicatorChartOptions = {
        ...commonChartOptions,
        chart: {
          ...commonChartOptions.chart,
          type: "line",
          id: "bbb" + context.groupID,
        },
        series: defaultSeries,
        stroke: {
          ...commonChartOptions.stroke,
          colors: [context.colors.indicators.bPercent],
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
      const defaultSeries = [
        {
          name: "Bollinger Width",
          data: bBWidth,
          color: context.colors.indicators.bWidth,
        },
      ];
      indicatorChartOptions = {
        ...commonChartOptions,
        chart: {
          ...commonChartOptions.chart,
          type: "line",
          id: "bbw" + context.groupID,
        },
        series: defaultSeries,
        stroke: {
          ...commonChartOptions.stroke,
          colors: [context.colors.indicators.bWidth],
        },
      };
    }

    // Additional theme settings for all indicator charts
    if (indicatorChartOptions) {
      // Apply theme settings to tooltip
      indicatorChartOptions.tooltip = {
        ...indicatorChartOptions.tooltip,
        theme: context.theme,
      };

      // Apply grid color adjustments for dark theme
      if (context.isDarkTheme) {
        indicatorChartOptions.grid = {
          ...indicatorChartOptions.grid,
          borderColor: "#404040",
          strokeDashArray: 3,
        };
      }
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

    if (context.xaxis) {
      context.xaxis.ensureXAxisIsLast();
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
    if (context.xaxis) {
      context.xaxis.ensureXAxisIsLast();
    }
  }
}
