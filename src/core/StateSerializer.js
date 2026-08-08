/**
 * StateSerializer — reads and writes a portable, schema-versioned snapshot of an
 * ApexStock chart's configurable state. This is the single serialization
 * backbone: `ApexStock#getState` / `setState` delegate here, and future
 * additions (drawings, trading overlays, event markers, panes) extend the
 * schema and the `migrate` step below rather than adding parallel save paths.
 *
 * v1 captures what the library authoritatively owns and can round-trip
 * losslessly: theme mode, active chart type, active indicators + their params,
 * and the visible x-range. The result is plain JSON (no functions), safe to
 * `JSON.stringify` and persist per user/workspace.
 *
 * Not in v1 (by design): drawings and trading price lines carry
 * non-serializable callbacks (`onMove`/`onCross`/custom renderers) and land in
 * v2 with a dedicated, lossless representation. A "timeframe"/interval is not
 * captured because ApexStock does not own one — interval aggregation is
 * consumer-driven via `ApexStock.aggregateOHLC`.
 */

const VERSION = 1;

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

    return {
      version: VERSION,
      theme: {
        mode: typeof ctx.getTheme === "function" ? ctx.getTheme() : "light",
      },
      chartType:
        (ctx.chartSwitch && ctx.chartSwitch.currentType) || "candlestick",
      indicators,
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
        zoom: null,
      };
    }

    // v1 is the current schema — nothing to migrate yet. Future bumps add
    // stepwise migrations here, e.g.:
    //   if ((state.version || 1) < 2) state = migrateV1toV2(state);
    // Newer-than-known versions pass through best-effort.
    return { ...state, version: state.version || VERSION };
  }
}
