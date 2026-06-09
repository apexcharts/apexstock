export default class IndicatorHandlers {
    /**
     * Updates or adds an indicator to the chart. If the indicator is already
     * active, this toggles it off (removes it).
     * @param {string} indicatorKey - The key/name of the indicator to update.
     * @param {import("../ApexStock.js").default} context - The ApexStock instance.
     */
    static updateIndicator(indicatorKey: string, context: import("../ApexStock.js").default): void;
    /**
     * Removes an indicator from the chart.
     * @param {string} indicatorKey - The key/name of the indicator to remove.
     * @param {import("../ApexStock.js").default} context - The ApexStock instance.
     */
    static removeIndicator(indicatorKey: string, context: import("../ApexStock.js").default): void;
}
