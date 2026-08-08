/**
 * Serialize an OHLC series (`{ x, y:[open,high,low,close], v? }`) to CSV or JSON
 * text for "download data" / reporting features. Pure and DOM-free so it is
 * trivially testable and reusable; the ApexStock instance handles range
 * selection and the actual file download.
 *
 * Columns are `time, open, high, low, close[, volume]`. `time` is emitted as an
 * ISO-8601 string when `x` is a numeric timestamp (pass `{ raw: true }` to keep
 * the original numeric value), and verbatim otherwise (e.g. category labels).
 * The `volume` column is included when any point carries a `v` (suppress with
 * `{ includeVolume: false }`). CSV output round-trips through
 * {@link DataAdapter.fromCSV}.
 */
const COLUMNS = ["time", "open", "high", "low", "close", "volume"];

export default class DataExport {
  /** ISO-8601 for numeric timestamps; pass-through for anything else. */
  static _formatTime(x, raw) {
    if (raw) return x;
    if (typeof x === "number") {
      const d = new Date(x);
      return Number.isNaN(d.getTime()) ? x : d.toISOString();
    }
    return x;
  }

  /** Flatten the OHLC points into row objects keyed by {@link COLUMNS}. */
  static _rows(series, options) {
    const raw = !!(options && options.raw);
    return (Array.isArray(series) ? series : []).map((p) => {
      const y = p && Array.isArray(p.y) ? p.y : [];
      return {
        time: DataExport._formatTime(p ? p.x : undefined, raw),
        open: y[0],
        high: y[1],
        low: y[2],
        close: y[3],
        volume: p ? p.v : undefined,
      };
    });
  }

  /** Whether a volume column should be emitted for these rows. */
  static _wantsVolume(rows, options) {
    if (options && options.includeVolume === false) return false;
    if (options && options.includeVolume === true) return true;
    return rows.some((r) => r.volume != null);
  }

  /**
   * @param {import("../../types.js").Series} series
   * @param {{includeVolume?:boolean, raw?:boolean}} [options]
   * @returns {string} CSV text (header + one row per point).
   */
  static toCSV(series, options = {}) {
    const rows = DataExport._rows(series, options);
    const cols = DataExport._wantsVolume(rows, options)
      ? COLUMNS
      : COLUMNS.slice(0, 5);
    const esc = (v) => {
      if (v == null) return "";
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = cols.join(",");
    const lines = rows.map((r) => cols.map((c) => esc(r[c])).join(","));
    return [header, ...lines].join("\n");
  }

  /**
   * @param {import("../../types.js").Series} series
   * @param {{includeVolume?:boolean, raw?:boolean, pretty?:boolean}} [options]
   * @returns {string} JSON text: an array of `{time,open,high,low,close[,volume]}`.
   */
  static toJSON(series, options = {}) {
    const rows = DataExport._rows(series, options);
    const withVolume = DataExport._wantsVolume(rows, options);
    const clean = rows.map((r) => {
      const o = {
        time: r.time,
        open: r.open,
        high: r.high,
        low: r.low,
        close: r.close,
      };
      if (withVolume) o.volume = r.volume == null ? null : r.volume;
      return o;
    });
    return JSON.stringify(clean, null, options.pretty === false ? 0 : 2);
  }
}
