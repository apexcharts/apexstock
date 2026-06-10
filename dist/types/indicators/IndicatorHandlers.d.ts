export default class IndicatorHandlers {
    /**
     * Default indicator-availability config, derived from the registry so the
     * set of supported indicators lives in exactly one place. Oscillators render
     * in separate panes; everything else (overlays + the annotation-based
     * fibonacci) is grouped with the overlays. Each entry defaults to enabled.
     * @returns {{ overlays: Object.<string, {enabled: boolean}>, oscillators: Object.<string, {enabled: boolean}> }}
     */
    static getDefaultConfig(): {
        overlays: {
            [x: string]: {
                enabled: boolean;
            };
        };
        oscillators: {
            [x: string]: {
                enabled: boolean;
            };
        };
    };
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
