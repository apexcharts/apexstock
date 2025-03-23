import Indicators from "./Indicators";
import Utils from "./utils/Utils";
import DrawingTools from "./DrawingTools";
import apexStockCSS from "ApexStock.css";
import Export from "./Export";
import ChartSwitch from "./ChartSwitch";
import IndicatorHandlers from "./IndicatorHandlers";
import XAxis from "./XAxis";

export default class ApexStock {
  /**
   * @param {HTMLElement} chartEl - The container element where the charts will be rendered.
   * @param {Object} chartOptions - The ApexCharts options object.
   */
  constructor(chartEl, chartOptions) {
    this.chartEl = chartEl;
    this.totalHeight = chartOptions.chart.height || 350;
    this.Utils = Utils;
    this.xAxisHeight = 30; // Define xAxisHeight as a constant property

    chartOptions.chart.id = this.randomId();
    this.groupID = "group" + this.randomId();
    this.mainChartId = chartOptions.chart.id;

    this.chartEl.innerHTML = "";
    this.mainChartDiv = document.createElement("div");
    this.mainChartDiv.id = this.mainChartId;
    this.mainChartDiv.classList.add("apexstock-main-chart");

    // Apply correct height initially, accounting for xAxisHeight
    const initialMainChartHeight = this.totalHeight - this.xAxisHeight;
    this.mainChartDiv.style.height = initialMainChartHeight + "px";

    this.indicatorContainer = document.createElement("div");
    this.indicatorContainer.classList.add("apexstock-indicator-container");
    this.indicatorContainer.style.height = "0px";

    this.chartEl.appendChild(this.mainChartDiv);
    this.chartEl.appendChild(this.indicatorContainer);

    this.primaryToolbar = document.createElement("div");
    this.primaryToolbar.classList.add("apexstock-toolbar");
    this.primaryToolbarLeft = document.createElement("div");
    this.primaryToolbarLeft.classList.add("apexstock-toolbar-left");
    this.primaryToolbarRight = document.createElement("div");
    this.primaryToolbarRight.classList.add("apexstock-toolbar-right");

    this.primaryToolbar.appendChild(this.primaryToolbarLeft);
    this.primaryToolbar.appendChild(this.primaryToolbarRight);

    this.indicatorChartMap = {};
    this.FIBLEVELS = [0, 0.236, 0.382, 0.5, 0.618, 1];
    this.activeOscillator = null;

    const stockChartOptions =
      (chartOptions.plotOptions && chartOptions.plotOptions.stockChart) || {};
    this.series = chartOptions.series[0].data || [];

    // Initialize xaxis range from the series data
    this.initializeXAxisRange();

    // Define overlays and oscillators
    this.overlays = {
      "moving average": { enabled: true },
      "bollinger bands": { enabled: true },
      "exponential moving average": { enabled: true },
      "fibonacci retracements": { enabled: true },
      "linear regression": { enabled: true },
      "ichimoku cloud indicator": { enabled: true },
    };

    this.oscillators = {
      rsi: { enabled: true },
      macd: { enabled: true },
      volumes: { enabled: true },
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
    };

    // Merge both for backward compatibility
    this.indicators = { ...this.overlays, ...this.oscillators };

    if (
      typeof stockChartOptions.indicators === "object" &&
      !Array.isArray(stockChartOptions.indicators)
    ) {
      this.indicators = stockChartOptions.indicators;
      // Update overlays and oscillators based on provided indicators
      Object.keys(this.indicators).forEach((key) => {
        if (this.overlays[key]) {
          this.overlays[key] = this.indicators[key];
        } else if (this.oscillators[key]) {
          this.oscillators[key] = this.indicators[key];
        }
      });
    } else if (Array.isArray(stockChartOptions.indicators)) {
      this.indicators = {};
      stockChartOptions.indicators.forEach((ind) => {
        this.indicators[ind.toLowerCase()] = { enabled: true };
        if (this.overlays[ind.toLowerCase()]) {
          this.overlays[ind.toLowerCase()] = { enabled: true };
        } else if (this.oscillators[ind.toLowerCase()]) {
          this.oscillators[ind.toLowerCase()] = { enabled: true };
        }
      });
    }

    this.volumesData = this.series
      .map((point) => (point.v ? { x: point.x, y: point.v } : null))
      .filter((x) => x !== null);

    this.mainChartOptions = Utils.extend(
      {
        chart: {
          type: "candlestick",
          height: initialMainChartHeight,
          id: this.mainChartId,
          group: this.groupID,
          parentHeightOffset: 0,
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
          animations: {
            enabled: false,
          },
          events: {
            zoomed: this.handleZoom.bind(this),
            scrolled: this.handleScroll.bind(this),
            beforeResetZoom: this.handleBeforeResetZoom.bind(this),
          },
        },
        series: [{ name: "Price", data: this.series }],
        grid: {
          padding: {
            left: 0,
            right: 0,
          },
        },
        tooltip: {
          theme: "dark",
        },
        yaxis: {
          opposite: true,
          floating: true,
          tooltip: {
            enabled: true,
            offsetX: -20,
          },
          labels: {
            align: "right",
            offsetX: 10,
            offsetY: -8,
          },
        },
        xaxis: {
          show: false,
          tickAmount: 5,
          labels: {
            rotate: 0,
            show: false,
          },
          axisTicks: {
            show: false,
          },
          tooltip: {
            enabled: false,
          },
        },
        legend: { show: false },
      },
      chartOptions
    );

    this.chart = new ApexCharts(this.mainChartDiv, this.mainChartOptions);
  }

  /**
   * Initialize the xaxis range from the series data
   * @param {boolean} useCurrentZoom - Whether to use current zoom state if available
   */
  initializeXAxisRange(useCurrentZoom = false) {
    // If useCurrentZoom is true and there's a valid zoom state, preserve it
    if (useCurrentZoom) {
      const zoomState = this.getCurrentZoomState();
      if (zoomState && this.xaxisRange) {
        // Keep existing zoom state
        return;
      }
    }

    if (!this.series || this.series.length === 0) {
      this.xaxisRange = {
        min: 0,
        max: 0,
      };
      return;
    }

    // Extract timestamps from the series
    const timestamps = this.series.map((point) => {
      // Handle different timestamp formats
      if (typeof point.x === "number") {
        return point.x;
      } else if (point.x instanceof Date) {
        return point.x.getTime();
      } else {
        // Try to parse as date string
        return new Date(point.x).getTime();
      }
    });

    this.xaxisRange = {
      min: Math.min(...timestamps),
      max: Math.max(...timestamps),
    };
  }

  /**
   * Handle before reset zoom event from the chart
   */
  handleBeforeResetZoom(ctx, e) {
    // Reset to the original range from the data
    setTimeout(() => {
      this.initializeXAxisRange();

      // Update the custom x-axis if it exists
      if (this.xaxis) {
        this.xaxis.prepareForTransition();
        this.xaxis.render();
      }
    }, 0);
  }

  /**
   * Handle zoom events from the chart
   * @param {Object} e - The zoom event data
   */
  handleZoom(ctx, e) {
    if (e && e.xaxis) {
      this.xaxisRange.min = new Date(
        ctx.w.config.series[0].data[Math.round(e.xaxis.min - 1)]?.x
      ).getTime();
      this.xaxisRange.max = new Date(
        ctx.w.config.series[0].data[Math.round(e.xaxis.max - 1)]?.x
      ).getTime();

      // Update the custom x-axis if it exists
      if (this.xaxis) {
        this.xaxis.prepareForTransition();
        this.xaxis.render();
      }
    }
  }

  /**
   * Handle scroll events from the chart
   * @param {Object} e - The scroll event data
   */
  handleScroll(ctx, e) {
    if (e && e.xaxis) {
      this.xaxisRange.min = new Date(
        ctx.w.config.series[0].data[Math.round(e.xaxis.min - 1)]?.x
      ).getTime();
      this.xaxisRange.max = new Date(
        ctx.w.config.series[0].data[Math.round(e.xaxis.max - 1)]?.x
      ).getTime();

      // Update the custom x-axis if it exists
      if (this.xaxis) {
        this.xaxis.prepareForTransition();
        this.xaxis.render();
      }
    }
  }

  render() {
    let rootNode = this.chartEl.getRootNode && this.chartEl.getRootNode();
    let inShadowRoot = Utils.is("ShadowRoot", rootNode);
    let doc = this.chartEl.ownerDocument;

    let css = inShadowRoot
      ? rootNode.getElementById("apexstock-css")
      : doc.getElementById("apexstock-css");

    if (!css) {
      css = document.createElement("style");
      css.id = "apexstock-css";
      css.textContent = apexStockCSS;

      if (inShadowRoot) {
        // We are in Shadow DOM, add to shadow root
        rootNode.prepend(css);
      } else {
        // Add to <head> of element's document
        doc.head.appendChild(css);
      }
    }

    this.chart.render();
    this.addCustomIndicatorDropdowns();

    // Initialize the ChartSwitch component
    new ChartSwitch(this);

    // Initialize DrawingTools
    new DrawingTools(this);

    // Initialize Export
    new Export(this, {
      filename: "my-stock-chart.png",
    });

    // Initialize the custom XAxis
    this.xaxis = new XAxis(this);

    // Initial update to ensure consistent heights
    this.updateAllChartHeights();
  }

  randomId() {
    return (Math.random() + 1).toString(36).substring(4);
  }

  addCustomIndicatorDropdowns() {
    // Create Overlays dropdown
    this.createIndicatorDropdown("Overlays", this.overlays, false);

    // Create Oscillators dropdown
    this.createIndicatorDropdown("Oscillators", this.oscillators, true);

    // Add the dropdowns to the toolbar
    this.chartEl.parentNode.insertBefore(this.primaryToolbar, this.chartEl);
  }

  createIndicatorDropdown(title, indicators, isOscillator) {
    const wrapper = document.createElement("div");
    wrapper.classList.add("apexstock-custom-select-wrapper");

    const trigger = document.createElement("div");
    trigger.classList.add("apexstock-custom-select-trigger");
    trigger.innerText = `Select ${title}`;
    wrapper.appendChild(trigger);

    const optionsContainer = document.createElement("div");
    optionsContainer.classList.add("apexstock-custom-options");

    Object.keys(indicators).forEach((key) => {
      const displayName =
        key === "rsi" || key === "macd"
          ? key.toUpperCase()
          : key
              .replace(/([A-Z])/g, " $1")
              .replace(/^./, (str) => str.toUpperCase());
      const option = document.createElement("div");
      option.classList.add("apexstock-custom-option");
      option.dataset.value = key;
      option.dataset.type = isOscillator ? "oscillator" : "overlay";
      option.innerText = displayName;
      optionsContainer.appendChild(option);

      option.addEventListener("click", (e) => {
        const optionValue = e.currentTarget.dataset.value;
        const isOscillatorOption =
          e.currentTarget.dataset.type === "oscillator";

        if (isOscillatorOption) {
          // For oscillators, implement radio button behavior

          if (e.currentTarget.classList.contains("selected")) {
            // If clicking on already selected oscillator, deselect it
            e.currentTarget.classList.remove("selected");
            this.removeIndicator(optionValue);
            this.activeOscillator = null;
          } else {
            // Clear any previously selected oscillator (radio button behavior)
            const allOscillatorOptions = optionsContainer.querySelectorAll(
              '.apexstock-custom-option[data-type="oscillator"]'
            );

            allOscillatorOptions.forEach((opt) => {
              if (opt.classList.contains("selected")) {
                opt.classList.remove("selected");
                this.removeIndicator(opt.dataset.value);
              }
            });

            // Select new oscillator
            e.currentTarget.classList.add("selected");
            this.activeOscillator = optionValue;
            this.updateIndicator(optionValue);
          }
        } else {
          // For overlays, keep checkbox behavior
          if (e.currentTarget.classList.contains("selected")) {
            e.currentTarget.classList.remove("selected");
            this.removeIndicator(optionValue);
          } else {
            e.currentTarget.classList.add("selected");
            this.updateIndicator(optionValue);
          }
        }

        // Update dropdown text
        const selectedOptions = optionsContainer.querySelectorAll(
          ".apexstock-custom-option.selected"
        );

        trigger.innerText =
          selectedOptions.length > 0
            ? `${title}: ${Array.from(selectedOptions)
                .map((opt) => opt.innerText)
                .join(", ")}`
            : `Select ${title}`;
      });
    });

    wrapper.appendChild(optionsContainer);
    trigger.addEventListener("click", () => {
      optionsContainer.style.display =
        optionsContainer.style.display === "block" ? "none" : "block";
    });
    // Track dropdown state and timeout for delayed closing
    let dropdownTimeout = null;
    const closeDropdown = () => {
      optionsContainer.style.display = "none";
    };

    // Add mouseleave event to the wrapper
    wrapper.addEventListener("mouseleave", () => {
      // Clear any existing timeout
      if (dropdownTimeout) {
        clearTimeout(dropdownTimeout);
      }
      // Set new timeout to close dropdown after 2 seconds
      if (optionsContainer.style.display === "block") {
        dropdownTimeout = setTimeout(closeDropdown, 1200);
      }
    });

    // Cancel the timeout if user returns to the dropdown before it closes
    wrapper.addEventListener("mouseenter", () => {
      if (dropdownTimeout) {
        clearTimeout(dropdownTimeout);
        dropdownTimeout = null;
      }
    });

    // Keep click listener for immediate closing when clicking elsewhere
    document.addEventListener("click", (e) => {
      if (!wrapper.contains(e.target)) {
        closeDropdown();
        if (dropdownTimeout) {
          clearTimeout(dropdownTimeout);
          dropdownTimeout = null;
        }
      }
    });

    this.primaryToolbarLeft.appendChild(wrapper);
    return wrapper;
  }

  computeHeights(newIndicatorCount) {
    // Get the total available height without the xAxis
    const totalHeightWithoutXAxis = this.totalHeight - this.xAxisHeight;

    // For main chart, calculate 60% of available height
    const newMainHeight = Math.floor(0.6 * totalHeightWithoutXAxis);

    // For indicators, calculate 40% of available height
    const indicatorContainerHeight = Math.floor(0.4 * totalHeightWithoutXAxis);

    // Divide indicator area by number of indicators
    const indicatorHeight =
      newIndicatorCount > 0
        ? Math.floor(indicatorContainerHeight / newIndicatorCount)
        : 0;

    return {
      newMainHeight,
      indicatorContainerHeight,
      indicatorHeight,
    };
  }

  updateAllChartHeights() {
    const indicatorCount = this.indicatorContainer.children.length;

    if (indicatorCount === 0) {
      // No indicators - give full height to main chart minus xAxisHeight
      const mainChartHeight = this.totalHeight - this.xAxisHeight;

      this.mainChartDiv.style.height = mainChartHeight + "px";
      this.indicatorContainer.style.height = "0px";

      this.chart.updateOptions(
        { chart: { height: mainChartHeight } },
        false,
        false,
        false
      );

      // Update XAxis position
      if (this.xaxis) {
        this.xaxis.updateHeight();
      }
      return;
    }

    // Calculate heights with indicators
    const { newMainHeight, indicatorContainerHeight, indicatorHeight } =
      this.computeHeights(indicatorCount);

    const INDICATOR_CHART_TOP_OFFSET = 18;
    // Update main chart height
    this.mainChartDiv.style.height =
      newMainHeight + INDICATOR_CHART_TOP_OFFSET * 2 + "px";
    this.indicatorContainer.style.height = indicatorContainerHeight + "px";

    this.chart.updateOptions(
      { chart: { height: newMainHeight + INDICATOR_CHART_TOP_OFFSET * 2 } },
      false,
      false,
      false
    );

    // Update each indicator's height
    for (let i = 0; i < indicatorCount; i++) {
      const indicatorDiv = this.indicatorContainer.children[i];
      indicatorDiv.style.height = indicatorHeight + "px";
      indicatorDiv.style.top = INDICATOR_CHART_TOP_OFFSET + "px";
      indicatorDiv.style.marginTop = INDICATOR_CHART_TOP_OFFSET * -2 + "px";
      indicatorDiv.style.position = "relative";
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

    // Update XAxis position
    if (this.xaxis) {
      this.xaxis.updateHeight();
    }
  }

  isOverlay(indicatorKey) {
    return Object.keys(this.overlays).includes(indicatorKey.toLowerCase());
  }

  /**
   * Get the current zoom state to apply to new charts
   * @returns {Object} Object containing min and max indices for the x-axis
   */
  getCurrentZoomState() {
    // If chart is not rendered yet, return null
    if (!this.chart || !this.chart.w) {
      return null;
    }

    const w = this.chart.w;

    // Get the current visible range
    let minX = 0;
    let maxX = w.globals.dataPoints - 1;

    // If chart is zoomed, use those values
    if (
      w.globals.isRangeBar ||
      w.globals.isTimelineBar ||
      w.config.chart.type === "rangeBar" ||
      w.config.chart.type === "candlestick"
    ) {
      minX = w.globals.minX;
      maxX = w.globals.maxX;
    } else if (
      w.globals.dataPoints > 0 &&
      w.globals.selectedDataPoints &&
      w.globals.selectedDataPoints[0] &&
      w.globals.selectedDataPoints[0].length
    ) {
      // In case of selection
      minX = Math.min(...w.globals.selectedDataPoints[0]);
      maxX = Math.max(...w.globals.selectedDataPoints[0]);
    } else if (w.globals.minX !== Infinity && w.globals.maxX !== -Infinity) {
      // For zoomed charts
      minX = w.globals.minX;
      maxX = w.globals.maxX;
    }

    return {
      minX,
      maxX,
    };
  }

  updateIndicator(indicatorKey) {
    // Store current zoom state before updating
    const zoomState = this.getCurrentZoomState();

    // Update the indicator
    IndicatorHandlers.updateIndicator(indicatorKey, this);

    // Apply zoom state to all charts if we have valid zoom information
    if (zoomState) {
      this.applyZoomToAllCharts(zoomState);
    }
  }

  removeIndicator(indicatorKey) {
    // Store current zoom state before removing
    const zoomState = this.getCurrentZoomState();

    // Remove the indicator
    IndicatorHandlers.removeIndicator(indicatorKey, this);

    // Apply zoom state to remaining charts if we have valid zoom information
    if (zoomState) {
      this.applyZoomToAllCharts(zoomState);
    }
  }

  /**
   * Apply saved zoom state to all charts
   * @param {Object} zoomState - The zoom state with minX and maxX
   */
  applyZoomToAllCharts(zoomState) {
    // First apply to main chart
    if (this.chart && zoomState) {
      this.chart.zoomX(zoomState.minX, zoomState.maxX);
    }

    // Then apply to all indicator charts
    Object.values(this.indicatorChartMap).forEach((chart) => {
      if (chart && typeof chart.zoomX === "function") {
        chart.zoomX(zoomState.minX, zoomState.maxX);
      }
    });
  }

  // Helper methods to delegate to the Indicators class
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

  calculateAcceleratorOsc(series) {
    return Indicators.calculateAcceleratorOsc(series);
  }

  calculateCCI(series, period) {
    return Indicators.calculateCCI(series, period);
  }

  calculateTSI(series, longPeriod, shortPeriod) {
    return Indicators.calculateTSI(series, longPeriod, shortPeriod);
  }
}
