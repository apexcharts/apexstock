import Utils from "../utils/Utils";
import Statistics from "./Statistics";
import Align from "./Align";

/**
 * Measurement: the analysis layer behind the `measure` drawing tool.
 *
 * A measure drawing is two data-space anchors, so it already answers "how far
 * apart are these two points". This manager makes it answer the question an
 * analyst actually asks: **what happened over this stretch of the instrument**.
 * It turns each measure drawing into a full {@link Statistics.rangeStats}
 * readout (change, duration, true high and low, averages, volatility, drawdown)
 * and feeds both the on-chart label and the {@link ../components/AnalysisPanel.js
 * AnalysisPanel}.
 *
 * ## Two numbers, both named
 *
 * A measurement carries two changes, and conflating them would be the easy
 * mistake here:
 *
 * - **selection**: the delta between the two `y` values the user dragged. This
 *   is what the box's height shows, and it is the right number when someone
 *   measures a swing from one bar's low to another's high.
 * - **change**: the delta between the instrument's closes at the two bars the
 *   selection spans. This is the number every other statistic is consistent
 *   with (the averages, the volatility, the drawdown), because those are
 *   properties of the series, not of where the pointer went.
 *
 * Both are reported, separately labelled. The on-chart label leads with the
 * selection (the pre-existing behavior, and what the box geometry shows) and the
 * panel shows both. With `analysis.measure.snap` the anchors are pulled onto the
 * bar values, at which point the two agree by construction.
 *
 * ## Why the render path drives it
 *
 * `DrawingTools.redrawElements()` is the single funnel every measure change
 * flows through: the create drag, a move drag, a delete, a zoom, a pan, a
 * resize, a theme rebuild, and a `setState` restore all end there. So
 * {@link resolve} is called from the render path and does the caching, and
 * change detection is keyed on `(id, fromIndex, toIndex)` so panning a chart
 * with a measurement on it recomputes nothing and emits nothing.
 *
 * `rangeMeasured` fires on a **settled** change, not per frame: the flush waits
 * while a drag is in flight (`DrawingTools.isDrawing` /
 * `ElementInteractionManager.isMoving`) so one drag produces one event.
 *
 * @typedef {Object} MeasurementInfo
 * @property {string} id - The measure drawing's id.
 * @property {{index:number, x:*, value:number}} from - The left bar.
 * @property {{index:number, x:*, value:number}} to - The right bar.
 * @property {{from:number, to:number, absolute:number, percent:number|null}} selection
 *   The dragged anchors and their delta.
 * @property {import("./Statistics.js").RangeStats} stats - The region statistics.
 */

/** How many redraws' worth of resolved measurements to keep. Small by nature. */
const MAX_CACHE = 64;

export default class Measurement {
  /** @param {import("../ApexStock.js").default} ctx */
  constructor(ctx) {
    this.ctx = ctx;
    /** id -> { i0, i1, stats, selection, lines } @type {Map<string, object>} */
    this._cache = new Map();
    /** ids whose resolved range changed and still owe a `rangeMeasured`. */
    this._pending = new Set();
    /** The measurement the panel is currently showing. */
    this._activeId = null;
    this._flushHandle = null;
    this._boundFlush = () => {
      this._flushHandle = null;
      this.flush();
    };
  }

  /* ------------------------------------------------------------------ *
   * Options
   * ------------------------------------------------------------------ */

  /** The `analysis.measure` sub-config, merged over the analysis defaults. */
  _cfg() {
    const a = (this.ctx && this.ctx.analysisOptions) || {};
    return { snap: false, ...(a.measure || {}) };
  }

  /** Options for the statistics engine (analysis defaults minus UI keys). */
  _statOpts() {
    const a = { ...((this.ctx && this.ctx.analysisOptions) || {}) };
    delete a.measure;
    delete a.panel;
    return a;
  }

  /** The live drawing layer, or null before render(). */
  _layer() {
    return (this.ctx && this.ctx.drawingTools) || null;
  }

  /** The authoritative drawing store (live layer, else the buffered set). */
  _store() {
    const layer = this._layer();
    if (layer && Array.isArray(layer.elements)) return layer.elements;
    const d = this.ctx && this.ctx.drawings;
    return d && Array.isArray(d._pending) ? d._pending : [];
  }

  /* ------------------------------------------------------------------ *
   * Resolution (called from the drawing render path)
   * ------------------------------------------------------------------ */

  /**
   * Resolve a measure drawing's record into bars, statistics, and the label.
   * Cached on `(id, fromIndex, toIndex)`, so a pan or zoom that leaves the
   * anchors alone is free.
   *
   * @param {object} data - The internal measure element record (`x1,y1,x2,y2`).
   * @returns {{id:string, i0:number, i1:number, stats:object, selection:object,
   *   geometry:{x1:number,y1:number,x2:number,y2:number}, lines:string[]}|null}
   *   null when the series cannot resolve the anchors (the caller then falls
   *   back to plain geometry).
   */
  resolve(data) {
    if (!data) return null;
    const series = Array.isArray(this.ctx && this.ctx.series)
      ? this.ctx.series
      : [];
    if (!series.length) return null;

    // Drawing anchors are axis-space x values, never indices. Every series that
    // reaches the chart has a numeric x: Utils.normalizeOHLC drops any point
    // whose x is not date-parseable, so a string-category axis cannot occur.
    const by = { by: "x" };
    const i0 = Statistics.resolveIndex(series, data.x1, by);
    const i1 = Statistics.resolveIndex(series, data.x2, by);
    if (i0 === -1 || i1 === -1) return null;

    // An in-progress create drag has no id yet (DrawingTools assigns it on
    // mouse-up), so it resolves under a reserved key and is never emitted.
    const id = data.id || "__interim__";
    const cached = this._cache.get(id);
    if (cached && cached.i0 === i0 && cached.i1 === i1 && !cached.stale) {
      return cached;
    }

    const stats = Statistics.rangeStats(series, i0, i1, {
      ...this._statOpts(),
      by: "index",
    });
    if (!stats) return null;

    const selection = Measurement._selection(data);
    const resolved = {
      id,
      i0,
      i1,
      stats,
      selection,
      geometry: this._geometry(data, i0, i1, series),
      lines: this._lines(stats, selection, data),
    };

    this._remember(id, resolved);

    // A new or moved measurement owes an event, unless it is still mid-drag.
    if (data.id) {
      const changed = !cached || cached.i0 !== i0 || cached.i1 !== i1;
      if (changed) {
        this._pending.add(id);
        this._scheduleFlush();
      }
    }

    // The most recently touched measurement is the one the panel shows.
    this._activeId = id;
    this._paint(resolved);

    return resolved;
  }

  /** Store a resolved measurement, bounding the cache. @private */
  _remember(id, resolved) {
    if (this._cache.size >= MAX_CACHE && !this._cache.has(id)) {
      const oldest = this._cache.keys().next().value;
      this._cache.delete(oldest);
    }
    this._cache.set(id, resolved);
  }

  /** The dragged anchors and their delta. @private */
  static _selection(data) {
    const from = Number(data.y1);
    const to = Number(data.y2);
    const ok = Number.isFinite(from) && Number.isFinite(to);
    const absolute = ok ? to - from : null;
    return {
      from: ok ? from : null,
      to: ok ? to : null,
      absolute,
      percent: ok && from !== 0 ? (absolute / from) * 100 : null,
    };
  }

  /**
   * The coordinates the box is actually drawn at: the raw anchors, or the bar
   * values when `snap` is on.
   * @private
   */
  _geometry(data, i0, i1, series) {
    const raw = { x1: data.x1, y1: data.y1, x2: data.x2, y2: data.y2 };
    const snap = this._cfg().snap;
    if (!snap) return raw;

    const field = snap === true ? "close" : snap;
    const idx = { open: 0, high: 1, low: 2, close: 3 }[field];
    if (idx == null) return raw;

    const at = (i, fallbackX, fallbackY) => {
      const bar = series[i];
      const y = bar && Array.isArray(bar.y) ? Number(bar.y[idx]) : NaN;
      const x = bar ? Align.toAxisX(bar.x) : null;
      return {
        x: x === null ? fallbackX : x,
        y: Number.isFinite(y) ? y : fallbackY,
      };
    };
    const a = at(i0, data.x1, data.y1);
    const b = at(i1, data.x2, data.y2);
    return { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
  }

  /* ------------------------------------------------------------------ *
   * Label
   * ------------------------------------------------------------------ */

  /**
   * The on-chart label's lines. Leads with the selection delta (what the box's
   * height shows), then the duration. Override wholesale with
   * `analysis.measure.label(stats, extra) -> string | string[]`.
   * @private
   */
  _lines(stats, selection, data) {
    const custom = this._cfg().label;
    if (typeof custom === "function") {
      try {
        const out = custom(stats, { selection, drawing: data });
        if (out != null) {
          return Array.isArray(out) ? out.map(String) : [String(out)];
        }
      } catch (err) {
        Utils.warn(
          "analysis.measure.label threw; using the default label.",
          err
        );
      }
    }

    const lines = [];
    const d = selection.absolute;
    if (Number.isFinite(d)) {
      const sign = d >= 0 ? "+" : "";
      const pct =
        selection.percent != null
          ? ` (${sign}${Utils.truncateNumber(selection.percent)}%)`
          : "";
      lines.push(`${sign}${Utils.truncateNumber(d)}${pct}`);
    }

    const parts = [`${stats.bars} bars`];
    if (stats.calendarDays != null && stats.calendarDays >= 1) {
      parts.push(`${Math.round(stats.calendarDays)}d`);
    }
    lines.push(parts.join("  ·  "));

    return lines;
  }

  /* ------------------------------------------------------------------ *
   * Events
   * ------------------------------------------------------------------ */

  /** Queue a flush on the next frame. @private */
  _scheduleFlush() {
    if (this._flushHandle != null) return;
    const raf =
      typeof requestAnimationFrame === "function"
        ? requestAnimationFrame
        : (fn) => setTimeout(fn, 16);
    this._flushHandle = raf(this._boundFlush);
  }

  /** True while a create drag or a move drag is in flight. @private */
  _dragging() {
    const layer = this._layer();
    if (!layer) return false;
    if (layer.isDrawing) return true;
    const eim = layer.elementInteractionManager;
    return !!(eim && eim.isMoving);
  }

  /**
   * Emit `rangeMeasured` for every measurement whose range settled since the
   * last flush. Re-arms itself while a drag is still in flight, so one drag
   * produces one event rather than one per frame.
   * @param {"drag"|"api"|"coreRuler"} [source="drag"]
   * @returns {void}
   */
  flush(source = "drag") {
    if (!this._pending.size) return;
    if (this._dragging()) {
      this._scheduleFlush();
      return;
    }
    const ids = Array.from(this._pending);
    this._pending.clear();
    ids.forEach((id) => {
      const m = this._cache.get(id);
      if (!m) return;
      this._emit("rangeMeasured", {
        id,
        from: m.stats.from,
        to: m.stats.to,
        selection: m.selection,
        stats: m.stats,
        source,
      });
    });
  }

  /** @private */
  _emit(name, payload) {
    if (this.ctx && this.ctx._emitter) this.ctx._emitter.emit(name, payload);
  }

  /* ------------------------------------------------------------------ *
   * Panel
   * ------------------------------------------------------------------ */

  /** Hand a resolved measurement to the panel, if there is one. @private */
  _paint(resolved) {
    const panel = this.ctx && this.ctx.analysisPanel;
    if (panel && typeof panel.showMeasurement === "function") {
      panel.showMeasurement(resolved);
    }
  }

  /** Tell the panel there is nothing to show. @private */
  _clearPanel() {
    const panel = this.ctx && this.ctx.analysisPanel;
    if (panel && typeof panel.clear === "function") panel.clear();
  }

  /* ------------------------------------------------------------------ *
   * Public API (proxied by ApexStock)
   * ------------------------------------------------------------------ */

  /**
   * Create a measurement over a bar range programmatically. It is a real
   * `measure` drawing, so it renders, drags, reprojects on zoom, and persists
   * through `getState()` / `setState()` like a hand-drawn one.
   *
   * @param {number|string|Date} from
   * @param {number|string|Date} to
   * @param {object} [opts] - Passed to `addDrawing` (color, upColor, downColor,
   *   fillOpacity, showLabel, locked, meta, ...), plus statistics overrides.
   * @returns {{id:string, stats:object}|null} null when the endpoints cannot be
   *   resolved or there is no data.
   */
  measure(from, to, opts = {}) {
    const series = Array.isArray(this.ctx && this.ctx.series)
      ? this.ctx.series
      : [];
    if (!series.length) {
      Utils.warn("measureRange: the chart has no data to measure.");
      return null;
    }
    const by = { by: opts.by || "auto" };
    let i0 = Statistics.resolveIndex(series, from, by);
    let i1 = Statistics.resolveIndex(series, to, by);
    if (i0 === -1 || i1 === -1) {
      Utils.warn(
        "measureRange: could not resolve the endpoints to bars in this series."
      );
      return null;
    }
    if (i0 > i1) {
      const t = i0;
      i0 = i1;
      i1 = t;
    }

    const close = (i) => {
      const y = series[i] && series[i].y;
      return Array.isArray(y) ? Number(y[y.length - 1]) : NaN;
    };
    const points = [
      { x: Align.toAxisX(series[i0].x), y: close(i0) },
      { x: Align.toAxisX(series[i1].x), y: close(i1) },
    ];
    if (!Number.isFinite(points[0].y) || !Number.isFinite(points[1].y)) {
      Utils.warn("measureRange: the endpoint bars have no usable close.");
      return null;
    }

    const drawings = this.ctx && this.ctx.drawings;
    if (!drawings || typeof drawings.add !== "function") return null;
    // `by` steers endpoint resolution above; it is not a drawing property.
    const drawOpts = { ...opts };
    delete drawOpts.by;
    const id = drawings.add({ ...drawOpts, type: "measure", points });
    if (!id) return null;

    // The drawing layer renders (and so resolves) synchronously when it exists;
    // before render() it is buffered, so resolve here to return the statistics
    // either way.
    let m = this._cache.get(id);
    if (!m) {
      const record = this._store().find((it) => it.data && it.data.id === id);
      m = record ? this.resolve(record.data) : null;
    }
    if (!m) return null;

    this._pending.add(id);
    this.flush("api");
    return { id, stats: m.stats };
  }

  /**
   * @param {string} id
   * @returns {MeasurementInfo|null}
   */
  get(id) {
    const record = this._store().find(
      (it) => it.data && it.data.type === "measure" && it.data.id === String(id)
    );
    if (!record) return null;
    const m = this._cache.get(String(id)) || this.resolve(record.data);
    return m ? Measurement._public(m) : null;
  }

  /**
   * Every measurement currently on the chart, in drawing order.
   * @returns {MeasurementInfo[]}
   */
  getAll() {
    return this._store()
      .filter((it) => it.data && it.data.type === "measure" && it.data.id)
      .map((it) => {
        const m = this._cache.get(it.data.id) || this.resolve(it.data);
        return m ? Measurement._public(m) : null;
      })
      .filter(Boolean);
  }

  /** Public-facing copy of a resolved measurement. @private */
  static _public(m) {
    return {
      id: m.id,
      from: m.stats.from,
      to: m.stats.to,
      selection: m.selection,
      stats: m.stats,
    };
  }

  /**
   * Remove one measurement, or every measurement when `id` is omitted. Other
   * drawing types are never touched.
   * @param {string} [id]
   * @returns {number} how many measurements were removed.
   */
  clear(id) {
    const drawings = this.ctx && this.ctx.drawings;
    if (!drawings || typeof drawings.remove !== "function") return 0;

    const ids =
      id != null
        ? [String(id)]
        : this._store()
            .filter((it) => it.data && it.data.type === "measure" && it.data.id)
            .map((it) => it.data.id);

    let removed = 0;
    ids.forEach((mid) => {
      const record = this._store().find(
        (it) => it.data && it.data.id === mid && it.data.type === "measure"
      );
      if (!record) return;
      if (drawings.remove(mid)) {
        removed++;
        this._cache.delete(mid);
        this._pending.delete(mid);
        this._emit("measurementRemoved", { id: mid });
      }
    });

    if (removed && !this.getAll().length) {
      this._activeId = null;
      this._clearPanel();
    }
    return removed;
  }

  /* ------------------------------------------------------------------ *
   * ApexCharts core measure-ruler interop
   * ------------------------------------------------------------------ */

  /**
   * ApexCharts (>= 6.0.0) ships its own measure ruler as an opt-in feature
   * bundle (`import "apexcharts/features/measure"` plus
   * `chart: { measure: { enabled: true } }`). It owns a good gesture (a glass
   * pane that keeps the drag away from zoom/pan) but its numbers are purely
   * geometric: `dx`, `dy`, `percentChange`, `slope` between two anchors, with no
   * view of the high, low, volume, volatility, or drawdown across the span.
   *
   * So ApexStock does not depend on it, and does not replace its own measure
   * drawing with it (the core ruler's pins live on the chart instance, outside
   * ApexStock's state, so they would not survive `getState()`/`setState()`).
   * Instead, when a consumer has enabled it, ApexStock feeds it the same
   * financial readout via `chart.measure.label` and re-emits its `measured`
   * event on the ApexStock bus, so both gestures produce one consistent result.
   *
   * @param {{from:{x:number,y:number}, to:{x:number,y:number}}} payload
   * @returns {string[]} the readout lines, or a geometric fallback.
   */
  labelForCoreRuler(payload) {
    const resolved = this._fromCoreRuler(payload);
    if (!resolved) return [""];
    return this._lines(resolved.stats, resolved.selection, null);
  }

  /**
   * Re-emit the core ruler's `measured` as ApexStock's `rangeMeasured`, with the
   * full region statistics attached.
   * @param {object} payload - The core `measured` payload.
   * @returns {void}
   */
  onCoreMeasured(payload) {
    const resolved = this._fromCoreRuler(payload);
    if (!resolved) return;
    this._emit("rangeMeasured", {
      id: null,
      from: resolved.stats.from,
      to: resolved.stats.to,
      selection: resolved.selection,
      stats: resolved.stats,
      source: "coreRuler",
    });
    this._paint(resolved);
  }

  /** Statistics for a core-ruler payload's two x positions. @private */
  _fromCoreRuler(payload) {
    const series = Array.isArray(this.ctx && this.ctx.series)
      ? this.ctx.series
      : [];
    if (!series.length || !payload || !payload.from || !payload.to) return null;
    const stats = Statistics.rangeStats(series, payload.from.x, payload.to.x, {
      ...this._statOpts(),
      by: "x",
    });
    if (!stats) return null;
    return {
      id: null,
      stats,
      selection: Measurement._selection({
        y1: payload.from.y,
        y2: payload.to.y,
      }),
    };
  }

  /* ------------------------------------------------------------------ *
   * Lifecycle
   * ------------------------------------------------------------------ */

  /**
   * Invalidate the resolved cache after the series or the chart was rebuilt, so
   * the next redraw recomputes against the new data. Cheap: the drawings
   * themselves are owned by the drawing layer, which reapplies separately.
   * @returns {void}
   */
  reapply() {
    this._cache.forEach((m) => {
      m.stale = true;
    });
    if (!this.getAll().length) {
      this._activeId = null;
      this._clearPanel();
    }
  }

  /** Drop all state and any queued flush. @returns {void} */
  destroy() {
    if (this._flushHandle != null) {
      const cancel =
        typeof cancelAnimationFrame === "function"
          ? cancelAnimationFrame
          : clearTimeout;
      cancel(this._flushHandle);
      this._flushHandle = null;
    }
    this._cache.clear();
    this._pending.clear();
    this._activeId = null;
  }
}
