import Utils from "../utils/Utils";

/**
 * Maps a numeric (or null) value array to {x, y} points aligned to the series.
 * @param {object} context - ApexStock instance.
 * @param {Array<number|null>} values
 * @returns {Array<{x: *, y: number|null}>}
 */
function toPoints(context, values) {
  return values.map((value, index) => ({
    x: context.series[index].x,
    y: value,
  }));
}

/**
 * Builds the chart options shared by every oscillator pane.
 * @param {object} context - ApexStock instance.
 */
function buildCommonChartOptions(context) {
  return {
    chart: {
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
        // Inherit the main chart's setting so the whole stock chart rescales
        // (or not) consistently; defaults on, matching the main chart.
        autoScaleYaxis:
          context.mainChartOptions.chart.zoom?.autoScaleYaxis ?? true,
        allowMouseWheelZoom: true,
      },
      // Inherit the main chart's data reducer so a large-dataset stock chart
      // decimates its oscillator panes consistently. Pane series are scalar
      // line data (RSI/MACD/volume values), which LTTB downsamples correctly.
      ...(context.mainChartOptions.chart.dataReducer
        ? { dataReducer: context.mainChartOptions.chart.dataReducer }
        : {}),
    },
    xaxis: {
      labels: { show: false },
      axisTicks: { show: false },
      tooltip: { enabled: false },
    },
    yaxis: context.mainChartOptions.yaxis[0],
    stroke: { width: 1 },
    legend: { show: false },
    dataLabels: { enabled: false },
    grid: {
      ...context.mainChartOptions.grid,
      borderColor: context.isDarkTheme ? "#404040" : "#e9ecef",
    },
    // Pass a proper theme object. `mainChartOptions.theme` is undefined (the
    // main chart only sets `chart.theme`), and an explicit `theme: undefined`
    // overwrites ApexCharts' default — making `cnf.theme.mode` throw in
    // Core.setupElements (an *absent* key would be back-filled; an undefined
    // one is not). `context.theme` is the theme-mode string ("light"/"dark").
    theme: { mode: context.theme },
    tooltip: {
      x: { show: false },
      marker: { show: false },
      theme: context.theme,
      cssClass: "",
      style: { fontSize: "11px" },
    },
  };
}

/**
 * Applies (or re-applies) the Fibonacci retracement y-axis annotations for the
 * currently visible range, and stores a map entry whose `update()` recomputes
 * them on zoom/scroll.
 * @param {object} context - ApexStock instance.
 */
function applyFibonacci(context) {
  const zoomState = context.getCurrentZoomState();
  let startIndex = 0;
  let endIndex = context.series.length - 1;

  if (
    zoomState &&
    zoomState.minX !== undefined &&
    zoomState.maxX !== undefined
  ) {
    startIndex = Math.max(0, Math.floor(zoomState.minX));
    endIndex = Math.min(context.series.length - 1, Math.ceil(zoomState.maxX));
  }

  const levels = context.calculateFibonacciRetracementsForRange(
    context.series,
    startIndex,
    endIndex
  );

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

  const currentOptions = context.chart.w.config.annotations || {};
  const currentYAxisAnnotations = (currentOptions.yaxis || []).filter(
    (anno) => !anno.id || !anno.id.startsWith("fib-anno-")
  );

  const updatedAnnotations = {
    ...currentOptions,
    yaxis: [...currentYAxisAnnotations, ...annotations],
  };

  context.chart.updateOptions({ annotations: updatedAnnotations });

  context.indicatorChartMap["fibonacci retracements"] = {
    // Called when zoom or scroll occurs — recompute levels for the new range.
    update: function () {
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

      context.FIBLEVELS.forEach((level) => {
        const id = "fib-anno-" + level.toString().replace(/\./g, "");
        context.chart.removeAnnotation(id);
      });

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
}

/**
 * Helper for the many oscillators that render one or more line series in a
 * separate pane. Returns the common-derived chart options.
 */
function lineOscillator(context, common, { id, series, strokeColors }) {
  return {
    ...common,
    chart: {
      ...common.chart,
      type: "line",
      id: id + context.groupID,
    },
    series,
    stroke: {
      ...common.stroke,
      colors: strokeColors,
    },
  };
}

/**
 * Indicator registry. Each entry declares its `kind` and a builder:
 * - overlay:    build(context, params) -> { series, replaceNames }
 * - oscillator: build(context, params, common) -> chart options (or null to skip)
 * - custom:     apply(context, params) and remove(context) handle the chart directly
 *
 * Adding a new indicator means adding one entry here — no branching to touch.
 * @type {Object.<string, object>}
 */
const INDICATOR_REGISTRY = {
  // ---- Overlays (drawn on the main chart) ----
  "moving average": {
    kind: "overlay",
    replaceNames: ["Moving Average"],
    build(context, params) {
      const period = params.period || 10;
      const data = toPoints(
        context,
        context.calculateMovingAverage(context.series, period)
      );
      return {
        replaceNames: ["Moving Average"],
        series: [
          {
            name: "Moving Average",
            type: "line",
            data,
            color: context.colors.indicators.movingAverage,
          },
        ],
      };
    },
  },

  "exponential moving average": {
    kind: "overlay",
    replaceNames: ["EMA"],
    build(context, params) {
      const period = params.period || 10;
      const data = toPoints(
        context,
        context.calculateEMA(context.series, period)
      );
      return {
        replaceNames: ["EMA"],
        series: [
          {
            name: "EMA",
            type: "line",
            data,
            color: context.colors.indicators.ema,
          },
        ],
      };
    },
  },

  "linear regression": {
    kind: "overlay",
    replaceNames: ["Linear Regression"],
    build(context, params) {
      const period = params.period || 14;
      const data = context.calculateLinearRegression(context.series, period);
      return {
        replaceNames: ["Linear Regression"],
        series: [
          {
            name: "Linear Regression",
            type: "line",
            data,
            color: context.colors.indicators.linearRegression,
          },
        ],
      };
    },
  },

  "bollinger bands": {
    kind: "overlay",
    replaceNames: ["Bollinger Bands"],
    build(context, params) {
      const period = params.period || 20;
      const stdDev = params.stdDev || 2;
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
      return { replaceNames: ["Bollinger Bands"], series: [bbSeries] };
    },
  },

  "ichimoku cloud indicator": {
    kind: "overlay",
    replaceNames: ["Tenkan-sen", "Kijun-sen"],
    build(context) {
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
          y: value.y,
        })),
        color: context.colors.indicators.kijunSen,
      };
      return {
        replaceNames: ["Tenkan-sen", "Kijun-sen"],
        series: [tenkanSeries, kijunSeries],
      };
    },
  },

  // ---- Custom (annotations) ----
  "fibonacci retracements": {
    kind: "custom",
    apply(context) {
      applyFibonacci(context);
    },
    remove(context) {
      context.FIBLEVELS.forEach((level) => {
        context.chart.removeAnnotation(
          "fib-anno-" + level.toString().replace(/\./g, "")
        );
      });
    },
  },

  // ---- Oscillators (drawn in separate panes) ----
  volumes: {
    kind: "oscillator",
    build(context, params, common) {
      if (!context.volumesData || context.volumesData.length === 0) {
        Utils.warn("No volumes data available.");
        return null;
      }
      const defaultSeries = [
        {
          name: "Volumes",
          data: context.volumesData,
          color: context.colors.indicators.volume,
        },
      ];
      let options = {
        ...common,
        chart: {
          ...common.chart,
          type: "area",
          id: "volume" + context.groupID,
        },
        series: defaultSeries,
        stroke: {
          ...common.stroke,
          curve: "linestep",
          colors: [context.colors.indicators.volume],
        },
        fill: { type: "solid", opacity: 0.2 },
      };
      if (context.indicators.volumes?.chartOptions) {
        options = Object.assign(
          {},
          options,
          context.indicators.volumes.chartOptions
        );
        if (!options.series) options.series = defaultSeries;
      }
      return options;
    },
  },

  rsi: {
    kind: "oscillator",
    build(context, params, common) {
      const period = params.period || 14;
      const rsiData = context.calculateRSI(context.series, period);
      const defaultSeries = [
        {
          name: "RSI",
          data: toPoints(context, rsiData),
          color: context.colors.indicators.rsi,
        },
      ];
      let options = {
        ...common,
        chart: {
          ...common.chart,
          type: "line",
          id: "rsi" + context.groupID,
        },
        series: defaultSeries,
        yaxis: {
          ...common.yaxis,
          min: 0,
          max: 100,
        },
        stroke: {
          ...common.stroke,
          colors: [context.colors.indicators.rsi],
        },
      };
      if (context.indicators.rsi?.chartOptions) {
        options = Object.assign(
          {},
          options,
          context.indicators.rsi.chartOptions
        );
        if (!options.series) options.series = defaultSeries;
      }
      return options;
    },
  },

  macd: {
    kind: "oscillator",
    build(context, params, common) {
      const fastPeriod = params.fastPeriod || 12;
      const slowPeriod = params.slowPeriod || 26;
      const signalPeriod = params.signalPeriod || 9;

      const { macd, signal, histogram } = context.calculateMACD(
        context.series,
        fastPeriod,
        slowPeriod,
        signalPeriod
      );

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
      let options = {
        ...common,
        chart: {
          ...common.chart,
          type: "line",
          id: "macd" + context.groupID,
        },
        series: defaultSeries,
        stroke: {
          ...common.stroke,
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
        options = Object.assign(
          {},
          options,
          context.indicators.macd.chartOptions
        );
        if (!options.series) options.series = defaultSeries;
      }
      return options;
    },
  },

  "price volume trend": {
    kind: "oscillator",
    build(context, params, common) {
      const pvtData = context.calculatePVT(context.series);
      return lineOscillator(context, common, {
        id: "pvt",
        series: [
          {
            name: "PVT",
            data: pvtData,
            color: context.colors.indicators.pvt,
          },
        ],
        strokeColors: [context.colors.indicators.pvt],
      });
    },
  },

  "stochastic oscillator": {
    kind: "oscillator",
    build(context, params, common) {
      const period = params.period || 14;
      const smoothPeriod = params.smoothPeriod || 3;
      const { k, d } = context.calculateStochastic(
        context.series,
        period,
        smoothPeriod
      );
      return lineOscillator(context, common, {
        id: "stochastic",
        series: [
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
        ],
        strokeColors: [
          context.colors.indicators.stochasticK,
          context.colors.indicators.stochasticD,
        ],
      });
    },
  },

  "standard deviation indicator": {
    kind: "oscillator",
    build(context, params, common) {
      const period = params.period || 14;
      const stdData = context.calculateStdDevIndicator(context.series, period);
      return lineOscillator(context, common, {
        id: "stddev",
        series: [
          {
            name: "Std Dev",
            data: stdData,
            color: context.colors.indicators.stdDev,
          },
        ],
        strokeColors: [context.colors.indicators.stdDev],
      });
    },
  },

  "average directional index": {
    kind: "oscillator",
    build(context, params, common) {
      const period = params.period || 14;
      const adxData = context.calculateADX(context.series, period);
      return lineOscillator(context, common, {
        id: "adx",
        series: [
          {
            name: "ADX",
            data: adxData,
            color: context.colors.indicators.adx,
          },
        ],
        strokeColors: [context.colors.indicators.adx],
      });
    },
  },

  "chaikin oscillator": {
    kind: "oscillator",
    build(context, params, common) {
      const shortPeriod = params.shortPeriod || 3;
      const longPeriod = params.longPeriod || 10;
      const chaikin = context.calculateChaikinOsc(
        context.series,
        shortPeriod,
        longPeriod
      );
      return lineOscillator(context, common, {
        id: "chaikin",
        series: [
          {
            name: "Chaikin Osc",
            data: chaikin,
            color: context.colors.indicators.chaikin,
          },
        ],
        strokeColors: [context.colors.indicators.chaikin],
      });
    },
  },

  "commodity channel index": {
    kind: "oscillator",
    build(context, params, common) {
      const period = params.period || 20;
      const cciData = context.calculateCCI(context.series, period);
      return lineOscillator(context, common, {
        id: "cci",
        series: [
          {
            name: "CCI",
            data: cciData,
            color: context.colors.indicators.cci,
          },
        ],
        strokeColors: [context.colors.indicators.cci],
      });
    },
  },

  "trend strength index": {
    kind: "oscillator",
    build(context, params, common) {
      const longPeriod = params.longPeriod || 25;
      const shortPeriod = params.shortPeriod || 13;
      const signalPeriod = params.signalPeriod || 7;
      const tsiData = context.calculateTSI(
        context.series,
        longPeriod,
        shortPeriod,
        signalPeriod
      );
      return lineOscillator(context, common, {
        id: "tsi",
        series: [
          {
            name: "TSI",
            data: tsiData.tsi,
            color: context.colors.indicators.tsi,
          },
        ],
        strokeColors: [context.colors.indicators.tsi],
      });
    },
  },

  "accelerator oscillator": {
    kind: "oscillator",
    build(context, params, common) {
      const period = params.period || 5;
      const acData = context.calculateAcceleratorOsc(context.series, period);
      return lineOscillator(context, common, {
        id: "ac",
        series: [
          {
            name: "AC",
            data: acData,
            color: context.colors.indicators.ac,
          },
        ],
        strokeColors: [context.colors.indicators.ac],
      });
    },
  },

  "bollinger bands %b": {
    kind: "oscillator",
    build(context, params, common) {
      const period = params.period || 20;
      const stdDev = params.stdDev || 2;
      const bb = context.calculateBollingerBands(context.series, period, stdDev);
      const bBPercent = context.calculateBBPercent(
        context.series,
        bb.lower,
        bb.upper
      );
      return lineOscillator(context, common, {
        id: "bbb",
        series: [
          {
            name: "Bollinger %B",
            data: bBPercent,
            color: context.colors.indicators.bPercent,
          },
        ],
        strokeColors: [context.colors.indicators.bPercent],
      });
    },
  },

  "bollinger bands width": {
    kind: "oscillator",
    build(context, params, common) {
      const period = params.period || 20;
      const stdDev = params.stdDev || 2;
      const bb = context.calculateBollingerBands(context.series, period, stdDev);
      const bBWidth = context.calculateBBWidth(
        context.series,
        bb.middle,
        bb.upper,
        bb.lower
      );
      return lineOscillator(context, common, {
        id: "bbw",
        series: [
          {
            name: "Bollinger Width",
            data: bBWidth,
            color: context.colors.indicators.bWidth,
          },
        ],
        strokeColors: [context.colors.indicators.bWidth],
      });
    },
  },
};

export default class IndicatorHandlers {
  /**
   * Default indicator-availability config, derived from the registry so the
   * set of supported indicators lives in exactly one place. Oscillators render
   * in separate panes; everything else (overlays + the annotation-based
   * fibonacci) is grouped with the overlays. Each entry defaults to enabled.
   * @returns {{ overlays: Object.<string, {enabled: boolean}>, oscillators: Object.<string, {enabled: boolean}> }}
   */
  static getDefaultConfig() {
    const overlays = {};
    const oscillators = {};
    for (const [key, def] of Object.entries(INDICATOR_REGISTRY)) {
      const target = def.kind === "oscillator" ? oscillators : overlays;
      target[key] = { enabled: true };
    }
    return { overlays, oscillators };
  }

  /**
   * Updates or adds an indicator to the chart. If the indicator is already
   * active, this toggles it off (removes it).
   * @param {string} indicatorKey - The key/name of the indicator to update.
   * @param {import("../ApexStock.js").default} context - The ApexStock instance.
   */
  static updateIndicator(indicatorKey, context) {
    if (!indicatorKey) return;
    indicatorKey = indicatorKey.toLowerCase();

    if (context.indicatorChartMap[indicatorKey]) {
      context.removeIndicator(indicatorKey);
      return;
    }

    const def = INDICATOR_REGISTRY[indicatorKey];
    if (!def) return; // unknown indicator — no-op

    const params = context.oscillatorSettings
      ? context.oscillatorSettings.getIndicatorParams(indicatorKey)
      : {};

    // Custom (annotation-driven) indicators handle the chart themselves.
    if (def.kind === "custom") {
      def.apply(context, params);
      if (context.xaxis) context.xaxis.ensureXAxisIsLast();
      return;
    }

    // Overlays add series to the existing main chart.
    if (def.kind === "overlay") {
      const { series, replaceNames } = def.build(context, params);
      const retained = context.chart.w.config.series.filter(
        (s) => !replaceNames.includes(s.name)
      );
      context.chart.updateSeries([...retained, ...series]);
      context.indicatorChartMap[indicatorKey] = true;
      if (context.xaxis) context.xaxis.ensureXAxisIsLast();
      return;
    }

    // Oscillators render in a separate pane.
    const common = buildCommonChartOptions(context);
    const indicatorChartOptions = def.build(context, params, common);
    if (!indicatorChartOptions) return; // builder opted out (e.g. no volume data)

    // Theme settings for the oscillator pane.
    indicatorChartOptions.tooltip = {
      ...indicatorChartOptions.tooltip,
      theme: context.theme,
    };
    if (context.isDarkTheme) {
      indicatorChartOptions.grid = {
        ...indicatorChartOptions.grid,
        borderColor: "#404040",
        strokeDashArray: 3,
      };
    }

    const indicatorDiv = document.createElement("div");
    indicatorDiv.dataset.indicator = indicatorKey;
    indicatorDiv.style.width = "100%";
    context.indicatorContainer.appendChild(indicatorDiv);

    context.updateAllChartHeights();
    if (!indicatorChartOptions.chart) indicatorChartOptions.chart = {};
    const { indicatorHeight } = context.computeHeights(1); // one oscillator pane
    indicatorChartOptions.chart.height = indicatorHeight;

    const chartInstance = new ApexCharts(indicatorDiv, indicatorChartOptions);
    chartInstance.render();
    context.indicatorChartMap[indicatorKey] = chartInstance;

    // Create the settings control for this oscillator.
    if (context.oscillatorSettings) {
      const settingsControl = context.oscillatorSettings.createSettingsControl(
        indicatorKey,
        context.indicatorContainer
      );
      if (settingsControl) {
        settingsControl.show();
      }
    }

    if (context.xaxis) {
      context.xaxis.ensureXAxisIsLast();
    }
  }

  /**
   * Removes an indicator from the chart.
   * @param {string} indicatorKey - The key/name of the indicator to remove.
   * @param {import("../ApexStock.js").default} context - The ApexStock instance.
   */
  static removeIndicator(indicatorKey, context) {
    indicatorKey = indicatorKey.toLowerCase();
    const def = INDICATOR_REGISTRY[indicatorKey];

    if (def && def.kind === "overlay") {
      const newSeries = context.chart.w.config.series.filter(
        (s) => !def.replaceNames.includes(s.name)
      );
      context.chart.updateSeries(newSeries);
      delete context.indicatorChartMap[indicatorKey];
    } else if (def && def.kind === "custom") {
      def.remove(context);
      delete context.indicatorChartMap[indicatorKey];
    } else {
      // Oscillator: tear down its separate chart and pane.
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

        if (context.activeOscillator === indicatorKey) {
          context.activeOscillator = null;
        }

        if (context.oscillatorSettings) {
          context.oscillatorSettings.hideSettings(indicatorKey);
        }

        context.updateAllChartHeights();
      }
    }

    if (context.xaxis) {
      context.xaxis.ensureXAxisIsLast();
    }
  }
}
