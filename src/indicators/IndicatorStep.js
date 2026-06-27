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
 * Running state for ADX at the series' last bar: the (untruncated) Wilder-
 * smoothed TR/+DM/-DM and the (untruncated) running ADX. Mirrors
 * Indicators.calculateADX exactly. Returns nulls until the first ADX value lands
 * (series index 2*period, i.e. length >= 2*period + 1), which signals the step
 * to keep falling back to a full recompute until then.
 */
function adxState(series, params_period) {
  const period = params_period;
  const empty = {
    smoothedTR: null,
    smoothedPlusDM: null,
    smoothedMinusDM: null,
    adx: null,
  };
  const n = series ? series.length : 0;
  if (!series || n < period * 2 + 1) return empty;

  const trArr = [];
  const plusDMArr = [];
  const minusDMArr = [];
  for (let i = 1; i < n; i++) {
    const curr = series[i].y;
    const prev = series[i - 1].y;
    trArr.push(
      Math.max(
        Math.abs(curr[1] - curr[2]),
        Math.abs(curr[1] - prev[3]),
        Math.abs(curr[2] - prev[3])
      )
    );
    const upMove = curr[1] - prev[1];
    const downMove = prev[2] - curr[2];
    plusDMArr.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDMArr.push(downMove > upMove && downMove > 0 ? downMove : 0);
  }

  let smTR = 0;
  let smP = 0;
  let smM = 0;
  for (let i = 0; i < period; i++) {
    smTR += trArr[i];
    smP += plusDMArr[i];
    smM += minusDMArr[i];
  }

  const dxArr = [];
  for (let k = 1; k < trArr.length - period + 1; k++) {
    smTR = smTR - smTR / period + trArr[k + period - 1];
    smP = smP - smP / period + plusDMArr[k + period - 1];
    smM = smM - smM / period + minusDMArr[k + period - 1];
    const plusDI = (smP / smTR) * 100;
    const minusDI = (smM / smTR) * 100;
    dxArr.push((Math.abs(plusDI - minusDI) / (plusDI + minusDI)) * 100);
  }

  let adxSum = 0;
  for (let i = 0; i < period; i++) if (i < dxArr.length) adxSum += dxArr[i];
  let adx = adxSum / period;
  for (let i = period; i < dxArr.length; i++) {
    adx = (adx * (period - 1) + dxArr[i]) / period;
  }

  return {
    smoothedTR: smTR,
    smoothedPlusDM: smP,
    smoothedMinusDM: smM,
    adx,
  };
}

/**
 * Running state for TSI at the series' last bar: the (truncated) running EMAs of
 * momentum (ema1/ema2) and |momentum| (absEma1/absEma2), the signal EMA, the
 * prior close, and the prior truncated TSI value. Computed via the same EMA
 * chain as Indicators.calculateTSI so the captured warm-up (null inputs coerced
 * to 0) is exact. `tsiPrev === null` signals the step to keep falling back.
 */
function tsiState(series, params) {
  const { longPeriod, shortPeriod, signalPeriod } = params;
  const n = series ? series.length : 0;
  if (!n) {
    return {
      prevClose: null,
      ema1: null,
      ema2: null,
      absEma1: null,
      absEma2: null,
      signal: null,
      tsiPrev: null,
    };
  }
  const momentum = [];
  const absChange = [];
  for (let i = 0; i < n; i++) {
    if (i === 0) {
      momentum.push(0);
      absChange.push(0);
    } else {
      const ch = series[i].y[3] - series[i - 1].y[3];
      momentum.push(ch);
      absChange.push(Math.abs(ch));
    }
  }
  const ema1 = Indicators.calculateEMAFromArray(momentum, longPeriod);
  const ema2 = Indicators.calculateEMAFromArray(ema1, shortPeriod);
  const absEma1 = Indicators.calculateEMAFromArray(absChange, longPeriod);
  const absEma2 = Indicators.calculateEMAFromArray(absEma1, shortPeriod);

  const tsiValues = [];
  for (let i = 0; i < n; i++) {
    if (ema2[i] === null || absEma2[i] === null || absEma2[i] === 0) {
      tsiValues.push(null);
    } else {
      tsiValues.push(t(100 * (ema2[i] / absEma2[i])));
    }
  }
  const signal = Indicators.calculateEMAFromArray(tsiValues, signalPeriod);

  const li = n - 1;
  return {
    prevClose: series[li].y[3],
    ema1: ema1[li],
    ema2: ema2[li],
    absEma1: absEma1[li],
    absEma2: absEma2[li],
    signal: signal[li],
    tsiPrev: tsiValues[li],
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

  // ── Recursive, O(1) running state ───────────────────────────────────────────

  // ADX: Wilder-smoothed TR/+DM/-DM -> +DI/-DI -> DX, then Wilder-smoothed DX.
  // State carries the (untruncated) running smoothed TR/+DM/-DM and the running
  // (untruncated) ADX, all for the previous bar. step() extends each by one bar:
  // smoothed_i = smoothed_{i-1} - smoothed_{i-1}/period + value_i (Wilder), and
  // adx_i = (adx_{i-1}*(period-1) + dx_i)/period. Only the output is truncated,
  // mirroring calculateADX. Falls back to a full recompute until the first ADX
  // value lands (series index 2*period, i.e. length >= 2*period + 1).
  adx: {
    seed(series, params) {
      return adxState(series, params.period);
    },
    step(state, series, params) {
      const { period } = params;
      // Warm-up: running state not established yet -> full recompute + re-seed.
      if (state.adx == null || state.smoothedTR == null) {
        const arr = Indicators.calculateADX(series, period);
        return {
          value: arr[arr.length - 1].y,
          state: adxState(series, period),
        };
      }
      const curr = lastBar(series).y;
      const prev = series[series.length - 2].y;
      const tr = Math.max(
        Math.abs(curr[1] - curr[2]),
        Math.abs(curr[1] - prev[3]),
        Math.abs(curr[2] - prev[3])
      );
      const upMove = curr[1] - prev[1];
      const downMove = prev[2] - curr[2];
      const plusDM = upMove > downMove && upMove > 0 ? upMove : 0;
      const minusDM = downMove > upMove && downMove > 0 ? downMove : 0;

      const smoothedTR = state.smoothedTR - state.smoothedTR / period + tr;
      const smoothedPlusDM =
        state.smoothedPlusDM - state.smoothedPlusDM / period + plusDM;
      const smoothedMinusDM =
        state.smoothedMinusDM - state.smoothedMinusDM / period + minusDM;

      const plusDI = (smoothedPlusDM / smoothedTR) * 100;
      const minusDI = (smoothedMinusDM / smoothedTR) * 100;
      const dx = (Math.abs(plusDI - minusDI) / (plusDI + minusDI)) * 100;
      const adx = (state.adx * (period - 1) + dx) / period;

      return {
        value: t(adx),
        state: { smoothedTR, smoothedPlusDM, smoothedMinusDM, adx },
      };
    },
  },

  // TSI: double-smoothed momentum ratio (EMA-of-EMA), with an EMA signal line.
  // State carries the (truncated) running EMAs for momentum (ema1/ema2) and its
  // absolute value (absEma1/absEma2), the running signal EMA, the prior close,
  // and the prior truncated TSI value. Each EMA extends in O(1) exactly as
  // calculateEMAFromArray does (input -> *k + prev*(1-k), truncated). Falls back
  // to a full recompute until TSI itself is established (the null-laden EMA
  // warm-up is captured once, in the seeded state).
  tsi: {
    seed(series, params) {
      return tsiState(series, params);
    },
    step(state, series, params) {
      const { longPeriod, shortPeriod, signalPeriod } = params;
      // Warm-up: TSI not yet established -> full recompute + re-seed.
      if (state.tsiPrev == null || state.signal == null) {
        const out = Indicators.calculateTSI(
          series,
          longPeriod,
          shortPeriod,
          signalPeriod
        );
        const last = out.tsi.length - 1;
        return {
          value: { tsi: out.tsi[last].y, signal: out.signal[last].y },
          state: tsiState(series, params),
        };
      }
      const kL = 2 / (longPeriod + 1);
      const kS = 2 / (shortPeriod + 1);
      const kSig = 2 / (signalPeriod + 1);
      const c = close(lastBar(series));
      const momentum = c - state.prevClose;
      const absChange = Math.abs(momentum);

      const ema1 = t(momentum * kL + state.ema1 * (1 - kL));
      const ema2 = t(ema1 * kS + state.ema2 * (1 - kS));
      const absEma1 = t(absChange * kL + state.absEma1 * (1 - kL));
      const absEma2 = t(absEma1 * kS + state.absEma2 * (1 - kS));

      const tsiY = absEma2 === 0 ? null : t(100 * (ema2 / absEma2));
      // calculateEMAFromArray coerces a null input to 0 in the recursion.
      const sigInput = tsiY === null ? 0 : tsiY;
      const signal = t(sigInput * kSig + state.signal * (1 - kSig));

      return {
        value: { tsi: tsiY, signal },
        state: {
          prevClose: c,
          ema1,
          ema2,
          absEma1,
          absEma2,
          signal,
          tsiPrev: tsiY,
        },
      };
    },
  },
};

/**
 * Maps a registry indicator key (as used by IndicatorHandlers and tracked in
 * `indicatorChartMap`) to its streaming stepper key plus a params translator
 * that mirrors EXACTLY the defaults each registry `build()` applies. This is the
 * bridge the appendData() path uses to drive the right stepper with the live
 * indicator's parameters.
 *
 * Indicators with no streaming twin are intentionally absent so `resolve()`
 * returns null and the append path leaves them to a full refresh:
 *   - "ichimoku cloud indicator" (multi-line projection),
 *   - "fibonacci retracements" (annotation, re-evaluated separately),
 *   - "volumes" (raw per-bar value, appended directly).
 * "awesome oscillator" has a stepper ("ao") but no registry entry, so it is not
 * listed here.
 */
// Each `render(value, x)` turns a stepped value into the exact rendered point(s)
// the matching registry build() produces, returned as `{ name, point }` entries
// (one per chart series the indicator owns). `kind` says where those series live:
// "overlay" (on the main chart) or "oscillator" (in a separate pane keyed by the
// registry key in indicatorChartMap).
const pt = (name, x, y) => ({ name, point: { x, y } });

const STREAM_MAP = {
  // ── Overlays (main chart) ───────────────────────────────────────────────────
  "moving average": {
    key: "sma",
    kind: "overlay",
    params: (p) => ({ period: p.period || 10 }),
    render: (v, x) => [pt("Moving Average", x, v)],
  },
  "exponential moving average": {
    key: "ema",
    kind: "overlay",
    params: (p) => ({ period: p.period || 10 }),
    render: (v, x) => [pt("EMA", x, v)],
  },
  "linear regression": {
    key: "linreg",
    kind: "overlay",
    params: (p) => ({ period: p.period || 14 }),
    render: (v, x) => [pt("Linear Regression", x, v)],
  },
  "bollinger bands": {
    key: "bollinger",
    kind: "overlay",
    params: (p) => ({ period: p.period || 20, stdDev: p.stdDev || 2 }),
    // rangeArea band: y = [lower, upper]; null band when the value is null.
    render: (v, x) => [
      {
        name: "Bollinger Bands",
        point: { x, y: v == null ? [null, null] : [v.lower, v.upper] },
      },
    ],
  },
  // ── Oscillators (separate panes) ────────────────────────────────────────────
  rsi: {
    key: "rsi",
    kind: "oscillator",
    params: (p) => ({ period: p.period || 14 }),
    render: (v, x) => [pt("RSI", x, v)],
  },
  macd: {
    key: "macd",
    kind: "oscillator",
    params: (p) => ({
      fast: p.fastPeriod || 12,
      slow: p.slowPeriod || 26,
      signal: p.signalPeriod || 9,
    }),
    // The pane renders truncated macd/signal/histogram (the raw stepped diffs).
    render: (v, x) =>
      v == null
        ? [pt("MACD", x, null), pt("Signal", x, null), pt("Histogram", x, null)]
        : [
            pt("MACD", x, v.macd == null ? null : t(v.macd)),
            pt("Signal", x, v.signal == null ? null : t(v.signal)),
            pt("Histogram", x, v.histogram == null ? null : t(v.histogram)),
          ],
  },
  "price volume trend": {
    key: "pvt",
    kind: "oscillator",
    params: () => ({}),
    render: (v, x) => [pt("PVT", x, v)],
  },
  "stochastic oscillator": {
    key: "stochastic",
    kind: "oscillator",
    params: (p) => ({ period: p.period || 14, smoothPeriod: p.smoothPeriod || 3 }),
    render: (v, x) => [
      pt("Stochastic %K", x, v == null ? null : v.k),
      pt("Stochastic %D", x, v == null ? null : v.d),
    ],
  },
  "standard deviation indicator": {
    key: "stddev",
    kind: "oscillator",
    params: (p) => ({ period: p.period || 14 }),
    render: (v, x) => [pt("Std Dev", x, v)],
  },
  "average directional index": {
    key: "adx",
    kind: "oscillator",
    params: (p) => ({ period: p.period || 14 }),
    render: (v, x) => [pt("ADX", x, v)],
  },
  "chaikin oscillator": {
    key: "chaikin",
    kind: "oscillator",
    params: (p) => ({ short: p.shortPeriod || 3, long: p.longPeriod || 10 }),
    render: (v, x) => [pt("Chaikin Osc", x, v)],
  },
  "commodity channel index": {
    key: "cci",
    kind: "oscillator",
    params: (p) => ({ period: p.period || 20 }),
    render: (v, x) => [pt("CCI", x, v)],
  },
  "trend strength index": {
    key: "tsi",
    kind: "oscillator",
    params: (p) => ({
      longPeriod: p.longPeriod || 25,
      shortPeriod: p.shortPeriod || 13,
      signalPeriod: p.signalPeriod || 7,
    }),
    // The pane renders only the TSI line (signal is computed but not drawn).
    render: (v, x) => [pt("TSI", x, v == null ? null : v.tsi)],
  },
  "accelerator oscillator": {
    key: "ac",
    kind: "oscillator",
    params: (p) => ({ acPeriod: p.period || 5 }),
    render: (v, x) => [pt("AC", x, v)],
  },
  "bollinger bands %b": {
    key: "bbpercent",
    kind: "oscillator",
    params: (p) => ({ period: p.period || 20, stdDev: p.stdDev || 2 }),
    render: (v, x) => [pt("Bollinger %B", x, v)],
  },
  "bollinger bands width": {
    key: "bbwidth",
    kind: "oscillator",
    params: (p) => ({ period: p.period || 20, stdDev: p.stdDev || 2 }),
    render: (v, x) => [pt("Bollinger Width", x, v)],
  },
};

const IndicatorStep = {
  /** Math keys with a streaming twin. */
  keys: () => Object.keys(STEPPERS),

  /** True if `key` has a streaming twin. */
  has: (key) => Object.prototype.hasOwnProperty.call(STEPPERS, key),

  /** Registry indicator keys that can be streamed incrementally. */
  streamableKeys: () => Object.keys(STREAM_MAP),

  /** True if the given registry indicator key can be streamed. */
  isStreamable: (registryKey) =>
    Object.prototype.hasOwnProperty.call(STREAM_MAP, registryKey),

  /**
   * Resolve a registry indicator key + its live params into the stepper key, the
   * params shape the stepper expects, where its series live ("overlay" on the
   * main chart vs "oscillator" pane), and a renderer that turns a stepped value
   * into the rendered point(s) for that indicator's series.
   * @param {string} registryKey - e.g. "moving average", "macd".
   * @param {any} [liveParams] - params from OscillatorSettings.getIndicatorParams.
   * @returns {{ key: string, params: any, kind: string, render: Function } | null}
   *   null if not streamable.
   */
  resolve(registryKey, liveParams = {}) {
    const m = STREAM_MAP[registryKey];
    if (!m) return null;
    return {
      key: m.key,
      params: m.params(liveParams || {}),
      kind: m.kind,
      render: m.render,
    };
  },

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
