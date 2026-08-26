import Utils from "../utils/Utils";

/**
 * Event markers / timeline: time-anchored flags for earnings, dividends, splits,
 * news, and custom events, floating along the x-axis with a hover card. Distinct
 * from data-space annotations (which mark price/time via native ApexCharts
 * annotations) and from freehand drawings.
 *
 * This is the "approach B" renderer: a lightweight HTML overlay layer appended to
 * the chart element, with one absolutely-positioned badge per marker positioned
 * from the chart's own axis globals (the same reprojection ChartSync uses for its
 * crosshair guide). Markers reproject on zoom/pan (via the `rangeChange` event)
 * and on resize, and are rebuilt on every re-render (update / theme / chart-type
 * switch) so they persist. Because the badge is real DOM, it can carry a rich
 * hover card and fire hover/click events.
 *
 * The `rangeChange` subscription and the resize listener are bound lazily (only
 * while at least one marker exists) so a chart that never uses markers keeps the
 * event bus's "no listeners" fast path.
 *
 * @typedef {Object} EventMarkerConfig
 * @property {number|string|Date} x - Anchor time (timestamp/date/category).
 * @property {"earnings"|"dividend"|"split"|"news"|"custom"} [type="custom"] - Marker kind (sets the default glyph + color).
 * @property {string} [id] - Stable id; auto-generated ("evt-N") when omitted.
 * @property {string} [label] - Hover-card title; falls back to the type name.
 * @property {string} [color] - Badge color; defaults from the type.
 * @property {string} [glyph] - Badge text (1 to 3 chars); defaults from the type.
 * @property {"top"|"bottom"} [position="bottom"] - Which edge the badge sits on.
 * @property {*} [meta] - Arbitrary consumer payload, returned by get()/getAll().
 */

/** Per-type defaults: badge glyph + color. */
const MARKER_TYPES = {
  earnings: { glyph: "E", color: "#f59e0b" },
  dividend: { glyph: "D", color: "#10b981" },
  split: { glyph: "S", color: "#3b82f6" },
  news: { glyph: "N", color: "#8b5cf6" },
  custom: { glyph: "•", color: "#64748b" },
};

export default class EventMarkers {
  /** @param {import("../ApexStock.js").default} ctx */
  constructor(ctx) {
    this.ctx = ctx;
    /** @type {Object.<string, object>} id -> normalized marker */
    this.items = {};
    this._counter = 0;

    // DOM: the overlay layer, one badge element per marker, one shared card.
    this._layerEl = null;
    this._card = null;
    /** @type {Map<string, HTMLElement>} id -> badge element */
    this._els = new Map();

    // Lazy reprojection wiring (bound only while markers exist).
    this._active = false;
    this._unsubRange = null;
    this._boundPosition = () => this._position();
  }

  /* ------------------------------------------------------------------ *
   * Normalization
   * ------------------------------------------------------------------ */

  /** Coerce an x value to axis space (epoch ms for date-like input). */
  _coerceX(x) {
    if (x == null) return null;
    if (typeof x === "number") return Number.isFinite(x) ? x : null;
    const t = new Date(x).getTime();
    return Number.isNaN(t) ? x : t; // pass through non-dates (category axes)
  }

  /** Validate + normalize a user config into a stored item, or null if invalid. */
  _normalize(config) {
    if (!config || typeof config !== "object") {
      Utils.warn("addEventMarker: a config object with an `x` is required.");
      return null;
    }
    const x = this._coerceX(config.x);
    if (x == null) {
      Utils.warn("addEventMarker: a valid `x` (time) is required.");
      return null;
    }
    const type = MARKER_TYPES[config.type] ? config.type : "custom";
    const defaults = MARKER_TYPES[type];
    const id = config.id != null ? String(config.id) : `evt-${++this._counter}`;
    return {
      id,
      type,
      x,
      label: config.label != null ? String(config.label) : undefined,
      color: config.color || defaults.color,
      glyph:
        config.glyph != null ? String(config.glyph).slice(0, 3) : defaults.glyph,
      position: config.position === "top" ? "top" : "bottom",
      meta: config.meta,
    };
  }

  /** Public-facing copy of a marker. */
  _public(item) {
    if (!item) return null;
    return {
      id: item.id,
      type: item.type,
      x: item.x,
      label: item.label,
      color: item.color,
      glyph: item.glyph,
      position: item.position,
      meta: item.meta,
    };
  }

  _emit(name, payload) {
    if (this.ctx._emitter && typeof this.ctx._emitter.emit === "function") {
      this.ctx._emitter.emit(name, payload);
    }
  }

  /* ------------------------------------------------------------------ *
   * Reprojection wiring (lazy)
   * ------------------------------------------------------------------ */

  /** Begin listening for zoom/pan/resize so markers track the axis. */
  _activate() {
    if (this._active) return;
    this._active = true;
    if (typeof this.ctx.on === "function") {
      this._unsubRange = this.ctx.on("rangeChange", this._boundPosition);
    }
    if (typeof window !== "undefined" && window.addEventListener) {
      window.addEventListener("resize", this._boundPosition);
    }
  }

  /** Stop listening (called when the last marker is removed). */
  _deactivate() {
    if (!this._active) return;
    this._active = false;
    if (this._unsubRange) {
      try {
        this._unsubRange();
      } catch {
        /* already gone */
      }
      this._unsubRange = null;
    }
    if (typeof window !== "undefined" && window.removeEventListener) {
      window.removeEventListener("resize", this._boundPosition);
    }
  }

  /* ------------------------------------------------------------------ *
   * DOM
   * ------------------------------------------------------------------ */

  /** The overlay layer, created lazily over the chart element. */
  _ensureLayer() {
    if (this._layerEl) return this._layerEl;
    const host = this.ctx.chartEl;
    if (!host || typeof document === "undefined") return null;
    if (
      typeof getComputedStyle === "function" &&
      getComputedStyle(host).position === "static"
    ) {
      host.style.position = "relative";
    }
    const layer = document.createElement("div");
    layer.className = "apexstock-event-markers";
    layer.style.cssText =
      "position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:6;";
    host.appendChild(layer);
    this._layerEl = layer;
    return layer;
  }

  /** The shared hover card, created lazily. */
  _ensureCard() {
    if (this._card) return this._card;
    const host = this.ctx.chartEl;
    if (!host || typeof document === "undefined") return null;
    const card = document.createElement("div");
    card.className = "apexstock-event-marker-card";
    card.style.cssText =
      "position:absolute;z-index:7;pointer-events:none;display:none;" +
      "background:rgba(30,41,59,0.96);color:#fff;padding:6px 9px;" +
      "border-radius:6px;box-shadow:0 2px 8px rgba(0,0,0,0.25);" +
      "font:400 11px/1.35 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;" +
      "max-width:220px;white-space:nowrap;transform:translate(-50%,-100%);";
    const title = document.createElement("div");
    title.className = "apexstock-event-marker-card-title";
    title.style.cssText = "font-weight:600;";
    const date = document.createElement("div");
    date.className = "apexstock-event-marker-card-date";
    date.style.cssText = "opacity:0.7;font-size:10px;margin-top:1px;";
    card.appendChild(title);
    card.appendChild(date);
    host.appendChild(card);
    this._card = card;
    this._cardTitle = title;
    this._cardDate = date;
    return card;
  }

  /** Format an x value for the hover card (ISO date for epoch-ms, else raw). */
  _formatX(x) {
    if (typeof x === "number" && Number.isFinite(x)) {
      const d = new Date(x);
      if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
    return String(x);
  }

  /** Chart axis globals for positioning, or null if not yet rendered. */
  _globals() {
    const g = this.ctx.chart && this.ctx.chart.w && this.ctx.chart.w.globals;
    if (!g) return null;
    const minX = g.minX;
    const maxX = g.maxX;
    if (!(maxX > minX) || !g.gridWidth) return null;
    return {
      minX,
      maxX,
      left: g.translateX || 0,
      top: g.translateY || 0,
      w: g.gridWidth,
      h: g.gridHeight,
    };
  }

  /** Create (or replace) the badge element for one marker. */
  _renderOne(item) {
    const layer = this._ensureLayer();
    if (!layer) return;
    this._removeEl(item.id);

    const el = document.createElement("div");
    el.className = "apexstock-event-marker";
    el.setAttribute("data-marker-id", item.id);
    el.style.cssText = "position:absolute;pointer-events:auto;display:none;";

    const badge = document.createElement("span");
    badge.className = "apexstock-event-marker-badge";
    badge.style.cssText =
      "display:inline-flex;align-items:center;justify-content:center;" +
      "min-width:16px;height:16px;padding:0 3px;border-radius:3px;box-sizing:border-box;" +
      "font:600 10px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;" +
      "color:#fff;cursor:pointer;box-shadow:0 1px 2px rgba(0,0,0,0.25);" +
      "background:" +
      item.color +
      ";";
    badge.textContent = item.glyph;
    el.appendChild(badge);

    el.addEventListener("mouseenter", (e) => {
      this._showCard(item, el);
      this._emit("eventMarkerHover", {
        id: item.id,
        marker: this._public(item),
        nativeEvent: e,
      });
    });
    el.addEventListener("mouseleave", () => this._hideCard());
    el.addEventListener("click", (e) => {
      this._emit("eventMarkerClick", {
        id: item.id,
        marker: this._public(item),
        nativeEvent: e,
      });
    });

    layer.appendChild(el);
    this._els.set(item.id, el);
    this._positionOne(item, el);
  }

  /** Position one badge from the current axis globals (hides it off-grid). */
  _positionOne(item, el) {
    const g = this._globals();
    if (!g) {
      el.style.display = "none";
      return;
    }
    const px = g.left + ((item.x - g.minX) / (g.maxX - g.minX)) * g.w;
    if (px < g.left - 0.5 || px > g.left + g.w + 0.5) {
      el.style.display = "none";
      return;
    }
    const bottom = item.position !== "top";
    const y = bottom ? g.top + g.h : g.top;
    el.style.left = px + "px";
    el.style.top = y + "px";
    // Sit just off the axis line: badge above it at the bottom, below it at the top.
    el.style.transform = bottom
      ? "translate(-50%,calc(-100% - 4px))"
      : "translate(-50%,4px)";
    el.style.display = "block";
  }

  /** Reposition every badge (zoom/pan/resize). */
  _position() {
    this._els.forEach((el, id) => {
      const item = this.items[id];
      if (item) this._positionOne(item, el);
    });
    // A visible card would now point at a stale spot.
    this._hideCard();
  }

  _showCard(item, el) {
    const card = this._ensureCard();
    if (!card) return;
    this._cardTitle.textContent =
      item.label != null
        ? item.label
        : item.type.charAt(0).toUpperCase() + item.type.slice(1);
    this._cardDate.textContent = this._formatX(item.x);
    // Anchor the card just above the badge (badge itself is above the axis).
    const left = parseFloat(el.style.left) || 0;
    const top = parseFloat(el.style.top) || 0;
    const above = item.position !== "top";
    card.style.left = left + "px";
    card.style.top = (above ? top - 22 : top + 22) + "px";
    card.style.transform = above
      ? "translate(-50%,-100%)"
      : "translate(-50%,0)";
    card.style.display = "block";
  }

  _hideCard() {
    if (this._card) this._card.style.display = "none";
  }

  /** Remove a single badge element by id. */
  _removeEl(id) {
    const el = this._els.get(id);
    if (el && el.parentNode) el.parentNode.removeChild(el);
    this._els.delete(id);
  }

  /* ------------------------------------------------------------------ *
   * Public API (proxied by ApexStock)
   * ------------------------------------------------------------------ */

  /**
   * Add (or replace, if `id` already exists) an event marker.
   * @param {EventMarkerConfig} config
   * @returns {string|null} the marker id, or null on invalid input.
   */
  add(config) {
    const item = this._normalize(config);
    if (!item) return null;
    this.items[item.id] = item;
    this._activate();
    this._renderOne(item);
    this._emit("eventMarkerAdded", { id: item.id, marker: this._public(item) });
    return item.id;
  }

  /**
   * Patch an existing marker (merges into its config).
   * @param {string} id
   * @param {Partial<EventMarkerConfig>} [patch]
   * @returns {boolean} false if no such marker.
   */
  update(id, patch = {}) {
    id = String(id);
    const existing = this.items[id];
    if (!existing) {
      Utils.warn(`updateEventMarker: no marker with id "${id}".`);
      return false;
    }
    const item = this._normalize({ ...this._public(existing), ...patch, id });
    if (!item) return false;
    this.items[id] = item;
    this._renderOne(item);
    this._emit("eventMarkerUpdated", { id, marker: this._public(item) });
    return true;
  }

  /**
   * Remove a marker by id.
   * @param {string} id
   * @returns {boolean} false if no such marker.
   */
  remove(id) {
    id = String(id);
    if (!this.items[id]) return false;
    delete this.items[id];
    this._removeEl(id);
    if (Object.keys(this.items).length === 0) this._deactivate();
    this._emit("eventMarkerRemoved", { id });
    return true;
  }

  /** Remove every marker. */
  clear() {
    this._els.forEach((el) => {
      if (el.parentNode) el.parentNode.removeChild(el);
    });
    this._els.clear();
    this.items = {};
    this._hideCard();
    this._deactivate();
    this._emit("eventMarkersCleared", {});
  }

  /**
   * @param {string} id
   * @returns {object|null} a copy of the marker config, or null.
   */
  get(id) {
    return this._public(this.items[String(id)]) || null;
  }

  /** @returns {object[]} copies of all marker configs. */
  getAll() {
    return Object.values(this.items).map((m) => this._public(m));
  }

  /* ------------------------------------------------------------------ *
   * Lifecycle
   * ------------------------------------------------------------------ */

  /**
   * Rebuild every badge from the stored items and reposition. Called after any
   * chart re-render (update / theme / chart-type switch) and once from
   * {@link ApexStock#render} to draw markers added before the chart existed.
   */
  reapply() {
    const ids = Object.keys(this.items);
    if (ids.length === 0) return;
    this._activate();
    // Rebuild all elements (the previous layer may have been discarded).
    this._els.forEach((el) => {
      if (el.parentNode) el.parentNode.removeChild(el);
    });
    this._els.clear();
    ids.forEach((id) => this._renderOne(this.items[id]));
  }

  /**
   * Lossless plain-JSON snapshot of every marker, for state serialization.
   * @returns {object[]}
   */
  _serialize() {
    return this.getAll()
      .map((m) => {
        try {
          return JSON.parse(JSON.stringify(m));
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  }

  /**
   * Replace all markers with a serialized list (from {@link _serialize}).
   * @param {object[]} list
   */
  _restore(list) {
    this.clear();
    if (Array.isArray(list)) {
      list.forEach((m) => {
        if (m && m.x != null) this.add(m);
      });
    }
  }

  /** Remove all markers and drop state. */
  destroy() {
    this.clear();
    if (this._card && this._card.parentNode) {
      this._card.parentNode.removeChild(this._card);
    }
    this._card = null;
    if (this._layerEl && this._layerEl.parentNode) {
      this._layerEl.parentNode.removeChild(this._layerEl);
    }
    this._layerEl = null;
  }
}
