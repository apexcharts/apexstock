import Utils from "../utils/Utils";
import { getDrawingTool } from "../tools/drawing/DrawingToolRegistry";

/**
 * Programmatic, data-space drawing API — a public facade over the drawing
 * layer's element model ({@link DrawingTools}). Where {@link Annotations}
 * mirrors declarative marks into native ApexCharts annotations, this manager
 * drives the freehand/anchored SVG overlay: it creates, edits, queries, and
 * serializes drawings whose geometry lives in *data* space ({@link
 * https://en.wikipedia.org/wiki/Cartesian_coordinate_system price/time}), so
 * they re-project through {@link CoordinateConverter} on every zoom/pan/resize
 * exactly like a mouse-drawn shape.
 *
 * Because every drawing (mouse-drawn or programmatic) is stored the same way in
 * `drawingTools.elements`, this is also the single source of truth for
 * serialization: {@link ApexStock#getState} captures the whole set and
 * {@link ApexStock#setState} restores it.
 *
 * Public types (input `type`, plus the aliases each accepts):
 * - `trendline` (alias `line`)      — a segment between two `{x, y}` points.
 * - `ray`                           — a half-line from point 0 through point 1,
 *                                     extended to the grid edge.
 * - `horizontalLine` (alias `hline`)— a price level spanning the full width.
 * - `verticalLine` (alias `vline`)  — a time marker spanning the full height.
 * - `rectangle` (alias `zone`)      — a filled box between two corner points.
 * - `fibRetracement` / `fibExtension` — Fibonacci level lines between two
 *                                     anchor points, each labeled with its ratio.
 * - `measure`                         — a box between two points, labeled with
 *                                     the price change, percent change, and bar
 *                                     count (green up, red down).
 *
 * `getDrawings()` additionally reports mouse-drawn `brush`/`highlighter`/
 * `circle`/`ellipse`/`text` shapes (read-only round-trip via state).
 *
 * @typedef {Object} DrawingConfig
 * @property {"trendline"|"line"|"ray"|"horizontalLine"|"hline"|"verticalLine"|"vline"|"rectangle"|"zone"|"fibRetracement"|"fibExtension"|"measure"} type
 * @property {string} [id] - Stable id; auto-generated ("draw-N") when omitted.
 * @property {Array<{x:(number|string|Date), y:number}>} [points] - Data-space
 *   anchors. trendline, ray, rectangle, fib, and measure need two;
 *   horizontalLine uses `y` of the first; verticalLine uses `x` of the first.
 * @property {boolean|"open"|"high"|"low"|"close"} [snap] - Snap each point to
 *   bar values: `true` (nearest OHLC value) or a specific field of the nearest bar.
 * @property {number[]} [levels] - Fibonacci ratios (fib* only); defaults to the
 *   standard retracement/extension set.
 * @property {boolean} [showLabels=true] - Draw ratio labels (fib* only).
 * @property {string} [upColor] - Measure box tint when the move is up.
 * @property {string} [downColor] - Measure box tint when the move is down.
 * @property {boolean} [showLabel=true] - Draw the measure label (measure only).
 * @property {string} [color] - Stroke color; defaults from the theme.
 * @property {number} [width=2] - Stroke width.
 * @property {string} [fill] - Fill color (rectangle); defaults to `color`.
 * @property {number} [fillOpacity=0.2] - Fill opacity (rectangle).
 * @property {number|number[]} [dashArray] - Stroke dash pattern for line types.
 * @property {boolean} [locked=false] - When true the drawing is not selectable
 *   or draggable in the UI (still visible and serialized).
 * @property {boolean} [visible=true] - When false the drawing is not rendered
 *   (still serialized, so it round-trips through state).
 * @property {*} [meta] - Arbitrary consumer payload, returned by get()/getAll().
 */

/** Input type -> internal element `data.type`. */
const TYPE_MAP = {
  trendline: "line",
  line: "line",
  ray: "ray",
  horizontalline: "hline",
  hline: "hline",
  verticalline: "vline",
  vline: "vline",
  rectangle: "rectangle",
  zone: "rectangle",
  fibretracement: "fib",
  fibextension: "fib",
  fib: "fib",
  measure: "measure",
};

/** Default Fibonacci ratios by kind. */
const FIB_LEVELS = {
  retracement: [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1],
  extension: [0, 0.618, 1, 1.618, 2.618],
};

/** Internal `data.type` -> the public type reported by get()/getAll(). */
const PUBLIC_TYPE = {
  line: "line",
  ray: "ray",
  hline: "horizontalLine",
  vline: "verticalLine",
  rectangle: "rectangle",
};

export default class Drawings {
  /** @param {import("../ApexStock.js").default} ctx */
  constructor(ctx) {
    this.ctx = ctx;
    // Drawings added before render() (when the drawing layer does not yet
    // exist) buffer here as {element:null, data}, flushed by reapply().
    /** @type {Array<{element:(SVGElement|null), data:object}>} */
    this._pending = [];
    this._counter = 0;
  }

  /** The live drawing layer, or null before render(). */
  _layer() {
    return this.ctx.drawingTools || null;
  }

  /** The authoritative element-store array ({element,data}), in place. */
  _store() {
    const layer = this._layer();
    return layer ? layer.elements : this._pending;
  }

  /** Repaint the overlay from the current data (no-op before render). */
  _redraw() {
    const layer = this._layer();
    if (layer && typeof layer.redrawElements === "function") {
      layer.redrawElements();
    }
  }

  _emit(name, payload) {
    if (this.ctx._emitter && typeof this.ctx._emitter.emit === "function") {
      this.ctx._emitter.emit(name, payload);
    }
  }

  /** Default stroke color from the theme (falls back to a neutral accent). */
  _defaultColor() {
    const c = this.ctx.colors || {};
    return (c.indicators && c.indicators.movingAverage) || "#008FFB";
  }

  /** Coerce an x value to axis space (epoch ms for date-like input). */
  _coerceX(x) {
    if (x == null) return null;
    if (typeof x === "number") return Number.isFinite(x) ? x : null;
    const t = new Date(x).getTime();
    return Number.isNaN(t) ? x : t; // pass through non-dates (category axes)
  }

  /** The primary OHLC series ({x, y:[o,h,l,c]}), or an empty array. */
  _series() {
    return Array.isArray(this.ctx.series) ? this.ctx.series : [];
  }

  /**
   * Snap a data-space point to bar values. With a numeric x, the point moves to
   * the nearest bar's x and its y snaps to that bar's chosen OHLC value; with no
   * x (a price-only point), y snaps to the nearest matching value across all
   * bars.
   * @param {{x:(number|null), y:number}} pt
   * @param {"ohlc"|"open"|"high"|"low"|"close"} mode
   * @param {import("../types.js").Series} series
   * @returns {{x:(number|null), y:number}}
   */
  _snapPoint(pt, mode, series) {
    const pick = (ohlc, py) => {
      switch (mode) {
        case "open":
          return ohlc[0];
        case "high":
          return ohlc[1];
        case "low":
          return ohlc[2];
        case "close":
          return ohlc[3];
        default: // "ohlc": whichever of the four is nearest to py
          return ohlc.reduce(
            (a, b) => (Math.abs(b - py) < Math.abs(a - py) ? b : a),
            ohlc[0]
          );
      }
    };

    let x = pt.x;
    let y = pt.y;

    if (pt.x != null && Number.isFinite(pt.x)) {
      let bar = null;
      let d = Infinity;
      for (const b of series) {
        if (!b || typeof b.x !== "number") continue;
        const dd = Math.abs(b.x - pt.x);
        if (dd < d) {
          d = dd;
          bar = b;
        }
      }
      if (bar) {
        x = bar.x;
        if (Number.isFinite(pt.y) && Array.isArray(bar.y)) y = pick(bar.y, pt.y);
      }
    } else if (Number.isFinite(pt.y)) {
      let best = pt.y;
      let d = Infinity;
      for (const b of series) {
        if (!b || !Array.isArray(b.y)) continue;
        const cand = pick(b.y, pt.y);
        const dd = Math.abs(cand - pt.y);
        if (dd < d) {
          d = dd;
          best = cand;
        }
      }
      y = best;
    }
    return { x, y };
  }

  /** Validate + normalize a user config into an internal `data`, or null. */
  _normalize(config) {
    if (!config || typeof config !== "object" || config.type == null) {
      Utils.warn("addDrawing: a config with a valid `type` is required.");
      return null;
    }
    const rawType = String(config.type).toLowerCase();
    const kind = TYPE_MAP[rawType];
    const customTool = kind ? null : getDrawingTool(rawType);
    if (!kind && !customTool) {
      Utils.warn(
        `addDrawing: unsupported type "${config.type}". Use trendline, ray, horizontalLine, verticalLine, rectangle, fibRetracement, fibExtension, or a type registered via ApexStock.registerDrawingTool.`
      );
      return null;
    }

    // Snap: adjust each point to bar values before geometry is derived.
    // `snap: true` snaps to the nearest OHLC value; a field name
    // ("open"|"high"|"low"|"close") snaps to that field of the nearest bar.
    const snapMode =
      config.snap === true
        ? "ohlc"
        : typeof config.snap === "string"
          ? config.snap.toLowerCase()
          : null;
    const snapSeries = snapMode ? this._series() : null;

    const pts = Array.isArray(config.points) ? config.points : [];
    const p = (i) => {
      if (!pts[i]) return { x: null, y: NaN };
      let pt = { x: this._coerceX(pts[i].x), y: Number(pts[i].y) };
      if (snapMode && snapSeries && snapSeries.length) {
        pt = this._snapPoint(pt, snapMode, snapSeries);
      }
      return pt;
    };
    const p0 = p(0);
    const p1 = p(1);

    const needXY = (q) => q.x != null && Number.isFinite(q.y);
    const bad = () => {
      Utils.warn(`addDrawing: missing/invalid points for type "${config.type}".`);
      return null;
    };

    const id =
      config.id != null ? String(config.id) : `draw-${++this._counter}`;
    const common = {
      id,
      color: config.color || this._defaultColor(),
      width: config.width != null ? Number(config.width) : 2,
      dashArray: config.dashArray,
      locked: config.locked === true,
      visible: config.visible !== false,
      meta: config.meta,
    };

    // Custom tool (registered via ApexStock.registerDrawingTool): keep the
    // data-space points and pass through arbitrary tool-specific fields so the
    // tool's render() can read them. Reserved keys are set from `common`.
    if (customTool) {
      const points = pts.map((pt) => {
        let q = { x: this._coerceX(pt.x), y: Number(pt.y) };
        if (snapMode && snapSeries && snapSeries.length) {
          q = this._snapPoint(q, snapMode, snapSeries);
        }
        return q;
      });
      // Pass through arbitrary tool-specific fields, minus the ones we set here.
      const rest = { ...config };
      delete rest.type;
      delete rest.points;
      delete rest.id;
      return {
        ...(customTool.defaults || {}),
        ...rest,
        id,
        type: rawType,
        points,
        color: common.color,
        width: common.width,
        dashArray: common.dashArray,
        locked: common.locked,
        visible: common.visible,
        meta: common.meta,
      };
    }

    switch (kind) {
      case "line":
      case "ray":
        if (!needXY(p0) || !needXY(p1)) return bad();
        return { ...common, type: kind, x1: p0.x, y1: p0.y, x2: p1.x, y2: p1.y };

      case "hline":
        if (!Number.isFinite(p0.y)) return bad();
        return { ...common, type: "hline", y: p0.y };

      case "vline":
        if (p0.x == null) return bad();
        return { ...common, type: "vline", x: p0.x };

      case "rectangle": {
        if (!needXY(p0) || !needXY(p1)) return bad();
        const x = Math.min(p0.x, p1.x);
        const y = Math.min(p0.y, p1.y);
        return {
          ...common,
          type: "rectangle",
          x,
          y,
          width: Math.abs(p1.x - p0.x),
          height: Math.abs(p1.y - p0.y),
          strokeWidth: common.width,
          fill: config.fill || common.color,
          fillOpacity: config.fillOpacity != null ? config.fillOpacity : 0.2,
        };
      }

      case "measure": {
        if (!needXY(p0) || !needXY(p1)) return bad();
        return {
          ...common,
          type: "measure",
          x1: p0.x,
          y1: p0.y,
          x2: p1.x,
          y2: p1.y,
          upColor: config.upColor || "#26a69a",
          downColor: config.downColor || "#ef5350",
          fillOpacity: config.fillOpacity != null ? config.fillOpacity : 0.2,
          showLabel: config.showLabel !== false,
        };
      }

      case "fib": {
        if (!needXY(p0) || !needXY(p1)) return bad();
        const fibType = rawType === "fibextension" ? "extension" : "retracement";
        const custom =
          Array.isArray(config.levels) && config.levels.length
            ? config.levels.map(Number).filter((n) => Number.isFinite(n))
            : null;
        return {
          ...common,
          type: "fib",
          fibType,
          x1: p0.x,
          y1: p0.y,
          x2: p1.x,
          y2: p1.y,
          levels: custom && custom.length ? custom : FIB_LEVELS[fibType],
          showLabels: config.showLabels !== false,
        };
      }

      default:
        return null;
    }
  }

  /** Public-facing copy of an internal element `data`. */
  _public(data) {
    if (!data) return null;
    const type = PUBLIC_TYPE[data.type] || data.type;
    const base = {
      id: data.id,
      type,
      color: data.color,
      width: data.width != null ? data.width : data.strokeWidth,
      dashArray: data.dashArray,
      locked: data.locked === true,
      visible: data.visible !== false,
      meta: data.meta,
    };

    switch (data.type) {
      case "line":
      case "ray":
        base.points = [
          { x: data.x1, y: data.y1 },
          { x: data.x2, y: data.y2 },
        ];
        break;
      case "hline":
        base.points = [{ x: null, y: data.y }];
        break;
      case "vline":
        base.points = [{ x: data.x, y: null }];
        break;
      case "rectangle":
        base.points = [
          { x: data.x, y: data.y },
          { x: data.x + data.width, y: data.y + data.height },
        ];
        base.fill = data.fill;
        base.fillOpacity = data.fillOpacity;
        break;
      case "fib":
        base.type = data.fibType === "extension" ? "fibExtension" : "fibRetracement";
        base.points = [
          { x: data.x1, y: data.y1 },
          { x: data.x2, y: data.y2 },
        ];
        base.levels = Array.isArray(data.levels) ? data.levels.slice() : [];
        base.showLabels = data.showLabels !== false;
        break;
      case "measure":
        base.points = [
          { x: data.x1, y: data.y1 },
          { x: data.x2, y: data.y2 },
        ];
        base.upColor = data.upColor;
        base.downColor = data.downColor;
        base.showLabel = data.showLabel !== false;
        break;
      case "circle":
        base.points = [{ x: data.cx, y: data.cy }];
        base.r = data.r;
        base.fill = data.fill;
        base.fillOpacity = data.fillOpacity;
        break;
      case "ellipse":
        base.points = [{ x: data.cx, y: data.cy }];
        base.rx = data.rx;
        base.ry = data.ry;
        base.fill = data.fill;
        base.fillOpacity = data.fillOpacity;
        break;
      case "brush":
      case "highlighter":
        base.points = Array.isArray(data.points)
          ? data.points.map((pt) => ({ x: pt.x, y: pt.y }))
          : [];
        break;
      case "text":
        base.points = [{ x: data.x, y: data.y }];
        base.text = data.text;
        break;
      default:
        // Custom tool types: report their data-space points.
        base.points = Array.isArray(data.points)
          ? data.points.map((pt) => ({ x: pt.x, y: pt.y }))
          : [];
    }
    return base;
  }

  /**
   * Add (or replace, if `id` already exists) a data-space drawing.
   * @param {DrawingConfig} config
   * @returns {string|null} the drawing id, or null on invalid input.
   */
  add(config) {
    const data = this._normalize(config);
    if (!data) return null;

    const store = this._store();
    const idx = store.findIndex((it) => it.data && it.data.id === data.id);
    if (idx !== -1) {
      store[idx] = { element: null, data };
    } else {
      store.push({ element: null, data });
    }
    this._redraw();
    this._emit("drawingAdded", { id: data.id, drawing: this._public(data) });
    return data.id;
  }

  /**
   * Patch an existing drawing (merges into its public config).
   * @param {string} id
   * @param {Partial<DrawingConfig>} [patch]
   * @returns {boolean} false if no such drawing.
   */
  update(id, patch = {}) {
    id = String(id);
    const store = this._store();
    const item = store.find((it) => it.data && it.data.id === id);
    if (!item) {
      Utils.warn(`updateDrawing: no drawing with id "${id}".`);
      return false;
    }
    const merged = { ...this._public(item.data), ...patch, id };
    const data = this._normalize(merged);
    if (!data) return false;
    item.data = data;
    item.element = null;
    this._redraw();
    this._emit("drawingUpdated", { id, drawing: this._public(data) });
    return true;
  }

  /**
   * Remove a drawing by id.
   * @param {string} id
   * @returns {boolean} false if no such drawing.
   */
  remove(id) {
    id = String(id);
    const store = this._store();
    const idx = store.findIndex((it) => it.data && it.data.id === id);
    if (idx === -1) return false;
    store.splice(idx, 1); // mutate in place (shared with the interaction mgr)
    this._redraw();
    this._emit("drawingRemoved", { id });
    return true;
  }

  /** Remove every drawing (mouse-drawn included). */
  clear() {
    const store = this._store();
    store.length = 0; // in place, so the interaction manager's ref stays valid
    this._redraw();
    this._emit("drawingsCleared", {});
  }

  /**
   * @param {string} id
   * @returns {object|null} a copy of the drawing config, or null.
   */
  get(id) {
    id = String(id);
    const item = this._store().find((it) => it.data && it.data.id === id);
    return item ? this._public(item.data) : null;
  }

  /** @returns {object[]} copies of all drawing configs (mouse-drawn included). */
  getAll() {
    return this._store()
      .filter((it) => it.data)
      .map((it) => this._public(it.data));
  }

  /**
   * Flush any drawings buffered before render() into the now-live layer.
   * Called by {@link ApexStock#render} after the drawing tools are created.
   */
  reapply() {
    const layer = this._layer();
    if (!layer || this._pending.length === 0) return;
    layer.elements.push(...this._pending); // mutate the shared array in place
    this._pending = [];
    this._redraw();
  }

  /**
   * Lossless plain-JSON snapshot of every drawing, for state serialization.
   * Un-serializable entries (e.g. a captured tooltip DOM) are skipped.
   * @returns {object[]}
   */
  _serialize() {
    return this._store()
      .filter((it) => it.data)
      .map((it) => {
        try {
          return JSON.parse(JSON.stringify(it.data));
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  }

  /**
   * Replace all drawings with a serialized list (from {@link _serialize}).
   * @param {object[]} list
   */
  _restore(list) {
    const store = this._store();
    store.length = 0; // in place
    if (Array.isArray(list)) {
      list.forEach((data) => {
        if (data && data.type) store.push({ element: null, data });
      });
    }
    this._redraw();
  }

  /** Remove all drawings and drop state. */
  destroy() {
    this._pending = [];
  }
}
