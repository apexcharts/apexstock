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
    static build(input?: {
        title?: string;
        stats?: import("../../types.js").RangeStats | null;
        comparison?: import("../../types.js").ComparisonRow[];
        maxRows?: number;
    }): string[];
}
