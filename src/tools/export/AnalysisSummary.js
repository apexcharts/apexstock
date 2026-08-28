import Utils from "../../utils/Utils";

/**
 * Turn analysis results into the plain text lines that go under a chart in an
 * exported PDF: the "what am I looking at" block a screenshot alone cannot
 * carry.
 *
 * Pure and DOM-free, and deliberately text-only (no layout, no bytes): the
 * caller gathers the statistics from the chart, {@link PdfExport} does the byte
 * assembly, and this decides what is worth saying and how to word it. That
 * keeps the wording testable without a browser, a canvas, or a PDF reader.
 *
 * Formatting matches the on-chart {@link ../../components/AnalysisPanel.js
 * AnalysisPanel}: percentages carry an explicit sign and two decimals, volumes
 * are compacted (1.20M), and anything the data could not support reads as a
 * dash rather than a plausible-looking zero.
 *
 * Output is ASCII on purpose. A PDF base-14 font gives us Latin-1 at best, and
 * a report is not the place to discover that an en space or a Greek delta came
 * out as a mojibake box.
 */

/** A percentage with an explicit sign, or a dash. */
function pct(v, sign = true) {
  if (v == null || !Number.isFinite(Number(v))) return "-";
  const n = Number(v);
  return `${sign && n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

/** A price at 2dp, or a dash. */
function price(v) {
  if (v == null || !Number.isFinite(Number(v))) return "-";
  return String(Utils.truncateNumber(Number(v)));
}

/** A compacted volume, or a dash. */
function vol(v) {
  const out = Utils.compactNumber(v);
  return out === "" ? "-" : out;
}

/** ISO yyyy-mm-dd for epoch ms, else the value as given. */
function date(x) {
  if (typeof x === "number" && Number.isFinite(x)) {
    const d = new Date(x);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return String(x == null ? "-" : x);
}

/** Join `label value` pairs into one line, skipping the unavailable ones. */
function fields(pairs) {
  return pairs
    .filter(([, v]) => v != null && v !== "-")
    .map(([k, v]) => `${k} ${v}`)
    .join("    ");
}

export default class AnalysisSummary {
  /**
   * Build the summary lines.
   *
   * @param {Object} input
   * @param {string} [input.title] - Usually the instrument name.
   * @param {import("../../types.js").RangeStats|null} [input.stats] - The window
   *   being summarized (typically the visible range, or the whole series).
   * @param {import("../../types.js").ComparisonRow[]} [input.comparison] - The
   *   leaderboard, when comparison is active.
   * @param {number} [input.maxRows=6] - Cap on comparison rows, so a long watch
   *   list cannot push the chart off the page. The overflow is stated, not
   *   silently dropped.
   * @returns {string[]} One entry per line; empty when there is nothing to say.
   */
  static build(input = {}) {
    const lines = [];
    const stats = input.stats || null;
    const rows = Array.isArray(input.comparison) ? input.comparison : [];

    if (stats) {
      const head = [
        input.title || "Range",
        date(stats.from.x),
        "to",
        date(stats.to.x),
      ]
        .filter(Boolean)
        .join(" ");
      lines.push(`${head}    ${stats.bars} bars`);

      lines.push(
        fields([
          [
            "Change",
            `${price(stats.change.absolute)} (${pct(stats.change.percent)})`,
          ],
          ["High", stats.high ? price(stats.high.value) : null],
          ["Low", stats.low ? price(stats.low.value) : null],
          ["Avg", price(stats.average.close)],
          [
            "Volume",
            stats.total.volume == null ? null : vol(stats.total.volume),
          ],
        ])
      );

      const secondary = fields([
        ["Annualized", stats.annualized ? pct(stats.annualized.return) : null],
        [
          "Volatility",
          stats.volatility
            ? `${pct(stats.volatility.stdev, false)} per bar` +
              (stats.volatility.annualized == null
                ? ""
                : ` / ${pct(stats.volatility.annualized, false)} annualized`)
            : null,
        ],
        [
          "Max drawdown",
          stats.drawdown && stats.drawdown.max != null
            ? pct(stats.drawdown.max, false)
            : null,
        ],
      ]);
      if (secondary) lines.push(secondary);
    }

    if (rows.length) {
      const max = Number.isInteger(input.maxRows) ? input.maxRows : 6;
      if (lines.length) lines.push("");
      lines.push("Comparison");
      const shown = rows.slice(0, Math.max(0, max));
      shown.forEach((r) => {
        const parts = [
          `${r.rank ? `${r.rank}.` : "-"} ${r.name}${r.primary ? " (primary)" : ""}`,
          pct(r.change.percent),
        ];
        if (r.benchmark) {
          parts.push("(benchmark)");
        } else if (r.relative != null) {
          parts.push(`(${pct(r.relative)} vs benchmark)`);
        }
        lines.push(`  ${parts.join("    ")}`);
      });
      if (rows.length > shown.length) {
        lines.push(`  ... and ${rows.length - shown.length} more`);
      }
    }

    return lines;
  }
}
