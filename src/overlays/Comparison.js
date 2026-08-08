import Utils from "../utils/Utils";

/**
 * Comparison mode: overlay one or more additional instruments (e.g. AAPL vs
 * MSFT vs SPY) on the main chart as line series, to compare their movement
 * against the primary symbol and each other.
 *
 * Because compared instruments rarely share the primary's price scale, they are
 * plotted on a dedicated **secondary y-axis**. Two normalization modes:
 * - `"absolute"` — raw close prices (secondary axis shows price).
 * - `"percent"`  — indexed performance: each instrument as % change from its
 *   first data point (secondary axis shows %). This is the "who's up more"
 *   view; it is the default.
 *
 * The primary candlestick and any indicators keep the primary y-axis untouched.
 *
 * ApexCharts v5 requires that when there are multiple y-axes, EVERY series is
 * bound to one via `seriesName` (a mix of bound/unbound throws). So while
 * comparisons are active the manager rebinds all main-chart series (price +
 * indicator overlays) to the primary axis and the comparison lines to the
 * secondary axis, rebuilding both on every {@link reapply}. Operations that
 * add/remove main-chart series mid-flight (indicator toggle, chart-type switch)
 * call {@link suspend} first to collapse back to a single axis, then reapply.
 *
 * @typedef {Object} ComparisonConfig
 * @property {string} name - Unique instrument name (also the series/legend label).
 * @property {Array<{x:*, y:number|number[]}>} data - Points; OHLC arrays use the close.
 * @property {string} [color] - Line color; defaults from a palette.
 */

const PALETTE = ["#00E396", "#FEB019", "#FF4560", "#775DD0", "#3F51B5", "#546E7A"];

export default class Comparison {
  /** @param {import("../ApexStock.js").default} ctx */
  constructor(ctx) {
    this.ctx = ctx;
    /** @type {Object.<string, {name:string, data:{x:*,close:number}[], color:string}>} */
    this.items = {};
    this.mode = "percent";
    this._counter = 0;
    /** Names currently rendered as comparison series (to filter on reapply). */
    this._rendered = new Set();
  }

  /** @returns {boolean} true if any comparison instrument is present. */
  isActive() {
    return Object.keys(this.items).length > 0;
  }

  /** @returns {"absolute"|"percent"} */
  getMode() {
    return this.mode;
  }

  /** Set the normalization mode and re-render. */
  setMode(mode) {
    this.mode = mode === "absolute" ? "absolute" : "percent";
    this.reapply();
  }

  /** Extract the close value from a point ({x,y:[o,h,l,c]} | {x,y:number} | {x,close}). */
  _close(p) {
    if (Array.isArray(p.y)) return p.y[p.y.length - 1];
    if (typeof p.y === "number") return p.y;
    if (typeof p.close === "number") return p.close;
    return NaN;
  }

  /**
   * Add (or replace, if `name` exists) a comparison instrument.
   * @param {ComparisonConfig} config
   * @returns {string|null} the instrument name, or null on invalid input.
   */
  add(config) {
    if (!config || !config.name || !Array.isArray(config.data)) {
      Utils.warn("addComparison: `name` and a `data` array are required.");
      return null;
    }
    const name = String(config.name);
    const data = config.data
      .map((p) => ({ x: p.x, close: this._close(p) }))
      .filter((p) => p.x != null && Number.isFinite(p.close));
    if (!data.length) {
      Utils.warn(`addComparison: "${name}" has no valid points.`);
      return null;
    }
    const color =
      config.color || PALETTE[this._counter++ % PALETTE.length];
    this.items[name] = { name, data, color };
    this.reapply();
    return name;
  }

  /**
   * Remove a comparison instrument.
   * @param {string} name
   * @returns {boolean} false if no such instrument.
   */
  remove(name) {
    name = String(name);
    if (!this.items[name]) return false;
    delete this.items[name];
    this.reapply();
    return true;
  }

  /** Remove every comparison instrument (restores the single price axis). */
  clear() {
    if (!this.isActive()) return;
    this.items = {};
    this.reapply();
  }

  /** @returns {object[]} copies of the comparison configs (mode-normalized values are not included). */
  getAll() {
    return Object.values(this.items).map((it) => ({
      name: it.name,
      color: it.color,
      points: it.data.length,
    }));
  }

  /** Compute a comparison line's points for the current mode. */
  _line(item) {
    if (this.mode === "percent") {
      const base = item.data[0].close;
      return item.data.map((p) => ({
        x: p.x,
        y: base ? Utils.truncateNumber(((p.close - base) / base) * 100) : 0,
      }));
    }
    return item.data.map((p) => ({ x: p.x, y: p.close }));
  }

  /** A fresh single-axis config matching the primary (used to collapse axes). */
  _singleAxis() {
    return this.ctx.mainChartOptions && this.ctx.mainChartOptions.yaxis
      ? Utils.extend({}, this.ctx.mainChartOptions.yaxis)
      : { opposite: true };
  }

  /** The secondary axis config for the comparison lines. */
  _cmpAxis(names) {
    const dark = this.ctx.isDarkTheme;
    const pct = this.mode === "percent";
    return {
      opposite: false,
      seriesName: names,
      labels: {
        style: { colors: dark ? "#9aa4b2" : "#667085" },
        formatter: (v) =>
          pct ? `${Number(v).toFixed(1)}%` : Number(v).toFixed(2),
      },
      title: {
        text: pct ? "Δ %" : "price",
        style: { color: dark ? "#9aa4b2" : "#667085", fontSize: "11px" },
      },
    };
  }

  /**
   * Collapse to a single y-axis (dropping the multi-axis binding) so a caller
   * can safely add/remove main-chart series without ApexCharts' bound/unbound
   * mismatch throwing. The comparison lines remain (temporarily on the shared
   * axis) until the next {@link reapply}. No-op when inactive.
   */
  suspend() {
    if (!this._rendered.size || !this.ctx.chart) return;
    this.ctx.chart.updateOptions(
      { yaxis: this._singleAxis() },
      false,
      false,
      false
    );
    this._rendered = new Set();
  }

  /**
   * Rebuild the comparison series and y-axes from the live chart state.
   * Idempotent. Reads the current main-chart series (price + overlays) so
   * indicator changes are picked up automatically.
   */
  reapply() {
    const chart = this.ctx.chart;
    if (!chart || !chart.w) return;

    const prev = this._rendered;
    // Exclude both previously-rendered comparison series AND any series whose
    // name matches a current instrument (chart-type switch carries our lines
    // over as pseudo-indicators; without this they would duplicate).
    const base = chart.w.config.series.filter(
      (s) => !prev.has(s.name) && !this.items[s.name]
    );
    const items = Object.values(this.items);
    const cmpSeries = items.map((it) => ({
      name: it.name,
      type: "line",
      data: this._line(it),
      color: it.color,
    }));
    const cmpNames = cmpSeries.map((s) => s.name);
    const nonCmpNames = base.map((s) => s.name).filter(Boolean);

    // Series first (single axis while they settle -> no bound/unbound mismatch),
    // then the axis binding once every series exists.
    chart.updateSeries([...base, ...cmpSeries]);

    if (items.length) {
      chart.updateOptions(
        {
          yaxis: [
            { ...this._singleAxis(), seriesName: nonCmpNames },
            this._cmpAxis(cmpNames),
          ],
        },
        false,
        false,
        false
      );
      this._rendered = new Set(cmpNames);
    } else if (prev.size) {
      // Last comparison removed: restore the single price axis.
      chart.updateOptions({ yaxis: this._singleAxis() }, false, false, false);
      this._rendered = new Set();
    }
  }

  /** Remove all comparison series + restore the single axis, and drop state. */
  destroy() {
    this.items = {};
    if (this._rendered.size && this.ctx.chart) {
      // Leave series cleanup to the chart teardown; just drop our state.
    }
    this._rendered = new Set();
  }
}
