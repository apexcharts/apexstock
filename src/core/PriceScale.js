/**
 * PriceScale — controls how the PRIMARY price y-axis is scaled and labelled.
 * Four modes, matching the price-scale options analysts expect (TradingView's
 * price-scale menu, Highcharts' `yAxis.type`):
 *
 * - `"linear"` (default) — raw price, evenly spaced.
 * - `"logarithmic"` — log-distributed price axis (equal % moves look equal);
 *   the one mode that changes gridline positions, delegated to ApexCharts'
 *   native `yaxis.logarithmic` + `logBase`.
 * - `"percent"` — axis labelled as % change from a baseline (the first data
 *   point's close, or an explicit `base`). "Who moved how much" view.
 * - `"indexed"` — axis labelled as an index where the baseline = `indexBase`
 *   (default 100), i.e. `price / base * indexBase`.
 *
 * `percent` and `indexed` are *affine* functions of price, so they leave the
 * gridline positions untouched and only relabel the axis — no series
 * transformation. That is the whole point of doing this at the axis level:
 * indicators, drawings, annotations, and trading price lines stay in true price
 * space and are completely unaffected; only the labels (and the y-axis
 * crosshair label, which shares the formatter) change. This is distinct from
 * {@link Comparison}'s percent mode, which normalizes *overlaid instruments*.
 *
 * Applied through the manager reapply pattern: {@link reapply} re-asserts the
 * primary-axis patch after every render/update/theme rebuild, and runs AFTER
 * {@link Comparison} in those chains so it always patches the correct primary
 * axis when a comparison secondary axis is present. It is a no-op until the
 * scale is actually touched (config or `setMode`), so default linear charts
 * keep their original formatter and pay nothing.
 */

const MODES = ["linear", "logarithmic", "percent", "indexed"];
const DEFAULT_LOG_BASE = 10;
const DEFAULT_INDEX_BASE = 100;

export default class PriceScale {
  /** @param {import("../ApexStock.js").default} ctx */
  constructor(ctx) {
    this.ctx = ctx;
    this.mode = "linear";
    /** Explicit baseline for percent/indexed; null => first data point's close. */
    this.base = null;
    this.logBase = DEFAULT_LOG_BASE;
    this.indexBase = DEFAULT_INDEX_BASE;
    /** Once true, reapply() asserts on every rebuild (else it no-ops). */
    this._touched = false;
    /** Baseline resolved from data, recomputed on each reapply. */
    this._base = null;
    // Bound so ApexCharts' cached copy always reads live instance state
    // (mode/base) rather than a value captured at apply time.
    this._fmt = (v) => this._format(v);

    // Initial config from `options.priceScale` (mirrors Legend's options.legend).
    const cfg = ctx && ctx.chartOptions && ctx.chartOptions.priceScale;
    if (cfg && typeof cfg === "object") {
      this._assign(cfg);
      if (this.mode !== "linear" || this.base != null) this._touched = true;
    }
  }

  /** Merge a partial `{ mode, base, logBase, indexBase }` into the config. */
  _assign(opts) {
    if (!opts || typeof opts !== "object") return;
    if (opts.mode && MODES.indexOf(opts.mode) !== -1) this.mode = opts.mode;
    if ("base" in opts) {
      this.base =
        opts.base != null && Number.isFinite(+opts.base) ? +opts.base : null;
    }
    if (Number.isFinite(+opts.logBase) && +opts.logBase > 1) {
      this.logBase = +opts.logBase;
    }
    if (Number.isFinite(+opts.indexBase) && +opts.indexBase > 0) {
      this.indexBase = +opts.indexBase;
    }
  }

  /** @returns {"linear"|"logarithmic"|"percent"|"indexed"} */
  getMode() {
    return this.mode;
  }

  /** @returns {{mode:string, base:number|null, logBase:number, indexBase:number}} */
  get() {
    return {
      mode: this.mode,
      base: this.base,
      logBase: this.logBase,
      indexBase: this.indexBase,
    };
  }

  /**
   * Set the scale mode (and optional knobs) and re-render the axis.
   * @param {"linear"|"logarithmic"|"percent"|"indexed"} mode
   * @param {{base?:number|null, logBase?:number, indexBase?:number}} [opts]
   * @returns {void}
   */
  setMode(mode, opts) {
    this.mode = MODES.indexOf(mode) !== -1 ? mode : "linear";
    if (opts) this._assign({ ...opts, mode: this.mode });
    this._touched = true;
    this.reapply();
    if (this.ctx && this.ctx._emitter) {
      this.ctx._emitter.emit("priceScaleChange", this.get());
    }
  }

  /** Resolve the baseline for percent/indexed from the current series. */
  _computeBase() {
    if (this.base != null && Number.isFinite(this.base)) return this.base;
    const s = this.ctx && this.ctx.series;
    if (!Array.isArray(s) || !s.length) return null;
    const p = s[0];
    if (Array.isArray(p.y)) return p.y[p.y.length - 1];
    if (typeof p.y === "number") return p.y;
    if (typeof p.close === "number") return p.close;
    return null;
  }

  /** Axis label formatter for the active mode. Reads live `this._base`. */
  _format(v) {
    if (v == null || !Number.isFinite(+v)) return v;
    const n = +v;
    if (this.mode === "percent") {
      const b = this._base;
      return b ? `${(((n - b) / b) * 100).toFixed(2)}%` : "0.00%";
    }
    if (this.mode === "indexed") {
      const b = this._base;
      return b ? ((n / b) * this.indexBase).toFixed(2) : n.toFixed(2);
    }
    // linear + logarithmic: raw price.
    return n.toFixed(2);
  }

  /** The non-label part of the primary-axis patch (scaling only). */
  _axisPatch() {
    const log = this.mode === "logarithmic";
    const patch = { logarithmic: log };
    if (log) patch.logBase = this.logBase;
    return patch;
  }

  /**
   * Re-assert the primary-axis scale on the live chart. No-op until the scale
   * has been touched. Preserves any secondary (comparison) axes by rewriting
   * only index 0 of the live y-axis array.
   * @returns {void}
   */
  reapply() {
    if (!this._touched) return;
    const chart = this.ctx && this.ctx.chart;
    if (!chart || !chart.w || !chart.w.config) return;
    const live = chart.w.config.yaxis || [];
    if (!live.length) return;
    this._base = this._computeBase();
    const patch = this._axisPatch();
    const yaxis = live.map((axis, i) => {
      if (i !== 0) return axis;
      return {
        ...axis,
        ...patch,
        labels: { ...(axis.labels || {}), formatter: this._fmt },
      };
    });
    chart.updateOptions({ yaxis }, false, false, false);
  }

  /**
   * JSON snapshot for state serialization, or null when the scale was never
   * touched (a null in state means "default linear scale").
   * @returns {{mode:string, base:number|null, logBase:number, indexBase:number}|null}
   */
  _serialize() {
    if (!this._touched) return null;
    return {
      mode: this.mode,
      base: this.base,
      logBase: this.logBase,
      indexBase: this.indexBase,
    };
  }

  /**
   * Restore from a snapshot. A null/absent snapshot resets to the default
   * linear scale (re-asserting only if a non-default scale is currently live,
   * so a prior percent/log formatter is cleared).
   * @param {object|null} state
   * @returns {void}
   */
  _restore(state) {
    if (!state || typeof state !== "object") {
      const wasTouched = this._touched;
      this.mode = "linear";
      this.base = null;
      this.logBase = DEFAULT_LOG_BASE;
      this.indexBase = DEFAULT_INDEX_BASE;
      if (wasTouched) this.reapply();
      return;
    }
    this._assign(state);
    this._touched = true;
    this.reapply();
  }

  /** Drop state (chart teardown handles the axis itself). */
  destroy() {
    this._touched = false;
  }
}
