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
