export default class IndicatorHandlers {
    /**
     * Updates or adds an indicator to the chart
     * @param {string} indicatorKey - The key/name of the indicator to update
     * @param {Object} context - The ApexStock instance
     */
    static updateIndicator(indicatorKey: string, context: any): void;
    /**
     * Removes an indicator from the chart
     * @param {string} indicatorKey - The key/name of the indicator to remove
     * @param {Object} context - The ApexStock instance
     */
    static removeIndicator(indicatorKey: string, context: any): void;
}
