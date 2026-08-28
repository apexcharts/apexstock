/**
 * Test fixtures for indicator math.
 *
 * ApexStock series points use the shape: { x, y: [open, high, low, close], v }.
 * Most close-based indicators only read y[3]; high/low/open default to the
 * close so simple fixtures stay readable.
 */

/**
 * Build an OHLC series from an array of close prices.
 * @param {number[]} closes
 * @param {{highs?: number[], lows?: number[], opens?: number[], volumes?: number[]}} [opts]
 * @returns {Array<{x: number, y: number[], v: number}>}
 */
export function ohlc(closes, opts = {}) {
  const { highs, lows, opens, volumes } = opts;
  return closes.map((c, i) => ({
    x: i + 1,
    y: [
      opens ? opens[i] : c,
      highs ? highs[i] : c,
      lows ? lows[i] : c,
      c,
    ],
    v: volumes ? volumes[i] : 100,
  }));
}

/** A longer ascending-with-noise series for structural/range assertions. */
export function longSeries(length = 60) {
  const closes = [];
  for (let i = 0; i < length; i++) {
    // Deterministic pseudo-noise around a rising trend (no Math.random).
    const noise = ((i * 37) % 11) - 5;
    closes.push(50 + i + noise);
  }
  return ohlc(closes, {
    highs: closes.map((c) => c + 2),
    lows: closes.map((c) => c - 2),
    volumes: closes.map((_, i) => 1000 + ((i * 13) % 50)),
  });
}

/** Epoch ms for 2024-01-01T00:00:00Z. A fixed base, so tests never use the clock. */
export const EPOCH = Date.UTC(2024, 0, 1);

/**
 * Build an OHLC series on real epoch-ms timestamps at a fixed spacing, for
 * anything that reads the time axis (calendar spans, annualization, bar-spacing
 * inference).
 * @param {number[]} closes
 * @param {{highs?: number[], lows?: number[], opens?: number[], volumes?: number[], stepMs?: number, start?: number}} [opts]
 * @returns {Array<{x: number, y: number[], v: number}>}
 */
export function dailyOhlc(closes, opts = {}) {
  const { highs, lows, opens, volumes } = opts;
  const step = opts.stepMs != null ? opts.stepMs : 86400000;
  const start = opts.start != null ? opts.start : EPOCH;
  return closes.map((c, i) => ({
    x: start + i * step,
    y: [opens ? opens[i] : c, highs ? highs[i] : c, lows ? lows[i] : c, c],
    v: volumes ? volumes[i] : 100,
  }));
}

/**
 * A series with one designed drawdown that fully recovers and a second that is
 * still underwater at the end, so drawdown depths, durations, and recovery are
 * assertable by hand.
 *
 * closes:  100 110 120  90  80  95 121 115
 * peak:    100 110 120 120 120 120 121 121
 * index:     0   1   2   3   4   5   6   7
 *                     └── episode 0 ──┘ └ episode 1 (ongoing)
 */
export function drawdownSeries() {
  return dailyOhlc([100, 110, 120, 90, 80, 95, 121, 115]);
}
