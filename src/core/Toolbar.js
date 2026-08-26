import Utils from "../utils/Utils";

/**
 * Toolbar — customization of the primary toolbar: show/hide the whole bar or
 * individual built-in sections, and inject custom buttons/controls.
 *
 * The built-in controls (chart-type switcher, indicator dropdown, drawing
 * toolbar, download button) each append themselves to `primaryToolbarLeft` /
 * `primaryToolbarRight` during render. Rather than thread config through every
 * one of them, this manager runs *after* the toolbar is populated and (a)
 * toggles `display` on the known section wrappers per `toolbar.items`, and (b)
 * renders the consumer's custom items into either side. That keeps the built-in
 * controls untouched and the customization non-invasive.
 *
 * Config (all optional) under `options.toolbar`:
 *   {
 *     show: true,                 // false hides the entire primary toolbar
 *     items: {                    // false hides a built-in section (default shown)
 *       chartType, indicators, drawing, download
 *     },
 *     custom: [ ToolbarItem, ... ]
 *   }
 *
 * @typedef {Object} ToolbarItem
 * @property {string} id - Unique id (also used to remove the item).
 * @property {string} [title] - Tooltip + aria-label (and the label if no icon/html).
 * @property {string} [icon] - Inline SVG/HTML for the button contents.
 * @property {string} [html] - Raw HTML contents (alternative to `icon`).
 * @property {HTMLElement} [element] - A ready-made element to inject as-is.
 * @property {"left"|"left-start"|"right"} [position="right"] - Which side (and
 *   `left-start` to prepend on the left).
 * @property {number} [order=0] - Sort order within its side (lower first).
 * @property {string} [className] - Extra class(es) on the button.
 * @property {(chart:import("../ApexStock.js").default, event:Event)=>void} [onClick]
 */

// Built-in section wrappers, by config key.
const SECTIONS = {
  chartType: ".apexstock-chart-type-wrapper",
  indicators: ".apexstock-custom-select-wrapper",
  drawing: ".apexstock-drawing-toolbar",
  download: ".apexstock-export-btn-container",
};

export default class Toolbar {
  /** @param {import("../ApexStock.js").default} ctx */
  constructor(ctx) {
    this.ctx = ctx;
    /** @type {ToolbarItem[]} buffered custom item defs (config + runtime adds). */
    this._defs = [];
    /** @type {Object.<string, HTMLElement>} rendered custom elements by id. */
    this._els = {};

    const cfg = ctx && ctx.chartOptions && ctx.chartOptions.toolbar;
    if (cfg && Array.isArray(cfg.custom)) {
      cfg.custom.forEach((d) => this._upsert(d));
    }
  }

  _config() {
    return (this.ctx.chartOptions && this.ctx.chartOptions.toolbar) || {};
  }

  /** Insert or replace a def by id (no render). @returns {string|null} */
  _upsert(def) {
    if (!def || def.id == null) {
      Utils.warn("Toolbar item requires an `id`.");
      return null;
    }
    const id = String(def.id);
    this._defs = this._defs.filter((d) => String(d.id) !== id);
    this._defs.push({ ...def, id });
    return id;
  }

  /**
   * Add (or replace) a custom toolbar item and render it.
   * @param {ToolbarItem} def
   * @returns {string|null} the item id, or null on invalid input.
   */
  addItem(def) {
    const id = this._upsert(def);
    if (id != null) this.reapply();
    return id;
  }

  /**
   * Remove a custom toolbar item.
   * @param {string} id
   * @returns {boolean} false if no such item.
   */
  removeItem(id) {
    id = String(id);
    const had = this._defs.some((d) => String(d.id) === id);
    this._defs = this._defs.filter((d) => String(d.id) !== id);
    const el = this._els[id];
    if (el && el.parentNode) el.parentNode.removeChild(el);
    delete this._els[id];
    return had;
  }

  /** @returns {Array<{id:string, title:string|undefined, position:string}>} */
  getItems() {
    return this._defs.map((d) => ({
      id: d.id,
      title: d.title,
      position: d.position || "right",
    }));
  }

  /**
   * Apply the toolbar config to the live DOM: whole-bar visibility, built-in
   * section visibility, and the custom items. Idempotent; safe to call again
   * whenever items change. No-op before the toolbar exists.
   * @returns {void}
   */
  reapply() {
    const bar = this.ctx.primaryToolbar;
    if (!bar) return;
    const cfg = this._config();

    if (cfg.show === false) {
      bar.style.display = "none";
      return;
    }
    bar.style.display = "";

    const items = cfg.items || {};
    Object.keys(SECTIONS).forEach((key) => {
      const el = bar.querySelector(SECTIONS[key]);
      if (el) el.style.display = items[key] === false ? "none" : "";
    });

    this._renderCustom();
  }

  _renderCustom() {
    // Clear previously-rendered custom elements, then rebuild in order.
    Object.keys(this._els).forEach((id) => {
      const el = this._els[id];
      if (el && el.parentNode) el.parentNode.removeChild(el);
    });
    this._els = {};

    const left = this.ctx.primaryToolbarLeft;
    const right = this.ctx.primaryToolbarRight;

    // Stable sort by `order`, then original insertion order.
    const ordered = this._defs
      .map((d, i) => ({ d, i }))
      .sort((a, b) => (a.d.order || 0) - (b.d.order || 0) || a.i - b.i)
      .map((x) => x.d);

    ordered.forEach((def) => {
      const el = this._build(def);
      if (!el) return;
      this._els[String(def.id)] = el;
      const pos = def.position || "right";
      if (pos === "left-start" && left) {
        left.insertBefore(el, left.firstChild);
      } else if (pos === "left" && left) {
        left.appendChild(el);
      } else if (right) {
        right.appendChild(el);
      }
    });
  }

  _build(def) {
    // A ready-made element is injected as-is.
    if (def.element && def.element.nodeType === 1) {
      def.element.classList.add("apexstock-toolbar-custom-item");
      def.element.dataset.toolbarItem = String(def.id);
      return def.element;
    }

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "apexstock-toolbar-custom-item apexstock-toolbar-button" +
      (def.className ? " " + def.className : "");
    btn.dataset.toolbarItem = String(def.id);
    if (def.title) {
      btn.title = def.title;
      btn.setAttribute("aria-label", def.title);
    }
    // Contents: icon/html (trusted, consumer-provided) or a text label.
    if (def.icon) btn.innerHTML = def.icon;
    else if (def.html) btn.innerHTML = def.html;
    else if (def.title) btn.textContent = def.title;

    if (typeof def.onClick === "function") {
      btn.addEventListener("click", (e) => def.onClick(this.ctx, e));
    }
    return btn;
  }

  /** Remove all custom elements (built-in controls are torn down by the chart). */
  destroy() {
    Object.keys(this._els).forEach((id) => {
      const el = this._els[id];
      if (el && el.parentNode) el.parentNode.removeChild(el);
    });
    this._els = {};
  }
}
