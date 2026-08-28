import Utils from "../utils/Utils";

/**
 * AnalysisPanel: the readout surface for the analysis layer.
 *
 * Where the {@link Legend} answers "what is this bar", this panel answers "what
 * happened over this stretch". It renders a {@link
 * ../analysis/Measurement.js Measurement}'s statistics as a compact,
 * professional block: the dated range, the change, the true high and low, the
 * averages, the volatility, the annualized return, and the deepest drawdown
 * with its decline and recovery durations.
 *
 * It follows the {@link Legend} conventions exactly, because they are the ones
 * the rest of the library settled on: an absolutely positioned block inside
 * `chartEl`, `pointer-events:none` so it never intercepts chart interaction,
 * theme colors baked into inline styles and rebuilt on {@link reapply}, and a
 * stable class on every part so a consumer can restyle it. Each metric row also
 * carries `data-metric="<key>"`, which is what the e2e tests read.
 *
 * Visibility is **automatic by default**: the panel appears when a measurement
 * exists and disappears when the last one is cleared, so a chart nobody has
 * measured on carries no extra chrome. `analysis.panel: false` suppresses it
 * entirely (the headless mode, for apps that render their own side panel from
 * `getRangeStats()`), and `showAnalysisPanel()` / `hideAnalysisPanel()` force it
 * either way.
 *
 * Two numbers are shown deliberately, separately labelled: **Change** is the
 * instrument's close-to-close move over the spanned bars (the number every
 * other statistic here is consistent with), and **Selection** is the delta
 * between the two anchors the user actually dragged. See
 * {@link ../analysis/Measurement.js Measurement} for why both exist.
 *
 * @typedef {Object} AnalysisPanelOptions
 * @property {boolean} [show] - Force visibility. Omit for the automatic mode.
 * @property {"top-left"|"top-right"|"bottom-left"|"bottom-right"} [position="top-right"]
 *   Defaults to the opposite corner from the legend, so the two never collide.
 * @property {string[]} [metrics] - Which rows to render, in order. See
 *   {@link DEFAULT_METRICS}.
 * @property {{price?:Function, percent?:Function, volume?:Function, date?:Function}} [formatters]
 * @property {string} [title="Range"] - Panel heading; "" hides it.
 * @property {string} [placeholder="No selection"] - Shown by an explicitly
 *   visible panel before anything has been measured.
 */

const POSITIONS = new Set([
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
]);

/**
 * The default rows, in order. `change` and `selection` lead because they are
 * what a measurement is for; the risk figures (volatility, drawdown) close it
 * out because they are what a price line cannot show.
 */
const DEFAULT_METRICS = [
  "change",
  "selection",
  "duration",
  "high",
  "low",
  "average",
  "volume",
  "volatility",
  "annualized",
  "drawdown",
  "recovery",
];

export default class AnalysisPanel {
  /** The default row set, exposed for consumers composing their own list. */
  static METRICS = DEFAULT_METRICS.slice();

  /** @param {import("../ApexStock.js").default} ctx */
  constructor(ctx) {
    this.ctx = ctx;
    const analysis = (ctx && ctx.analysisOptions) || {};
    const raw = analysis.panel;
    const cfg = raw && typeof raw === "object" ? raw : {};

    this.opts = {
      // `panel: false` opts out entirely; anything else uses the automatic mode
      // unless an explicit `show` is given.
      enabled: raw !== false,
      show: typeof cfg.show === "boolean" ? cfg.show : null,
      position: POSITIONS.has(cfg.position) ? cfg.position : "top-right",
      metrics:
        Array.isArray(cfg.metrics) && cfg.metrics.length
          ? cfg.metrics.slice()
          : DEFAULT_METRICS.slice(),
      formatters: { ...(cfg.formatters || {}) },
      title: cfg.title != null ? String(cfg.title) : "Range",
      placeholder:
        cfg.placeholder != null ? String(cfg.placeholder) : "No selection",
    };

    this._el = null;
    this._rows = null;
    /** The last resolved measurement handed in, so reapply can repaint it. */
    this._current = null;
    /** True while the panel is in the DOM and visible. */
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

  _muted() {
    return this._dark() ? "#9aa4b2" : "#667085";
  }

  /** A price, via `formatters.price`, else 2dp. */
  _price(v) {
    const f = this.opts.formatters.price;
    if (typeof f === "function") return String(f(v));
    return v == null || !Number.isFinite(Number(v))
      ? "-"
      : String(Utils.truncateNumber(Number(v)));
  }

  /** A percentage with an explicit sign, via `formatters.percent`. */
  _pct(v, { sign = true } = {}) {
    const f = this.opts.formatters.percent;
    if (typeof f === "function") return String(f(v));
    if (v == null || !Number.isFinite(Number(v))) return "-";
    const n = Number(v);
    return `${sign && n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
  }

  /** A volume, via `formatters.volume`, else compacted (1.20M). */
  _vol(v) {
    const f = this.opts.formatters.volume;
    if (typeof f === "function") return String(f(v));
    const out = Utils.compactNumber(v);
    return out === "" ? "-" : out;
  }

  /** A date, via `formatters.date`, else ISO yyyy-mm-dd (epoch ms x only). */
  _date(x) {
    const f = this.opts.formatters.date;
    if (typeof f === "function") return String(f(x));
    if (typeof x === "number" && Number.isFinite(x)) {
      const d = new Date(x);
      if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
    return String(x);
  }

  /* ------------------------------------------------------------------ *
   * DOM
   * ------------------------------------------------------------------ */

  /** Build (once) and return the panel element, or null with no host. */
  _ensureEl() {
    if (this._el) return this._el;
    const host = this.ctx && this.ctx.chartEl;
    if (!host || typeof document === "undefined") return null;
    if (
      typeof getComputedStyle === "function" &&
      getComputedStyle(host).position === "static"
    ) {
      host.style.position = "relative";
    }

    const dark = this._dark();
    const pos = this.opts.position;
    const el = document.createElement("div");
    el.className = "apexstock-analysis-panel apexstock-analysis-panel-" + pos;
    el.style.cssText =
      "position:absolute;" +
      (pos.startsWith("top") ? "top:8px;" : "bottom:8px;") +
      (pos.endsWith("left") ? "left:10px;" : "right:10px;") +
      "z-index:8;pointer-events:none;" +
      "padding:7px 10px;border-radius:6px;min-width:168px;max-width:260px;" +
      "font:400 11px/1.55 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;" +
      "background:" +
      (dark ? "rgba(28,32,42,0.90)" : "rgba(255,255,255,0.92)") +
      ";color:" +
      (dark ? "#e5e7eb" : "#1f2937") +
      ";border:1px solid " +
      (dark ? "rgba(255,255,255,0.10)" : "rgba(16,24,40,0.10)") +
      ";box-shadow:0 1px 4px rgba(16,24,40,0.12);";

    const title = document.createElement("div");
    title.className = "apexstock-analysis-panel-title";
    title.style.cssText =
      "font-weight:600;margin-bottom:1px;letter-spacing:0.01em;";

    const range = document.createElement("div");
    range.className = "apexstock-analysis-panel-range";
    range.style.cssText =
      "color:" + this._muted() + ";margin-bottom:5px;font-size:10px;";

    const body = document.createElement("div");
    body.className = "apexstock-analysis-panel-metrics";
    body.style.cssText = "display:flex;flex-direction:column;gap:1px;";

    const note = document.createElement("div");
    note.className = "apexstock-analysis-panel-note";
    note.style.cssText =
      "margin-top:5px;padding-top:4px;font-size:10px;font-style:italic;color:" +
      this._muted() +
      ";border-top:1px solid " +
      (dark ? "rgba(255,255,255,0.08)" : "rgba(16,24,40,0.08)") +
      ";display:none;";

    el.appendChild(title);
    el.appendChild(range);
    el.appendChild(body);
    el.appendChild(note);
    host.appendChild(el);

    this._el = el;
    this._title = title;
    this._range = range;
    this._body = body;
    this._note = note;
    this._rows = new Map();
    return el;
  }

  /** Remove the element and forget the child refs (rebuilt on next paint). */
  _removeEl() {
    if (this._el && this._el.parentNode) {
      this._el.parentNode.removeChild(this._el);
    }
    this._el = null;
    this._rows = null;
  }

  /**
   * Get (creating on first use) the label/value pair for a metric key. Rows are
   * reused across repaints so a drag mutates text rather than rebuilding DOM.
   * @private
   */
  _row(key, label) {
    let row = this._rows.get(key);
    if (row) {
      row.label.textContent = label;
      row.el.style.display = "";
      return row;
    }
    const el = document.createElement("div");
    el.className = "apexstock-analysis-metric";
    el.setAttribute("data-metric", key);
    el.style.cssText = "display:flex;align-items:baseline;gap:8px;";

    const name = document.createElement("span");
    name.className = "apexstock-analysis-metric-label";
    name.style.cssText = "color:" + this._muted() + ";";
    name.textContent = label;

    const value = document.createElement("b");
    value.className = "apexstock-analysis-metric-value";
    value.style.cssText =
      "font-weight:600;margin-left:auto;font-variant-numeric:tabular-nums;";

    el.appendChild(name);
    el.appendChild(value);
    this._body.appendChild(el);

    row = { el, label: name, value };
    this._rows.set(key, row);
    return row;
  }

  /** Write one metric row, or hide it when there is nothing to say. @private */
  _set(key, label, text, color) {
    if (text == null) {
      const existing = this._rows.get(key);
      if (existing) existing.el.style.display = "none";
      return;
    }
    const row = this._row(key, label);
    row.value.textContent = text;
    row.value.style.color = color || "inherit";
  }

  /* ------------------------------------------------------------------ *
   * Rendering
   * ------------------------------------------------------------------ */

  /**
   * Render a resolved measurement.
   * @param {{stats: object, selection: object}} resolved - From
   *   {@link ../analysis/Measurement.js Measurement#resolve}.
   * @returns {void}
   */
  showMeasurement(resolved) {
    this._current = resolved || null;
    if (!resolved || !resolved.stats) {
      this.clear();
      return;
    }
    // Automatic mode: a measurement exists, so show the panel. An explicit
    // `show: false` still wins.
    if (!this.opts.enabled || this.opts.show === false) return;
    this._visible = true;
    this._paint(resolved);
  }

  /**
   * Paint the panel. A null measurement renders the placeholder, which is what
   * an explicitly-shown panel displays before anything has been measured.
   * @private
   */
  _paint(resolved) {
    const el = this._ensureEl();
    if (!el) return;
    el.style.display = "";

    if (!resolved || !resolved.stats) {
      this._title.textContent = this.opts.title;
      this._title.style.display = this.opts.title ? "" : "none";
      this._range.textContent = this.opts.placeholder;
      this._rows.forEach((row) => {
        row.el.style.display = "none";
      });
      this._note.style.display = "none";
      return;
    }

    const { stats, selection } = resolved;
    const up = this._upColor();
    const down = this._downColor();
    const dirColor = (v) => (v == null ? "inherit" : v >= 0 ? up : down);

    this._title.textContent = this.opts.title;
    this._title.style.display = this.opts.title ? "" : "none";
    this._range.textContent =
      this._date(stats.from.x) + "  to  " + this._date(stats.to.x);

    this.opts.metrics.forEach((key) =>
      this._metric(key, stats, selection, dirColor)
    );

    // Hide any row not in the current metric set (a metrics change at runtime).
    const wanted = new Set(this.opts.metrics);
    this._rows.forEach((row, key) => {
      if (!wanted.has(key)) row.el.style.display = "none";
    });

    // One muted footnote for the assumptions the engine had to make, with the
    // full list on the title attribute. Silence would be dishonest; printing
    // every warning would be noise.
    if (Array.isArray(stats.warnings) && stats.warnings.length) {
      this._note.textContent = stats.warnings[0];
      this._note.title = stats.warnings.join("\n");
      this._note.style.display = "";
    } else {
      this._note.style.display = "none";
      this._note.removeAttribute("title");
    }
  }

  /** Write a single metric by key. @private */
  _metric(key, stats, selection, dirColor) {
    const dd = stats.drawdown || {};
    switch (key) {
      case "change": {
        const a = stats.change.absolute;
        const sign = a >= 0 ? "+" : "";
        const pct =
          stats.change.percent != null
            ? ` (${this._pct(stats.change.percent)})`
            : "";
        this._set(key, "Change", `${sign}${this._price(a)}${pct}`, dirColor(a));
        break;
      }

      case "selection": {
        // The dragged anchors. Omitted for a measurement with no anchors (the
        // core ruler in span mode, or an API measurement on the closes).
        if (!selection || selection.absolute == null) {
          this._set(key, "Selection", null);
          break;
        }
        const same =
          Math.abs(selection.absolute - stats.change.absolute) < 1e-9 &&
          Math.abs((selection.from || 0) - stats.from.value) < 1e-9;
        if (same) {
          this._set(key, "Selection", null); // identical to Change: no noise
          break;
        }
        const sign = selection.absolute >= 0 ? "+" : "";
        const pct =
          selection.percent != null ? ` (${this._pct(selection.percent)})` : "";
        this._set(
          key,
          "Selection",
          `${sign}${this._price(selection.absolute)}${pct}`,
          dirColor(selection.absolute)
        );
        break;
      }

      case "duration": {
        const parts = [`${stats.bars} bars`];
        if (stats.calendarDays != null && stats.calendarDays >= 1) {
          parts.push(`${Math.round(stats.calendarDays)}d`);
        }
        this._set(key, "Duration", parts.join(" · "));
        break;
      }

      case "high":
        this._set(
          key,
          "High",
          stats.high ? this._price(stats.high.value) : null
        );
        break;

      case "low":
        this._set(key, "Low", stats.low ? this._price(stats.low.value) : null);
        break;

      case "average":
        this._set(
          key,
          "Avg price",
          stats.average.close != null ? this._price(stats.average.close) : null
        );
        break;

      case "volume":
        this._set(
          key,
          "Avg volume",
          stats.average.volume != null ? this._vol(stats.average.volume) : null
        );
        break;

      case "volatility": {
        if (!stats.volatility) {
          this._set(key, "Volatility", null);
          break;
        }
        const v = stats.volatility;
        const text =
          v.annualized != null
            ? `${this._pct(v.annualized, { sign: false })} ann.`
            : `${this._pct(v.stdev, { sign: false })} / bar`;
        this._set(key, "Volatility", text);
        break;
      }

      case "annualized":
        this._set(
          key,
          "Annualized",
          stats.annualized ? this._pct(stats.annualized.return) : null,
          stats.annualized ? dirColor(stats.annualized.return) : null
        );
        break;

      case "drawdown": {
        if (dd.max == null) {
          this._set(key, "Max drawdown", null);
          break;
        }
        const suffix =
          dd.barsToTrough != null ? ` · ${dd.barsToTrough} bars` : "";
        // A drawdown is never positive, so it never wants a "+" prefix (a flat
        // range would otherwise read "+0.00%").
        this._set(
          key,
          "Max drawdown",
          `${this._pct(dd.max, { sign: false })}${suffix}`,
          dd.max < 0 ? this._downColor() : "inherit"
        );
        break;
      }

      case "recovery": {
        // Only meaningful once there is a drawdown to recover from.
        if (dd.max == null || dd.max === 0 || dd.trough == null) {
          this._set(key, "Recovery", null);
          break;
        }
        this._set(
          key,
          "Recovery",
          dd.recovered && dd.barsToRecovery != null
            ? `${dd.barsToRecovery} bars`
            : "not recovered",
          dd.recovered ? "inherit" : this._downColor()
        );
        break;
      }

      default:
        // An unknown key is the consumer's typo, not a crash.
        this._set(key, key, null);
    }
  }

  /* ------------------------------------------------------------------ *
   * Public API (proxied by ApexStock)
   * ------------------------------------------------------------------ */

  /**
   * Force the panel on (optionally patching its options) and repaint the current
   * measurement if there is one.
   * @param {AnalysisPanelOptions} [opts]
   * @returns {void}
   */
  show(opts) {
    if (opts && typeof opts === "object") {
      if (POSITIONS.has(opts.position)) this.opts.position = opts.position;
      if (Array.isArray(opts.metrics) && opts.metrics.length) {
        this.opts.metrics = opts.metrics.slice();
      }
      if (opts.formatters && typeof opts.formatters === "object") {
        this.opts.formatters = { ...this.opts.formatters, ...opts.formatters };
      }
      if (opts.title != null) this.opts.title = String(opts.title);
      if (opts.placeholder != null) {
        this.opts.placeholder = String(opts.placeholder);
      }
      // The corner and the palette are baked into inline styles.
      this._removeEl();
    }
    this.opts.enabled = true;
    this.opts.show = true;
    this._visible = true;
    this._paint(this._current);
  }

  /** Force the panel off. It stays hidden until `show()` is called again. */
  hide() {
    this.opts.show = false;
    this._visible = false;
    if (this._el) this._el.style.display = "none";
  }

  /** @returns {boolean} whether the panel is currently rendered and visible. */
  isVisible() {
    return !!(
      this._visible &&
      this._el &&
      this._el.style.display !== "none" &&
      this.opts.show !== false
    );
  }

  /**
   * There is nothing to show (the last measurement was cleared). Returns the
   * panel to its resting state without changing the configured mode.
   * @returns {void}
   */
  clear() {
    this._current = null;
    if (this.opts.show === true) {
      // Explicitly shown: keep the frame, fall back to the placeholder.
      this._paint(null);
      return;
    }
    this._visible = false;
    if (this._el) this._el.style.display = "none";
  }

  /**
   * Rebuild after a (re-)render or theme change: the palette is baked into
   * inline styles, so the element is discarded and repainted.
   * @returns {void}
   */
  reapply() {
    this._removeEl();
    if (this.opts.show === true) {
      this._visible = true;
      this._paint(this._current);
    } else if (this._current && this._visible) {
      this._paint(this._current);
    }
  }

  /** Remove the panel and drop state. */
  destroy() {
    this._current = null;
    this._visible = false;
    this._removeEl();
  }
}
