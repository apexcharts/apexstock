export default IndicatorStep;
declare namespace IndicatorStep {
    function keys(): string[];
    function has(key: any): any;
    function streamableKeys(): string[];
    function isStreamable(registryKey: any): any;
    /**
     * Resolve a registry indicator key + its live params into the stepper key, the
     * params shape the stepper expects, where its series live ("overlay" on the
     * main chart vs "oscillator" pane), and a renderer that turns a stepped value
     * into the rendered point(s) for that indicator's series.
     * @param {string} registryKey - e.g. "moving average", "macd".
     * @param {any} [liveParams] - params from OscillatorSettings.getIndicatorParams.
     * @returns {{ key: string, params: any, kind: string, render: Function } | null}
     *   null if not streamable.
     */
    function resolve(registryKey: string, liveParams?: any): {
        key: string;
        params: any;
        kind: string;
        render: Function;
    } | null;
    /**
     * Capture initial state from history for indicator `key`.
     * @param {string} key
     * @param {any[]} series
     * @param {any} [params]
     */
    function seed(key: string, series: any[], params?: any): any;
    /**
     * Compute the indicator value at the series' last bar incrementally.
     * @param {string} key
     * @param {any} state - prior state (from seed/step)
     * @param {any[]} series - series INCLUDING the new last bar
     * @param {any} [params]
     * @returns {{ value: any, state: any }}
     */
    function step(key: string, state: any, series: any[], params?: any): {
        value: any;
        state: any;
    };
    /**
     * Register a streaming twin for a custom indicator so the `appendData()` path
     * updates it incrementally (instead of leaving it to a full recompute). Called
     * by `IndicatorHandlers.register` when a custom indicator supplies a `stream`.
     *
     * @param {string} registryKey - The (lowercased) indicator key, matching its
     *   INDICATOR_REGISTRY entry.
     * @param {Object} stepper
     * @param {"overlay"|"oscillator"} [stepper.kind="overlay"] - Where its series live.
     * @param {(series:any[], params:any) => any} stepper.seed - Capture state from history.
     * @param {(state:any, series:any[], params:any) => {value:any, state:any}} stepper.step -
     *   Advance state by the last bar; returns the value at that bar + next state.
     * @param {(value:any, x:*) => Array<{name:string, point:{x:*, y:*}}>} stepper.render -
     *   Turn a stepped value into the rendered point(s) for the indicator's series.
     * @param {(liveParams:any) => any} [stepper.params] - Translate live params to
     *   the shape seed/step expect (defaults to identity).
     * @returns {void}
     */
    function register(registryKey: string, stepper: {
        kind?: "overlay" | "oscillator";
        seed: (series: any[], params: any) => any;
        step: (state: any, series: any[], params: any) => {
            value: any;
            state: any;
        };
        render: (value: any, x: any) => Array<{
            name: string;
            point: {
                x: any;
                y: any;
            };
        }>;
        params?: (liveParams: any) => any;
    }): void;
}
