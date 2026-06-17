// Runs under Vitest's default `node` environment (no jsdom docblock), i.e. an
// environment with no `window`/`document` — the same conditions a server-side
// render sees. These tests lock in two SSR contracts:
//   1. The module is import-safe: importing it (and its transitive deps, incl.
//      `apex-commons` and the CSS-injection shim) touches no DOM at load time.
//   2. The pure static helpers work server-side, while *constructing* a chart
//      fails fast with a clear, actionable message instead of a cryptic
//      `document is not defined`.
import { describe, it, expect } from "vitest";
import ApexStock from "../src/ApexStock.js";

describe("ApexStock SSR / import-time safety", () => {
  it("imports without a DOM present (no window/document at module load)", () => {
    // If the import had touched the DOM at module scope, this file would have
    // thrown before reaching here. Assert the env really is DOM-less.
    expect(typeof window).toBe("undefined");
    expect(typeof document).toBe("undefined");
    expect(typeof ApexStock).toBe("function");
  });

  it("exposes pure static helpers that run server-side", () => {
    expect(typeof ApexStock.aggregateOHLC).toBe("function");
    expect(Array.isArray(ApexStock.INTERVALS)).toBe(true);

    const hourly = [
      { x: Date.UTC(2024, 0, 1, 0), y: [100, 105, 98, 102], v: 10 },
      { x: Date.UTC(2024, 0, 1, 1), y: [102, 110, 101, 108], v: 20 },
    ];
    const daily = ApexStock.aggregateOHLC(hourly, "1d");
    expect(daily).toHaveLength(1);
    expect(daily[0].y).toEqual([100, 110, 98, 108]);
    expect(daily[0].v).toBe(30);
  });

  it("throws a clear, actionable error when constructed without a DOM", () => {
    expect(() => new ApexStock({}, {})).toThrow(/server-side rendering/i);
    expect(() => new ApexStock(null, null)).toThrow(/No DOM is available/);
  });
});
