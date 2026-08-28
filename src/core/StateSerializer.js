/**
 * StateSerializer — reads and writes a portable, schema-versioned snapshot of an
 * ApexStock chart's configurable state. This is the single serialization
 * backbone: `ApexStock#getState` / `setState` delegate here, and future
 * additions (drawings, trading overlays, event markers, panes) extend the
 * schema and the `migrate` step below rather than adding parallel save paths.
 *
 * v1 captured theme mode, active chart type, active indicators + their params,
 * and the visible x-range. v2 adds, all round-tripping as plain JSON:
 * `drawings` (the full data-space drawing set: trend/ray/level lines, zones, and
 * any mouse-drawn shapes), `eventMarkers` (time-anchored earnings/dividend/split/
 * news/custom flags), `annotations` (data-space y/x lines, bands, points, text),
 * `priceLines` (trading order/stop/take-profit/alert lines), and `priceScale`
 * (the primary-axis mode: linear/logarithmic/percent/indexed, or null for the
 * default linear scale), and `comparison` (multi-instrument comparison: mode,
 * benchmark, alignment policy, and instrument identity). The result is plain
 * JSON (no functions), safe to `JSON.stringify` and persist per user/workspace.
 *
 * Two things are captured by *reference* rather than by value, because the
 * consumer owns them:
 *
 * - Price lines carry non-serializable interactive callbacks (`onCross`/
 *   `onMove`/`onRemove`); only their declarative config is captured, so a
 *   consumer that relies on those callbacks re-binds them after `setState`
 *   (e.g. via `updatePriceLine(id, { onCross })`).
 * - Comparison instruments carry their price *data*, which the consumer fetches
 *   and which would bloat state unboundedly (and go stale immediately). State
 *   holds each instrument's name and color; `setState` restores the mode,
 *   benchmark, and policy, keeps any instrument whose data is still loaded, and
 *   emits `comparisonRestoreNeeded` with the names whose data must be supplied
 *   again (via `addComparison`).
 *
 * Measurements need no key of their own: a measurement *is* a `measure`
 * drawing, so it round-trips inside `drawings`.
 *
 * `panes` captures only the pane height ratios a consumer actually set (the
 * layout, not the pane list: which panes exist is derived from `indicators`).
 *
 * A "timeframe"/interval is not captured because ApexStock does not own one:
 * interval aggregation is consumer-driven via `ApexStock.aggregateOHLC`.
 *
 * Adding a key does not bump the schema version. `comparison`, like
 * `eventMarkers`, `annotations`, `priceLines`, and `priceScale` before it, is
 * additive and defaulted by {@link migrate}, so an older state restores cleanly
 * and an older reader ignores what it does not know. The version is for changes
 * that need a real transformation.
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

    const eventMarkers =
      ctx.eventMarkers && typeof ctx.eventMarkers._serialize === "function"
        ? ctx.eventMarkers._serialize()
        : [];

    const annotations =
      ctx.annotations && typeof ctx.annotations._serialize === "function"
        ? ctx.annotations._serialize()
        : [];

    const priceLines =
      ctx.tradingOverlays && typeof ctx.tradingOverlays._serialize === "function"
        ? ctx.tradingOverlays._serialize()
        : [];

    const priceScale =
      ctx.priceScale && typeof ctx.priceScale._serialize === "function"
        ? ctx.priceScale._serialize()
        : null;

    const comparison =
      ctx.comparison && typeof ctx.comparison._serialize === "function"
        ? ctx.comparison._serialize()
        : null;

    const paneRatios =
      typeof ctx.getPaneHeightRatios === "function"
        ? ctx.getPaneHeightRatios()
        : {};
    const panes = Object.keys(paneRatios).length ? paneRatios : null;

    return {
      version: VERSION,
      theme: {
        mode: typeof ctx.getTheme === "function" ? ctx.getTheme() : "light",
        preset:
          typeof ctx.getThemePreset === "function"
            ? ctx.getThemePreset()
            : null,
      },
      chartType:
        (ctx.chartSwitch && ctx.chartSwitch.currentType) || "candlestick",
      indicators,
      drawings,
      eventMarkers,
      annotations,
      priceLines,
      priceScale,
      comparison,
      panes,
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

    // Theme. A `preset` (named look) takes precedence over the plain `mode`;
    // with no preset we ensure the plain mode (which also clears any live
    // preset). `setThemePreset` / `updateTheme` are no-ops when already there.
    if (s.theme) {
      const wantPreset = s.theme.preset || null;
      const wantMode = s.theme.mode || "light";
      const curPreset =
        typeof ctx.getThemePreset === "function" ? ctx.getThemePreset() : null;
      const curMode =
        typeof ctx.getTheme === "function" ? ctx.getTheme() : "light";
      if (wantPreset && typeof ctx.setThemePreset === "function") {
        if (wantPreset !== curPreset) ctx.setThemePreset(wantPreset);
      } else if (typeof ctx.updateTheme === "function") {
        if (wantMode !== curMode || curPreset) ctx.updateTheme(wantMode);
      }
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

    // Event markers: same replace-the-set semantics as drawings.
    if (ctx.eventMarkers && typeof ctx.eventMarkers._restore === "function") {
      ctx.eventMarkers._restore(
        Array.isArray(s.eventMarkers) ? s.eventMarkers : []
      );
    }

    // Data-space annotations.
    if (ctx.annotations && typeof ctx.annotations._restore === "function") {
      ctx.annotations._restore(Array.isArray(s.annotations) ? s.annotations : []);
    }

    // Trading price lines (declarative config only; callbacks are re-bound by
    // the consumer after restore, see TradingOverlays._serialize).
    if (
      ctx.tradingOverlays &&
      typeof ctx.tradingOverlays._restore === "function"
    ) {
      ctx.tradingOverlays._restore(
        Array.isArray(s.priceLines) ? s.priceLines : []
      );
    }

    // Pane layout. After the indicators (which create the panes a ratio applies
    // to) and before the comparison rebuild, so the heights settle once. A null
    // snapshot clears any configured ratio back to the pane's default.
    if (typeof ctx.setPaneHeightRatio === "function") {
      const wanted = s.panes && typeof s.panes === "object" ? s.panes : {};
      const current =
        typeof ctx.getPaneHeightRatios === "function"
          ? ctx.getPaneHeightRatios()
          : {};
      Object.keys(current).forEach((key) => {
        if (!wanted[key]) ctx.setPaneHeightRatio(key, null);
      });
      Object.keys(wanted).forEach((key) => {
        const r = wanted[key] && wanted[key].heightRatio;
        if (Number.isFinite(+r) && +r > 0) ctx.setPaneHeightRatio(key, +r);
      });
    }

    // Comparison: mode, benchmark, and alignment policy, plus whichever
    // instruments still have their data (see the note at the top of this file).
    // Before the price scale, because rebuilding the comparison rewrites the
    // y-axes and PriceScale has to patch the primary axis afterwards.
    if (ctx.comparison && typeof ctx.comparison._restore === "function") {
      ctx.comparison._restore(s.comparison || null);
    }

    // Primary price-axis scale mode. A null snapshot resets to linear. Restored
    // last so the theme/chart-type rebuilds above cannot clobber it.
    if (ctx.priceScale && typeof ctx.priceScale._restore === "function") {
      ctx.priceScale._restore(s.priceScale || null);
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
        eventMarkers: [],
        annotations: [],
        priceLines: [],
        priceScale: null,
        comparison: null,
        panes: null,
        zoom: null,
      };
    }

    let s = { ...state };
    // v1 -> v2: `drawings` did not exist; default it to an empty set.
    if ((s.version || 1) < 2 && !Array.isArray(s.drawings)) {
      s.drawings = [];
    }
    if (!Array.isArray(s.drawings)) s.drawings = [];
    // `eventMarkers`, `annotations`, and `priceLines` also arrived in the v2
    // line; default them when absent so states captured before they existed
    // restore cleanly.
    if (!Array.isArray(s.eventMarkers)) s.eventMarkers = [];
    if (!Array.isArray(s.annotations)) s.annotations = [];
    if (!Array.isArray(s.priceLines)) s.priceLines = [];
    // `comparison` is additive like the keys above: a config object or null (no
    // comparison). Normalize anything non-object to null.
    if (typeof s.comparison !== "object") s.comparison = null;
    if (typeof s.panes !== "object") s.panes = null;
    // `priceScale` arrived in the v2 line too; a scalar object or null (default
    // linear). Normalize anything non-object to null.
    if (typeof s.priceScale !== "object") s.priceScale = null;
    // Newer-than-known versions pass through best-effort.
    s.version = VERSION;
    return s;
  }
}
