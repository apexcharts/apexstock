import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Utils from "../src/utils/Utils.js";

const jan1 = Date.UTC(2024, 0, 1);
const H = 3600000;

describe("Utils.normalizeOHLC", () => {
  let warnSpy;
  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("returns [] for non-array / empty input", () => {
    expect(Utils.normalizeOHLC(undefined)).toEqual([]);
    expect(Utils.normalizeOHLC(null)).toEqual([]);
    expect(Utils.normalizeOHLC("nope")).toEqual([]);
    expect(Utils.normalizeOHLC([])).toEqual([]);
  });

  it("passes clean, sorted data through unchanged (and does not warn)", () => {
    const data = [
      { x: jan1, y: [1, 2, 0.5, 1.5], v: 10 },
      { x: jan1 + H, y: [1.5, 3, 1, 2] },
    ];
    const out = Utils.normalizeOHLC(data);
    expect(out).toEqual(data);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("drops malformed points (bad x, bad/short y, non-finite numbers)", () => {
    const good1 = { x: jan1, y: [1, 2, 0, 1] };
    const good2 = { x: jan1 + H, y: [1, 3, 1, 2] };
    const data = [
      good1,
      null, // not an object
      { x: null, y: [1, 2, 0, 1] }, // nullish x
      { x: "not-a-date", y: [1, 2, 0, 1] }, // unparseable x
      { x: jan1 + 2 * H, y: [1, 2, 0] }, // short y
      { x: jan1 + 3 * H, y: [1, NaN, 0, 1] }, // non-finite
      { x: jan1 + 4 * H, y: [1, Infinity, 0, 1] }, // non-finite
      { x: jan1 + 5 * H }, // missing y
      good2,
    ];
    const out = Utils.normalizeOHLC(data);
    expect(out).toEqual([good1, good2]);
    expect(warnSpy).toHaveBeenCalledTimes(1); // one "dropped N" warning
    expect(warnSpy.mock.calls[0].join(" ")).toMatch(/Dropped 7 malformed/);
  });

  it("reorders out-of-order points ascending by timestamp", () => {
    const data = [
      { x: jan1 + 2 * H, y: [3, 3, 3, 3] },
      { x: jan1, y: [1, 1, 1, 1] },
      { x: jan1 + H, y: [2, 2, 2, 2] },
    ];
    const out = Utils.normalizeOHLC(data);
    expect(out.map((p) => p.x)).toEqual([jan1, jan1 + H, jan1 + 2 * H]);
    expect(warnSpy.mock.calls.some((c) => /ascending time order/.test(c.join(" ")))).toBe(true);
  });

  it("accepts Date and date-string x values for ordering checks", () => {
    const data = [
      { x: new Date("2024-01-01T02:00:00Z"), y: [3, 3, 3, 3] },
      { x: "2024-01-01T00:00:00Z", y: [1, 1, 1, 1] },
    ];
    const out = Utils.normalizeOHLC(data);
    // reordered: the string-dated 00:00 point comes first
    expect(out[0].y[0]).toBe(1);
  });

  it("does not mutate the input array", () => {
    const data = [
      { x: jan1 + H, y: [2, 2, 2, 2] },
      { x: jan1, y: [1, 1, 1, 1] },
    ];
    const snapshot = data.slice();
    Utils.normalizeOHLC(data);
    expect(data).toEqual(snapshot); // same order, same refs
    expect(data[0].x).toBe(jan1 + H);
  });

  it("keeps a single valid point", () => {
    const data = [{ x: jan1, y: [1, 2, 0, 1] }];
    expect(Utils.normalizeOHLC(data)).toEqual(data);
  });
});
