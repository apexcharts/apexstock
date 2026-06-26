import Indicators from "./Indicators";
import Utils from "./../utils/Utils";

/**
 * Incremental ("streaming") twins of the pure `Indicators.calculate*` functions,
 * for the real-time `appendData()` path. Each entry exposes:
 *
 *   seed(series, params) -> state            // capture state from history
 *   step(state, series, params) -> { value, state }
 *
 * `step` is called with the series that ALREADY includes the new last bar and
 * returns the indicator value at that last index, plus the next state. By
 * construction every stepper agrees exactly with a full recompute of the same
 * `calculate*` (locked down by test/indicator-step.test.js):
 *
 * - **Windowed** indicators (value at i depends only on a bounded trailing
 *   window) recompute that window via the existing `calculate*` on a tail slice.
 *   Exact, and cheap because the window is bounded.
 * - **Recursive / cumulative** indicators carry running state and extend it by
 *   one bar in O(1). They fall back to a full recompute while still in their
 *   warm-up period (state not yet established), then switch to O(1).
 *
 * `value` mirrors the matching `calculate*` element: a scalar (or null) for
 * line indicators, `{ middle, upper, lower }` for Bollinger, and
 * `{ macd, signal, histogram }` for MACD.
 */

const t = Utils.truncateNumber;
const close = (bar) => bar.y[3];
const lastBar = (series) => series[series.length - 1];

/** Last `n` bars of the series (or the whole series if shorter). */
function tail(series, n) {
  return series.length > n ? series.slice(series.length - n) : series;
}

/** Running state for Chaikin: cumulative ADL + the two ADL-EMA values. */
function seedChaikin(series, params) {
  const ad = [];
  let cumulative = 0;
  for (let i = 0; i < series.length; i++) {
    const high = series[i].y[1];
    const low = series[i].y[2];
    const c = series[i].y[3];
    const vol = series[i].v || 0;
    const clv = (high - c - (c - low)) / (high - low || 1);
    cumulative += clv * vol;
    ad.push(cumulative);
  }
  const emaS = Indicators.calculateEMAFromArray(ad, params.short);
  const emaL = Indicators.calculateEMAFromArray(ad, params.long);
  return {
    adl: cumulative,
    emaShort: emaS[emaS.length - 1] ?? null,
    emaLong: emaL[emaL.length - 1] ?? null,
  };
}

/**
 * Build a windowed stepper: the value at the last index is recomputed from the
 * last `window(params)` bars via `calc`, and `pick` extracts the value from
 * `calc`'s return. No running state is needed.
 * @param {(params: any) => number} windowFn
 * @param {(series: any[], params: any) => any} calc
 * @param {(out: any) => any} pick
 */
function windowed(windowFn, calc, pick) {
  return {
    seed() {
      return {};
    },
    step(_state, series, params) {
      const out = calc(tail(series, windowFn(params)), params);
      return { value: pick(out), state: {} };
    },
  };
}

const STEPPERS = {
  // ── Windowed ───────────────────────────────────────────────────────────────

  // SMA at i depends on the last `period` closes.
  sma: windowed(
    (p) => p.period,
    (s, p) => Indicators.calculateMovingAverage(s, p.period),
    (arr) => arr[arr.length - 1]
  ),

  // Bollinger middle/stddev both span the last `period` closes.
  bollinger: windowed(
    (p) => p.period,
    (s, p) => Indicators.calculateBollingerBands(s, p.period, p.stdDev),
    (out) => ({
      middle: out.middle[out.middle.length - 1],
      upper: out.upper[out.upper.length - 1],
      lower: out.lower[out.lower.length - 1],
    })
  ),

  // RSI (this codebase's sliding-window variant) at i depends on the last
  // `period` deltas, i.e. the last `period + 1` closes.
  rsi: windowed(
    (p) => p.period + 1,
    (s, p) => Indicators.calculateRSI(s, p.period),
    (arr) => arr[arr.length - 1]
  ),

  // ── Recursive ────────────────────────────────────────────────────────────

  // EMA: ema[i] = trunc(close*k + ema[i-1]*(1-k)), seeded at i=period-1 with the
  // SMA. State carries the (truncated) previous EMA — exactly what the next step
  // reads in the full function.
  ema: {
    seed(series, params) {
      const full = Indicators.calculateEMA(series, params.period);
      return { ema: full[full.length - 1] ?? null };
    },
    step(state, series, params) {
      // Warm-up: state not established yet -> full recompute, then re-seed.
      if (state.ema == null) {
        const full = Indicators.calculateEMA(series, params.period);
        const v = full[full.length - 1] ?? null;
        return { value: v, state: { ema: v } };
      }
      const k = 2 / (params.period + 1);
      const v = t(close(lastBar(series)) * k + state.ema * (1 - k));
      return { value: v, state: { ema: v } };
    },
  },

  // MACD: macd = fastEMA - slowEMA (raw diff of truncated EMAs); signal = EMA of
  // macd (not truncated); histogram = macd - signal. State carries the running
  // fast/slow EMAs and the signal EMA.
  macd: {
    seed(series, params) {
      const { fast, slow, signal } = params;
      const m = Indicators.calculateMACD(series, fast, slow, signal);
      const fastEMA = Indicators.calculateEMA(series, fast);
      const slowEMA = Indicators.calculateEMA(series, slow);
      return {
        fastEMA: fastEMA[fastEMA.length - 1] ?? null,
        slowEMA: slowEMA[slowEMA.length - 1] ?? null,
        signal: m.signal[m.signal.length - 1] ?? null,
      };
    },
    step(state, series, params) {
      const { fast, slow, signal } = params;
      // Warm-up (signal not established) -> full recompute, then re-seed.
      if (state.signal == null) {
        const m = Indicators.calculateMACD(series, fast, slow, signal);
        const fe = Indicators.calculateEMA(series, fast);
        const se = Indicators.calculateEMA(series, slow);
        return {
          value: {
            macd: m.macd[m.macd.length - 1] ?? null,
            signal: m.signal[m.signal.length - 1] ?? null,
            histogram: m.histogram[m.histogram.length - 1] ?? null,
          },
          state: {
            fastEMA: fe[fe.length - 1] ?? null,
            slowEMA: se[se.length - 1] ?? null,
            signal: m.signal[m.signal.length - 1] ?? null,
          },
        };
      }
      const c = close(lastBar(series));
      const kf = 2 / (fast + 1);
      const ks = 2 / (slow + 1);
      const ksig = 2 / (signal + 1);
      const fastEMA = t(c * kf + state.fastEMA * (1 - kf));
      const slowEMA = t(c * ks + state.slowEMA * (1 - ks));
      const macd = fastEMA - slowEMA;
      const sig = macd * ksig + state.signal * (1 - ksig);
      return {
        value: { macd, signal: sig, histogram: macd - sig },
        state: { fastEMA, slowEMA, signal: sig },
      };
    },
  },

  // ── Cumulative ─────────────────────────────────────────────────────────────

  // PVT: prev += changePct * volume (running, NOT truncated); only the output is
  // truncated. State carries the untruncated running total and the prior close.
  pvt: {
    seed(series) {
      let prev = 0;
      for (let i = 1; i < series.length; i++) {
        const prevClose = series[i - 1].y[3];
        const currClose = series[i].y[3];
        const vol = series[i].v || 0;
        const changePct =
          prevClose === 0 ? 0 : (currClose - prevClose) / prevClose;
        prev += changePct * vol;
      }
      return {
        prev,
        prevClose: series.length ? close(lastBar(series)) : null,
      };
    },
    step(state, series) {
      const bar = lastBar(series);
      const currClose = close(bar);
      const vol = bar.v || 0;
      const changePct =
        state.prevClose == null || state.prevClose === 0
          ? 0
          : (currClose - state.prevClose) / state.prevClose;
      const prev = state.prev + changePct * vol;
      return { value: t(prev), state: { prev, prevClose: currClose } };
    },
  },

  // Chaikin: cumulative ADL, then trunc(EMA(ADL,short) - EMA(ADL,long)). ADL has
  // no nulls, so the EMAs behave like EMA-on-closes. State: running ADL + both
  // (truncated) ADL-EMA values.
  chaikin: {
    seed: seedChaikin,
    step(state, series, params) {
      const bar = lastBar(series);
      const high = bar.y[1];
      const low = bar.y[2];
      const c = close(bar);
      const vol = bar.v || 0;
      const clv = (high - c - (c - low)) / (high - low || 1);
      const adl = state.adl + clv * vol;
      // Warm-up: an EMA not yet seeded -> full recompute + re-seed.
      if (state.emaShort == null || state.emaLong == null) {
        const full = Indicators.calculateChaikinOsc(
          series,
          params.short,
          params.long
        );
        return {
          value: full[full.length - 1].y,
          state: seedChaikin(series, params),
        };
      }
      const ks = 2 / (params.short + 1);
      const kl = 2 / (params.long + 1);
      const emaShort = t(adl * ks + state.emaShort * (1 - ks));
      const emaLong = t(adl * kl + state.emaLong * (1 - kl));
      return {
        value: t(emaShort - emaLong),
        state: { adl, emaShort, emaLong },
      };
    },
  },

  // ── Windowed (batch 2) ─────────────────────────────────────────────────────

  // %K spans the last `period` bars; %D smooths the last `smoothPeriod` %K, so
  // the pair depends on the last `period + smoothPeriod - 1` bars.
  stochastic: windowed(
    (p) => p.period + p.smoothPeriod - 1,
    (s, p) => Indicators.calculateStochastic(s, p.period, p.smoothPeriod),
    (out) => ({
      k: out.k[out.k.length - 1].y,
      d: out.d[out.d.length - 1].y,
    })
  ),

  stddev: windowed(
    (p) => p.period,
    (s, p) => Indicators.calculateStdDevIndicator(s, p.period),
    (arr) => arr[arr.length - 1].y
  ),

  cci: windowed(
    (p) => p.period,
    (s, p) => Indicators.calculateCCI(s, p.period),
    (arr) => arr[arr.length - 1].y
  ),

  // Linear regression is translation-invariant in x, so a tail slice yields the
  // same fitted value at the last index.
  linreg: windowed(
    (p) => p.period,
    (s, p) => Indicators.calculateLinearRegression(s, p.period),
    (arr) => arr[arr.length - 1].y
  ),

  // Awesome oscillator: SMA(median,5) - SMA(median,34) -> last 34 bars.
  ao: windowed(
    () => 34,
    (s) => Indicators.calculateAwesomeOscillator(s),
    (arr) => arr[arr.length - 1].y
  ),

  // Accelerator: AO - SMA(AO, acPeriod) -> last 34 + acPeriod - 1 bars.
  ac: windowed(
    (p) => 34 + (p.acPeriod || 5) - 1,
    (s, p) => Indicators.calculateAcceleratorOsc(s, p.acPeriod),
    (arr) => arr[arr.length - 1].y
  ),

  // Bollinger %B and width are functions of the band at the last index, which
  // spans the last `period` bars.
  bbpercent: {
    seed() {
      return {};
    },
    step(_state, series, params) {
      const s = tail(series, params.period);
      const b = Indicators.calculateBollingerBands(s, params.period, params.stdDev);
      const out = Indicators.calculateBBPercent(s, b.lower, b.upper);
      return { value: out[out.length - 1].y, state: {} };
    },
  },

  bbwidth: {
    seed() {
      return {};
    },
    step(_state, series, params) {
      const s = tail(series, params.period);
      const b = Indicators.calculateBollingerBands(s, params.period, params.stdDev);
      const out = Indicators.calculateBBWidth(s, b.middle, b.upper, b.lower);
      return { value: out[out.length - 1].y, state: {} };
    },
  },

  // ── Recursive, not yet O(1) (exact full recompute) ──────────────────────────
  // ADX (Wilder smoothing with forward-index offsets) and TSI (chained EMAs over
  // null-laden arrays) are exact via full recompute. Since oscillators are
  // mutually exclusive (one active at a time), at most one O(n) recompute runs
  // per tick. Converting these to O(1) running state is a tracked follow-up.
  adx: {
    seed() {
      return {};
    },
    step(_state, series, params) {
      const arr = Indicators.calculateADX(series, params.period);
      return { value: arr[arr.length - 1].y, state: {} };
    },
  },

  tsi: {
    seed() {
      return {};
    },
    step(_state, series, params) {
      const out = Indicators.calculateTSI(
        series,
        params.longPeriod,
        params.shortPeriod,
        params.signalPeriod
      );
      return {
        value: {
          tsi: out.tsi[out.tsi.length - 1].y,
          signal: out.signal[out.signal.length - 1].y,
        },
        state: {},
      };
    },
  },
};

const IndicatorStep = {
  /** Math keys with a streaming twin. */
  keys: () => Object.keys(STEPPERS),

  /** True if `key` has a streaming twin. */
  has: (key) => Object.prototype.hasOwnProperty.call(STEPPERS, key),

  /**
   * Capture initial state from history for indicator `key`.
   * @param {string} key
   * @param {any[]} series
   * @param {any} [params]
   */
  seed(key, series, params = {}) {
    return STEPPERS[key].seed(series, params);
  },

  /**
   * Compute the indicator value at the series' last bar incrementally.
   * @param {string} key
   * @param {any} state - prior state (from seed/step)
   * @param {any[]} series - series INCLUDING the new last bar
   * @param {any} [params]
   * @returns {{ value: any, state: any }}
   */
  step(key, state, series, params = {}) {
    return STEPPERS[key].step(state, series, params);
  },
};

export default IndicatorStep;
