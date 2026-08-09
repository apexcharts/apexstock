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
     * Register a custom indicator so it is available to every ApexStock instance
     * created afterwards — usable via `updateIndicator(key)`, listed in the
     * indicators dropdown, and captured/restored by `getState`/`setState`. The
     * registry is global; register once at app startup, before constructing charts.
     *
     * Declarative form (recommended):
     * ```
     * ApexStock.registerIndicator("supertrend", {
     *   type: "overlay",                 // or "oscillator"
     *   defaultParams: { period: 10, multiplier: 3 },
     *   calc(series, params) {           // return one of:
     *     return series.map((bar) => ...);              //  (number|null)[]  (one line)
     *     // return { Upper: [...], Lower: [...] };      //  named multi-line map
     *     // return [{ name: "X", data: [{x,y}] }];      //  ready-made series
     *   },
     *   colors: ["#00E396"],             // optional stroke colors
     *   yaxis: { min: 0, max: 100 },     // optional (oscillator pane)
     *   stream: {                        // optional: live appendData() support
     *     seed(series, params) { return state; },
     *     step(state, series, params) { return { value, state }; },
     *     render(value, x) { return [{ name: "Supertrend", point: { x, y: value } }]; },
     *   },
     * });
     * ```
     * Advanced form: pass `{ kind, build/apply/remove }` to plug a raw registry
     * entry in verbatim (full control over the ApexCharts series/options).
     *
     * @param {string} name - Indicator key (case-insensitive; stored lowercased).
     * @param {object} def - Declarative or advanced definition.
     * @returns {string} The normalized (lowercased) key.
     */
    static register(name: string, def: object): string;
    /**
     * @param {string} key
     * @returns {boolean} true if `key` was added via {@link register} (not built-in).
     */
    static isCustomRegistered(key: string): boolean;
    /**
     * Default params contributed by custom indicators, merged into each instance's
     * OscillatorSettings so they surface in the settings UI and round-trip via
     * getState().
     * @returns {Object.<string, object>}
     */
    static getCustomDefaultParams(): {
        [x: string]: any;
    };
    /**
     * @param {string} key
     * @returns {boolean} true if `key` ships with the library (not custom-registered).
     */
    static isBuiltin(key: string): boolean;
    /**
     * Registry metadata for one indicator, or null if unknown. Static shape only
     * (no per-instance `active`/`params`); {@link ../ApexStock.js#getIndicator}
     * decorates it with instance state.
     * @param {string} key
     * @returns {{key: string, kind: string, type: "overlay"|"oscillator", label: string, builtin: boolean}|null}
     */
    static describe(key: string): {
        key: string;
        kind: string;
        type: "overlay" | "oscillator";
        label: string;
        builtin: boolean;
    } | null;
    /**
     * Registry metadata for every registered indicator (built-in + custom), in
     * registry order.
     * @returns {Array<{key: string, kind: string, type: "overlay"|"oscillator", label: string, builtin: boolean}>}
     */
    static list(): Array<{
        key: string;
        kind: string;
        type: "overlay" | "oscillator";
        label: string;
        builtin: boolean;
    }>;
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
