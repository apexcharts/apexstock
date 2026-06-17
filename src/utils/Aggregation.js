import Utils from "./Utils";

/**
 * Fixed-width time-frame intervals, in milliseconds. These bucket on epoch
 * (i.e. UTC) boundaries — `1d` aligns to UTC midnight, `4h` to 00/04/08/… UTC.
 * `1w` (UTC week, Monday-anchored) and `1M` (calendar month) are variable
 * width and handled separately in {@link bucketStart}.
 * @type {Object.<string, number>}
 */
export const INTERVAL_MS = {
  "1m": 60000,
  "5m": 300000,
  "15m": 900000,
  "30m": 1800000,
  "1h": 3600000,
  "2h": 7200000,
  "4h": 14400000,
  "12h": 43200000,
  "1d": 86400000,
};

/** All accepted interval keys (fixed-width plus the calendar ones). */
export const INTERVALS = [...Object.keys(INTERVAL_MS), "1w", "1M"];

/** @param {number} ts @returns {number} UTC-midnight timestamp of that week's Monday. */
function startOfUTCWeek(ts) {
  const d = new Date(ts);
  const monday = (d.getUTCDay() + 6) % 7; // Sun=6, Mon=0
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - monday);
}

/**
 * Start timestamp of the bucket a given time falls into, for `interval`.
 * @param {number} ts
 * @param {string} interval
 * @returns {number|null} bucket-start ms, or null for an unknown interval.
 */
function bucketStart(ts, interval) {
  const width = INTERVAL_MS[interval];
  if (width) return Math.floor(ts / width) * width;
  if (interval === "1w") return startOfUTCWeek(ts);
  if (interval === "1M") {
    const d = new Date(ts);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
  }
  return null;
}

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
export function aggregateOHLC(series, interval) {
  if (!Array.isArray(series) || series.length === 0) return [];
  if (!INTERVALS.includes(interval)) {
    Utils.warn(
      `aggregateOHLC: unknown interval "${interval}". Expected one of ${INTERVALS.join(", ")}.`
    );
    return series.slice();
  }

  const toTs = (x) => (typeof x === "number" ? x : new Date(x).getTime());
  const hasVolume = series.some((p) => p && typeof p.v === "number");

  const out = [];
  let key = null;
  let bucket = null;

  for (const point of series) {
    if (!point || !Array.isArray(point.y)) continue;
    const ts = toTs(point.x);
    if (Number.isNaN(ts)) continue;

    const bKey = bucketStart(ts, interval);
    const [open, high, low, close] = point.y;

    if (bKey !== key) {
      if (bucket) out.push(bucket);
      key = bKey;
      bucket = {
        x: bKey,
        y: [open, high, low, close],
        ...(hasVolume ? { v: point.v || 0 } : {}),
      };
    } else {
      if (high > bucket.y[1]) bucket.y[1] = high;
      if (low < bucket.y[2]) bucket.y[2] = low;
      bucket.y[3] = close;
      if (hasVolume) bucket.v += point.v || 0;
    }
  }
  if (bucket) out.push(bucket);

  return out;
}
