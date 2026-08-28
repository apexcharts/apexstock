import { describe, it, expect, vi, afterEach } from "vitest";
import Align from "../src/analysis/Align.js";
import Utils from "../src/utils/Utils.js";
import { dailyOhlc, EPOCH } from "./fixtures.js";

const DAY = 86400000;
const d = (n) => EPOCH + n * DAY;

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * Three instruments that disagree about the calendar, which is the normal case:
 *
 *   day   0    1    2    3    4    5
 *   A   100  101  102  103  104    .     the primary, contiguous
 *   B     .    .  200  202  204  206     lists late, runs past the primary
 *   C    50   51    .   53   54    .     a hole on day 2 (market holiday)
 */
const A = [100, 101, 102, 103, 104].map((v, i) => ({ x: d(i), y: v }));
const B = [200, 202, 204, 206].map((v, i) => ({ x: d(i + 2), y: v }));
const C = [
  { x: d(0), y: 50 },
  { x: d(1), y: 51 },
  { x: d(3), y: 53 },
  { x: d(4), y: 54 },
];
const three = () => ({ A: A.slice(), B: B.slice(), C: C.slice() });

describe("Align.align: the x grid", () => {
  it("uses the primary instrument's own x values by default", () => {
    const out = Align.align(three(), { primary: "A" });
    expect(out.primary).toBe("A");
    expect(out.x).toEqual([d(0), d(1), d(2), d(3), d(4)]);
  });

  it("defaults the primary to the first key", () => {
    expect(Align.align(three()).primary).toBe("A");
  });

  it("takes every x seen anywhere for join: union", () => {
    const out = Align.align(three(), { join: "union" });
    expect(out.x).toEqual([d(0), d(1), d(2), d(3), d(4), d(5)]);
  });

  it("takes only x values present in every instrument for join: intersection", () => {
    // B misses days 0 and 1; C misses day 2; only 3 and 4 are shared.
    const out = Align.align(three(), { join: "intersection" });
    expect(out.x).toEqual([d(3), d(4)]);
  });

  it("warns and falls back to a union grid when the primary has no points", () => {
    const out = Align.align({ A: [], B: B.slice() }, { primary: "A" });
    expect(out.x).toEqual([d(2), d(3), d(4), d(5)]);
    expect(out.warnings.join(" ")).toMatch(/primary instrument has no points/);
  });

  it("warns when the named primary is not one of the instruments", () => {
    const out = Align.align(three(), { primary: "ZZZ" });
    expect(out.primary).toBe("A");
    expect(out.warnings.join(" ")).toMatch(/is not one of the instruments/);
  });

  it("warns when an intersection is empty", () => {
    const out = Align.align(
      { A: [{ x: d(0), y: 1 }], B: [{ x: d(9), y: 2 }] },
      { join: "intersection" }
    );
    expect(out.x).toEqual([]);
    expect(out.warnings.join(" ")).toMatch(/share no common x values/);
  });
});

describe("Align.align: missing data", () => {
  it("carries the last observation forward by default", () => {
    const out = Align.align(three(), { primary: "A" });
    // C has no day-2 observation, so day 1's 51 is held.
    expect(out.columns.C).toEqual([50, 51, 51, 53, 54]);
    expect(out.coverage.C.filled).toBe(1);
    expect(out.coverage.C.bars).toBe(5);
  });

  it("breaks the line instead, with fill: gap", () => {
    const out = Align.align(three(), { primary: "A", fill: "gap" });
    expect(out.columns.C).toEqual([50, 51, null, 53, 54]);
    expect(out.coverage.C.filled).toBe(0);
    expect(out.coverage.C.bars).toBe(4);
  });

  it("never carries a value backwards before an instrument's first observation", () => {
    for (const fill of ["hold", "gap"]) {
      const out = Align.align(three(), { primary: "A", fill });
      expect(out.columns.B[0]).toBeNull();
      expect(out.columns.B[1]).toBeNull();
      expect(out.columns.B[2]).toBe(200);
      expect(out.coverage.B.firstIndex).toBe(2);
    }
  });

  it("keeps only grid points every instrument actually observed, with fill: drop", () => {
    const out = Align.align(three(), { primary: "A", fill: "drop" });
    // Days 0 and 1 go because B has not listed yet; day 2 goes because C has no
    // observation there. `drop` never falls back to a held value: it is the
    // observed-data-only policy.
    expect(out.x).toEqual([d(3), d(4)]);
    expect(out.columns.A).toEqual([103, 104]);
    expect(out.columns.B).toEqual([202, 204]);
    expect(out.columns.C).toEqual([53, 54]);
  });

  it("makes drop over a union grid equivalent to an intersection", () => {
    const dropped = Align.align(three(), { join: "union", fill: "drop" });
    const intersected = Align.align(three(), { join: "intersection" });
    expect(dropped.x).toEqual(intersected.x);
  });

  it("reindexes coverage after a drop pass", () => {
    const out = Align.align(three(), { primary: "A", fill: "drop" });
    expect(out.coverage.B.firstIndex).toBe(0);
    expect(out.coverage.C.bars).toBe(2);
    expect(out.coverage.C.filled).toBe(0); // nothing was held, by definition
  });

  it("reports coverage so a caller can say how much was estimated", () => {
    const out = Align.align(three(), { primary: "A" });
    expect(out.coverage.A).toMatchObject({
      bars: 5,
      filled: 0,
      firstIndex: 0,
      lastIndex: 4,
    });
    expect(out.coverage.B).toMatchObject({ bars: 3, firstIndex: 2 });
  });
});

describe("Align.align: input shapes", () => {
  it("reads the close from OHLC points", () => {
    const out = Align.align({ A: dailyOhlc([10, 11]) });
    expect(out.columns.A).toEqual([10, 11]);
  });

  it("reads a named OHLC field when asked", () => {
    const out = Align.align(
      { A: dailyOhlc([10, 11], { highs: [99, 98] }) },
      {
        source: "high",
      }
    );
    expect(out.columns.A).toEqual([99, 98]);
  });

  it("reads scalar y and { close } points", () => {
    expect(Align.align({ A: [{ x: d(0), y: 5 }] }).columns.A).toEqual([5]);
    expect(Align.align({ A: [{ x: d(0), close: 7 }] }).columns.A).toEqual([7]);
  });

  it("accepts date strings and Dates as x", () => {
    const out = Align.align({
      A: [
        { x: "2024-01-01T00:00:00Z", y: 1 },
        { x: new Date(d(1)), y: 2 },
      ],
    });
    expect(out.x).toEqual([d(0), d(1)]);
  });

  it("sorts unordered input and collapses duplicate x values (last wins)", () => {
    const out = Align.align({
      A: [
        { x: d(2), y: 3 },
        { x: d(0), y: 1 },
        { x: d(0), y: 9 },
      ],
    });
    expect(out.x).toEqual([d(0), d(2)]);
    expect(out.columns.A).toEqual([9, 3]);
  });

  it("drops unusable points and warns about an instrument with none", () => {
    const out = Align.align({
      A: [
        { x: d(0), y: 1 },
        { x: null, y: 2 },
        { x: d(1), y: NaN },
      ],
      B: [],
    });
    expect(out.columns.A).toEqual([1]);
    expect(out.warnings.join(" ")).toMatch(/"B" has no usable points/);
  });

  it("ignores a point carrying no usable value at all", () => {
    const out = Align.align({ A: [{ x: d(0) }, { x: d(1), y: 5 }] });
    expect(out.x).toEqual([d(1)]);
    expect(out.columns.A).toEqual([5]);
  });

  it("survives being handed nothing at all", () => {
    const out = Align.align(null);
    expect(out.x).toEqual([]);
    expect(out.names).toEqual([]);
    expect(out.primary).toBeNull();
  });
});

describe("Align.baseline", () => {
  it("picks the first date every instrument has data for (common)", () => {
    const aligned = Align.align(three(), { primary: "A" });
    const base = Align.baseline(aligned, "common");
    // B lists on day 2, and C's hold covers day 2, so day 2 is the first
    // comparable date.
    expect(base.index).toBe(2);
    expect(base.perInstrument).toEqual({ A: 2, B: 2, C: 2 });
  });

  it("moves the common baseline later when a hole is left as a gap", () => {
    const aligned = Align.align(three(), { primary: "A", fill: "gap" });
    expect(Align.baseline(aligned, "common").index).toBe(3);
  });

  it("gives each instrument its own first value (own)", () => {
    const aligned = Align.align(three(), { primary: "A" });
    const base = Align.baseline(aligned, "own");
    expect(base.index).toBeNull();
    expect(base.perInstrument).toEqual({ A: 0, B: 2, C: 0 });
  });

  it("rebases to the left edge of the visible window (visible)", () => {
    const aligned = Align.align(three(), { primary: "A" });
    const base = Align.baseline(aligned, "visible", { from: d(3) });
    expect(base.index).toBe(3);
  });

  it("resolves an explicit x to the first grid point at or after it", () => {
    const aligned = Align.align(three(), { primary: "A" });
    expect(Align.baseline(aligned, d(1) + 1).index).toBe(2);
    expect(Align.baseline(aligned, d(3)).policy).toBe("explicit");
  });

  it("clamps an x past the end of the data, with a warning", () => {
    const aligned = Align.align(three(), { primary: "A" });
    const base = Align.baseline(aligned, d(99));
    expect(base.index).toBe(4);
    expect(base.warnings.join(" ")).toMatch(/past the end of the data/);
  });

  it("falls back to common when a visible baseline has no x", () => {
    const aligned = Align.align(three(), { primary: "A" });
    const base = Align.baseline(aligned, "visible", {});
    expect(base.index).toBe(2);
    expect(base.warnings.join(" ")).toMatch(/falling back to "common"/);
  });

  it("falls back to own, with a warning, when no shared date exists", () => {
    const aligned = Align.align(
      { A: [{ x: d(0), y: 1 }], B: [{ x: d(9), y: 2 }] },
      { join: "union", fill: "gap" }
    );
    const base = Align.baseline(aligned, "common");
    expect(base.policy).toBe("own");
    expect(base.warnings.join(" ")).toMatch(/no x value has data for every/);
  });

  it("uses an instrument's own first value when it has none at a shared baseline", () => {
    const aligned = Align.align(three(), { primary: "A" });
    const base = Align.baseline(aligned, d(0));
    expect(base.index).toBe(0);
    expect(base.perInstrument.B).toBe(2); // B had not listed on day 0
    expect(base.warnings.join(" ")).toMatch(
      /"B" has no value at the shared baseline/
    );
  });
});

describe("Align.rebase", () => {
  it("expresses every instrument as percent change from the shared baseline", () => {
    const aligned = Align.align(three(), { primary: "A" });
    const { columns, baseline } = Align.rebase(aligned, { mode: "percent" });
    expect(baseline.index).toBe(2);
    // Each line reads zero at the shared baseline: that is the whole point.
    expect(columns.A[2]).toBeCloseTo(0, 10);
    expect(columns.B[2]).toBeCloseTo(0, 10);
    expect(columns.C[2]).toBeCloseTo(0, 10);
    expect(columns.A[4]).toBeCloseTo((104 / 102 - 1) * 100, 10);
    expect(columns.B[4]).toBeCloseTo((204 / 200 - 1) * 100, 10);
    // Before the baseline the primary is legitimately negative.
    expect(columns.A[0]).toBeCloseTo((100 / 102 - 1) * 100, 10);
    expect(columns.B[0]).toBeNull();
  });

  it("indexes to 100 = starting value", () => {
    const aligned = Align.align(three(), { primary: "A" });
    const { columns } = Align.rebase(aligned, { mode: "indexed" });
    expect(columns.A[2]).toBeCloseTo(100, 10);
    expect(columns.B[4]).toBeCloseTo((204 / 200) * 100, 10);
  });

  it("honors a custom index base", () => {
    const aligned = Align.align(three(), { primary: "A" });
    const { columns } = Align.rebase(aligned, {
      mode: "indexed",
      indexBase: 1000,
    });
    expect(columns.A[2]).toBeCloseTo(1000, 10);
  });

  it("passes the raw values through in absolute mode", () => {
    const aligned = Align.align(three(), { primary: "A" });
    expect(Align.rebase(aligned, { mode: "absolute" }).columns.A).toEqual([
      100, 101, 102, 103, 104,
    ]);
  });

  it("starts each line at zero on its own first date under baseline: own", () => {
    const aligned = Align.align(three(), { primary: "A" });
    const { columns } = Align.rebase(aligned, { baseline: "own" });
    expect(columns.A[0]).toBeCloseTo(0, 10);
    expect(columns.B[2]).toBeCloseTo(0, 10);
    expect(columns.C[0]).toBeCloseTo(0, 10);
  });

  it("nulls a line whose baseline value is zero, and warns", () => {
    const aligned = Align.align({
      A: [
        { x: d(0), y: 0 },
        { x: d(1), y: 5 },
      ],
    });
    const out = Align.rebase(aligned, { mode: "percent" });
    expect(out.columns.A).toEqual([null, null]);
    expect(out.warnings.join(" ")).toMatch(/zero baseline value/);
  });

  it("defaults to percent for an unknown mode", () => {
    const aligned = Align.align(three(), { primary: "A" });
    expect(Align.rebase(aligned, { mode: "banana" }).mode).toBe("percent");
  });
});

describe("Align.relative", () => {
  const aligned = () => Align.align(three(), { primary: "A" });

  it("spreads the asset's return against the benchmark's, in percentage points", () => {
    const out = Align.relative(aligned(), "A", "B", { mode: "spread" });
    const pa = (104 / 102 - 1) * 100;
    const pb = (204 / 200 - 1) * 100;
    expect(out.mode).toBe("spread");
    expect(out.values[4]).toBeCloseTo(pa - pb, 10);
    expect(out.values[2]).toBeCloseTo(0, 10); // both zero at the baseline
  });

  it("is zero throughout when an instrument is compared with itself", () => {
    const out = Align.relative(aligned(), "A", "A");
    out.values.forEach((v) => expect(v).toBeCloseTo(0, 10));
  });

  it("nulls the spread wherever either side has no value", () => {
    const out = Align.relative(aligned(), "A", "B");
    expect(out.values[0]).toBeNull();
    expect(out.values[1]).toBeNull();
  });

  it("divides the asset by the benchmark and rebases the ratio", () => {
    const out = Align.relative(aligned(), "A", "B", { mode: "ratio" });
    expect(out.mode).toBe("ratio");
    expect(out.values[2]).toBeCloseTo(100, 10);
    const raw2 = 102 / 200;
    const raw4 = 104 / 204;
    expect(out.values[4]).toBeCloseTo((raw4 / raw2) * 100, 10);
  });

  it("returns the unrebased ratio when asked", () => {
    const out = Align.relative(aligned(), "A", "B", {
      mode: "ratio",
      rebaseRatio: false,
    });
    expect(out.values[2]).toBeCloseTo(102 / 200, 10);
  });

  it("leaves a ratio unrebased when the baseline point has no ratio", () => {
    // Baseline day 0: A has a value, B has not listed, so A/B is null there and
    // there is nothing to rebase against. The raw ratio is returned instead of a
    // column of nulls.
    const out = Align.relative(aligned(), "A", "B", {
      mode: "ratio",
      baseline: d(0),
    });
    expect(out.values[0]).toBeNull();
    expect(out.values[2]).toBeCloseTo(102 / 200, 10);
  });

  it("warns and returns null for an unknown instrument", () => {
    const warn = vi.spyOn(Utils, "warn").mockImplementation(() => {});
    expect(Align.relative(aligned(), "A", "NOPE")).toBeNull();
    expect(warn).toHaveBeenCalled();
    expect(Align.relative(null, "A", "B")).toBeNull();
  });

  it("defaults to a spread for an unknown mode", () => {
    expect(Align.relative(aligned(), "A", "B", { mode: "banana" }).mode).toBe(
      "spread"
    );
  });
});
