import Utils from "./Utils";

/**
 * Data adapters that turn common real-world shapes (parallel column arrays, CSV
 * text, arrays of plain objects/tuples) into the ApexStock OHLC point shape
 * `{ x, y: [open, high, low, close], v? }`.
 *
 * The `{ x, y: [o, h, l, c] }` shape is the #1 onboarding surprise, so these
 * helpers exist to skip the hand-mapping. All three funnel through
 * {@link DataAdapter.normalize} and reuse {@link Utils.normalizeOHLC}, so the
 * output is already validated, finite, and time-sorted, ready to pass straight
 * to `new ApexStock(el, { series: [{ data }] })` or `update({ series })`.
 *
 * Field resolution is alias-based and case-insensitive: `x` matches
 * `x/t/time/timestamp/date/datetime`, `open` matches `open/o`, and so on. Pass
 * an explicit `mapping` to override when your source uses different names or
 * (for headerless data) column indices.
 */
const ALIASES = {
  x: ["x", "t", "time", "timestamp", "date", "datetime"],
  open: ["open", "o"],
  high: ["high", "h"],
  low: ["low", "l"],
  close: ["close", "c", "price", "last"],
  volume: ["volume", "vol", "v"],
};

const FIELDS = ["x", "open", "high", "low", "close", "volume"];

export default class DataAdapter {
  /**
   * Coerce an x value to a timestamp (ms). Numbers pass through; numeric
   * strings parse as numbers; everything else is handed to `Date`. Returns
   * `NaN` for unparseable input so the caller can drop the row.
   * @param {*} v
   * @returns {number}
   */
  static _toX(v) {
    if (typeof v === "number") return v;
    if (v instanceof Date) return v.getTime();
    if (typeof v === "string") {
      const s = v.trim();
      if (s !== "" && !Number.isNaN(Number(s))) return Number(s);
      const t = new Date(s).getTime();
      return t;
    }
    return NaN;
  }

  /** Coerce a numeric cell (handles numeric strings, blanks -> NaN). */
  static _toNum(v) {
    if (typeof v === "number") return v;
    if (typeof v === "string") {
      const s = v.trim();
      return s === "" ? NaN : Number(s);
    }
    return NaN;
  }

  /**
   * Given a row's own key list and a caller mapping, resolve which source key
   * (or index) supplies each OHLC field. Caller mapping wins; otherwise the
   * first case-insensitive alias present on the row is used.
   * @param {string[]|number} keys - Object keys, or a count for tuple rows.
   * @param {Object.<string,string|number>} [mapping]
   * @returns {Object.<string,string|number|undefined>}
   */
  static _resolve(keys, mapping) {
    const isTuple = typeof keys === "number";
    const lower = isTuple ? null : keys.map((k) => String(k).toLowerCase());
    const out = {};
    for (const field of FIELDS) {
      if (mapping && mapping[field] != null) {
        out[field] = mapping[field];
        continue;
      }
      if (isTuple) continue; // tuples need explicit/positional mapping
      for (const alias of ALIASES[field]) {
        const idx = lower.indexOf(alias);
        if (idx !== -1) {
          out[field] = keys[idx];
          break;
        }
      }
    }
    return out;
  }

  /** Read a field off a row that may be an object or an array/tuple. */
  static _pick(row, key) {
    if (key == null) return undefined;
    return Array.isArray(row) ? row[key] : row[key];
  }

  /**
   * Turn an array of plain objects or tuples into an OHLC series.
   *
   * @param {Array<Object|Array>} rows - e.g. `[{ date, open, high, low, close, volume }]`
   *   or tuples `[[t, o, h, l, c, v]]` (tuples require a `mapping` of indices,
   *   or default positional order `x, open, high, low, close, volume`).
   * @param {Object.<string,string|number>} [mapping] - Override field -> source
   *   key/index (e.g. `{ x: "Date", close: "Adj Close" }`).
   * @returns {import("../types.js").Series} Validated, time-sorted OHLC points.
   */
  static normalize(rows, mapping) {
    if (!Array.isArray(rows) || rows.length === 0) {
      Utils.warn("DataAdapter.normalize: expected a non-empty array of rows.");
      return [];
    }

    const first = rows[0];
    const tuples = Array.isArray(first);
    let resolved;
    if (tuples) {
      // Default positional order for headerless tuples.
      const positional = { x: 0, open: 1, high: 2, low: 3, close: 4, volume: 5 };
      resolved = DataAdapter._resolve(first.length, {
        ...positional,
        ...(mapping || {}),
      });
    } else {
      resolved = DataAdapter._resolve(Object.keys(first), mapping);
    }

    if (resolved.close == null) {
      Utils.warn(
        "DataAdapter.normalize: could not find a `close` column. Pass a `mapping` (e.g. { close: 'Close' })."
      );
      return [];
    }

    const points = rows.map((row) => {
      const close = DataAdapter._toNum(DataAdapter._pick(row, resolved.close));
      const open =
        resolved.open != null
          ? DataAdapter._toNum(DataAdapter._pick(row, resolved.open))
          : close;
      const high =
        resolved.high != null
          ? DataAdapter._toNum(DataAdapter._pick(row, resolved.high))
          : Math.max(open, close);
      const low =
        resolved.low != null
          ? DataAdapter._toNum(DataAdapter._pick(row, resolved.low))
          : Math.min(open, close);
      const point = {
        x: DataAdapter._toX(DataAdapter._pick(row, resolved.x)),
        y: [open, high, low, close],
      };
      if (resolved.volume != null) {
        const v = DataAdapter._toNum(DataAdapter._pick(row, resolved.volume));
        if (Number.isFinite(v)) point.v = v;
      }
      return point;
    });

    return Utils.normalizeOHLC(points);
  }

  /**
   * Zip parallel column arrays into an OHLC series. Only `close` is required;
   * missing `open`/`high`/`low` are derived from it (a close-only line becomes a
   * flat candle). Column keys are alias-resolved (`t/time/date` for x, `o` for
   * open, ...), so `{ t, o, h, l, c, v }` and `{ x, open, high, low, close }`
   * both work.
   *
   * @param {Object.<string, Array>} columns - e.g.
   *   `{ x: [...], open: [...], high: [...], low: [...], close: [...], volume: [...] }`.
   * @returns {import("../types.js").Series} Validated, time-sorted OHLC points.
   */
  static fromArrays(columns) {
    if (!Utils.isObject(columns)) {
      Utils.warn("DataAdapter.fromArrays: expected an object of column arrays.");
      return [];
    }
    const keys = Object.keys(columns);
    const resolved = DataAdapter._resolve(keys, undefined);
    const closeCol = resolved.close != null ? columns[resolved.close] : null;
    if (!Array.isArray(closeCol)) {
      Utils.warn(
        "DataAdapter.fromArrays: a `close` (or `c`) column array is required."
      );
      return [];
    }
    const xCol = resolved.x != null ? columns[resolved.x] : null;
    const rows = closeCol.map((_, i) => {
      const row = {};
      for (const field of FIELDS) {
        const col = resolved[field] != null ? columns[resolved[field]] : null;
        if (Array.isArray(col)) row[field] = col[i];
      }
      if (!xCol) row.x = i; // fall back to positional index when no x column
      return row;
    });
    // Rows use canonical field names, which are themselves aliases, so plain
    // alias resolution picks up exactly the columns that were supplied.
    return DataAdapter.normalize(rows);
  }

  /**
   * Split one CSV line into fields, honoring double-quoted values that may
   * contain the delimiter or escaped quotes (`""`).
   * @param {string} line
   * @param {string} delimiter
   * @returns {string[]}
   */
  static _splitLine(line, delimiter) {
    const out = [];
    let cur = "";
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (quoted) {
        if (ch === '"') {
          if (line[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            quoted = false;
          }
        } else {
          cur += ch;
        }
      } else if (ch === '"') {
        quoted = true;
      } else if (ch === delimiter) {
        out.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out;
  }

  /**
   * Parse CSV text into an OHLC series. A header row is used by default to
   * alias-resolve columns; set `header: false` for headerless data (columns are
   * then positional or driven by an index `mapping`).
   *
   * @param {string} text - Raw CSV.
   * @param {Object} [options]
   * @param {string} [options.delimiter=","] - Field delimiter.
   * @param {boolean} [options.header=true] - Whether the first row is headers.
   * @param {Object.<string,string|number>} [options.mapping] - Override
   *   field -> header name (with a header row) or column index (headerless).
   * @returns {import("../types.js").Series} Validated, time-sorted OHLC points.
   */
  static fromCSV(text, options = {}) {
    if (typeof text !== "string" || text.trim() === "") {
      Utils.warn("DataAdapter.fromCSV: expected a non-empty CSV string.");
      return [];
    }
    const delimiter = options.delimiter || ",";
    const header = options.header !== false;
    const lines = text
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .split("\n")
      .filter((l) => l.trim() !== "");
    if (!lines.length) return [];

    if (header) {
      const cols = DataAdapter._splitLine(lines[0], delimiter).map((h) =>
        h.trim()
      );
      const rows = lines.slice(1).map((line) => {
        const cells = DataAdapter._splitLine(line, delimiter);
        const obj = {};
        cols.forEach((c, i) => {
          obj[c] = cells[i];
        });
        return obj;
      });
      return DataAdapter.normalize(rows, options.mapping);
    }

    const rows = lines.map((line) => DataAdapter._splitLine(line, delimiter));
    return DataAdapter.normalize(rows, options.mapping);
  }
}
