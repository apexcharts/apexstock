import Utils from "../utils/Utils";

/**
 * Data-space annotations: horizontal/vertical lines, bands, point markers, and
 * text placed at data coordinates (price and time), distinct from the freehand
 * drawing tools (screen space) and the trading price lines
 * ({@link TradingOverlays}, a specialized y-line subset).
 *
 * Each annotation is a declarative config the consumer owns; this manager keeps
 * the source-of-truth map and mirrors it into ApexCharts annotations,
 * re-applying them on every re-render (update / theme / chart-type switch) so
 * they persist. Removal is always by id (never `clearAnnotations()`), so trading
 * price lines and indicator annotations are left untouched.
 *
 * Types:
 * - `yLine`  — horizontal line at `y`.
 * - `yBand`  — horizontal band between `y` and `y2`.
 * - `xLine`  — vertical line at `x` (timestamp/category).
 * - `xBand`  — vertical band between `x` and `x2`.
 * - `point`  — marker at (`x`, `y`), optionally labeled.
 * - `text`   — a label at (`x`, `y`) with no marker.
 *
 * @typedef {Object} AnnotationConfig
 * @property {"yLine"|"yBand"|"xLine"|"xBand"|"point"|"text"} type
 * @property {string} [id] - Stable id; auto-generated ("anno-N") when omitted.
 * @property {number} [y] - Y (price) for yLine/yBand/point/text.
 * @property {number} [y2] - Second Y for yBand.
 * @property {number|string|Date} [x] - X (time) for xLine/xBand/point/text.
 * @property {number|string|Date} [x2] - Second X for xBand.
 * @property {string} [label] - Label text.
 * @property {string} [text] - Alias for `label` (natural for type "text").
 * @property {string} [color] - Line/marker/label color; defaults from the theme.
 * @property {string} [fillColor] - Band fill (defaults to `color`).
 * @property {number} [opacity=0.1] - Band fill opacity.
 * @property {string} [textColor] - Label text color.
 * @property {number} [strokeDashArray] - Line dash length.
 * @property {number} [width=1] - Line width.
 * @property {"left"|"right"} [labelPosition] - Label side for y annotations.
 * @property {object} [marker] - Point marker overrides ({ size, shape, fillColor, ... }).
 * @property {*} [meta] - Arbitrary consumer payload, returned by get()/getAll().
 */

const LINE_TYPES = new Set(["yLine", "yBand", "xLine", "xBand", "point", "text"]);

export default class Annotations {
  /** @param {import("../ApexStock.js").default} ctx */
  constructor(ctx) {
    this.ctx = ctx;
    /** @type {Object.<string, object>} id -> normalized annotation */
    this.items = {};
    this._counter = 0;
  }

  /** Default annotation color from the theme (falls back to a neutral accent). */
  _defaultColor() {
    const c = this.ctx.colors || {};
    return (c.indicators && c.indicators.movingAverage) || "#008FFB";
  }

  /** Coerce an x value to the axis space (epoch ms for date-like input). */
  _coerceX(x) {
    if (x == null) return null;
    if (typeof x === "number") return Number.isFinite(x) ? x : null;
    const t = new Date(x).getTime();
    return Number.isNaN(t) ? x : t; // pass through non-dates (category axes)
  }

  /** Validate + normalize a user config into a stored item, or null if invalid. */
  _normalize(config) {
    if (!config || typeof config !== "object" || !LINE_TYPES.has(config.type)) {
      Utils.warn(
        'addAnnotation: a config with a valid `type` ("yLine"|"yBand"|"xLine"|"xBand"|"point"|"text") is required.'
      );
      return null;
    }
    const type = config.type;
    const y = config.y != null ? Number(config.y) : undefined;
    const y2 = config.y2 != null ? Number(config.y2) : undefined;
    const x = this._coerceX(config.x);
    const x2 = this._coerceX(config.x2);

    // Per-type required fields.
    const needFiniteY = (v) => Number.isFinite(v);
    if (
      ((type === "yLine" || type === "yBand") && !needFiniteY(y)) ||
      (type === "yBand" && !needFiniteY(y2)) ||
      ((type === "xLine" || type === "xBand") && x == null) ||
      (type === "xBand" && x2 == null) ||
      ((type === "point" || type === "text") && (x == null || !needFiniteY(y)))
    ) {
      Utils.warn(`addAnnotation: missing/invalid coordinates for type "${type}".`);
      return null;
    }

    const id =
      config.id != null ? String(config.id) : `anno-${++this._counter}`;
    return {
      id,
      type,
      x,
      x2,
      y,
      y2,
      label: config.text != null ? String(config.text) : config.label,
      color: config.color,
      fillColor: config.fillColor,
      opacity: config.opacity != null ? config.opacity : 0.1,
      textColor: config.textColor,
      strokeDashArray: config.strokeDashArray,
      width: config.width != null ? config.width : 1,
      labelPosition: config.labelPosition === "left" ? "left" : "right",
      marker: config.marker,
      meta: config.meta,
    };
  }

  /** A themed label block shared by line/point annotations (or undefined). */
  _label(item, color) {
    if (item.label == null && item.type !== "text") return undefined;
    return {
      text: item.label != null ? item.label : "",
      borderColor: color,
      style: {
        background: item.type === "text" ? "transparent" : color,
        color:
          item.textColor || (item.type === "text" ? color : "#fff"),
        fontSize: "11px",
      },
    };
  }

  /** Resolve the ApexCharts add method + options for a stored annotation. */
  _resolve(item) {
    const color = item.color || this._defaultColor();
    const label = this._label(item, color);

    if (item.type === "yLine" || item.type === "yBand") {
      const opts = {
        id: item.id,
        y: item.y,
        borderColor: color,
        strokeDashArray: item.strokeDashArray,
      };
      // Only set `label` when present — passing `undefined` makes ApexCharts
      // dereference a missing label object during render.
      if (label) opts.label = { ...label, position: item.labelPosition };
      if (item.type === "yBand") {
        opts.y2 = item.y2;
        opts.fillColor = item.fillColor || color;
        opts.opacity = item.opacity;
      } else {
        opts.borderWidth = item.width;
      }
      return { method: "addYaxisAnnotation", opts };
    }

    if (item.type === "xLine" || item.type === "xBand") {
      const opts = {
        id: item.id,
        x: item.x,
        borderColor: color,
        strokeDashArray: item.strokeDashArray,
      };
      if (label) opts.label = { ...label, orientation: "horizontal" };
      if (item.type === "xBand") {
        opts.x2 = item.x2;
        opts.fillColor = item.fillColor || color;
        opts.opacity = item.opacity;
      } else {
        opts.borderWidth = item.width;
      }
      return { method: "addXaxisAnnotation", opts };
    }

    // point | text
    const marker =
      item.type === "text"
        ? { size: 0 }
        : { size: 5, fillColor: color, strokeColor: "#fff", ...item.marker };
    const opts = { id: item.id, x: item.x, y: item.y, marker };
    if (label) opts.label = label;
    return { method: "addPointAnnotation", opts };
  }

  /** Draw one annotation via the resolved ApexCharts method. */
  _apply(item) {
    if (!this.ctx.chart) return;
    const { method, opts } = this._resolve(item);
    if (typeof this.ctx.chart[method] === "function") {
      this.ctx.chart[method](opts);
    }
  }

  /** Public-facing copy of an annotation. */
  _public(item) {
    if (!item) return null;
    return {
      id: item.id,
      type: item.type,
      x: item.x,
      x2: item.x2,
      y: item.y,
      y2: item.y2,
      label: item.label,
      color: item.color,
      fillColor: item.fillColor,
      opacity: item.opacity,
      textColor: item.textColor,
      strokeDashArray: item.strokeDashArray,
      width: item.width,
      labelPosition: item.labelPosition,
      marker: item.marker,
      meta: item.meta,
    };
  }

  /**
   * Add (or replace, if `id` already exists) a data-space annotation.
   * @param {AnnotationConfig} config
   * @returns {string|null} the annotation id, or null on invalid input.
   */
  add(config) {
    const item = this._normalize(config);
    if (!item) return null;
    if (this.items[item.id] && this.ctx.chart) {
      this.ctx.chart.removeAnnotation(item.id);
    }
    this.items[item.id] = item;
    this._apply(item);
    return item.id;
  }

  /**
   * Patch an existing annotation (merges into its config).
   * @param {string} id
   * @param {Partial<AnnotationConfig>} [patch]
   * @returns {boolean} false if no such annotation.
   */
  update(id, patch = {}) {
    id = String(id);
    const existing = this.items[id];
    if (!existing) {
      Utils.warn(`updateAnnotation: no annotation with id "${id}".`);
      return false;
    }
    const item = this._normalize({ ...this._public(existing), ...patch, id });
    if (!item) return false;
    this.items[id] = item;
    if (this.ctx.chart) {
      this.ctx.chart.removeAnnotation(id);
      this._apply(item);
    }
    return true;
  }

  /**
   * Remove an annotation.
   * @param {string} id
   * @returns {boolean} false if no such annotation.
   */
  remove(id) {
    id = String(id);
    if (!this.items[id]) return false;
    delete this.items[id];
    if (this.ctx.chart) this.ctx.chart.removeAnnotation(id);
    return true;
  }

  /** Remove every annotation this manager owns (leaves others intact). */
  clear() {
    for (const id of Object.keys(this.items)) {
      if (this.ctx.chart) this.ctx.chart.removeAnnotation(id);
    }
    this.items = {};
  }

  /**
   * @param {string} id
   * @returns {object|null} a copy of the annotation config, or null.
   */
  get(id) {
    return this._public(this.items[String(id)]) || null;
  }

  /** @returns {object[]} copies of all annotation configs. */
  getAll() {
    return Object.values(this.items).map((a) => this._public(a));
  }

  /**
   * Re-apply every annotation (removes then re-adds by id). Idempotent, and
   * re-reads theme colors so a theme switch recolors defaults. Called after any
   * chart re-render that may drop or stale dynamic annotations.
   */
  reapply() {
    if (!this.ctx.chart) return;
    for (const id of Object.keys(this.items)) {
      this.ctx.chart.removeAnnotation(id);
      this._apply(this.items[id]);
    }
  }

  /** Remove all annotations and drop state. */
  destroy() {
    if (this.ctx.chart) {
      for (const id of Object.keys(this.items)) {
        this.ctx.chart.removeAnnotation(id);
      }
    }
    this.items = {};
  }
}
