import Utils from "../utils/Utils";

/**
 * Trading overlays: horizontal price lines (order lines, stop-loss, take-profit,
 * and alerts) drawn on the main chart as y-axis annotations. Each line is a
 * declarative config the consumer owns; this manager keeps the source-of-truth
 * map and mirrors it into ApexCharts annotations, re-applying them when the chart
 * re-renders (update / theme change / chart-type switch) so they persist.
 *
 * Lines are price-only (horizontal), so they are unaffected by appendData and the
 * x-axis. Colors default from the theme's `colors.tradingOverlays` group and are
 * re-read on every re-apply, so a theme switch recolors them.
 *
 * @typedef {Object} PriceLineConfig
 * @property {number} price - The y value the line sits at (required).
 * @property {string} [id] - Stable id; auto-generated ("tl-N") when omitted.
 * @property {"order"|"stop-loss"|"take-profit"|"alert"} [type="order"]
 * @property {"buy"|"sell"} [side] - For order lines; drives the default color.
 * @property {string} [label] - Defaults to a type/side/price summary.
 * @property {string} [color] - Border + label color; defaults from the theme.
 * @property {string} [textColor] - Label text color; defaults to white.
 * @property {number} [strokeDashArray] - Dash length; default varies by type.
 * @property {number} [width=1] - Line width.
 * @property {"left"|"right"} [labelPosition="right"]
 * @property {*} [meta] - Arbitrary consumer payload, returned by get()/getAll().
 */

/** Per-type defaults: dash pattern + the theme color key to fall back to. */
const TYPE_DEFAULTS = {
  order: { dash: 0, colorKey: "order" },
  "stop-loss": { dash: 4, colorKey: "stopLoss" },
  "take-profit": { dash: 4, colorKey: "takeProfit" },
  alert: { dash: 6, colorKey: "alert" },
};

export default class TradingOverlays {
  /** @param {import("../ApexStock.js").default} ctx */
  constructor(ctx) {
    this.ctx = ctx;
    /** @type {Object.<string, object>} id -> normalized line */
    this.lines = {};
    this._counter = 0;
  }

  /** The theme's trading-overlay color group (re-read so theme switches apply). */
  _palette() {
    return (this.ctx.colors && this.ctx.colors.tradingOverlays) || {};
  }

  /** Resolve a line's border color from its explicit color, side, then type. */
  _color(line) {
    if (line.color) return line.color;
    const p = this._palette();
    if (line.type === "order" && line.side === "buy") return p.buy;
    if (line.type === "order" && line.side === "sell") return p.sell;
    const td = TYPE_DEFAULTS[line.type] || TYPE_DEFAULTS.order;
    return p[td.colorKey] || p.order || "#0099FF";
  }

  /** Default label text for a line (used until the consumer sets a custom one). */
  _defaultLabel(line) {
    const price = Utils.truncateNumber(line.price);
    switch (line.type) {
      case "stop-loss":
        return `SL ${price}`;
      case "take-profit":
        return `TP ${price}`;
      case "alert":
        return `Alert ${price}`;
      default:
        return line.side
          ? `${line.side === "buy" ? "Buy" : "Sell"} ${price}`
          : `${price}`;
    }
  }

  /** Build the ApexCharts y-axis annotation for a stored line. */
  _toAnnotation(line) {
    const color = this._color(line);
    const onClick = line._onClick;
    return {
      id: line.id,
      y: line.price,
      strokeDashArray: line.strokeDashArray,
      borderColor: color,
      borderWidth: line.width,
      label: {
        text: line.label,
        position: line.labelPosition,
        textAnchor: line.labelPosition === "left" ? "start" : "end",
        borderColor: color,
        click: onClick,
        style: {
          background: color,
          color: line.textColor || this._palette().labelText || "#fff",
          fontSize: "10px",
        },
      },
    };
  }

  /** Validate + normalize a user config into a stored line, or null if invalid. */
  _normalize(config) {
    if (!config || typeof config !== "object") {
      Utils.warn("addPriceLine: a config object is required.");
      return null;
    }
    const price = Number(config.price);
    if (!Number.isFinite(price)) {
      Utils.warn("addPriceLine: a finite `price` is required.");
      return null;
    }
    const type = TYPE_DEFAULTS[config.type] ? config.type : "order";
    const td = TYPE_DEFAULTS[type];
    const id = config.id != null ? String(config.id) : `tl-${++this._counter}`;
    const line = {
      id,
      type,
      price,
      side:
        config.side === "buy" || config.side === "sell"
          ? config.side
          : undefined,
      color: config.color,
      textColor: config.textColor,
      strokeDashArray:
        config.strokeDashArray != null ? config.strokeDashArray : td.dash,
      width: config.width != null ? config.width : 1,
      labelPosition: config.labelPosition === "left" ? "left" : "right",
      meta: config.meta,
      _onClick: typeof config.onClick === "function" ? config.onClick : undefined,
    };
    if (config.label != null) {
      line.label = String(config.label);
      line._autoLabel = false;
    } else {
      line.label = this._defaultLabel(line);
      line._autoLabel = true;
    }
    return line;
  }

  /** Public-facing copy of a line (drops private fields). */
  _public(line) {
    if (!line) return null;
    const { id, type, price, side, color, textColor, strokeDashArray, width, labelPosition, label, meta } =
      line;
    return {
      id,
      type,
      price,
      side,
      color,
      textColor,
      strokeDashArray,
      width,
      labelPosition,
      label,
      meta,
    };
  }

  /**
   * Add (or replace, if `id` already exists) a price line.
   * @param {PriceLineConfig} config
   * @returns {string|null} the line id, or null on invalid input.
   */
  add(config) {
    const line = this._normalize(config);
    if (!line) return null;
    if (this.lines[line.id] && this.ctx.chart) {
      this.ctx.chart.removeAnnotation(line.id);
    }
    this.lines[line.id] = line;
    if (
      this.ctx.chart &&
      typeof this.ctx.chart.addYaxisAnnotation === "function"
    ) {
      this.ctx.chart.addYaxisAnnotation(this._toAnnotation(line));
    }
    return line.id;
  }

  /**
   * Patch an existing line (e.g. reprice). Auto-generated labels track the new
   * price/type/side; a custom label is preserved unless `patch.label` is given.
   * @param {string} id
   * @param {Partial<PriceLineConfig>} [patch]
   * @returns {boolean} false if no such line.
   */
  update(id, patch = {}) {
    id = String(id);
    const existing = this.lines[id];
    if (!existing) {
      Utils.warn(`updatePriceLine: no line with id "${id}".`);
      return false;
    }
    const merged = { ...existing, ...patch, id };
    // Preserve auto-label behavior: if the caller did not set a label and the
    // existing one was auto-generated, drop it so it regenerates from new fields.
    if ((patch == null || patch.label == null) && existing._autoLabel) {
      merged.label = undefined;
    }
    // Carry the existing click handler unless the patch overrides it.
    if (!patch || patch.onClick === undefined) merged.onClick = existing._onClick;
    const line = this._normalize(merged);
    if (!line) return false;
    this.lines[id] = line;
    if (this.ctx.chart) {
      this.ctx.chart.removeAnnotation(id);
      this.ctx.chart.addYaxisAnnotation(this._toAnnotation(line));
    }
    return true;
  }

  /**
   * Remove a line.
   * @param {string} id
   * @returns {boolean} false if no such line.
   */
  remove(id) {
    id = String(id);
    if (!this.lines[id]) return false;
    delete this.lines[id];
    if (this.ctx.chart) this.ctx.chart.removeAnnotation(id);
    return true;
  }

  /** Remove every line. */
  clear() {
    for (const id of Object.keys(this.lines)) {
      if (this.ctx.chart) this.ctx.chart.removeAnnotation(id);
    }
    this.lines = {};
  }

  /**
   * @param {string} id
   * @returns {object|null} a copy of the line config, or null.
   */
  get(id) {
    return this._public(this.lines[String(id)]) || null;
  }

  /** @returns {object[]} copies of all line configs. */
  getAll() {
    return Object.values(this.lines).map((l) => this._public(l));
  }

  /**
   * Re-apply every line's annotation. Idempotent (removes then re-adds by id),
   * and re-reads theme colors so a theme switch recolors the lines. Called after
   * any chart re-render that may drop or stale dynamic annotations.
   */
  reapply() {
    if (!this.ctx.chart) return;
    for (const id of Object.keys(this.lines)) {
      this.ctx.chart.removeAnnotation(id);
      this.ctx.chart.addYaxisAnnotation(this._toAnnotation(this.lines[id]));
    }
  }

  /** Remove all annotations and drop state. */
  destroy() {
    if (this.ctx.chart) {
      for (const id of Object.keys(this.lines)) {
        this.ctx.chart.removeAnnotation(id);
      }
    }
    this.lines = {};
  }
}
