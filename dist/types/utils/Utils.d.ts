export default Utils;
declare class Utils {
    /**
     * When true, suppresses non-error log/warn output. Errors always surface.
     * Consumers can silence library logging via `Utils.silent = true`.
     * @type {boolean}
     */
    static silent: boolean;
    /** @type {string} Prefix prepended to all library log output. */
    static logPrefix: string;
    /**
     * Logs an informational message (suppressed when `Utils.silent` is true).
     * @param {...*} args
     */
    static log(...args: any[]): void;
    /**
     * Logs a warning (suppressed when `Utils.silent` is true).
     * @param {...*} args
     */
    static warn(...args: any[]): void;
    /**
     * Logs an error. Always surfaces, even when `Utils.silent` is true.
     * @param {...*} args
     */
    static error(...args: any[]): void;
    static truncateNumber(val: any): any;
    static is(type: any, val: any): boolean;
    static isObject(item: any): boolean;
    static extend(target: any, source: any): any;
    /**
     * Validate and normalize an OHLC series before it enters the chart pipeline.
     * Drops malformed points (a nullish/unparseable `x`, or a `y` that is not an
     * array whose first four entries `[open, high, low, close]` are finite
     * numbers) and guarantees ascending time order (a financial time series is
     * expected sorted; out-of-order input is stably reordered by timestamp).
     *
     * The input array is never mutated. A single, suppressible warning is emitted
     * per problem class (dropped points / reordering) so issues are visible
     * without being fatal — malformed data degrades gracefully instead of
     * throwing deep in an indicator or coordinate calculation.
     *
     * @param {import("../types.js").Series} data - Raw OHLC points.
     * @returns {import("../types.js").Series} A cleaned, time-sorted series (a new
     *   array; the happy path with valid, sorted input returns a shallow copy).
     */
    static normalizeOHLC(data: import("../types.js").Series): import("../types.js").Series;
    /**
     * Coalesces rapid calls into at most one invocation per animation frame,
     * always using the most recent arguments. Useful for high-frequency events
     * (mousemove, scroll) where only the latest state matters.
     *
     * Note: this defers work to a later frame, so it must NOT wrap logic that
     * needs a synchronous `preventDefault()`/`stopPropagation()` — call those
     * before invoking the throttled function.
     *
     * @param {Function} fn - The function to throttle.
     * @returns {Function & { cancel: () => void }} Throttled wrapper exposing
     *   a `cancel()` method that drops any pending frame.
     */
    static rafThrottle(fn: Function): Function & {
        cancel: () => void;
    };
    /**
     * Generates a unique ID for an element
     * @param {string} type - Element type
     * @returns {string} - A unique ID
     */
    static generateUniqueId(type: string): string;
}
