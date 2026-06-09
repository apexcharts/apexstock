/**
 * LayoutManager — pure layout math for the main chart and indicator panes.
 *
 * Extracted from the ApexStock god-object so the height calculations can be
 * reasoned about and unit-tested without a DOM. No DOM or chart access here.
 */
export default class LayoutManager {
  /** Fraction of the available height (excluding the x-axis) given to the main chart. */
  static MAIN_CHART_RATIO = 0.6;
  /** Fraction of the available height (excluding the x-axis) given to the indicator area. */
  static INDICATOR_AREA_RATIO = 0.4;
  /** Vertical offset (px) applied to each indicator pane for visual spacing. */
  static INDICATOR_CHART_TOP_OFFSET = 18;

  /**
   * Compute chart heights for the current layout.
   * @param {Object} params
   * @param {number} params.totalHeight - Total height available to the widget.
   * @param {number} params.xAxisHeight - Height reserved for the shared x-axis.
   * @param {number} params.indicatorCount - Number of indicator panes.
   * @returns {{ newMainHeight: number, indicatorContainerHeight: number, indicatorHeight: number }}
   */
  static computeHeights({ totalHeight, xAxisHeight, indicatorCount }) {
    const totalHeightWithoutXAxis = totalHeight - xAxisHeight;

    const newMainHeight = Math.floor(
      LayoutManager.MAIN_CHART_RATIO * totalHeightWithoutXAxis
    );

    const indicatorContainerHeight = Math.floor(
      LayoutManager.INDICATOR_AREA_RATIO * totalHeightWithoutXAxis
    );

    const indicatorHeight =
      indicatorCount > 0
        ? Math.floor(indicatorContainerHeight / indicatorCount)
        : 0;

    return { newMainHeight, indicatorContainerHeight, indicatorHeight };
  }
}
