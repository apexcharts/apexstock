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
     * Resolve the per-instance indicator config from the registry defaults plus the
     * consumer's `indicators` option, producing the `{ overlays, oscillators,
     * indicators }` maps the chart keeps. Pure (no DOM / chart), so it is unit
     * testable in isolation; this is the logic lifted out of the constructor.
     *
     * `indicators` accepts three shapes:
     * - `undefined` -> every registry indicator available, defaulted to enabled.
     * - an object (`{ "rsi": { enabled, chartOptions? }, ... }`) -> becomes the
     *   `indicators` map verbatim, and any key that matches a known overlay/
     *   oscillator copies that config into the matching map.
     * - an array of names (`["rsi", "moving average"]`) -> each becomes
     *   `{ enabled: true }` in `indicators` and (if known) its overlay/oscillator map.
     *
     * Registry-kind "custom" (fibonacci) is grouped with the overlays (per
     * {@link getDefaultConfig}); the indicator dropdown relies on this to classify
     * it as a non-oscillator.
     *
     * @param {Object|Array<string>|undefined} userIndicators - `stockChartOptions.indicators`.
     * @returns {{ overlays: Object, oscillators: Object, indicators: Object }}
     */
    static resolveIndicatorConfig(userIndicators: any | Array<string> | undefined): {
        overlays: any;
        oscillators: any;
        indicators: any;
    };
    /**
     * Updates or adds an indicator to the chart. If the indicator is already
     * active, this toggles it off (removes it).
     * @param {string} indicatorKey - The key/name of the indicator to update.
     * @param {import("../ApexStock.js").default} context - The ApexStock instance.
     */
    static updateIndicator(indicatorKey: string, context: import("../ApexStock.js").default): void;
    /**
     * Recompute an already-active indicator's data over the current series and push
     * it into the EXISTING overlay series / oscillator pane / annotation, WITHOUT
     * tearing anything down. This is the data-only fast path for {@link
     * ../ApexStock.js#update} on a series change (theme changes still go through the
     * full {@link updateIndicator} rebuild, since they also restyle the pane chrome).
     *
     * - Overlay: rebuild its series and push via the main chart's `updateSeries`
     *   (the overlay was dropped when `update()` replaced the price series, so this
     *   re-adds it with fresh data in a single call rather than remove-then-add).
     * - Oscillator: the pane is a separate, still-alive ApexCharts instance, so
     *   `updateSeries` refreshes its data in place (no destroy/recreate/render).
     * - Custom (fibonacci): re-evaluate its annotation levels via the stored handle.
     *
     * @param {string} indicatorKey
     * @param {import("../ApexStock.js").default} context
     * @returns {boolean} true if updated in place; false if it must fall back to a
     *   full rebuild (unknown key, missing pane, or a builder that opted out).
     */
    static updateIndicatorDataInPlace(indicatorKey: string, context: import("../ApexStock.js").default): boolean;
    /**
     * Removes an indicator from the chart.
     * @param {string} indicatorKey - The key/name of the indicator to remove.
     * @param {import("../ApexStock.js").default} context - The ApexStock instance.
     */
    static removeIndicator(indicatorKey: string, context: import("../ApexStock.js").default): void;
}
