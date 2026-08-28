import Utils from "../utils/Utils";
import Align from "../analysis/Align";
import Statistics from "../analysis/Statistics";
import Drawdown from "../analysis/Drawdown";

/**
 * Comparison mode: overlay one or more additional instruments (e.g. AAPL vs
 * MSFT vs SPY) on the main chart as line series, to compare their movement
 * against the primary symbol and each other.
 *
 * Because compared instruments rarely share the primary's price scale, they are
 * plotted on a dedicated **secondary y-axis**.
 *
 * ## Alignment: why this manager does not just plot each array as given
 *
 * Instruments do not share a calendar. A newer listing starts later, exchanges
 * keep different holidays, and a data feed can simply be missing a day. So
 * every instrument (the primary included) goes through {@link Align.align},
 * which samples them all onto one shared x grid and reports per-instrument
 * `coverage`. Two policies control it:
 *
 * - `join`: `"union"` (default, keep every x any instrument has), `"primary"`
 *   (resample onto the primary's bars), `"intersection"` (only shared x values).
 * - `fill`: `"hold"` (default, carry the last observation across a hole),
 *   `"gap"` (leave it null), `"drop"` (remove x values not everyone has).
 *
 * A carried-forward value is used for the *math* (baselines, statistics) but is
 * **not plotted** by default, so a line never shows a bar its instrument does
 * not have. Set `resample: true` to plot the filled grid instead (the default
 * when `join: "primary"`, which exists precisely to resample).
 *
 * ## Baseline: what "0%" means
 *
 * `baseline: "common"` (the default) rebases every instrument at the first x
 * where *all* of them, primary included, have data. That is the only policy
 * under which lines with different start dates are actually comparable, and it
 * is why the primary participates: the chart's window is anchored on it.
 * `"own"` (each instrument's own first point) is the pre-0.5.0 behavior, kept
 * for compatibility. `"visible"` rebases to the left edge of the visible window
 * and follows the zoom. A number is an explicit x value.
 *
 * ## Modes
 *
 * - `"absolute"`: raw values (secondary axis shows price).
 * - `"percent"`: percent change from the baseline. The default.
 * - `"indexed"`: the baseline reads `indexBase` (default 100), i.e. the
 *   "100 = starting value" view.
 * - `"relative"`: `percentChange(asset) - percentChange(benchmark)`, in
 *   percentage points. Zero means "kept pace".
 * - `"ratio"`: `asset / benchmark`, rebased so the baseline reads `indexBase`.
 *
 * The last two need a benchmark, which is a **role**, not a ticker: it is any
 * added instrument by name, or `"__primary__"` (the default) for the chart's
 * own symbol. Nothing in ApexStock hard-codes a benchmark symbol.
 *
 * ## Axis binding
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
 * @property {Array<{x:*, y:number|number[]}>} data - Points; OHLC arrays use `source`.
 * @property {string} [color] - Line color; defaults from a palette.
 */

const PALETTE = [
  "#00E396",
  "#FEB019",
  "#FF4560",
  "#775DD0",
  "#3F51B5",
  "#546E7A",
];

/** @type {import("../types.js").ComparisonMode[]} */
const MODES = ["absolute", "percent", "indexed", "relative", "ratio"];

const DEFAULT_MODE = "percent";

/** Benchmark sentinel: the chart's own symbol, whatever it is named. */
const PRIMARY = "__primary__";

const JOINS = ["union", "primary", "intersection"];
const FILLS = ["hold", "gap", "drop"];
const SOURCES = ["close", "open", "high", "low"];
const BASELINES = ["common", "own", "visible"];

/** @type {import("../types.js").ComparisonOptions} */
const DEFAULTS = {
  join: "union",
  fill: "hold",
  baseline: "common",
  indexBase: 100,
  source: "close",
  rebaseRatio: true,
  resample: null,
};

export default class Comparison {
  /** @param {import("../ApexStock.js").default} ctx */
  constructor(ctx) {
    this.ctx = ctx;
    /** @type {Object.<string, {name:string, data:{x:*,y:number|number[]}[], color:string}>} */
    this.items = {};
    const cfg =
      (ctx && ctx.analysisOptions && ctx.analysisOptions.comparison) || {};

    /** @type {import("../types.js").ComparisonMode} */
    this.mode = MODES.indexOf(cfg.mode) !== -1 ? cfg.mode : DEFAULT_MODE;
    /** Benchmark instrument name, or the {@link PRIMARY} sentinel. */
    this.benchmark = cfg.benchmark != null ? String(cfg.benchmark) : PRIMARY;
    /** @type {import("../types.js").ComparisonOptions} */
    this.options = Comparison._normalizeOptions(DEFAULTS, cfg);

    this._counter = 0;
    /** Names currently rendered as comparison series (to filter on reapply). */
    this._rendered = new Set();
    /** Memoized alignment + derived columns, keyed by {@link _cacheKey}. */
    this._derived = null;
    this._derivedKey = "";
    /** Bumped whenever the instrument set or the primary's data changes. */
    this._dataVersion = 0;
    /** Left edge of the visible window, for `baseline: "visible"`. */
    this._visibleFrom = null;
    /** Re-entrancy guard for the visible-baseline rebase. */
    this._rebasing = false;
    this._rangeUnsub = null;
    /** name -> color remembered from a restored state, see {@link _restore}. */
    this._restoredColors = {};
  }

  /** @returns {boolean} true if any comparison instrument is present. */
  isActive() {
    return Object.keys(this.items).length > 0;
  }

  /** @returns {import("../types.js").ComparisonMode} */
  getMode() {
    return this.mode;
  }

  /**
   * Set the normalization mode and re-render.
   * @param {import("../types.js").ComparisonMode} mode
   */
  setMode(mode) {
    if (MODES.indexOf(mode) === -1) {
      Utils.warn(
        `setComparisonMode: unknown mode "${mode}". Expected one of ${MODES.join(", ")}.`
      );
      return;
    }
    if (this.mode === mode) return;
    this.mode = mode;
    this._invalidate();
    this.reapply();
    this._emitChange("mode");
  }

  /** @returns {string} the benchmark name, or `"__primary__"`. */
  getBenchmark() {
    return this.benchmark;
  }

  /**
   * Set the benchmark instrument for `relative` and `ratio` mode. The benchmark
   * is a role: pass the name of any added instrument, or `"__primary__"` for
   * the chart's own symbol. No symbol is special-cased.
   * @param {string} name
   */
  setBenchmark(name) {
    const next = name == null ? PRIMARY : String(name);
    if (next !== PRIMARY && !this.items[next]) {
      Utils.warn(
        `setComparisonBenchmark: "${next}" is not an added instrument. Add it first, or pass "${PRIMARY}".`
      );
      return;
    }
    if (this.benchmark === next) return;
    this.benchmark = next;
    this._invalidate();
    if (this.mode === "relative" || this.mode === "ratio") this.reapply();
    this._emitChange("benchmark");
  }

  /** @returns {import("../types.js").ComparisonOptions} a copy of the alignment options. */
  getOptions() {
    return { ...this.options };
  }

  /**
   * Patch the alignment / baseline options and re-render.
   * @param {import("../types.js").ComparisonOptions} patch
   */
  setOptions(patch) {
    if (!patch || typeof patch !== "object") return;
    const next = Comparison._normalizeOptions(this.options, patch);
    const changed = JSON.stringify(next) !== JSON.stringify(this.options);
    if (!changed) return;
    this.options = next;
    this._bindRange();
    this._invalidate();
    this.reapply();
    this._emitChange("options");
  }

  /**
   * Validate a patch against a base, warning about (and ignoring) bad values so
   * one typo cannot silently change what the numbers mean.
   * @param {import("../types.js").ComparisonOptions} base
   * @param {Object} patch
   * @returns {import("../types.js").ComparisonOptions}
   * @private
   */
  static _normalizeOptions(base, patch) {
    const out = { ...base };
    const oneOf = (key, allowed) => {
      if (patch[key] === undefined) return;
      if (allowed.indexOf(patch[key]) === -1) {
        Utils.warn(
          `comparison: unknown ${key} "${patch[key]}". Expected one of ${allowed.join(", ")}.`
        );
        return;
      }
      out[key] = patch[key];
    };
    oneOf("join", JOINS);
    oneOf("fill", FILLS);
    oneOf("source", SOURCES);
    if (patch.baseline !== undefined) {
      if (
        BASELINES.indexOf(patch.baseline) !== -1 ||
        Number.isFinite(+patch.baseline)
      ) {
        out.baseline =
          BASELINES.indexOf(patch.baseline) !== -1
            ? patch.baseline
            : +patch.baseline;
      } else {
        Utils.warn(
          `comparison: unknown baseline "${patch.baseline}". Expected one of ${BASELINES.join(", ")} or an x value.`
        );
      }
    }
    if (patch.indexBase !== undefined) {
      if (Number.isFinite(+patch.indexBase) && +patch.indexBase !== 0) {
        out.indexBase = +patch.indexBase;
      } else {
        Utils.warn("comparison: indexBase must be a non-zero number.");
      }
    }
    if (patch.rebaseRatio !== undefined) out.rebaseRatio = !!patch.rebaseRatio;
    if (patch.resample !== undefined) {
      out.resample = patch.resample == null ? null : !!patch.resample;
    }
    return out;
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
    if (name === this._primaryName()) {
      Utils.warn(
        `addComparison: "${name}" is the primary series' name; a comparison instrument needs a distinct name.`
      );
      return null;
    }
    if (name === PRIMARY) {
      Utils.warn(
        `addComparison: "${PRIMARY}" is reserved for the primary symbol.`
      );
      return null;
    }
    // Keep the points as given (OHLC arrays included) rather than collapsing to
    // a close here: `source` decides which field to compare on, and it can be
    // changed after the fact.
    const data = [];
    for (const p of config.data) {
      if (!p || typeof p !== "object" || Align.toAxisX(p.x) === null) continue;
      if (Array.isArray(p.y)) data.push({ x: p.x, y: p.y.slice() });
      else if (typeof p.y === "number") data.push({ x: p.x, y: p.y });
      else if (typeof p.close === "number") data.push({ x: p.x, y: p.close });
    }
    if (!Align.observations(data, this.options.source).length) {
      Utils.warn(`addComparison: "${name}" has no valid points.`);
      return null;
    }
    // An explicit color wins, then one remembered from a restored state (so
    // re-supplying an instrument's data brings its line back in its own color),
    // then the palette.
    const color =
      config.color ||
      this._restoredColors[name] ||
      PALETTE[this._counter++ % PALETTE.length];
    this.items[name] = { name, data, color };
    this._invalidate();
    this._bindRange();
    this.reapply();
    this._emitChange("add");
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
    if (this.benchmark === name) {
      // The benchmark role falls back to the primary rather than leaving the
      // chart pointing at an instrument that is no longer there.
      this.benchmark = PRIMARY;
    }
    this._invalidate();
    this.reapply();
    if (!this.isActive()) this._unbindRange();
    this._emitChange("remove");
    return true;
  }

  /** Remove every comparison instrument (restores the single price axis). */
  clear() {
    if (!this.isActive()) return;
    this.items = {};
    this.benchmark = PRIMARY;
    this._restoredColors = {};
    this._invalidate();
    this.reapply();
    this._unbindRange();
    this._emitChange("clear");
  }

  /** @returns {object[]} copies of the comparison configs (mode-normalized values are not included). */
  getAll() {
    return Object.values(this.items).map((it) => ({
      name: it.name,
      color: it.color,
      points: it.data.length,
    }));
  }

  /**
   * Drop the memoized alignment. Called on every mutation, and by ApexStock
   * when the primary series changes (`appendData`, `update`), because the
   * primary is one of the aligned instruments.
   * @returns {void}
   */
  invalidate() {
    this._invalidate();
  }

  /** @private */
  _invalidate() {
    this._dataVersion++;
    this._derived = null;
    this._derivedKey = "";
  }

  /* ------------------------------------------------------------------ *
   * Alignment
   * ------------------------------------------------------------------ */

  /**
   * The primary series' name, by POSITION (index 0), never by the literal
   * "Price": consumers rename it. Same rule as ChartSwitch.
   * @returns {string}
   * @private
   */
  _primaryName() {
    const live =
      this.ctx &&
      this.ctx.chart &&
      this.ctx.chart.w &&
      this.ctx.chart.w.config &&
      this.ctx.chart.w.config.series;
    if (live && live.length && live[0] && live[0].name)
      return String(live[0].name);
    const cfg =
      this.ctx && this.ctx.mainChartOptions && this.ctx.mainChartOptions.series;
    if (cfg && cfg.length && cfg[0] && cfg[0].name) return String(cfg[0].name);
    return "Price";
  }

  /**
   * Resolve the benchmark role to an instrument name.
   * @returns {string|null} null when the configured name is gone.
   * @private
   */
  _benchmarkName() {
    if (this.benchmark === PRIMARY) return this._primaryName();
    return this.items[this.benchmark] ? this.benchmark : null;
  }

  /** @returns {boolean} true when the current mode needs a benchmark. @private */
  _needsBenchmark() {
    return this.mode === "relative" || this.mode === "ratio";
  }

  /** @private */
  _cacheKey() {
    const s = this.ctx && this.ctx.series;
    return [
      this.mode,
      this.benchmark,
      JSON.stringify(this.options),
      this._visibleFrom,
      this._dataVersion,
      s ? s.length : 0,
    ].join("|");
  }

  /**
   * Align every instrument (primary included) and derive the display column for
   * the current mode. Memoized: one alignment per mutation, reused by every
   * reapply, every stats call, and every theme rebuild.
   * @returns {{primary:string, benchmark:string, aligned:import("../analysis/Align.js").AlignResult, baseline:object, columns:Object.<string,Array<number|null>>, plot:Object.<string,{i:number,x:number}[]>, obs:Object.<string,{i:number,x:number,v:number}[]>, warnings:string[]}|null}
   * @private
   */
  _derive() {
    if (!this.isActive()) return null;
    const key = this._cacheKey();
    if (this._derived && this._derivedKey === key) return this._derived;

    const o = this.options;
    const primary = this._primaryName();
    const instruments = { [primary]: (this.ctx && this.ctx.series) || [] };
    Object.values(this.items).forEach((it) => {
      instruments[it.name] = it.data;
    });

    const aligned = Align.align(instruments, {
      join: o.join,
      fill: o.fill,
      primary,
      source: o.source,
    });
    const warnings = aligned.warnings.slice();

    const from =
      o.baseline === "visible" ? this._resolveVisibleFrom() : undefined;
    let benchmark = this._benchmarkName();
    if (this._needsBenchmark() && benchmark === null) {
      warnings.push(
        `comparison: benchmark "${this.benchmark}" is not an added instrument; using the primary symbol.`
      );
      benchmark = primary;
    } else if (benchmark === null) {
      benchmark = primary;
    }

    const baseOpts = { baseline: o.baseline, indexBase: o.indexBase, from };
    const baseline = Align.baseline(aligned, o.baseline, { from });
    warnings.push(...baseline.warnings);
    const columns = {};

    if (this._needsBenchmark()) {
      const relMode = this.mode === "relative" ? "spread" : "ratio";
      aligned.names.forEach((n) => {
        const r = Align.relative(aligned, n, benchmark, {
          ...baseOpts,
          mode: relMode,
          rebaseRatio: o.rebaseRatio,
        });
        columns[n] = r ? r.values : aligned.columns[n].map(() => null);
      });
    } else {
      const reb = Align.rebase(aligned, { ...baseOpts, mode: this.mode });
      Object.assign(columns, reb.columns);
      warnings.push(...reb.warnings);
    }

    // Observed points per instrument: the grid indices this instrument really
    // has a value at, excluding anything carried forward. These drive both the
    // rendered line and the per-instrument statistics, so a held value never
    // becomes a plotted point or a fabricated return.
    const resample = o.resample == null ? o.join === "primary" : o.resample;
    const obs = {};
    const plot = {};
    aligned.names.forEach((n) => {
      const vals = aligned.columns[n] || [];
      const filledAt =
        (aligned.coverage[n] && aligned.coverage[n].filledAt) || new Set();
      const list = [];
      const plotted = [];
      for (let i = 0; i < vals.length; i++) {
        if (vals[i] == null) continue;
        const held = filledAt.has(i);
        if (!held) list.push({ i, x: aligned.x[i], v: vals[i] });
        if (resample || !held) plotted.push({ i, x: aligned.x[i] });
      }
      obs[n] = list;
      plot[n] = plotted;
      if (!plotted.length && (aligned.coverage[n] || {}).bars > 0) {
        warnings.push(
          `comparison: "${n}" has no observation on the shared grid, so nothing is plotted. Try \`join: "union"\` or \`resample: true\`.`
        );
      }
    });

    this._derived = {
      primary,
      benchmark,
      aligned,
      baseline,
      columns,
      plot,
      obs,
      // The baseline is resolved twice (here and inside rebase/relative), so the
      // same assumption can be reported twice. Consumers see it once.
      warnings: Array.from(new Set(warnings)),
    };
    this._derivedKey = key;
    return this._derived;
  }

  /** The visible window's left edge, for `baseline: "visible"`. @private */
  _resolveVisibleFrom() {
    if (Number.isFinite(this._visibleFrom)) return this._visibleFrom;
    const range =
      this.ctx && this.ctx.getVisibleRange && this.ctx.getVisibleRange();
    return range && Number.isFinite(range.min) ? range.min : undefined;
  }

  /* ------------------------------------------------------------------ *
   * Statistics
   * ------------------------------------------------------------------ */

  /**
   * Per-instrument performance rows for the current mode and baseline: the
   * leaderboard, already computed, so a consumer never has to recompute it.
   *
   * The window runs from the baseline to the last observation, so with
   * `baseline: "visible"` the rows follow the zoom. Pass `from`/`to` as x values
   * to scope it explicitly instead.
   *
   * Every row is derived from `source` (close by default) for *every*
   * instrument, primary included, so the rows are comparable with each other.
   * {@link ApexStock#getRangeStats} is the OHLC-aware path for the primary.
   *
   * @param {{from?:number|Date|string, to?:number|Date|string}} [opts]
   * @returns {import("../types.js").ComparisonRow[]} empty when no instrument is added.
   */
  getStats(opts = {}) {
    const d = this._derive();
    if (!d) return [];

    const grid = d.aligned.x;
    const lo = this._gridIndex(grid, opts.from, 0, "forward");
    const hi = this._gridIndex(grid, opts.to, grid.length - 1, "back");
    const rows = [];

    d.aligned.names.forEach((name) => {
      const bIdx = d.baseline.perInstrument[name];
      const start = Math.max(lo, bIdx == null ? lo : bIdx);
      const points = d.obs[name].filter((p) => p.i >= start && p.i <= hi);
      const cov = d.aligned.coverage[name] || { bars: 0, filled: 0 };
      const item = this.items[name];
      const row = {
        name,
        color: item ? item.color : null,
        primary: name === d.primary,
        benchmark: name === d.benchmark,
        from: null,
        to: null,
        start: null,
        end: null,
        change: { absolute: null, percent: null },
        relative: null,
        high: null,
        low: null,
        volatility: null,
        drawdown: null,
        bars: points.length,
        coverage: {
          bars: cov.bars,
          filled: cov.filled,
          firstX: cov.firstIndex >= 0 ? grid[cov.firstIndex] : null,
          lastX: cov.lastIndex >= 0 ? grid[cov.lastIndex] : null,
        },
        rank: 0,
      };

      if (points.length) {
        const first = points[0];
        const last = points[points.length - 1];
        row.from = first.x;
        row.to = last.x;
        row.start = first.v;
        row.end = last.v;
        row.change.absolute = last.v - first.v;
        if (first.v !== 0) {
          row.change.percent = (last.v / first.v - 1) * 100;
        }
        let high = points[0];
        let low = points[0];
        points.forEach((p) => {
          if (p.v > high.v) high = p;
          if (p.v < low.v) low = p;
        });
        row.high = { value: high.v, x: high.x };
        row.low = { value: low.v, x: low.x };

        // Volatility and drawdown run on this instrument's OWN observations, so
        // the bar-spacing convention and the returns are its own and not the
        // shared grid's (a weekly line on a daily grid must not be annualized
        // as if it had 252 bars a year).
        const bars = points.map((p) => ({ x: p.x, y: [p.v, p.v, p.v, p.v] }));
        row.volatility = Statistics.volatility(
          bars,
          0,
          bars.length - 1,
          this.ctx && this.ctx._analysisOpts ? this.ctx._analysisOpts() : {}
        );
        const worst = Drawdown.worst(bars, 0, bars.length - 1, {
          basis: "close",
        });
        if (worst) {
          row.drawdown = {
            max: worst.max,
            barsToTrough: worst.barsToTrough,
            barsToRecovery: worst.barsToRecovery,
            barsUnderwater: worst.barsUnderwater,
            recovered: !worst.ongoing,
          };
        }
      }
      rows.push(row);
    });

    // Excess return in percentage points, against whichever instrument fills
    // the benchmark role over the same window.
    const bench = rows.find((r) => r.name === d.benchmark);
    if (bench && bench.change.percent != null) {
      rows.forEach((r) => {
        if (r.change.percent != null) {
          r.relative = r.change.percent - bench.change.percent;
        }
      });
    }

    // Rank by performance, best first. Rows with no percent change sort last.
    const ranked = rows
      .filter((r) => r.change.percent != null)
      .sort((a, b) => b.change.percent - a.change.percent);
    ranked.forEach((r, i) => {
      r.rank = i + 1;
    });
    return rows;
  }

  /**
   * Resolve an x value (timestamp, Date, or parseable string) to a grid index.
   * An endpoint between two bars resolves inward, so a window never claims data
   * outside what was asked for: `from` snaps forward to the next bar, `to` snaps
   * back to the previous one.
   * @param {number[]} grid
   * @param {*} ref
   * @param {number} fallback - Used when `ref` is absent or unparseable.
   * @param {"forward"|"back"} dir
   * @returns {number}
   * @private
   */
  _gridIndex(grid, ref, fallback, dir) {
    if (ref == null || !grid.length) return fallback;
    const x = Align.toAxisX(ref);
    if (x === null) return fallback;
    if (x <= grid[0]) return 0;
    if (x >= grid[grid.length - 1]) return grid.length - 1;
    // x is strictly inside the grid here, so findIndex always lands.
    const idx = grid.findIndex((gx) => gx >= x);
    return dir === "back" && grid[idx] > x ? idx - 1 : idx;
  }

  /* ------------------------------------------------------------------ *
   * Rendering
   * ------------------------------------------------------------------ */

  /** Compute a comparison line's points for the current mode. @private */
  _line(item) {
    const d = this._derive();
    if (!d) return [];
    const vals = d.columns[item.name] || [];
    const raw = this.mode === "absolute";
    return (d.plot[item.name] || []).map((p) => ({
      x: p.x,
      // Derived values are display values, truncated like the indicator math;
      // absolute values are prices and stay as given.
      y: raw ? vals[p.i] : Utils.truncateNumber(vals[p.i]),
    }));
  }

  /** Axis title + label formatter for the current mode. @private */
  _axisMeta() {
    const base = this.options.indexBase;
    switch (this.mode) {
      case "absolute":
        return { title: "price", fmt: (v) => Number(v).toFixed(2) };
      case "indexed":
        return { title: `index (${base})`, fmt: (v) => Number(v).toFixed(1) };
      case "relative":
        return { title: "excess %", fmt: (v) => `${Number(v).toFixed(1)}%` };
      case "ratio":
        return { title: `ratio (${base})`, fmt: (v) => Number(v).toFixed(1) };
      default:
        return { title: "Δ %", fmt: (v) => `${Number(v).toFixed(1)}%` };
    }
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
    const meta = this._axisMeta();
    return {
      opposite: false,
      seriesName: names,
      labels: {
        style: { colors: dark ? "#9aa4b2" : "#667085" },
        formatter: meta.fmt,
      },
      title: {
        text: meta.title,
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
    this._rebasing = true;
    try {
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
    } finally {
      this._rebasing = false;
    }
  }

  /* ------------------------------------------------------------------ *
   * Visible-window baseline
   * ------------------------------------------------------------------ */

  /**
   * Subscribe to `rangeChange` only while `baseline: "visible"` is in effect and
   * something is actually plotted. The subscription is deliberately conditional:
   * ApexStock skips emitting `rangeChange` entirely when nothing listens, and a
   * baseline that does not follow the zoom has no reason to pay for it.
   * @private
   */
  _bindRange() {
    const want = this.options.baseline === "visible" && this.isActive();
    if (want === !!this._rangeUnsub) return;
    if (!want) return this._unbindRange();
    if (!this.ctx || typeof this.ctx.on !== "function") return;
    this._rangeUnsub = this.ctx.on("rangeChange", (p) =>
      this._onRangeChange(p)
    );
  }

  /** @private */
  _unbindRange() {
    if (!this._rangeUnsub) return;
    this._rangeUnsub();
    this._rangeUnsub = null;
    this._visibleFrom = null;
  }

  /**
   * Rebase to the new left edge. Echoes are suppressed the same two ways
   * ChartSync documents: a re-entrancy flag for the synchronous case, and value
   * comparison for the asynchronous one (ApexCharts emits `zoomed`/`scrolled`
   * out of band, so the flag alone would not be enough).
   * @param {{min:number}} payload
   * @private
   */
  _onRangeChange(payload) {
    if (this._rebasing || !payload) return;
    const min = payload.min;
    if (!Number.isFinite(min) || min === this._visibleFrom) return;
    this._visibleFrom = min;
    this._derived = null;
    this._derivedKey = "";
    this.reapply();
    this._emitChange("visible");
  }

  /* ------------------------------------------------------------------ *
   * State
   * ------------------------------------------------------------------ */

  /**
   * JSON snapshot for state serialization, or null when comparison was never
   * configured (a null in state means "no comparison").
   *
   * **Instrument data is deliberately not captured.** It is supplied by the
   * consumer, runs to thousands of bars per instrument, and would be stale the
   * moment it was written. What state carries is each instrument's *identity*
   * and styling, plus the mode, benchmark, and alignment policy;
   * {@link _restore} then reports which instruments need their data supplied
   * again. Same division of labour as the price lines' interactive callbacks,
   * which are also re-bound by the consumer after a restore.
   *
   * @returns {import("../types.js").ComparisonState|null}
   */
  _serialize() {
    const names = Object.keys(this.items);
    const configured =
      names.length > 0 ||
      this.mode !== DEFAULT_MODE ||
      this.benchmark !== PRIMARY ||
      JSON.stringify(this.options) !== JSON.stringify(DEFAULTS);
    if (!configured) return null;
    return {
      mode: this.mode,
      benchmark: this.benchmark,
      options: { ...this.options },
      instruments: names.map((n) => ({ name: n, color: this.items[n].color })),
    };
  }

  /**
   * Restore from a snapshot. Replace-the-set semantics, with one concession to
   * the data contract: an instrument whose data is **already loaded** is kept
   * (re-ordered and re-colored to match the state) rather than dropped and
   * demanded back, so an in-app save/restore costs no round trip. Whatever is
   * left over is reported through `comparisonRestoreNeeded` with the names the
   * consumer has to re-supply, and remembered by color for when they do.
   *
   * A null snapshot means "no comparison": everything is dropped and the
   * options return to their defaults.
   *
   * @param {import("../types.js").ComparisonState|null} state
   * @returns {void}
   */
  _restore(state) {
    const wasActive = this.isActive();
    this._visibleFrom = null;

    if (!state || typeof state !== "object") {
      this.mode = DEFAULT_MODE;
      this.benchmark = PRIMARY;
      this.options = { ...DEFAULTS };
      this._restoredColors = {};
      this.items = {};
      this._invalidate();
      this._unbindRange();
      // Only repaint if something was actually live; a null-to-null restore is
      // a no-op, not a re-render.
      if (wasActive) this.reapply();
      return;
    }

    if (MODES.indexOf(state.mode) !== -1) this.mode = state.mode;
    if (state.benchmark != null) this.benchmark = String(state.benchmark);
    this.options = Comparison._normalizeOptions(DEFAULTS, state.options || {});

    const wanted = Array.isArray(state.instruments) ? state.instruments : [];
    const kept = {};
    const missing = [];
    this._restoredColors = {};
    wanted.forEach((entry) => {
      const name = entry && entry.name != null ? String(entry.name) : "";
      if (!name) return;
      const color = entry.color || null;
      if (color) this._restoredColors[name] = color;
      const live = this.items[name];
      if (live) {
        kept[name] = { ...live, color: color || live.color };
      } else {
        missing.push(name);
      }
    });
    this.items = kept;

    this._invalidate();
    this._bindRange();
    if (wasActive || this.isActive()) this.reapply();
    this._emitChange("restore");
    if (missing.length) {
      this._emit("comparisonRestoreNeeded", { names: missing });
    }
  }

  /* ------------------------------------------------------------------ *
   * Events
   * ------------------------------------------------------------------ */

  /**
   * Emit on the ApexStock bus, if there is one.
   * @param {string} name
   * @param {*} payload
   * @private
   */
  _emit(name, payload) {
    if (this.ctx && this.ctx._emitter) this.ctx._emitter.emit(name, payload);
  }

  /**
   * Emit `comparisonChange` with the fresh leaderboard attached. Skipped
   * entirely when nothing is subscribed, because building the rows is real work
   * (the `_emitPointerEvent` precedent).
   * @param {import("../types.js").ComparisonChangeEvent["reason"]} reason
   * @private
   */
  _emitChange(reason) {
    const emitter = this.ctx && this.ctx._emitter;
    if (!emitter || emitter.listenerCount("comparisonChange") === 0) return;
    const d = this._derive();
    emitter.emit("comparisonChange", {
      reason,
      mode: this.mode,
      benchmark: this.benchmark,
      baseline: d ? d.baseline.policy : this.options.baseline,
      instruments: Object.keys(this.items),
      stats: this.getStats(),
      warnings: d ? d.warnings.slice() : [],
    });
  }

  /** Remove all comparison series + restore the single axis, and drop state. */
  destroy() {
    this._unbindRange();
    this.items = {};
    this._restoredColors = {};
    this._invalidate();
    if (this._rendered.size && this.ctx.chart) {
      // Leave series cleanup to the chart teardown; just drop our state.
    }
    this._rendered = new Set();
  }
}
