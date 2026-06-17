/**
 * Roll fine-grained OHLC candles up into a coarser time frame (e.g. 1m → 5m,
 * 1h → 1d). Consecutive candles falling in the same time bucket are merged:
 * open = first candle's open, high = max high, low = min low, close = last
 * candle's close, and volume (`v`) = sum (only when the input carries volume).
 *
 * The input is expected to be sorted ascending by time (the normal contract for
 * a time series); aggregation is a single streaming pass. The output `x` is the
 * bucket-start timestamp (ms, UTC-aligned).
 *
 * @param {import("../types.js").Series} series - OHLC points; each `x` may be a
 *   timestamp (ms), a `Date`, or a parseable date string; `y` = [open, high, low, close].
 * @param {string} interval - one of {@link INTERVALS}.
 * @returns {import("../types.js").Series} Aggregated candles (a new array; inputs are not mutated).
 */
export function aggregateOHLC(series: import("../types.js").Series, interval: string): import("../types.js").Series;
/**
 * Fixed-width time-frame intervals, in milliseconds. These bucket on epoch
 * (i.e. UTC) boundaries — `1d` aligns to UTC midnight, `4h` to 00/04/08/… UTC.
 * `1w` (UTC week, Monday-anchored) and `1M` (calendar month) are variable
 * width and handled separately in {@link bucketStart}.
 * @type {Object.<string, number>}
 */
export const INTERVAL_MS: {
    [x: string]: number;
};
/** All accepted interval keys (fixed-width plus the calendar ones). */
export const INTERVALS: string[];
