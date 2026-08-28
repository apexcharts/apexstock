import Utils from "../utils/Utils";

/**
 * Align: the multi-instrument primitive.
 *
 * Every comparison, benchmark, and relative-performance calculation in
 * ApexStock goes through here, because they all face the same two problems the
 * moment a second instrument appears: the instruments do **not** share a start
 * date, and they do **not** share every date in between (different exchanges,
 * different holidays, listings that begin mid-history, feeds with holes).
 *
 * Alignment resolves both explicitly rather than by accident:
 *
 * - **`join`** picks the x grid every instrument is sampled onto.
 *   - `"primary"` (default): the primary instrument's own x values. Keeps the
 *     price candles authoritative, which is what an overlay comparison wants.
 *   - `"intersection"`: only x values present in *every* instrument. The fair
 *     frame for pairwise statistics (correlation, beta).
 *   - `"union"`: every x seen in any instrument.
 * - **`fill`** decides what a grid point with no observation becomes.
 *   - `"hold"` (default): last observation carried forward. The finance
 *     default: a holiday in one market should not put a hole in the line.
 *   - `"gap"`: `null`, so the rendered line visibly breaks.
 *   - `"drop"`: the grid point is removed entirely, for every instrument. This
 *     is the observed-data-only policy: it never falls back to a held value, so
 *     `join: "union"` with `fill: "drop"` is equivalent to
 *     `join: "intersection"`.
 *
 * One rule overrides `fill` everywhere: a grid point **before** an instrument's
 * first observation is always `null`. Carrying a value backwards would invent
 * history that did not exist, which is the single most misleading thing a
 * comparison chart can do.
 *
 * Values are returned unrounded (see {@link Statistics} for the same contract).
 *
 * @typedef {Object} AlignCoverage
 * @property {number} bars - Grid points where the instrument has a value.
 * @property {number} filled - How many of those were carried forward, not observed.
 * @property {number} firstIndex - Grid index of the first observation, or -1.
 * @property {number} lastIndex - Grid index of the last observation, or -1.
 * @property {Set<number>} filledAt - Grid indices whose value was carried
 *   forward rather than observed. Lets a renderer plot only real observations
 *   while still doing its math on the filled grid.
 *
 * @typedef {Object} AlignResult
 * @property {number[]} x - The shared x grid, ascending.
 * @property {Object.<string, Array<number|null>>} columns - One value array per
 *   instrument, each the same length as `x`.
 * @property {Object.<string, AlignCoverage>} coverage - Per-instrument coverage.
 * @property {string[]} names - Instrument names, in input order.
 * @property {string|null} primary - The resolved primary instrument name.
 * @property {string[]} warnings - Assumptions that had to be made.
 */

const JOINS = ["primary", "intersection", "union"];
const FILLS = ["hold", "gap", "drop"];

/**
 * Coerce an x value to axis space: epoch ms for date-like input, the number
 * itself for numeric input. Matches the library-wide convention (see
 * `EventMarkers._coerceX`), where a numeric `x` is already axis space.
 * @param {*} x
 * @returns {number|null} null when it cannot be placed on a numeric axis.
 */
function toAxisX(x) {
  if (x == null) return null;
  if (typeof x === "number") return Number.isFinite(x) ? x : null;
  const t = new Date(x).getTime();
  return Number.isNaN(t) ? null : t;
}

/**
 * Extract the comparable scalar from a point. Accepts the shapes ApexStock
 * already passes around: an OHLC point (`y` is an array, whose close is used), a
 * scalar line point (`y` is a number), or `{ close }`.
 * @param {*} p
 * @param {"close"|"open"|"high"|"low"} [source="close"]
 * @returns {number} NaN when there is no usable value.
 */
function toValue(p, source = "close") {
  if (!p || typeof p !== "object") return NaN;
  if (Array.isArray(p.y)) {
    const idx = { open: 0, high: 1, low: 2, close: 3 }[source];
    const v = Number(p.y[idx != null ? idx : p.y.length - 1]);
    return Number.isFinite(v) ? v : NaN;
  }
  if (typeof p.y === "number") return Number.isFinite(p.y) ? p.y : NaN;
  if (typeof p.close === "number")
    return Number.isFinite(p.close) ? p.close : NaN;
  return NaN;
}

/**
 * Normalize one instrument's points into ascending `{x, v}` observations,
 * dropping anything unusable and collapsing duplicate x values (last wins).
 * @param {Array<*>} points
 * @param {"close"|"open"|"high"|"low"} source
 * @returns {Array<{x:number, v:number}>}
 */
function observations(points, source) {
  if (!Array.isArray(points)) return [];
  const out = [];
  for (const p of points) {
    const x = toAxisX(p && p.x);
    const v = toValue(p, source);
    if (x === null || !Number.isFinite(v)) continue;
    out.push({ x, v });
  }
  out.sort((a, b) => a.x - b.x);
  // Collapse duplicates (last observation for an x wins).
  const dedup = [];
  for (const o of out) {
    if (dedup.length && dedup[dedup.length - 1].x === o.x) {
      dedup[dedup.length - 1] = o;
    } else {
      dedup.push(o);
    }
  }
  return dedup;
}

export default class Align {
  /** @see toAxisX */
  static toAxisX = toAxisX;
  /** @see toValue */
  static toValue = toValue;
  /** @see observations */
  static observations = observations;

  /**
   * Sample every instrument onto one shared x grid.
   *
   * @param {Object.<string, Array<*>>} instruments - name -> points. Points may
   *   be OHLC (`{x, y:[o,h,l,c]}`), scalar (`{x, y}`), or `{x, close}`.
   * @param {Object} [opts]
   * @param {"primary"|"intersection"|"union"} [opts.join="primary"]
   * @param {"hold"|"gap"|"drop"} [opts.fill="hold"]
   * @param {string} [opts.primary] - Primary instrument name (defaults to the
   *   first key). Required in spirit for `join: "primary"`.
   * @param {"close"|"open"|"high"|"low"} [opts.source="close"] - Which OHLC
   *   field to compare on.
   * @returns {AlignResult}
   */
  static align(instruments, opts = {}) {
    const warnings = [];
    const src =
      instruments && typeof instruments === "object" ? instruments : {};
    const names = Object.keys(src);

    const join = JOINS.indexOf(opts.join) !== -1 ? opts.join : "primary";
    const fill = FILLS.indexOf(opts.fill) !== -1 ? opts.fill : "hold";
    const source = opts.source || "close";

    let primary =
      opts.primary != null ? String(opts.primary) : names[0] || null;
    if (primary !== null && names.indexOf(primary) === -1) {
      warnings.push(
        `align: primary "${primary}" is not one of the instruments; using "${names[0]}".`
      );
      primary = names[0] || null;
    }

    const obs = {};
    names.forEach((n) => {
      obs[n] = observations(src[n], source);
      if (!obs[n].length) {
        warnings.push(`align: "${n}" has no usable points.`);
      }
    });

    const withData = names.filter((n) => obs[n].length);

    // ---- Build the x grid ----
    let grid = [];
    if (join === "primary") {
      grid = primary && obs[primary] ? obs[primary].map((o) => o.x) : [];
      if (!grid.length && withData.length) {
        warnings.push(
          "align: the primary instrument has no points; falling back to a union grid."
        );
        grid = Align._union(obs, withData);
      }
    } else if (join === "intersection") {
      grid = Align._intersection(obs, withData);
      if (!grid.length && withData.length > 1) {
        warnings.push(
          "align: the instruments share no common x values; the intersection is empty."
        );
      }
    } else {
      grid = Align._union(obs, withData);
    }

    // ---- Sample each instrument onto the grid ----
    const columns = {};
    const coverage = {};
    names.forEach((n) => {
      const sampled = Align._sample(obs[n], grid, fill === "hold");
      columns[n] = sampled.values;
      coverage[n] = sampled.coverage;
    });

    // ---- `drop`: remove grid points any instrument cannot supply ----
    if (fill === "drop" && grid.length) {
      const keep = [];
      for (let i = 0; i < grid.length; i++) {
        let ok = true;
        for (const n of names) {
          if (columns[n][i] == null) {
            ok = false;
            break;
          }
        }
        if (ok) keep.push(i);
      }
      if (keep.length !== grid.length) {
        grid = keep.map((i) => grid[i]);
        names.forEach((n) => {
          columns[n] = keep.map((i) => columns[n][i]);
          coverage[n] = Align._coverageOf(columns[n]);
        });
      }
    }

    return { x: grid, columns, coverage, names, primary, warnings };
  }

  /** Ascending union of every instrument's x values. @private */
  static _union(obs, names) {
    const seen = new Set();
    names.forEach((n) => obs[n].forEach((o) => seen.add(o.x)));
    return Array.from(seen).sort((a, b) => a - b);
  }

  /** Ascending intersection of every instrument's x values. @private */
  static _intersection(obs, names) {
    if (!names.length) return [];
    let acc = obs[names[0]].map((o) => o.x);
    for (let k = 1; k < names.length; k++) {
      const set = new Set(obs[names[k]].map((o) => o.x));
      acc = acc.filter((x) => set.has(x));
    }
    return acc.sort((a, b) => a - b);
  }

  /**
   * Two-pointer walk of ascending observations over an ascending grid.
   * @param {Array<{x:number, v:number}>} points
   * @param {number[]} grid
   * @param {boolean} hold - Carry the last observation forward.
   * @private
   */
  static _sample(points, grid, hold) {
    const values = new Array(grid.length).fill(null);
    const filledAt = new Set();
    let bars = 0;
    let filled = 0;
    let firstIndex = -1;
    let lastIndex = -1;

    let p = 0;
    let carry = null;
    let started = false;
    for (let i = 0; i < grid.length; i++) {
      const gx = grid[i];
      let exact = false;
      while (p < points.length && points[p].x <= gx) {
        carry = points[p].v;
        started = true;
        if (points[p].x === gx) exact = true;
        p++;
      }
      if (!started) continue; // before the first observation: always null
      if (exact) {
        values[i] = carry;
      } else if (hold) {
        values[i] = carry;
        filled++;
        filledAt.add(i);
      } else {
        continue; // "gap": leave it null
      }
      bars++;
      if (firstIndex === -1) firstIndex = i;
      lastIndex = i;
    }

    return {
      values,
      coverage: { bars, filled, firstIndex, lastIndex, filledAt },
    };
  }

  /**
   * Recompute coverage after a `drop` pass reindexed the grid. `filled` is
   * always zero here by construction: `drop` samples with hold off, so no value
   * was ever carried forward for the reindexed grid to preserve.
   * @param {Array<number|null>} values
   * @private
   */
  static _coverageOf(values) {
    let bars = 0;
    let firstIndex = -1;
    let lastIndex = -1;
    for (let i = 0; i < values.length; i++) {
      if (values[i] == null) continue;
      bars++;
      if (firstIndex === -1) firstIndex = i;
      lastIndex = i;
    }
    return { bars, filled: 0, firstIndex, lastIndex, filledAt: new Set() };
  }

  /**
   * Resolve the baseline grid index each instrument is measured from.
   *
   * - `"common"` (default): the first grid index where **every** instrument
   *   with data has a value. The only policy under which instruments with
   *   different start dates are actually comparable, which is why it is the
   *   default.
   * - `"own"`: each instrument's own first value (so each line starts at zero
   *   at a different date). Preserved because it is what ApexStock did before.
   * - `"visible"`: `opts.from`, the left edge of the visible window, so the
   *   comparison rebases as the user zooms.
   * - a number: an explicit x value (or grid index), resolved to the nearest
   *   grid point at or after it.
   *
   * @param {AlignResult} aligned
   * @param {"common"|"own"|"visible"|number} [policy="common"]
   * @param {{from?:number}} [opts]
   * @returns {{policy:string, index:number|null, perInstrument:Object.<string,number>, warnings:string[]}}
   */
  static baseline(aligned, policy = "common", opts = {}) {
    const warnings = [];
    const { x, columns, coverage, names } = aligned;
    const withData = names.filter((n) => coverage[n] && coverage[n].bars > 0);
    const perInstrument = {};

    if (policy === "own") {
      withData.forEach((n) => {
        perInstrument[n] = coverage[n].firstIndex;
      });
      return { policy: "own", index: null, perInstrument, warnings };
    }

    let index = null;
    if (policy === "visible" || typeof policy === "number") {
      const target = policy === "visible" ? opts.from : policy;
      if (!Number.isFinite(target)) {
        warnings.push(
          `baseline: "${policy}" needs a finite x; falling back to "common".`
        );
        policy = "common";
      } else {
        index = x.findIndex((gx) => gx >= target);
        if (index === -1) {
          warnings.push(
            "baseline: the requested x is past the end of the data; using the last grid point."
          );
          index = x.length - 1;
        }
      }
    }

    if (index === null) {
      // "common": the first index where every instrument with data has a value.
      index = -1;
      for (let i = 0; i < x.length; i++) {
        let all = withData.length > 0;
        for (const n of withData) {
          if (columns[n][i] == null) {
            all = false;
            break;
          }
        }
        if (all) {
          index = i;
          break;
        }
      }
      if (index === -1) {
        warnings.push(
          "baseline: no x value has data for every instrument; each instrument falls back to its own first value."
        );
        withData.forEach((n) => {
          perInstrument[n] = coverage[n].firstIndex;
        });
        return { policy: "own", index: null, perInstrument, warnings };
      }
    }

    // A late-listing instrument has no value at a shared baseline; it uses its
    // own first value instead, and says so.
    withData.forEach((n) => {
      if (columns[n][index] == null) {
        perInstrument[n] = coverage[n].firstIndex;
        warnings.push(
          `baseline: "${n}" has no value at the shared baseline; using its own first value.`
        );
      } else {
        perInstrument[n] = index;
      }
    });

    return {
      policy: typeof policy === "number" ? "explicit" : policy,
      index,
      perInstrument,
      warnings,
    };
  }

  /**
   * Rebase aligned columns onto a comparable scale.
   *
   * - `"percent"`: percent change from the baseline (`+18.4` means +18.4%).
   * - `"indexed"`: an index where the baseline equals `indexBase` (default
   *   100), i.e. the "100 = starting value" view.
   * - `"absolute"`: the raw values, untouched (returned for symmetry so a
   *   caller can switch modes without branching).
   *
   * @param {AlignResult} aligned
   * @param {Object} [opts]
   * @param {"percent"|"indexed"|"absolute"} [opts.mode="percent"]
   * @param {"common"|"own"|"visible"|number} [opts.baseline="common"]
   * @param {number} [opts.indexBase=100]
   * @param {number} [opts.from] - Left edge x, for `baseline: "visible"`.
   * @returns {{mode:string, columns:Object.<string,Array<number|null>>, baseline:object, warnings:string[]}}
   */
  static rebase(aligned, opts = {}) {
    const mode =
      opts.mode === "indexed" || opts.mode === "absolute"
        ? opts.mode
        : "percent";
    const indexBase = Number.isFinite(+opts.indexBase) ? +opts.indexBase : 100;
    const base = Align.baseline(aligned, opts.baseline || "common", {
      from: opts.from,
    });
    const warnings = base.warnings.slice();
    const columns = {};

    aligned.names.forEach((name) => {
      const src = aligned.columns[name] || [];
      if (mode === "absolute") {
        columns[name] = src.slice();
        return;
      }
      const bIdx = base.perInstrument[name];
      const bVal = bIdx != null ? src[bIdx] : null;
      if (bVal == null || bVal === 0) {
        if (bVal === 0) {
          warnings.push(
            `rebase: "${name}" has a zero baseline value; it cannot be expressed as a ratio.`
          );
        }
        columns[name] = src.map(() => null);
        return;
      }
      columns[name] = src.map((v) =>
        v == null
          ? null
          : mode === "indexed"
            ? (v / bVal) * indexBase
            : (v / bVal - 1) * 100
      );
    });

    return { mode, columns, baseline: base, warnings };
  }

  /**
   * Derive a relative-performance series from two aligned instruments. This is
   * the reusable analytical primitive behind "stock vs benchmark", "stock vs
   * sector", and "asset A vs asset B": the benchmark is a **role**, filled by
   * whichever instrument is named, never a hard-coded symbol.
   *
   * - `"spread"` (default): `percentChange(asset) - percentChange(benchmark)`,
   *   in percentage points. Zero means "kept pace".
   * - `"ratio"`: `asset / benchmark`, optionally rebased so the baseline reads
   *   `indexBase`. A rising line means the asset is outperforming.
   *
   * @param {AlignResult} aligned
   * @param {string} name - The asset.
   * @param {string} benchmark - The benchmark instrument's name.
   * @param {Object} [opts]
   * @param {"spread"|"ratio"} [opts.mode="spread"]
   * @param {"common"|"own"|"visible"|number} [opts.baseline="common"]
   * @param {number} [opts.indexBase=100] - Ratio mode: baseline value.
   * @param {boolean} [opts.rebaseRatio=true] - Ratio mode: rebase to `indexBase`.
   * @param {number} [opts.from]
   * @returns {{mode:string, values:Array<number|null>, warnings:string[]}|null}
   */
  static relative(aligned, name, benchmark, opts = {}) {
    if (!aligned || !aligned.columns) return null;
    const a = aligned.columns[name];
    const b = aligned.columns[benchmark];
    if (!a || !b) {
      Utils.warn(`relative: unknown instrument ("${name}" vs "${benchmark}").`);
      return null;
    }
    const mode = opts.mode === "ratio" ? "ratio" : "spread";

    if (mode === "spread") {
      const reb = Align.rebase(aligned, {
        mode: "percent",
        baseline: opts.baseline || "common",
        from: opts.from,
      });
      const pa = reb.columns[name];
      const pb = reb.columns[benchmark];
      const values = pa.map((v, i) =>
        v == null || pb[i] == null ? null : v - pb[i]
      );
      return { mode, values, warnings: reb.warnings };
    }

    const raw = a.map((v, i) =>
      v == null || b[i] == null || b[i] === 0 ? null : v / b[i]
    );
    if (opts.rebaseRatio === false) return { mode, values: raw, warnings: [] };

    const indexBase = Number.isFinite(+opts.indexBase) ? +opts.indexBase : 100;
    const base = Align.baseline(aligned, opts.baseline || "common", {
      from: opts.from,
    });
    const bIdx = base.perInstrument[name];
    const bRatio = bIdx != null ? raw[bIdx] : null;
    if (bRatio == null || bRatio === 0) {
      return { mode, values: raw, warnings: base.warnings };
    }
    return {
      mode,
      values: raw.map((v) => (v == null ? null : (v / bRatio) * indexBase)),
      warnings: base.warnings,
    };
  }
}
