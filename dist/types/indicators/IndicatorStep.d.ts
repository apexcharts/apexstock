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
}
