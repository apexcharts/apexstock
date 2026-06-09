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
     * @param {Object} params
     * @param {number} params.totalHeight - Total height available to the widget.
     * @param {number} params.xAxisHeight - Height reserved for the shared x-axis.
     * @param {number} params.indicatorCount - Number of indicator panes.
     * @returns {{ newMainHeight: number, indicatorContainerHeight: number, indicatorHeight: number }}
     */
    static computeHeights({ totalHeight, xAxisHeight, indicatorCount }: {
        totalHeight: number;
        xAxisHeight: number;
        indicatorCount: number;
    }): {
        newMainHeight: number;
        indicatorContainerHeight: number;
        indicatorHeight: number;
    };
}
