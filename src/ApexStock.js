import Indicators from "./indicators/Indicators";
import Utils from "./utils/Utils";
import DrawingTools from "./tools/drawing/DrawingTools";
import apexStockCSS from "ApexStock.css";
import Export from "./tools/export/Export";
import ChartSwitch from "./core/ChartSwitch";
import IndicatorHandlers from "./indicators/IndicatorHandlers";
import IndicatorStep from "./indicators/IndicatorStep";
import TradingOverlays from "./overlays/TradingOverlays";
import TradingOverlayInteractions from "./overlays/TradingOverlayInteractions";
import XAxis from "./components/XAxis";
import ThemeManager from "./core/ThemeManager";
import LayoutManager from "./core/LayoutManager";
import ZoomControls from "./components/ZoomControls";
import OscillatorSettings from "./components/OscillatorSettings";
import SettingsControl from "./components/SettingsControl";
import { LicenseManager, Watermark } from "apex-commons";
import { aggregateOHLC, INTERVALS } from "./utils/Aggregation";

/**
 * ApexStock — a financial-charting layer on top of ApexCharts. Renders an OHLC
 * main chart plus technical-indicator panes, drawing tools, and theming.
 */
export default class ApexStock {
  /**
   * Per-scope reference count for the shared `<style id="apexstock-css">` tag.
   * Keyed by the node the style is looked up on (the host `Document` or an
   * enclosing `ShadowRoot`) so the tag is injected once per scope and removed
   * only when the last instance sharing it is destroyed — preventing the
   * stylesheet from leaking into `<head>` across SPA navigation.
   * @type {WeakMap<Document | ShadowRoot, number>}
   */
  static _styleRefs = new WeakMap();

  /**
   * @param {HTMLElement} chartEl - The container element where the charts will be rendered.
   * @param {import("./types.js").StockChartOptions} chartOptions - ApexCharts options whose `series[0].data` holds the OHLC points.
   */
  constructor(chartEl, chartOptions) {
    // --- Validate the public boundary with clear, actionable errors ---
    // ApexStock is import-safe in Node/SSR (no DOM access happens at module
    // load), but it cannot *render* without a DOM. If a consumer constructs an
    // instance during server-side rendering, fail with a clear, actionable
    // message instead of a cryptic `document is not defined` deep in the stack.
    if (typeof document === "undefined" || typeof window === "undefined") {
      throw new Error(
        "[ApexStock] No DOM is available (window/document are undefined). ApexStock renders to the DOM and cannot run during server-side rendering — create the chart on the client (e.g. inside a browser-only effect/lifecycle, or after a dynamic client-only import)."
      );
    }
    if (!chartEl || typeof chartEl.appendChild !== "function") {
      throw new Error(
        "[ApexStock] A valid container DOM element must be provided as the first argument."
      );
    }
    if (typeof ApexCharts === "undefined") {
      throw new Error(
        "[ApexStock] ApexCharts was not found. Install the `apexcharts` peer dependency and ensure it is loaded before creating an ApexStock instance."
      );
    }
    if (
      !chartOptions ||
      typeof chartOptions !== "object" ||
      !chartOptions.chart
    ) {
      throw new Error(
        "[ApexStock] `chartOptions` with a `chart` object is required."
      );
    }
    if (
      !Array.isArray(chartOptions.series) ||
      !chartOptions.series[0] ||
      !Array.isArray(chartOptions.series[0].data)
    ) {
      throw new Error(
        "[ApexStock] `chartOptions.series[0].data` must be an array of OHLC data points."
      );
    }

    this.chartEl = chartEl;
    this.chartOptions = chartOptions;
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
    // Per-indicator running state for the incremental appendData() path, keyed by
    // the (lowercased) registry indicator key. Seeded from the current series
    // when an indicator is added, cleared when it is removed, and dropped wholesale
    // when the series is fully replaced (update()). Bypasses the WeakMap memo on
    // Indicators.* so a live append never forces an O(n) full recompute.
    // Each entry: { key, params, state } (see IndicatorStep).
    this._indicatorState = {};
    // Trading overlays (price lines: order / stop-loss / take-profit / alert).
    // Manages its own annotation lifecycle; re-applied on re-render so the lines
    // persist across update(), theme change, and chart-type switch.
    this.tradingOverlays = new TradingOverlays(this);
    this.FIBLEVELS = [0, 0.236, 0.382, 0.5, 0.618, 1];
    this.activeOscillator = null;

    // Initialize theme manager
    const themeName =
      (chartOptions.theme && chartOptions.theme.mode) || "light";
    this.themeManager = new ThemeManager(this, themeName);

    this.theme = this.themeManager.getTheme();
    this.isDarkTheme = this.theme === "dark";
    this.colors = this.themeManager.getColors();
    this.chartEl.parentNode.classList.add(`apexstock-theme-${this.theme}`);

    this.chartEl.parentNode.style.backgroundColor = this.isDarkTheme
      ? this.colors.toolbar.background
      : this.colors.toolbar.background;
    this.chartEl.style.backgroundColor = this.isDarkTheme
      ? this.colors.toolbar.background
      : this.colors.toolbar.background;

    const stockChartOptions =
      (chartOptions.plotOptions && chartOptions.plotOptions.stockChart) || {};
    // Sanitize the incoming OHLC data once at the boundary so the chart,
    // indicators, x-axis, and drawing-coordinate math all see clean, ordered
    // points. Write it back so ApexCharts renders the same normalized series.
    chartOptions.series[0].data = Utils.normalizeOHLC(chartOptions.series[0].data);
    this.series = chartOptions.series[0].data;

    // Initialize xaxis range from the series data
    this.initializeXAxisRange();

    this.SettingsControl = SettingsControl;

    // Indicator availability config (overlays / oscillators / merged indicators),
    // derived from the registry defaults plus the consumer's `indicators` option.
    // The resolution logic lives in IndicatorHandlers so it stays pure + testable.
    const indicatorConfig = IndicatorHandlers.resolveIndicatorConfig(
      stockChartOptions.indicators
    );
    this.overlays = indicatorConfig.overlays;
    this.oscillators = indicatorConfig.oscillators;
    this.indicators = indicatorConfig.indicators;

    this.volumesData = this.series
      .map((point) => (point.v ? { x: point.x, y: point.v } : null))
      .filter((x) => x !== null);

    const newChartOptions = Utils.extend(
      this.themeManager.getChartConfig(),
      chartOptions
    );
    this.mainChartOptions = Utils.extend(
      {
        chart: {
          type: "candlestick",
          height: initialMainChartHeight,
          id: this.mainChartId,
          group: this.groupID,
          parentHeightOffset: 0,
          background: "transparent",
          toolbar: {
            show: false,
            autoSelected: "pan",
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
          theme: {
            mode: this.theme,
          },
        },
        series: [{ name: "Price", data: this.series }],
        grid: {
          padding: {
            left: 0,
            right: 0,
          },
          borderColor: this.isDarkTheme ? "#404040" : "#e9ecef",
          strokeDashArray: 3,
        },
        tooltip: {
          theme: this.theme,
        },
        yaxis: {
          opposite: true,
          floating: true,
          tooltip: {
            enabled: true,
            offsetX: -5,
          },
          labels: {
            align: "right",
            offsetX: 10,
            offsetY: -8,
            style: {
              colors: this.isDarkTheme ? "#e0e0e0" : "#333",
            },
            formatter: (val) => {
              return Number(val).toFixed(2);
            },
          },
          crosshairs: {
            stroke: {
              dashArray: 3,
              color: this.isDarkTheme ? "#6c757d" : "#90A4AE",
            },
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
        // Add candlestick colors for dark/light themes
        plotOptions: {
          candlestick: {
            colors: {
              upward: this.isDarkTheme ? "#26A69A" : "#00B746",
              downward: this.isDarkTheme ? "#EF5350" : "#EF403C",
            },
          },
        },
        legend: { show: false },
      },
      newChartOptions
    );

    this.sanitizeTheme(this.mainChartOptions);

    this.chart = new ApexCharts(this.mainChartDiv, this.mainChartOptions);

    this.oscillatorSettings = new OscillatorSettings(this);
  }

  /**
   * Register a license key globally (delegates to apex-commons `LicenseManager`).
   * An invalid, expired, or missing key causes the apex-commons watermark
   * overlay to be shown on the chart.
   * @param {string} key - License key in the form `APEX-{encoded}`.
   * @returns {void}
   */
  static setLicense(key) {
    LicenseManager.setLicense(key);
  }

  /**
   * Roll fine-grained OHLC candles up into a coarser time frame (e.g. 1m → 1h,
   * 1h → 1d). Pure helper — pass the result to `new ApexStock(...)` or
   * `update({ series })` to re-render at the chosen interval.
   * @param {import("./types.js").Series} series - OHLC points to aggregate.
   * @param {string} interval - one of {@link ApexStock.INTERVALS}.
   * @returns {import("./types.js").Series} Aggregated candles (new array).
   */
  static aggregateOHLC(series, interval) {
    return aggregateOHLC(series, interval);
  }

  /**
   * The time-frame intervals accepted by {@link ApexStock.aggregateOHLC}.
   * @type {string[]}
   */
  static INTERVALS = INTERVALS;

  /**
   * Drop a present-but-nullish top-level `theme` before handing options to
   * ApexCharts. ApexCharts v5 dereferences `config.theme.mode` unconditionally,
   * and an explicit `theme: undefined` (e.g. `theme: someUnsetVar`) overwrites
   * its default rather than being back-filled — so it would throw. Deleting the
   * key lets ApexCharts apply its own default; a valid `theme` object is left
   * untouched.
   * @param {object} options - A chart-options object, mutated in place.
   * @returns {void}
   */
  sanitizeTheme(options) {
    if (options && "theme" in options && options.theme == null) {
      delete options.theme;
    }
  }

  handleWatermark() {
    const container = this.chartEl;

    if (!container) {
      return;
    }

    if (LicenseManager.isLicenseValid()) {
      Watermark.remove(container);
    } else {
      Watermark.add(container);
    }
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
        this.xaxis.render();
      }
    }, 0);
  }

  /**
   * Resolve a zoom/scroll-event x bound to a timestamp for the custom x-axis.
   *
   * ApexCharts reports `e.xaxis.min/max` in the axis's own value space, and the
   * declared `xaxis.type` is not a reliable discriminator (a category-style
   * candlestick axis can still report `type: "numeric"`). What IS reliable is
   * magnitude: on a category/index axis the bound is a small 1-based data index
   * (≤ the number of points), whereas on a numeric/datetime axis — what
   * numeric-timestamp `x` data produces — it is the x value itself, an epoch-ms
   * timestamp that dwarfs any index. So:
   *   - index-sized bound  -> look up `data[round(val - 1)].x`
   *   - timestamp-sized    -> the bound already IS the timestamp
   * The old code always did the index lookup, which on a numeric axis read past
   * the end of the array, yielded `NaN`, and froze the labels on scroll/zoom.
   *
   * @param {object} ctx - The ApexCharts context.
   * @param {number} val - `e.xaxis.min` or `e.xaxis.max`.
   * @param {number} fallback - Value to keep if resolution fails.
   * @returns {number} Timestamp in ms.
   */
  resolveXToTimestamp(ctx, val, fallback) {
    if (typeof val !== "number" || Number.isNaN(val)) return fallback;
    const data = ctx.w.config.series[0] && ctx.w.config.series[0].data;
    const isIndex = Array.isArray(data) && val <= data.length + 1;
    if (isIndex) {
      const point = data[Math.round(val - 1)];
      const ts = point ? new Date(point.x).getTime() : NaN;
      return Number.isNaN(ts) ? fallback : ts;
    }
    // numeric / datetime: the bound is already the x value (timestamp).
    const ts = new Date(val).getTime();
    return Number.isNaN(ts) ? fallback : ts;
  }

  /**
   * Handle zoom events from the chart
   * @param {Object} e - The zoom event data
   */
  handleZoom(ctx, e) {
    if (e && e.xaxis) {
      this.xaxisRange.min = this.resolveXToTimestamp(
        ctx,
        e.xaxis.min,
        this.xaxisRange.min
      );
      this.xaxisRange.max = this.resolveXToTimestamp(
        ctx,
        e.xaxis.max,
        this.xaxisRange.max
      );

      // Update the custom x-axis if it exists
      if (this.xaxis) {
        this.xaxis.render();
      }

      if (
        this.indicatorChartMap["fibonacci retracements"] &&
        typeof this.indicatorChartMap["fibonacci retracements"].update ===
          "function"
      ) {
        this.indicatorChartMap["fibonacci retracements"].update();
      }

      // Reposition draggable price-line handles for the new visible range.
      if (this.tradingInteractions) this.tradingInteractions.sync();
    }
  }

  /**
   * Handle scroll events from the chart
   * @param {Object} e - The scroll event data
   */
  handleScroll(ctx, e) {
    if (e && e.xaxis) {
      this.xaxisRange.min = this.resolveXToTimestamp(
        ctx,
        e.xaxis.min,
        this.xaxisRange.min
      );
      this.xaxisRange.max = this.resolveXToTimestamp(
        ctx,
        e.xaxis.max,
        this.xaxisRange.max
      );

      // Update the custom x-axis if it exists
      if (this.xaxis) {
        this.xaxis.render();
      }

      if (
        this.indicatorChartMap["fibonacci retracements"] &&
        typeof this.indicatorChartMap["fibonacci retracements"].update ===
          "function"
      ) {
        this.indicatorChartMap["fibonacci retracements"].update();
      }

      // Reposition draggable price-line handles for the new visible range.
      if (this.tradingInteractions) this.tradingInteractions.sync();
    }
  }

  /**
   * Render the main chart and initialize all sub-components (chart-type switch,
   * drawing tools, export, custom x-axis, zoom controls). Call once after
   * construction.
   * @returns {void}
   */
  render() {
    this._injectStyles();

    // Apply theme to chart container and toolbars
    this.themeManager.applyThemeStyles(this.chartEl, this.primaryToolbar);

    this.chart.render();
    this.addCustomIndicatorDropdowns();

    // Initialize the ChartSwitch component
    this.chartSwitch = new ChartSwitch(this);

    // Initialize DrawingTools
    new DrawingTools(this);

    // Initialize Export
    new Export(this, {
      filename: "my-stock-chart.png",
    });

    // Initialize the custom XAxis
    this.xaxis = new XAxis(this);

    // Initialize zoom controls
    this.zoomControls = new ZoomControls(this);

    // Initial update to ensure consistent heights
    this.updateAllChartHeights();

    this.handleWatermark();

    // Drag-to-reprice layer for draggable price lines (needs the rendered chart).
    this.tradingInteractions = new TradingOverlayInteractions(this);

    // Draw any price lines added before render() (and sync the drag handles).
    this.tradingOverlays.reapply();
  }

  /**
   * Inject the shared `<style id="apexstock-css">` into the chart's root — the
   * host document's `<head>`, or the enclosing `ShadowRoot`. Deduped by id so
   * it is added once per scope no matter how many charts mount, and reference-
   * counted (see {@link ApexStock._styleRefs}) so {@link ApexStock#destroy} can
   * remove it once the last chart in that scope is gone. Idempotent per
   * instance.
   * @returns {void}
   */
  _injectStyles() {
    if (this._styleScope) return; // already counted for this instance

    let rootNode = this.chartEl.getRootNode && this.chartEl.getRootNode();
    let inShadowRoot = Utils.is("ShadowRoot", rootNode);
    let doc = this.chartEl.ownerDocument;

    // The node we both look the style up on and key the refcount by.
    let scope = inShadowRoot ? rootNode : doc;

    let css = scope.getElementById("apexstock-css");
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

    ApexStock._styleRefs.set(scope, (ApexStock._styleRefs.get(scope) || 0) + 1);
    this._styleScope = scope;
  }

  /**
   * Release this instance's reference to the shared stylesheet and, when no
   * instances remain in the same scope, remove the injected `<style>` so it
   * does not linger in `<head>` after the chart is torn down (e.g. SPA
   * navigation). Idempotent — safe to call more than once.
   * @returns {void}
   */
  _removeStyles() {
    let scope = this._styleScope;
    if (!scope) return;
    this._styleScope = null;

    let count = (ApexStock._styleRefs.get(scope) || 1) - 1;
    if (count > 0) {
      ApexStock._styleRefs.set(scope, count);
      return;
    }

    ApexStock._styleRefs.delete(scope);
    let css = scope.getElementById && scope.getElementById("apexstock-css");
    if (css && css.parentNode) {
      css.parentNode.removeChild(css);
    }
  }

  /**
   * Apply new options/data to the chart, preserving active indicators, zoom
   * state, theme, and chart type across the update.
   * @param {Partial<import("./types.js").StockChartOptions>} newOptions
   * @returns {void}
   */
  update(newOptions) {
    // Store current state
    const activeIndicators = Object.keys(this.indicatorChartMap);
    const activeOscillator = this.activeOscillator;
    let currentZoomState = this.getCurrentZoomState();
    let themeConfig = this.themeManager.getChartConfig();

    // Indicators derive from the series data and theme colors; track whether
    // either actually changed so we can skip the (expensive) indicator rebuild
    // on option-only updates.
    let themeChanged = false;
    let seriesChanged = false;

    // Handle theme if it's being updated
    if (
      newOptions.theme &&
      newOptions.theme.mode &&
      newOptions.theme.mode !== this.theme
    ) {
      themeChanged = true;
      if (this.chartSwitch) {
        this.chartSwitch.updateTheme(newOptions.theme.mode);
      }

      // Update theme manager
      this.themeManager.setTheme(newOptions.theme.mode);
      this.theme = this.themeManager.getTheme();
      this.isDarkTheme = this.theme === "dark";
      this.colors = this.themeManager.getColors();

      themeConfig = this.themeManager.getChartConfig();

      // Apply theme styles to DOM elements
      this.chartEl.parentNode.classList.remove(
        `apexstock-theme-dark`,
        `apexstock-theme-light`
      );
      this.chartEl.parentNode.classList.add(`apexstock-theme-${this.theme}`);

      this.chartEl.parentNode.style.backgroundColor = this.isDarkTheme
        ? this.colors.toolbar.background
        : this.colors.toolbar.background;
      this.chartEl.style.backgroundColor = this.isDarkTheme
        ? this.colors.toolbar.background
        : this.colors.toolbar.background;

      // Apply theme to all UI elements
      this.themeManager.applyThemeStyles(this.chartEl, this.primaryToolbar);
    }

    // Update internal series data if new series is provided
    if (
      newOptions.series &&
      newOptions.series[0] &&
      newOptions.series[0].data
    ) {
      seriesChanged = true;
      // Normalize the replacement series too (same contract as the constructor)
      // and write it back so the chart update receives the cleaned points.
      newOptions.series[0].data = Utils.normalizeOHLC(newOptions.series[0].data);
      this.series = newOptions.series[0].data;

      // The series identity changed: drop all streaming state. refreshIndicators
      // below re-seeds each active indicator from the new data.
      this.resetIndicatorState();

      // Update volumes data if available in the new series
      this.volumesData = this.series
        .map((point) => (point.v ? { x: point.x, y: point.v } : null))
        .filter((x) => x !== null);
    }

    // Force update yaxis label colors based on theme
    if (!newOptions.yaxis) {
      newOptions.yaxis = this.chart.w.config.yaxis.map((axis) => ({
        ...axis,
        labels: {
          ...axis.labels,
          style: {
            ...axis.labels?.style,
            colors: themeConfig.yaxis.labels.style.colors,
          },
        },
      }));
    }

    // Merge options with theme configuration
    const updatedOptions = Utils.extend(
      this.themeManager.getChartConfig(),
      newOptions
    );

    // Update candlestick colors for dark/light themes if not specified in newOptions
    if (
      !newOptions.plotOptions ||
      !newOptions.plotOptions.candlestick ||
      !newOptions.plotOptions.candlestick.colors
    ) {
      if (!updatedOptions.plotOptions) updatedOptions.plotOptions = {};
      if (!updatedOptions.plotOptions.candlestick)
        updatedOptions.plotOptions.candlestick = {};

      updatedOptions.plotOptions.candlestick.colors = {
        upward: this.isDarkTheme ? "#26A69A" : "#00B746",
        downward: this.isDarkTheme ? "#EF5350" : "#EF403C",
      };
    }

    // Update the chart with new options
    this.sanitizeTheme(updatedOptions);
    this.chart.updateOptions(updatedOptions, true, true, true);

    // Reinitialize xaxis range with new data
    this.initializeXAxisRange();

    // Rebuild active indicators only when their inputs (series data or theme
    // colors) changed. Option-only updates leave them untouched, since the
    // updateOptions call above does not replace the chart series.
    //   - series-only change -> update indicator DATA in place (no pane teardown),
    //   - theme change (with or without series) -> full rebuild so the pane chrome
    //     (stroke/grid/colors) is restyled too.
    if (seriesChanged && !themeChanged) {
      this.refreshIndicatorsInPlace(activeIndicators);
    } else if (seriesChanged || themeChanged) {
      this.refreshIndicators(activeIndicators);
    }

    // Re-apply trading price lines: updateOptions can drop or stale dynamically
    // added annotations, and a theme change must recolor them.
    this.tradingOverlays.reapply();

    // Restore active oscillator state
    this.activeOscillator = activeOscillator;

    // Apply zoom if there was an active zoom state and preserve it if possible
    if (
      currentZoomState &&
      currentZoomState.minX !== undefined &&
      currentZoomState.maxX !== undefined
    ) {
      // Check if the new data range is compatible with the previous zoom
      const dataLength = this.series.length;
      if (currentZoomState.maxX < dataLength) {
        this.applyZoomToAllCharts(currentZoomState);
      } else {
        // If previous zoom is out of bounds for new data, adjust to fit
        const adjustedZoom = {
          minX: Math.min(currentZoomState.minX, dataLength - 1),
          maxX: Math.min(currentZoomState.maxX, dataLength - 1),
        };
        this.applyZoomToAllCharts(adjustedZoom);
      }
    }

    // Update XAxis with new theme if applicable
    if (this.xaxis) {
      if (newOptions.theme && newOptions.theme.mode) {
        // Store reference to the old xaxis instance
        const oldXAxis = this.xaxis;

        // Create a new XAxis instance with updated theme context
        this.xaxis = new XAxis(this);

        // Clean up old instance if possible
        if (oldXAxis && typeof oldXAxis.destroy === "function") {
          oldXAxis.destroy();
        }
      }

      // Render the XAxis (either existing or newly created)
      this.xaxis.render();
    }

    // Update heights to ensure consistent layout
    this.updateAllChartHeights();

    // Restore chart type if different from default
    if (this.chartSwitch && this.chartSwitch.currentType !== "candlestick") {
      const temp = this.chartSwitch.currentType;
      this.chartSwitch.currentType = null; // Reset to force redraw
      this.chartSwitch.changeChartType(temp);
    }

    this.handleWatermark();
  }

  /**
   * Tear down sub-components and their listeners.
   * @returns {void}
   */
  destroy() {
    // Clean up trading overlays (remove annotations, drop state) + drag layer.
    if (this.tradingInteractions) this.tradingInteractions.destroy();
    if (this.tradingOverlays) this.tradingOverlays.destroy();

    // Clean up ChartSwitch
    if (this.chartSwitch && typeof this.chartSwitch.destroy === "function") {
      this.chartSwitch.destroy();
    }
    if (
      this.oscillatorSettings &&
      typeof this.oscillatorSettings.destroy === "function"
    ) {
      this.oscillatorSettings.destroy();
    }

    // Drop our reference to the shared stylesheet; removes it from <head>
    // once the last instance in this scope is gone.
    this._removeStyles();
  }

  randomId() {
    return (Math.random() + 1).toString(36).substring(4);
  }

  addCustomIndicatorDropdowns() {
    // Create a single Indicators dropdown combining both overlays and oscillators
    this.createIndicatorDropdown("Indicators", {
      ...this.overlays,
      ...this.oscillators,
    });

    // Add the dropdown to the toolbar
    this.chartEl.parentNode.insertBefore(this.primaryToolbar, this.chartEl);
  }

  createIndicatorDropdown(title, indicators) {
    const wrapper = document.createElement("div");
    wrapper.classList.add("apexstock-custom-select-wrapper");

    const trigger = document.createElement("div");
    trigger.classList.add("apexstock-custom-select-trigger");
    trigger.innerText = `Select ${title}`;
    trigger.setAttribute("role", "button");
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");

    wrapper.appendChild(trigger);

    const optionsContainer = document.createElement("div");
    optionsContainer.classList.add("apexstock-custom-options");
    optionsContainer.setAttribute("role", "listbox");
    optionsContainer.setAttribute("aria-label", title);

    // Selection logic shared by mouse click and keyboard (Enter/Space). Toggles
    // the option (overlays = checkbox, oscillators = radio), refreshes the
    // trigger label, and keeps `aria-selected` in sync.
    const toggleOption = (option) => {
      const optionValue = option.dataset.value;
      const isOscillatorOption = option.dataset.type === "oscillator";

      if (isOscillatorOption) {
        if (option.classList.contains("selected")) {
          option.classList.remove("selected");
          this.removeIndicator(optionValue);
          this.activeOscillator = null;
        } else {
          // Radio behavior: clear any previously selected oscillator first.
          optionsContainer
            .querySelectorAll(
              '.apexstock-custom-option[data-type="oscillator"]'
            )
            .forEach((opt) => {
              if (opt.classList.contains("selected")) {
                opt.classList.remove("selected");
                this.removeIndicator(opt.dataset.value);
              }
            });
          option.classList.add("selected");
          this.activeOscillator = optionValue;
          this.updateIndicator(optionValue);
        }
      } else {
        // Checkbox behavior for overlays.
        if (option.classList.contains("selected")) {
          option.classList.remove("selected");
          this.removeIndicator(optionValue);
        } else {
          option.classList.add("selected");
          this.updateIndicator(optionValue);
        }
      }

      const selectedOptions = optionsContainer.querySelectorAll(
        ".apexstock-custom-option.selected"
      );
      trigger.innerText =
        selectedOptions.length > 0
          ? `${title}: ${Array.from(selectedOptions)
              .map((opt) => opt.innerText)
              .join(", ")}`
          : `Select ${title}`;

      optionsContainer
        .querySelectorAll(".apexstock-custom-option")
        .forEach((opt) => {
          opt.setAttribute(
            "aria-selected",
            opt.classList.contains("selected") ? "true" : "false"
          );
        });
    };

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
      option.setAttribute("role", "option");
      option.setAttribute("aria-selected", "false");
      // Roving tabindex: the active option becomes 0 while the listbox is open.
      option.setAttribute("tabindex", "-1");

      // Determine if this is an oscillator or overlay
      const isOscillator = Object.keys(this.oscillators).includes(key);
      option.dataset.type = isOscillator ? "oscillator" : "overlay";

      option.innerText = displayName;
      optionsContainer.appendChild(option);

      option.addEventListener("click", () => toggleOption(option));
    });

    wrapper.appendChild(optionsContainer);

    // --- Keyboard support (ARIA listbox pattern) ---
    const getOptions = () =>
      Array.from(optionsContainer.querySelectorAll(".apexstock-custom-option"));
    const isOpen = () => optionsContainer.style.display === "block";

    // Roving tabindex: only the active option is in the tab order; focus it.
    const focusOption = (idx) => {
      const opts = getOptions();
      if (!opts.length) return;
      const i = Math.max(0, Math.min(idx, opts.length - 1));
      opts.forEach((o, n) => o.setAttribute("tabindex", n === i ? "0" : "-1"));
      opts[i].focus();
    };

    let dropdownTimeout = null;
    const closeDropdown = (returnFocus) => {
      optionsContainer.style.display = "none";
      trigger.setAttribute("aria-expanded", "false");
      if (returnFocus) trigger.focus();
    };
    const openDropdown = (focusActive) => {
      optionsContainer.style.display = "block";
      trigger.setAttribute("aria-expanded", "true");
      if (focusActive) {
        const opts = getOptions();
        const sel = opts.findIndex((o) => o.classList.contains("selected"));
        focusOption(sel >= 0 ? sel : 0);
      }
    };

    // Trigger is operable via mouse and keyboard.
    trigger.setAttribute("tabindex", "0");
    trigger.addEventListener("click", () => {
      if (isOpen()) closeDropdown();
      else openDropdown(false);
    });
    trigger.addEventListener("keydown", (e) => {
      switch (e.key) {
        case "Enter":
        case " ":
          e.preventDefault();
          if (isOpen()) closeDropdown();
          else openDropdown(true);
          break;
        case "ArrowDown":
          e.preventDefault();
          openDropdown(true);
          break;
        case "Escape":
          if (isOpen()) {
            e.preventDefault();
            closeDropdown();
          }
          break;
      }
    });

    // Arrow / Home / End / Enter / Space / Escape / Tab within the listbox.
    optionsContainer.addEventListener("keydown", (e) => {
      const opts = getOptions();
      const current = opts.indexOf(document.activeElement);
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          focusOption(current + 1);
          break;
        case "ArrowUp":
          e.preventDefault();
          focusOption(current - 1);
          break;
        case "Home":
          e.preventDefault();
          focusOption(0);
          break;
        case "End":
          e.preventDefault();
          focusOption(opts.length - 1);
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          if (current >= 0) toggleOption(opts[current]);
          break;
        case "Escape":
          e.preventDefault();
          closeDropdown(true);
          break;
        case "Tab":
          closeDropdown();
          break;
      }
    });

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
    return LayoutManager.computeHeights({
      totalHeight: this.totalHeight,
      xAxisHeight: this.xAxisHeight,
      indicatorCount: newIndicatorCount,
    });
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
        this.xaxis.ensureXAxisIsLast();
      }
      return;
    }

    // Calculate heights with indicators
    const { newMainHeight, indicatorContainerHeight, indicatorHeight } =
      this.computeHeights(indicatorCount);

    const INDICATOR_CHART_TOP_OFFSET = LayoutManager.INDICATOR_CHART_TOP_OFFSET;
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
      this.xaxis.ensureXAxisIsLast();
    }

    this.updateOscillatorSettings();
  }

  isOverlay(indicatorKey) {
    return Object.keys(this.overlays).includes(indicatorKey.toLowerCase());
  }

  /**
   * Get the current visible x-axis range to apply to new charts.
   * @returns {import("./types.js").ZoomState|null} `{minX, maxX}`, or null if the chart is not yet rendered.
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

  /**
   * Tear down and rebuild the given indicators so they reflect new data or
   * theme colors. The teardown is required because {@link updateIndicator}
   * toggles: calling it on an already-active indicator would remove it.
   * @param {string[]} indicatorKeys - Keys of currently active indicators.
   * @returns {void}
   */
  refreshIndicators(indicatorKeys) {
    indicatorKeys.forEach((indicator) => {
      this.removeIndicator(indicator);
    });
    indicatorKeys.forEach((indicator) => {
      this.updateIndicator(indicator);
    });
  }

  /**
   * Refresh the given indicators' DATA over the current series without tearing
   * anything down: overlays are rebuilt onto the main chart, oscillator panes are
   * updated in place (no destroy/recreate/render), and fibonacci re-evaluates.
   * This is the fast path for {@link update} on a series-only change; it preserves
   * zoom and re-seeds the streaming state from the new data. Any indicator that
   * cannot be updated in place (e.g. a builder that opted out) falls back to a
   * full {@link updateIndicator} rebuild.
   * @param {string[]} indicatorKeys - Keys of currently active indicators.
   * @returns {void}
   */
  refreshIndicatorsInPlace(indicatorKeys) {
    const zoomState = this.getCurrentZoomState();
    indicatorKeys.forEach((indicator) => {
      const ok = IndicatorHandlers.updateIndicatorDataInPlace(indicator, this);
      if (!ok) {
        // Could not update in place: rebuild this one the heavy way.
        this.removeIndicator(indicator);
        this.updateIndicator(indicator);
      }
      // Re-seed the incremental streaming state from the new series.
      this.seedIndicatorState(indicator);
    });
    if (this.xaxis && typeof this.xaxis.ensureXAxisIsLast === "function") {
      this.xaxis.ensureXAxisIsLast();
    }
    if (zoomState) {
      this.applyZoomToAllCharts(zoomState);
    }
    if (this.xaxis && typeof this.xaxis.updateEventListeners === "function") {
      this.xaxis.updateEventListeners();
    }
  }

  /**
   * Seed (or re-seed) the incremental streaming state for one indicator from the
   * current `this.series`, bypassing the memoized full-compute cache. No-op for
   * indicators without a streaming twin (ichimoku, fibonacci, volumes), whose
   * stale state (if any) is dropped.
   * @param {string} indicatorKey - Registry indicator key (any casing).
   * @returns {void}
   */
  seedIndicatorState(indicatorKey) {
    const key = (indicatorKey || "").toLowerCase();
    const params = this.oscillatorSettings
      ? this.oscillatorSettings.getIndicatorParams(key)
      : {};
    const resolved = IndicatorStep.resolve(key, params);
    if (!resolved) {
      delete this._indicatorState[key];
      return;
    }
    this._indicatorState[key] = {
      key: resolved.key,
      params: resolved.params,
      kind: resolved.kind,
      render: resolved.render,
      // `state` is the committed running state covering this.series[0 .. len-1].
      state: IndicatorStep.seed(resolved.key, this.series, resolved.params),
      len: this.series.length,
    };
  }

  /**
   * Drop the streaming state for one indicator (on removal/toggle-off).
   * @param {string} indicatorKey - Registry indicator key (any casing).
   * @returns {void}
   */
  clearIndicatorState(indicatorKey) {
    delete this._indicatorState[(indicatorKey || "").toLowerCase()];
  }

  /**
   * Drop all streaming state. Used when the series is fully replaced so the next
   * append re-seeds from the new data (the active indicators are re-added by
   * {@link refreshIndicators}, which re-seeds each).
   * @returns {void}
   */
  resetIndicatorState() {
    this._indicatorState = {};
  }

  /**
   * Step one indicator to the value at this.series' last bar, bypassing the
   * memoized full compute. `entry.state` is the committed running state covering
   * this.series[0 .. entry.len-1]; this advances it to cover the last bar when
   * `commit` is true (a closed bar) and leaves it untouched for a forming bar so
   * the next forming tick re-steps from the same base. The committed state lags
   * by exactly one in the steady-state append path (no re-seed); a re-seed (the
   * O(n) safety net) only happens when that invariant is broken, e.g. when a
   * forming bar closes or after a maxPoints trim shifts indices.
   * @param {{ key: string, params: any, state: any, len: number }} entry
   * @param {boolean} commit
   * @returns {*} the indicator value at the last bar.
   */
  _stepIndicatorEntry(entry, commit) {
    const L = this.series.length;
    if (entry.len !== L - 1) {
      entry.state = IndicatorStep.seed(
        entry.key,
        this.series.slice(0, L - 1),
        entry.params
      );
      entry.len = L - 1;
    }
    const { value, state } = IndicatorStep.step(
      entry.key,
      entry.state,
      this.series,
      entry.params
    );
    if (commit) {
      entry.state = state;
      entry.len = L;
    }
    return value;
  }

  /**
   * Incrementally append one or more OHLC bars (or replace the forming last bar)
   * without the full teardown/rebuild that {@link update} performs. Price candles,
   * every streamable overlay and oscillator pane, the volume pane, the x-axis, and
   * the view are updated in O(active indicators x small tail) instead of
   * O(full history): no normalizeOHLC over all bars, no memoized full indicator
   * recompute, and no pane destroy/recreate.
   *
   * @param {import("./types.js").OHLCPoint | import("./types.js").OHLCPoint[]} pointOrPoints
   *   One bar, or a batch, in the canonical `{ x, y:[o,h,l,c], v? }` shape.
   * @param {Object} [options]
   * @param {"follow"|"preserve"} [options.view="follow"] `follow` rides the right
   *   edge (shifts a zoomed window to include the new bar); `preserve` keeps the
   *   current zoom window unchanged.
   * @param {number} [options.maxPoints] Rolling-window cap: trims the oldest bars
   *   from the front so the buffer stays fixed-width. Running indicators keep their
   *   carried state (values reflect all history seen, not the trimmed window), so
   *   they intentionally differ from a cold reload of the truncated buffer.
   * @param {boolean} [options.updateLast=false] When the incoming `x` equals the
   *   last bar's `x`, replace it (a forming candle receiving ticks) instead of
   *   appending. With `updateLast`, a new-`x` bar is treated as still forming.
   * @returns {this}
   */
  appendData(pointOrPoints, options = {}) {
    if (!this.chart || !this.chart.w) {
      Utils.warn("appendData: chart is not rendered; ignoring.");
      return this;
    }
    const view = options.view === "preserve" ? "preserve" : "follow";
    const updateLast = !!options.updateLast;
    const maxPoints = options.maxPoints;

    let incoming = Array.isArray(pointOrPoints)
      ? pointOrPoints
      : [pointOrPoints];
    incoming = Utils.normalizeOHLC(incoming);
    if (!incoming.length) {
      Utils.warn("appendData: no valid points to append; ignoring.");
      return this;
    }

    // Capture the pre-append view so the policy can decide whether to follow or
    // preserve. "Zoomed" = the visible window sits inside the old data extent.
    const oldFirstX = this.series.length ? this.series[0].x : null;
    const oldLastX = this.series.length
      ? this.series[this.series.length - 1].x
      : null;
    const zoomState = this.getCurrentZoomState();
    const wasZoomed = !!(
      zoomState &&
      oldFirstX != null &&
      (zoomState.minX > oldFirstX || zoomState.maxX < oldLastX)
    );

    // A volume pane only consumes per-bar volume; it is not derived.
    const volumePane = this.indicatorChartMap["volumes"];
    const hasVolumePane = volumePane && typeof volumePane !== "boolean";

    // Per-series deltas to apply once at the end. `committed` (a closed bar) vs a
    // forming bar is the same for every bar in one call (single updateLast flag).
    const overlayDeltas = {}; // seriesName -> [{ op, point }]
    const paneDeltas = {}; // registryKey -> { seriesName -> [{ op, point }] }
    const volumeDeltas = []; // [{ op, point }]
    const pushDelta = (bucket, name, op, point) => {
      (bucket[name] = bucket[name] || []).push({ op, point });
    };

    const streamableKeys = Object.keys(this._indicatorState);
    let applied = 0;

    for (const bar of incoming) {
      const last = this.series[this.series.length - 1];
      const sameX = last && bar.x === last.x;
      let op;
      if (updateLast && sameX) {
        this.series[this.series.length - 1] = bar;
        op = "replace";
      } else if (last && bar.x <= last.x) {
        Utils.warn(
          "appendData: ignoring out-of-order/duplicate x (" + bar.x + ")."
        );
        continue;
      } else {
        this.series.push(bar);
        op = "append";
      }
      applied++;
      const commit = op === "append" && !updateLast;

      // Volume buffer + pane delta.
      if (bar.v != null) {
        const vPoint = { x: bar.x, y: bar.v };
        if (op === "replace" && this.volumesData.length) {
          this.volumesData[this.volumesData.length - 1] = vPoint;
        } else {
          this.volumesData.push(vPoint);
        }
        if (hasVolumePane) volumeDeltas.push({ op, point: vPoint });
      }

      // Indicators: step each streamable active indicator and record its points.
      for (const regKey of streamableKeys) {
        const entry = this._indicatorState[regKey];
        const value = this._stepIndicatorEntry(entry, commit);
        const rendered = entry.render(value, bar.x);
        if (entry.kind === "overlay") {
          for (const { name, point } of rendered) {
            pushDelta(overlayDeltas, name, op, point);
          }
        } else {
          paneDeltas[regKey] = paneDeltas[regKey] || {};
          for (const { name, point } of rendered) {
            pushDelta(paneDeltas[regKey], name, op, point);
          }
        }
      }

      // Fire price-line cross/alert callbacks for a newly-closed bar.
      if (commit) this.tradingOverlays.checkCrossings(null, bar);
    }

    if (!applied) return this; // every incoming bar was rejected

    // this.series was mutated in place, so its identity-keyed memo is now stale.
    // Drop it: the streaming steppers already bypass the memo, but any later full
    // compute on this array (ichimoku below, or a theme-driven refresh) must not
    // read a stale, shorter cached result.
    Indicators.invalidate(this.series);

    // Rolling-window trim: drop the oldest bars uniformly from every buffer and
    // shift each indicator's committed length so its invariant still holds.
    let drop = 0;
    if (maxPoints && this.series.length > maxPoints) {
      drop = this.series.length - maxPoints;
      this.series.splice(0, drop);
      const vDrop = Math.min(drop, this.volumesData.length);
      if (vDrop) this.volumesData.splice(0, vDrop);
      for (const regKey of streamableKeys) {
        const e = this._indicatorState[regKey];
        e.len = Math.max(0, e.len - drop);
      }
    }

    // Helper: apply this call's deltas (then the front trim) to a data array.
    const applyDeltas = (data, deltas) => {
      for (const { op, point } of deltas) {
        if (op === "replace" && data.length) data[data.length - 1] = point;
        else data.push(point);
      }
      if (drop) data.splice(0, Math.min(drop, data.length));
      return data;
    };

    // ── Main chart: price + overlays (streamable patched, ichimoku recomputed) ──
    const ichimokuActive = !!this.indicatorChartMap["ichimoku cloud indicator"];
    let ichimoku = null;
    if (ichimokuActive) ichimoku = this.calculateIchimoku(this.series);
    const newMainSeries = this.chart.w.config.series.map((s) => {
      if (s.name === "Price") return { ...s, data: this.series };
      if (overlayDeltas[s.name]) {
        return { ...s, data: applyDeltas(s.data.slice(), overlayDeltas[s.name]) };
      }
      if (ichimoku && s.name === "Tenkan-sen") {
        return {
          ...s,
          data: ichimoku.tenkan.map((v, i) => ({ x: this.series[i].x, y: v.y })),
        };
      }
      if (ichimoku && s.name === "Kijun-sen") {
        return {
          ...s,
          data: ichimoku.kijun.map((v, i) => ({ x: this.series[i].x, y: v.y })),
        };
      }
      return s;
    });
    this.chart.updateSeries(newMainSeries);

    // ── Oscillator panes (one updateSeries per active pane instance) ────────────
    for (const regKey of Object.keys(paneDeltas)) {
      const pane = this.indicatorChartMap[regKey];
      if (!pane || typeof pane === "boolean") continue;
      const newPaneSeries = pane.w.config.series.map((s) => {
        const d = paneDeltas[regKey][s.name];
        return d ? { ...s, data: applyDeltas(s.data.slice(), d) } : s;
      });
      pane.updateSeries(newPaneSeries);
    }

    // ── Volume pane ─────────────────────────────────────────────────────────────
    if (hasVolumePane && (volumeDeltas.length || drop)) {
      const newVolSeries = volumePane.w.config.series.map((s) =>
        s.name === "Volumes"
          ? { ...s, data: applyDeltas(s.data.slice(), volumeDeltas) }
          : s
      );
      volumePane.updateSeries(newVolSeries);
    }

    // ── Fibonacci annotation: re-evaluate its levels against the new range ───────
    const fib = this.indicatorChartMap["fibonacci retracements"];
    if (fib && typeof fib.update === "function") fib.update();

    // ── X-axis + view policy ────────────────────────────────────────────────────
    this.initializeXAxisRange();
    const lastX = this.series[this.series.length - 1].x;
    if (view === "follow") {
      if (wasZoomed) {
        const width = zoomState.maxX - zoomState.minX;
        this.applyZoomToAllCharts({ minX: lastX - width, maxX: lastX });
      }
      // Not zoomed: the full view already includes the new bar.
    } else if (wasZoomed) {
      // preserve: keep the exact prior window even if the new bar is off-screen.
      this.applyZoomToAllCharts(zoomState);
    }

    // The y-range may have shifted with the new bars; reposition drag handles.
    if (this.tradingInteractions) this.tradingInteractions.sync();

    return this;
  }

  /**
   * Add a trading price line (a horizontal y-axis annotation on the main chart).
   * @param {import("./overlays/TradingOverlays.js").PriceLineConfig} config
   * @returns {string|null} the line id, or null on invalid input.
   */
  addPriceLine(config) {
    return this.tradingOverlays.add(config);
  }

  /**
   * Add an order line. Pass `side: "buy" | "sell"` to color it accordingly.
   * @param {import("./overlays/TradingOverlays.js").PriceLineConfig} [config]
   * @returns {string|null}
   */
  addOrderLine(config = {}) {
    return this.tradingOverlays.add({ ...config, type: "order" });
  }

  /**
   * Add a stop-loss line.
   * @param {import("./overlays/TradingOverlays.js").PriceLineConfig} [config]
   * @returns {string|null}
   */
  addStopLoss(config = {}) {
    return this.tradingOverlays.add({ ...config, type: "stop-loss" });
  }

  /**
   * Add a take-profit line.
   * @param {import("./overlays/TradingOverlays.js").PriceLineConfig} [config]
   * @returns {string|null}
   */
  addTakeProfit(config = {}) {
    return this.tradingOverlays.add({ ...config, type: "take-profit" });
  }

  /**
   * Add a price alert line.
   * @param {import("./overlays/TradingOverlays.js").PriceLineConfig} [config]
   * @returns {string|null}
   */
  addAlert(config = {}) {
    return this.tradingOverlays.add({ ...config, type: "alert" });
  }

  /**
   * Patch an existing price line (e.g. reprice or relabel).
   * @param {string} id
   * @param {Partial<import("./overlays/TradingOverlays.js").PriceLineConfig>} patch
   * @returns {boolean} false if no such line.
   */
  updatePriceLine(id, patch) {
    return this.tradingOverlays.update(id, patch);
  }

  /**
   * Remove a price line by id.
   * @param {string} id
   * @returns {boolean} false if no such line.
   */
  removePriceLine(id) {
    return this.tradingOverlays.remove(id);
  }

  /** Remove every trading price line. @returns {void} */
  clearPriceLines() {
    this.tradingOverlays.clear();
  }

  /**
   * @param {string} id
   * @returns {object|null} a copy of the line's config, or null.
   */
  getPriceLine(id) {
    return this.tradingOverlays.get(id);
  }

  /** @returns {object[]} copies of all price-line configs. */
  getPriceLines() {
    return this.tradingOverlays.getAll();
  }

  /**
   * Add or refresh a technical indicator pane/overlay, preserving zoom state.
   * @param {string} indicatorKey - Indicator name (e.g. "rsi", "moving average").
   * @returns {void}
   */
  updateIndicator(indicatorKey) {
    // Store current zoom state before updating
    const zoomState = this.getCurrentZoomState();

    // Update the indicator
    IndicatorHandlers.updateIndicator(indicatorKey, this);

    // Maintain the incremental streaming state for the append path. updateIndicator
    // toggles, so seed when the indicator is now active and clear when it was
    // toggled off.
    const key = (indicatorKey || "").toLowerCase();
    if (this.indicatorChartMap[key]) {
      this.seedIndicatorState(key);
    } else {
      this.clearIndicatorState(key);
    }

    // Apply zoom state to all charts if we have valid zoom information
    if (zoomState) {
      this.applyZoomToAllCharts(zoomState);
    }

    // Update XAxis event listeners to include the new indicator chart
    if (this.xaxis && typeof this.xaxis.updateEventListeners === "function") {
      this.xaxis.updateEventListeners();
    }
  }

  /**
   * Remove a technical indicator pane/overlay, preserving zoom state.
   * @param {string} indicatorKey - Indicator name (e.g. "rsi", "moving average").
   * @returns {void}
   */
  removeIndicator(indicatorKey) {
    // Store current zoom state before removing
    const zoomState = this.getCurrentZoomState();

    // Remove the indicator
    IndicatorHandlers.removeIndicator(indicatorKey, this);

    // Drop any incremental streaming state for the removed indicator.
    this.clearIndicatorState(indicatorKey);

    // Apply zoom state to remaining charts if we have valid zoom information
    if (zoomState) {
      this.applyZoomToAllCharts(zoomState);
    }

    // Update XAxis event listeners to reflect removed indicator chart
    if (this.xaxis && typeof this.xaxis.updateEventListeners === "function") {
      this.xaxis.updateEventListeners();
    }

    if (this.oscillatorSettings) {
      this.oscillatorSettings.removeSettingsElement(indicatorKey);
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

  /**
   * Updates the chart theme
   * @param {string} newTheme - The new theme ('light' or 'dark')
   */
  updateTheme(newTheme) {
    if (newTheme !== "light" && newTheme !== "dark") {
      Utils.warn('Invalid theme. Use "light" or "dark".');
      return;
    }

    if (this.theme === newTheme) return;

    this.themeManager.setTheme(newTheme);
    this.theme = this.themeManager.getTheme();
    this.isDarkTheme = this.theme === "dark";
    this.colors = this.themeManager.getColors();
    this.themeManager.applyThemeStyles(this.chartEl, this.primaryToolbar);

    // Get theme configuration with preserved axis settings
    const themeConfig = this.themeManager.getChartConfig();

    // Update chart with preserved configurations
    this.chart.updateOptions(
      Utils.extend(themeConfig, this.mainChartOptions),
      false,
      false,
      false
    );

    // Update all indicators by re-adding them with new theme colors
    const activeIndicators = Object.keys(this.indicatorChartMap);
    const activeOscillator = this.activeOscillator;

    // Rebuild active indicators so they pick up the new theme colors.
    this.refreshIndicators(activeIndicators);

    // Recolor trading price lines for the new theme.
    this.tradingOverlays.reapply();

    // Restore active oscillator state
    this.activeOscillator = activeOscillator;

    // Re-apply zoom state
    const zoomState = this.getCurrentZoomState();
    if (zoomState) {
      this.applyZoomToAllCharts(zoomState);
    }

    // Update zoom controls theme
    if (this.zoomControls) {
      this.zoomControls.updateTheme(newTheme);
    }

    // Update ChartSwitch theme
    if (
      this.chartSwitch &&
      typeof this.chartSwitch.updateTheme === "function"
    ) {
      this.chartSwitch.updateTheme(newTheme);
    }

    if (this.oscillatorSettings) {
      this.oscillatorSettings.updateTheme(newTheme);
    }
  }

  /**
   * Gets the current theme.
   * @returns {import("./types.js").ThemeMode} Current theme ('light' or 'dark').
   */
  getTheme() {
    return this.themeManager.getTheme();
  }

  /**
   * Update the positions of oscillator settings controls
   * Called after height changes, indicator additions/removals
   */
  updateOscillatorSettings() {
    if (
      this.oscillatorSettings &&
      typeof this.oscillatorSettings.updatePositions === "function"
    ) {
      // Use setTimeout to allow chart layout to finalize
      setTimeout(() => {
        this.oscillatorSettings.updatePositions();
      }, 150);
    }
  }

  /**
   * Updates chart options and applies theme changes if needed.
   * @param {Partial<import("./types.js").StockChartOptions>} newOptions - New chart options.
   * @returns {void}
   */
  updateChartOptions(newOptions) {
    if (newOptions.theme && newOptions.theme.mode !== this.theme) {
      this.updateTheme(newOptions.theme.mode);
    }

    this.chart.updateOptions(newOptions, false, false, false);

    // Update any other chart-related properties as needed
    if (newOptions.chart && newOptions.chart.height) {
      this.totalHeight = newOptions.chart.height;
      this.updateAllChartHeights();
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

  calculateFibonacciRetracementsForRange(series, startIndex, endIndex) {
    return Indicators.calculateFibonacciRetracementsForRange(
      series,
      startIndex,
      endIndex
    );
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

  calculateChaikinOsc(series, shortPeriod, longPeriod) {
    return Indicators.calculateChaikinOsc(series, shortPeriod, longPeriod);
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

  calculateAcceleratorOsc(series, period) {
    return Indicators.calculateAcceleratorOsc(series, period);
  }

  calculateCCI(series, period) {
    return Indicators.calculateCCI(series, period);
  }

  calculateTSI(series, longPeriod, shortPeriod) {
    return Indicators.calculateTSI(series, longPeriod, shortPeriod);
  }
}
