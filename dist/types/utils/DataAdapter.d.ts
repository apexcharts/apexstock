export default class DataAdapter {
    /**
     * Coerce an x value to a timestamp (ms). Numbers pass through; numeric
     * strings parse as numbers; everything else is handed to `Date`. Returns
     * `NaN` for unparseable input so the caller can drop the row.
     * @param {*} v
     * @returns {number}
     */
    static _toX(v: any): number;
    /** Coerce a numeric cell (handles numeric strings, blanks -> NaN). */
    static _toNum(v: any): number;
    /**
     * Given a row's own key list and a caller mapping, resolve which source key
     * (or index) supplies each OHLC field. Caller mapping wins; otherwise the
     * first case-insensitive alias present on the row is used.
     * @param {string[]|number} keys - Object keys, or a count for tuple rows.
     * @param {Object.<string,string|number>} [mapping]
     * @returns {Object.<string,string|number|undefined>}
     */
    static _resolve(keys: string[] | number, mapping?: {
        [x: string]: string | number;
    }): {
        [x: string]: string | number;
    };
    /** Read a field off a row that may be an object or an array/tuple. */
    static _pick(row: any, key: any): any;
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
    static normalize(rows: Array<any | any[]>, mapping?: {
        [x: string]: string | number;
    }): import("../types.js").Series;
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
    static fromArrays(columns: {
        [x: string]: any[];
    }): import("../types.js").Series;
    /**
     * Split one CSV line into fields, honoring double-quoted values that may
     * contain the delimiter or escaped quotes (`""`).
     * @param {string} line
     * @param {string} delimiter
     * @returns {string[]}
     */
    static _splitLine(line: string, delimiter: string): string[];
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
    static fromCSV(text: string, options?: {
        delimiter?: string;
        header?: boolean;
        mapping?: {
            [x: string]: string | number;
        };
    }): import("../types.js").Series;
}
