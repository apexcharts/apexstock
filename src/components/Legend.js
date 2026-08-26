import Utils from "../utils/Utils";

/**
 * On-chart data legend (a.k.a. data window): a small panel pinned in a corner of
 * the price chart that reads out the instrument's OHLC, volume, and change at the
 * crosshair, plus the value of each main-chart overlay indicator. It tracks the
 * pointer via the public `crosshairMove` event and falls back to the latest bar
 * when the pointer is not over the plot.
 *
 * Opt-in: enabled via `options.legend = { show: true, ... }` at construction, or
 * imperatively with {@link ApexStock#showLegend} / `hideLegend` / `toggleLegend`.
 * The panel is `pointer-events:none`, so it never intercepts chart interaction,
 * and it subscribes to the event bus only while visible (so a chart that never
 * shows the legend keeps the bus's no-listener fast path).
 *
 * @typedef {Object} LegendOptions
 * @property {boolean} [show=false] - Show the legend.
 * @property {"top-left"|"top-right"|"bottom-left"|"bottom-right"} [position="top-left"]
 * @property {boolean} [showVolume=true] - Include a volume row.
 * @property {boolean} [showChange=true] - Include the change vs the previous close.
 * @property {boolean} [showIndicators=true] - Include main-chart overlay indicator values.
 */

const POSITIONS = new Set(["top-left", "top-right", "bottom-left", "bottom-right"]);

export default class Legend {
  /** @param {import("../ApexStock.js").default} ctx */
  constructor(ctx) {
    this.ctx = ctx;
    const cfg = (ctx.chartOptions && ctx.chartOptions.legend) || {};
    this.opts = {
      show: !!cfg.show,
      position: POSITIONS.has(cfg.position) ? cfg.position : "top-left",
      showVolume: cfg.showVolume !== false,
      showChange: cfg.showChange !== false,
      showIndicators: cfg.showIndicators !== false,
    };
    this._el = null;
    this._unsubs = [];
    this._visible = false;
  }

  /* ------------------------------------------------------------------ *
   * Theme + formatting
   * ------------------------------------------------------------------ */

  _dark() {
    return !!this.ctx.isDarkTheme;
  }

  _upColor() {
    return this._dark() ? "#26A69A" : "#00B746";
  }

  _downColor() {
    return this._dark() ? "#EF5350" : "#EF403C";
  }

  /** Compact volume format (1.2M, 3.4K). */
  _fmtVol(v) {
    if (v == null || !Number.isFinite(Number(v))) return "";
    const n = Number(v);
    const abs = Math.abs(n);
    if (abs >= 1e9) return (n / 1e9).toFixed(2) + "B";
    if (abs >= 1e6) return (n / 1e6).toFixed(2) + "M";
    if (abs >= 1e3) return (n / 1e3).toFixed(2) + "K";
    return String(n);
  }

  _fmt(v) {
    return v == null || !Number.isFinite(Number(v))
      ? "-"
      : String(Utils.truncateNumber(Number(v)));
  }

  /* ------------------------------------------------------------------ *
   * DOM
   * ------------------------------------------------------------------ */

  _ensureEl() {
    if (this._el) return this._el;
    const host = this.ctx.chartEl;
    if (!host || typeof document === "undefined") return null;
    if (
      typeof getComputedStyle === "function" &&
      getComputedStyle(host).position === "static"
    ) {
      host.style.position = "relative";
    }

    const dark = this._dark();
    const el = document.createElement("div");
    el.className = "apexstock-legend apexstock-legend-" + this.opts.position;
    const pos = this.opts.position;
    const vy = pos.startsWith("top") ? "top:8px;" : "bottom:8px;";
    const vx = pos.endsWith("left") ? "left:10px;" : "right:10px;";
    el.style.cssText =
      "position:absolute;" +
      vy +
      vx +
      "z-index:7;pointer-events:none;" +
      "padding:6px 9px;border-radius:6px;" +
      "font:400 11px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;" +
      "background:" +
      (dark ? "rgba(28,32,42,0.86)" : "rgba(255,255,255,0.88)") +
      ";color:" +
      (dark ? "#e5e7eb" : "#1f2937") +
      ";border:1px solid " +
      (dark ? "rgba(255,255,255,0.10)" : "rgba(16,24,40,0.10)") +
      ";box-shadow:0 1px 4px rgba(16,24,40,0.12);max-width:280px;";

    const title = document.createElement("div");
    title.className = "apexstock-legend-title";
    title.style.cssText = "font-weight:600;margin-bottom:2px;";

    const ohlc = document.createElement("div");
    ohlc.className = "apexstock-legend-ohlc";
    ohlc.style.cssText = "display:flex;flex-wrap:wrap;gap:8px;align-items:baseline;";

    const muted = dark ? "#9aa4b2" : "#667085";
    const mk = (label) => {
      const span = document.createElement("span");
      const lab = document.createElement("span");
      lab.textContent = label;
      lab.style.cssText = "color:" + muted + ";margin-right:3px;";
      const val = document.createElement("b");
      val.style.fontWeight = "600";
      span.appendChild(lab);
      span.appendChild(val);
      ohlc.appendChild(span);
      return val;
    };
    this._o = mk("O");
    this._h = mk("H");
    this._l = mk("L");
    this._c = mk("C");

    const chg = document.createElement("span");
    chg.className = "apexstock-legend-change";
    chg.style.fontWeight = "600";
    ohlc.appendChild(chg);
    this._chg = chg;

    const vol = document.createElement("div");
    vol.className = "apexstock-legend-volume";
    vol.style.cssText = "color:" + muted + ";margin-top:2px;";
    this._vol = vol;

    const ind = document.createElement("div");
    ind.className = "apexstock-legend-indicators";
    ind.style.cssText = "margin-top:3px;display:flex;flex-direction:column;gap:1px;";
    this._ind = ind;

    el.appendChild(title);
    el.appendChild(ohlc);
    el.appendChild(vol);
    el.appendChild(ind);
    this._title = title;

    host.appendChild(el);
    this._el = el;
    return el;
  }

  /** Remove the panel and forget the child refs (rebuilt on next show). */
  _removeEl() {
    if (this._el && this._el.parentNode) this._el.parentNode.removeChild(this._el);
    this._el = null;
  }

  /* ------------------------------------------------------------------ *
   * Data
   * ------------------------------------------------------------------ */

  /** Main-chart overlay indicator values at `idx`, read defensively. */
  _indicatorRows(idx) {
    const rows = [];
    try {
      const g = this.ctx.chart && this.ctx.chart.w && this.ctx.chart.w.globals;
      if (!g || !Array.isArray(g.seriesNames) || !Array.isArray(g.series)) {
        return rows;
      }
      for (let i = 1; i < g.seriesNames.length; i++) {
        const arr = g.series[i];
        if (!Array.isArray(arr)) continue;
        const v = arr[idx];
        if (v == null || !Number.isFinite(Number(v))) continue;
        const color =
          (Array.isArray(g.colors) && g.colors[i]) ||
          (this._dark() ? "#93c5fd" : "#2563eb");
        rows.push({ name: String(g.seriesNames[i] || ""), value: Number(v), color });
      }
    } catch {
      /* internals shifted; the OHLC core still renders */
    }
    return rows;
  }

  /**
   * Render the panel for a crosshair payload (or, when null, the latest bar).
   * @param {object|null} payload - A `crosshairMove` event payload, or null.
   */
  _render(payload) {
    if (!this._visible) return;
    const el = this._ensureEl();
    if (!el) return;

    const s = Array.isArray(this.ctx.series) ? this.ctx.series : [];
    if (!s.length) {
      el.style.display = "none";
      return;
    }
    el.style.display = "";

    let idx =
      payload && Number.isInteger(payload.dataPointIndex) && payload.dataPointIndex >= 0
        ? payload.dataPointIndex
        : s.length - 1;
    if (idx < 0) idx = 0;
    if (idx >= s.length) idx = s.length - 1;

    const bar = s[idx];
    const y = bar && Array.isArray(bar.y) ? bar.y : [];
    const open = y[0];
    const close = y[3];

    const name =
      (this.ctx.chartOptions &&
        this.ctx.chartOptions.series &&
        this.ctx.chartOptions.series[0] &&
        this.ctx.chartOptions.series[0].name) ||
      "";
    this._title.textContent = name;
    this._title.style.display = name ? "" : "none";

    const dirColor =
      Number.isFinite(open) && Number.isFinite(close)
        ? close >= open
          ? this._upColor()
          : this._downColor()
        : "inherit";

    this._o.textContent = this._fmt(open);
    this._h.textContent = this._fmt(y[1]);
    this._l.textContent = this._fmt(y[2]);
    this._c.textContent = this._fmt(close);
    this._c.style.color = dirColor;

    // Change vs the previous bar's close.
    if (this.opts.showChange) {
      const prev = s[idx - 1];
      const prevClose = prev && Array.isArray(prev.y) ? prev.y[3] : undefined;
      if (Number.isFinite(close) && Number.isFinite(prevClose) && prevClose !== 0) {
        const d = close - prevClose;
        const pct = (d / prevClose) * 100;
        const sign = d >= 0 ? "+" : "";
        this._chg.textContent = `${sign}${Utils.truncateNumber(d)} (${sign}${pct.toFixed(2)}%)`;
        this._chg.style.color = d >= 0 ? this._upColor() : this._downColor();
        this._chg.style.display = "";
      } else {
        this._chg.style.display = "none";
      }
    } else {
      this._chg.style.display = "none";
    }

    // Volume.
    if (this.opts.showVolume && bar && bar.v != null) {
      this._vol.textContent = "Vol " + this._fmtVol(bar.v);
      this._vol.style.display = "";
    } else {
      this._vol.style.display = "none";
    }

    // Overlay indicator rows.
    this._ind.textContent = "";
    if (this.opts.showIndicators) {
      const rows = this._indicatorRows(idx);
      rows.forEach((r) => {
        const row = document.createElement("div");
        row.style.cssText = "display:flex;align-items:center;gap:5px;";
        const dot = document.createElement("span");
        dot.style.cssText =
          "width:7px;height:7px;border-radius:50%;flex:0 0 auto;background:" + r.color + ";";
        const label = document.createElement("span");
        label.textContent = r.name;
        const val = document.createElement("b");
        val.style.cssText = "font-weight:600;margin-left:auto;padding-left:8px;";
        val.textContent = this._fmt(r.value);
        row.appendChild(dot);
        row.appendChild(label);
        row.appendChild(val);
        this._ind.appendChild(row);
      });
    }
  }

  /* ------------------------------------------------------------------ *
   * Public API (proxied by ApexStock)
   * ------------------------------------------------------------------ */

  /**
   * Show the legend (optionally patching its options), subscribe to the
   * crosshair, and render the latest bar.
   * @param {LegendOptions} [opts]
   */
  show(opts) {
    if (opts && typeof opts === "object") {
      if (POSITIONS.has(opts.position)) this.opts.position = opts.position;
      if (opts.showVolume !== undefined) this.opts.showVolume = !!opts.showVolume;
      if (opts.showChange !== undefined) this.opts.showChange = !!opts.showChange;
      if (opts.showIndicators !== undefined)
        this.opts.showIndicators = !!opts.showIndicators;
      // A position change needs a fresh element (the corner is baked into style).
      this._removeEl();
    }
    this.opts.show = true;
    this._visible = true;
    if (!this._unsubs.length && typeof this.ctx.on === "function") {
      // Track the crosshair, and re-render when indicators toggle so their rows
      // stay in sync (an overlay added/removed after render is reflected).
      this._unsubs.push(this.ctx.on("crosshairMove", (e) => this._render(e)));
      this._unsubs.push(this.ctx.on("indicatorToggle", () => this._render(null)));
    }
    this._render(null);
  }

  /** Hide the legend and unsubscribe from the event bus. */
  hide() {
    this.opts.show = false;
    this._visible = false;
    this._unsubs.forEach((off) => {
      try {
        if (off) off();
      } catch {
        /* already gone */
      }
    });
    this._unsubs = [];
    if (this._el) this._el.style.display = "none";
  }

  /** Toggle visibility. @returns {boolean} the new visibility. */
  toggle() {
    if (this._visible) this.hide();
    else this.show();
    return this._visible;
  }

  /** @returns {boolean} whether the legend is currently shown. */
  isVisible() {
    return this._visible;
  }

  /**
   * Re-establish the legend after a (re-)render. Shows it if enabled by option
   * or a prior `show()`, and repaints from the latest bar. Called by
   * {@link ApexStock#render} and after `update()`/theme changes.
   */
  reapply() {
    if (!this.opts.show) return;
    // A theme switch changes the palette baked into the element's inline styles.
    this._removeEl();
    this.show();
  }

  /** Remove the panel, unsubscribe, and drop state. */
  destroy() {
    this.hide();
    this._removeEl();
  }
}
