export default class DataExport {
    /** ISO-8601 for numeric timestamps; pass-through for anything else. */
    static _formatTime(x: any, raw: any): any;
    /** Flatten the OHLC points into row objects keyed by {@link COLUMNS}. */
    static _rows(series: any, options: any): {
        time: any;
        open: any;
        high: any;
        low: any;
        close: any;
        volume: any;
    }[];
    /** Whether a volume column should be emitted for these rows. */
    static _wantsVolume(rows: any, options: any): any;
    /**
     * @param {import("../../types.js").Series} series
     * @param {{includeVolume?:boolean, raw?:boolean}} [options]
     * @returns {string} CSV text (header + one row per point).
     */
    static toCSV(series: import("../../types.js").Series, options?: {
        includeVolume?: boolean;
        raw?: boolean;
    }): string;
    /**
     * @param {import("../../types.js").Series} series
     * @param {{includeVolume?:boolean, raw?:boolean, pretty?:boolean}} [options]
     * @returns {string} JSON text: an array of `{time,open,high,low,close[,volume]}`.
     */
    static toJSON(series: import("../../types.js").Series, options?: {
        includeVolume?: boolean;
        raw?: boolean;
        pretty?: boolean;
    }): string;
}
