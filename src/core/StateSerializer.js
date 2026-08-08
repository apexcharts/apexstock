/**
 * StateSerializer — reads and writes a portable, schema-versioned snapshot of an
 * ApexStock chart's configurable state. This is the single serialization
 * backbone: `ApexStock#getState` / `setState` delegate here, and future
 * additions (drawings, trading overlays, event markers, panes) extend the
 * schema and the `migrate` step below rather than adding parallel save paths.
 *
 * v1 captured theme mode, active chart type, active indicators + their params,
 * and the visible x-range. v2 adds `drawings`: the full data-space drawing set
 * (trend/ray/level lines, zones, and any mouse-drawn shapes), which round-trips
 * losslessly because every drawing already stores plain-JSON geometry in data
 * coordinates. The result is plain JSON (no functions), safe to `JSON.stringify`
 * and persist per user/workspace.
 *
 * Not yet captured (by design): trading price lines carry non-serializable
 * callbacks (`onMove`/`onCross`/custom renderers) and land in a later version
 * with a dedicated representation. A "timeframe"/interval is not captured
 * because ApexStock does not own one — interval aggregation is consumer-driven
 * via `ApexStock.aggregateOHLC`.
 */

const VERSION = 2;

export default class StateSerializer {
  /** Current schema version. */
  static VERSION = VERSION;

  /**
   * Capture the current chart state as a plain, JSON-serializable object.
   * @param {import("../ApexStock.js").default} ctx - The ApexStock instance.
   * @returns {import("../types.js").ApexStockState}
   */
  static capture(ctx) {
    const map = ctx.indicatorChartMap || {};
    const indicators = Object.keys(map)
      .filter((key) => !!map[key])
      .map((key) => ({
        key,
        params:
          ctx.oscillatorSettings &&
          typeof ctx.oscillatorSettings.getIndicatorParams === "function"
            ? { ...ctx.oscillatorSettings.getIndicatorParams(key) }
            : {},
      }));

    const zoom =
      typeof ctx.getCurrentZoomState === "function"
        ? ctx.getCurrentZoomState()
        : null;

    const drawings =
      ctx.drawings && typeof ctx.drawings._serialize === "function"
        ? ctx.drawings._serialize()
        : [];

    return {
      version: VERSION,
      theme: {
        mode: typeof ctx.getTheme === "function" ? ctx.getTheme() : "light",
      },
      chartType:
        (ctx.chartSwitch && ctx.chartSwitch.currentType) || "candlestick",
      indicators,
      drawings,
      zoom:
        zoom && Number.isFinite(zoom.minX) && Number.isFinite(zoom.maxX)
          ? { minX: zoom.minX, maxX: zoom.maxX }
          : null,
    };
  }

  /**
   * Apply a captured state to a (rendered) ApexStock instance. Idempotent:
   * applying the state a chart is already in is a no-op-equivalent.
   *
   * Order matters — theme and chart type first, then indicators reconciled to
   * exactly the state's set (removed-then-added so restored params always take
   * effect), then the toolbar/`activeOscillator` resynced, and finally the zoom
   * (applied last so indicator churn does not clobber it).
   *
   * @param {import("../ApexStock.js").default} ctx - The ApexStock instance.
   * @param {import("../types.js").ApexStockState} state - A state (any supported version).
   * @returns {void}
   */
  static apply(ctx, state) {
    if (!state || typeof state !== "object") return;
    const s = StateSerializer.migrate(state);

    // Theme.
    if (
      s.theme &&
      s.theme.mode &&
      typeof ctx.getTheme === "function" &&
      s.theme.mode !== ctx.getTheme()
    ) {
      ctx.updateTheme(s.theme.mode);
    }

    // Chart type.
    if (
      s.chartType &&
      ctx.chartSwitch &&
      typeof ctx.chartSwitch.changeChartType === "function" &&
      s.chartType !== ctx.chartSwitch.currentType
    ) {
      ctx.chartSwitch.changeChartType(s.chartType);
    }

    // Indicators: reconcile to exactly the state's set. Remove every active
    // one, then add each desired indicator fresh with its restored params, so a
    // param change on an already-active indicator is honored.
    Object.keys(ctx.indicatorChartMap || {})
      .filter((k) => !!ctx.indicatorChartMap[k])
      .forEach((k) => ctx.removeIndicator(k));

    const desired = Array.isArray(s.indicators) ? s.indicators : [];
    desired.forEach((entry) => {
      const key = (entry && entry.key ? entry.key : "").toLowerCase();
      if (!key) return;
      if (entry.params && ctx.oscillatorSettings) {
        ctx.oscillatorSettings.indicatorParams[key] = { ...entry.params };
      }
      if (!ctx.indicatorChartMap[key]) ctx.updateIndicator(key);
    });

    // Reflect the active set onto the toolbar dropdown + activeOscillator.
    if (typeof ctx._syncIndicatorSelectionUI === "function") {
      ctx._syncIndicatorSelectionUI();
    }

    // Zoom (last, so indicator add/remove does not clobber the restored range).
    if (
      s.zoom &&
      Number.isFinite(s.zoom.minX) &&
      Number.isFinite(s.zoom.maxX) &&
      typeof ctx.applyZoomToAllCharts === "function"
    ) {
      ctx.applyZoomToAllCharts({ minX: s.zoom.minX, maxX: s.zoom.maxX });
    }

    // Drawings: replace the current set with the state's (post-render, so the
    // drawing layer exists; buffered otherwise). Guarded for fake ctxs.
    if (ctx.drawings && typeof ctx.drawings._restore === "function") {
      ctx.drawings._restore(Array.isArray(s.drawings) ? s.drawings : []);
    }
  }

  /**
   * Normalize a state object to the current schema version, applying any
   * stepwise migrations. A missing/invalid state yields an empty, valid v1
   * state so `setState(anything)` never throws.
   * @param {*} state
   * @returns {import("../types.js").ApexStockState}
   */
  static migrate(state) {
    if (!state || typeof state !== "object") {
      return {
        version: VERSION,
        theme: { mode: "light" },
        chartType: "candlestick",
        indicators: [],
        drawings: [],
        zoom: null,
      };
    }

    let s = { ...state };
    // v1 -> v2: `drawings` did not exist; default it to an empty set.
    if ((s.version || 1) < 2 && !Array.isArray(s.drawings)) {
      s.drawings = [];
    }
    if (!Array.isArray(s.drawings)) s.drawings = [];
    // Newer-than-known versions pass through best-effort.
    s.version = VERSION;
    return s;
  }
}
