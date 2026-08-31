/**
 * LayoutManager — pure layout math for the main chart and indicator panes.
 *
 * Extracted from the ApexStock god-object so the height calculations can be
 * reasoned about and unit-tested without a DOM. No DOM or chart access here.
 */
export default class LayoutManager {
    /** Fraction of the available height (excluding the x-axis) given to the main chart. */
    static MAIN_CHART_RATIO: number;
    /** Fraction of the available height (excluding the x-axis) given to the indicator area. */
    static INDICATOR_AREA_RATIO: number;
    /** Vertical offset (px) applied to each indicator pane for visual spacing. */
    static INDICATOR_CHART_TOP_OFFSET: number;
    /**
     * Compute chart heights for the current layout.
     *
     * Panes share the indicator area evenly unless `weights` is given, in which
     * case they divide it in proportion (a pane with weight 2 gets twice the room
     * of one with weight 1). The rounding remainder goes to the last pane, so the
     * pane heights always add up to the container height exactly and no gap opens
     * at the bottom.
     *
     * @param {Object} params
     * @param {number} params.totalHeight - Total height available to the widget.
     * @param {number} params.xAxisHeight - Height reserved for the shared x-axis.
     * @param {number} params.indicatorCount - Number of indicator panes.
     * @param {number[]} [params.weights] - Relative height per pane, in pane
     *   order. Ignored unless it has one usable positive number per pane.
     * @returns {{ newMainHeight: number, indicatorContainerHeight: number, indicatorHeight: number, indicatorHeights: number[] }}
     *   `indicatorHeight` is the even split (what a single unweighted pane gets);
     *   `indicatorHeights` is the per-pane height, weighted when weights apply.
     */
    static computeHeights({ totalHeight, xAxisHeight, indicatorCount, weights }: {
        totalHeight: number;
        xAxisHeight: number;
        indicatorCount: number;
        weights?: number[];
    }): {
        newMainHeight: number;
        indicatorContainerHeight: number;
        indicatorHeight: number;
        indicatorHeights: number[];
    };
    /**
     * Split `total` px across `count` panes, in proportion to `weights` when they
     * are usable and evenly otherwise. The last pane absorbs the remainder.
     * @param {number} total
     * @param {number} count
     * @param {number[]} [weights]
     * @returns {number[]}
     */
    static distribute(total: number, count: number, weights?: number[]): number[];
}
