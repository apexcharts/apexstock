/**
 * DataReadout — a read-only snapshot of the chart's values at a data-point
 * index: OHLC, volume, change-vs-previous, and every active indicator's value
 * (main-chart overlays AND oscillator panes). It is the programmatic complement
 * to the on-chart {@link Legend} and the `crosshairMove` event: the event tells
 * you *which* bar the pointer is over (its `dataPointIndex`), and this turns an
 * index into structured data a consumer can render in their own legend, side
 * panel, or tooltip.
 *
 * Everything is read defensively from the live chart state and returned as plain
 * numbers (no formatting, no rounding) so the values are faithful; the consumer
 * formats. Values that are unavailable come back `null` (volume, change) or are
 * simply omitted (an indicator with no value at that index, e.g. during its
 * warm-up period).
 *
 * @typedef {Object} ReadoutIndicator
 * @property {string} name - Series name (e.g. "MA 20", "RSI").
 * @property {number} value - The indicator's value at the index.
 * @property {string|null} color - The series color, if known.
 * @property {"main"|string} pane - "main" for overlays, else the oscillator key.
 * @property {string} [key] - The oscillator's indicator key (pane readouts only).
 *
 * @typedef {Object} Readout
 * @property {number} index - The resolved data-point index.
 * @property {number|null} x - The bar's x (timestamp in ms), or null.
 * @property {{open:number, high:number, low:number, close:number}} ohlc
 * @property {number|null} volume
 * @property {{absolute:number, percent:number}|null} change - vs the previous close.
 * @property {ReadoutIndicator[]} indicators
 *
 * @typedef {Object} ReadoutColumn
 * @property {string} name - Series name, used as the export column header.
 * @property {"main"|string} pane - "main" for overlays, else the oscillator key.
 * @property {string} [key] - The oscillator's indicator key (pane columns only).
 * @property {Array<number|null>} values - One entry per bar, null where the
 *   indicator has no value (its warm-up period).
 */

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
};

const seriesColor = (g, i) =>
  (Array.isArray(g.colors) && g.colors[i]) || null;

export default class DataReadout {
  /**
   * Snapshot the chart at a data-point index.
   * @param {import("../ApexStock.js").default} ctx
   * @param {number} [index] - Defaults to (and is clamped to) the latest bar.
   * @returns {Readout|null} null if there is no series data.
   */
  static at(ctx, index) {
    const s = Array.isArray(ctx && ctx.series) ? ctx.series : [];
    if (!s.length) return null;

    let idx = Number.isInteger(index) ? index : s.length - 1;
    if (idx < 0) idx = 0;
    if (idx >= s.length) idx = s.length - 1;

    const bar = s[idx] || {};
    const y = Array.isArray(bar.y) ? bar.y : [];
    const ohlc = {
      open: num(y[0]),
      high: num(y[1]),
      low: num(y[2]),
      close: num(y[3]),
    };

    const volume =
      bar.v != null && Number.isFinite(Number(bar.v)) ? Number(bar.v) : null;

    let change = null;
    const prev = s[idx - 1];
    const prevClose = prev && Array.isArray(prev.y) ? num(prev.y[3]) : NaN;
    if (Number.isFinite(ohlc.close) && Number.isFinite(prevClose) && prevClose !== 0) {
      const d = ohlc.close - prevClose;
      change = { absolute: d, percent: (d / prevClose) * 100 };
    }

    return {
      index: idx,
      x: bar.x != null ? bar.x : null,
      ohlc,
      volume,
      change,
      indicators: DataReadout._indicators(ctx, idx),
    };
  }

  /**
   * Every active indicator as a whole column, for a data export: one entry per
   * bar, null through the warm-up period.
   *
   * Deliberately a separate traversal from {@link _indicators}, which answers a
   * different question with a different contract: that one is called per pointer
   * move and *omits* an indicator with no value at the index, this one is called
   * once per export and *null-pads* so the columns stay aligned to the bars.
   *
   * @param {import("../ApexStock.js").default} ctx
   * @param {number} [length] - Bars to cover; defaults to the series length.
   * @returns {ReadoutColumn[]}
   */
  static columns(ctx, length) {
    const s = Array.isArray(ctx && ctx.series) ? ctx.series : [];
    const len = Number.isInteger(length) && length >= 0 ? length : s.length;
    const out = [];

    const push = (g, i, pane, key) => {
      const arr = g.series[i];
      if (!Array.isArray(arr)) return;
      const values = new Array(len).fill(null);
      let any = false;
      for (let j = 0; j < len; j++) {
        if (arr[j] == null) continue;
        const v = num(arr[j]);
        if (!Number.isFinite(v)) continue;
        values[j] = v;
        any = true;
      }
      if (!any) return;
      const col = { name: String(g.seriesNames[i] || key || ""), pane, values };
      if (key) col.key = key;
      out.push(col);
    };

    // Main-chart overlays: extra line series at index >= 1.
    try {
      const g = ctx.chart && ctx.chart.w && ctx.chart.w.globals;
      if (g && Array.isArray(g.seriesNames) && Array.isArray(g.series)) {
        for (let i = 1; i < g.seriesNames.length; i++) push(g, i, "main");
      }
    } catch {
      /* main globals shifted; the OHLC columns still export */
    }

    // Oscillator panes: one ApexCharts instance each in indicatorChartMap.
    try {
      const map = ctx.indicatorChartMap || {};
      Object.keys(map).forEach((key) => {
        const pane = map[key];
        const g = pane && pane.w && pane.w.globals;
        if (!g || !Array.isArray(g.series) || !Array.isArray(g.seriesNames)) {
          return;
        }
        for (let i = 0; i < g.seriesNames.length; i++) push(g, i, key, key);
      });
    } catch {
      /* pane internals shifted; overlays still returned */
    }

    return out;
  }

  /** Overlay (main-chart) + oscillator-pane indicator values at `idx`. */
  static _indicators(ctx, idx) {
    const out = [];

    // Main-chart overlays: extra line series at index >= 1.
    try {
      const g = ctx.chart && ctx.chart.w && ctx.chart.w.globals;
      if (g && Array.isArray(g.seriesNames) && Array.isArray(g.series)) {
        for (let i = 1; i < g.seriesNames.length; i++) {
          const arr = g.series[i];
          if (!Array.isArray(arr) || arr[idx] == null) continue;
          const v = num(arr[idx]);
          if (!Number.isFinite(v)) continue;
          out.push({
            name: String(g.seriesNames[i] || ""),
            value: v,
            color: seriesColor(g, i),
            pane: "main",
          });
        }
      }
    } catch {
      /* main globals shifted; OHLC still returns */
    }

    // Oscillator panes: each active oscillator is its own ApexCharts instance in
    // indicatorChartMap (overlay entries are not charts and have no `.w`).
    try {
      const map = ctx.indicatorChartMap || {};
      Object.keys(map).forEach((key) => {
        const pane = map[key];
        const g = pane && pane.w && pane.w.globals;
        if (!g || !Array.isArray(g.series) || !Array.isArray(g.seriesNames)) return;
        for (let i = 0; i < g.seriesNames.length; i++) {
          const arr = g.series[i];
          if (!Array.isArray(arr) || arr[idx] == null) continue;
          const v = num(arr[idx]);
          if (!Number.isFinite(v)) continue;
          out.push({
            key,
            name: String(g.seriesNames[i] || key),
            value: v,
            color: seriesColor(g, i),
            pane: key,
          });
        }
      });
    } catch {
      /* pane internals shifted; overlays still returned */
    }

    return out;
  }
}
