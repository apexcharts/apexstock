// @vitest-environment node
//
// AnalysisSummary: the text block that goes under the chart in an exported PDF.
// Pure, so the wording and the "say nothing rather than something wrong" rules
// are testable without a browser or a PDF reader.
import { describe, it, expect } from "vitest";
import AnalysisSummary from "../src/tools/export/AnalysisSummary.js";
import Statistics from "../src/analysis/Statistics.js";
import { dailyOhlc } from "./fixtures.js";

const series = dailyOhlc([100, 110, 120, 90, 80, 95, 121, 115], {
  highs: [101, 111, 121, 91, 81, 96, 122, 116],
  lows: [99, 109, 119, 89, 79, 94, 120, 114],
  volumes: [1e6, 2e6, 1e6, 3e6, 1e6, 1e6, 1e6, 1e6],
});

const statsFor = (from, to, opts) =>
  Statistics.rangeStats(series, from, to, opts);

const row = (over) => ({
  name: "AAA",
  color: "#000",
  primary: false,
  benchmark: false,
  from: 1,
  to: 2,
  start: 10,
  end: 12,
  change: { absolute: 2, percent: 20 },
  relative: 5,
  high: { value: 12, x: 2 },
  low: { value: 10, x: 1 },
  volatility: null,
  drawdown: null,
  bars: 2,
  coverage: { bars: 2, filled: 0, firstX: 1, lastX: 2 },
  rank: 1,
  ...over,
});

describe("AnalysisSummary.build", () => {
  it("says nothing when there is nothing to say", () => {
    expect(AnalysisSummary.build()).toEqual([]);
    expect(AnalysisSummary.build({ stats: null, comparison: [] })).toEqual([]);
  });

  it("leads with the instrument, the dates, and the bar count", () => {
    const lines = AnalysisSummary.build({
      title: "AAPL",
      stats: statsFor(0, 7),
    });
    expect(lines[0]).toBe("AAPL 2024-01-01 to 2024-01-08    8 bars");
  });

  it("reports the change, extremes, average, and volume on one line", () => {
    const lines = AnalysisSummary.build({ stats: statsFor(0, 7) });
    // 100 -> 115 over the window; the true high/low come from the bars.
    expect(lines[1]).toContain("Change 15 (+15.00%)");
    expect(lines[1]).toContain("High 122");
    expect(lines[1]).toContain("Low 79");
    expect(lines[1]).toContain("Volume 11.00M");
  });

  it("reports volatility and the max drawdown", () => {
    const lines = AnalysisSummary.build({ stats: statsFor(0, 7) });
    const line = lines[2];
    expect(line).toContain("per bar");
    expect(line).toContain("annualized");
    // 80 against a 120 peak: a 33.33% drawdown, unsigned (never positive).
    expect(line).toContain("Max drawdown -33.33%");
  });

  it("omits an annualized return the span cannot support", () => {
    // Two bars is one day: annualizing it would be a fiction, so the engine
    // returns null and the summary simply does not mention it.
    const lines = AnalysisSummary.build({ stats: statsFor(0, 1) });
    expect(lines.join("\n")).not.toContain("Annualized");
  });

  it("includes an annualized return over a long enough span", () => {
    const long = dailyOhlc(Array.from({ length: 120 }, (_, i) => 100 + i));
    const lines = AnalysisSummary.build({
      stats: Statistics.rangeStats(long, 0, 119),
    });
    expect(lines[2]).toContain("Annualized");
  });

  it("renders the comparison leaderboard with ranks and excess return", () => {
    const lines = AnalysisSummary.build({
      title: "AAPL",
      stats: statsFor(0, 7),
      comparison: [
        row({
          name: "AAPL",
          primary: true,
          rank: 2,
          change: { absolute: 15, percent: 15 },
          relative: -5,
        }),
        row({
          name: "NVDA",
          rank: 1,
          change: { absolute: 40, percent: 40 },
          relative: 20,
        }),
        row({
          name: "SPY",
          rank: 3,
          benchmark: true,
          change: { absolute: 5, percent: 5 },
        }),
      ],
    });
    const block = lines.slice(lines.indexOf("Comparison"));
    expect(block[0]).toBe("Comparison");
    expect(block[1]).toBe(
      "  2. AAPL (primary)    +15.00%    (-5.00% vs benchmark)"
    );
    expect(block[2]).toBe("  1. NVDA    +40.00%    (+20.00% vs benchmark)");
    expect(block[3]).toBe("  3. SPY    +5.00%    (benchmark)");
  });

  it("works with a comparison and no range statistics", () => {
    const lines = AnalysisSummary.build({ comparison: [row({})] });
    expect(lines[0]).toBe("Comparison");
  });

  it("caps the leaderboard and says how much it dropped", () => {
    const rows = Array.from({ length: 9 }, (_, i) =>
      row({ name: `S${i}`, rank: i + 1 })
    );
    const lines = AnalysisSummary.build({ comparison: rows, maxRows: 4 });
    expect(
      lines.filter((l) => l.startsWith("  ") && !l.includes("more"))
    ).toHaveLength(4);
    expect(lines[lines.length - 1]).toBe("  ... and 5 more");
  });

  it("prints a dash rather than a plausible-looking zero", () => {
    // A stats object the engine could only partly fill in: the summary has to
    // say "unavailable", not invent a number.
    const partial = {
      from: { x: "2024-W01", index: 0, value: 1 },
      to: { x: "2024-W02", index: 1, value: 1 },
      bars: 2,
      change: { absolute: null, percent: null },
      high: null,
      low: null,
      average: { close: null, volume: null },
      total: { volume: null },
      annualized: null,
      volatility: null,
      drawdown: { max: null },
    };
    const lines = AnalysisSummary.build({ title: "X", stats: partial });
    // A non-numeric x (a category axis) is printed as given.
    expect(lines[0]).toBe("X 2024-W01 to 2024-W02    2 bars");
    expect(lines[1]).toBe("Change - (-)");
    // Nothing else could be computed, so there is no third line at all.
    expect(lines).toHaveLength(2);
  });

  it("omits an annualized volatility it cannot annualize", () => {
    const stats = {
      ...statsFor(0, 7),
      volatility: {
        stdev: 4.5,
        annualized: null,
        periodsPerYear: null,
        inferred: false,
      },
    };
    const lines = AnalysisSummary.build({ stats });
    expect(lines[2]).toContain("Volatility 4.50% per bar");
    expect(lines[2]).not.toContain("annualized");
  });

  it("emits ASCII only, so a base-14 PDF font can set it", () => {
    const lines = AnalysisSummary.build({
      title: "AAPL",
      stats: statsFor(0, 7),
      comparison: [row({})],
    });
    expect(lines.join("\n")).toMatch(/^[\x20-\x7e\n]*$/);
  });
});
