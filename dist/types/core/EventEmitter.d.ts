/**
 * A tiny, dependency-free publish/subscribe emitter backing ApexStock's public
 * event API (`ApexStock#on` / `off` / `once` / `emit`). It is deliberately
 * minimal: string event names, single-argument payloads, and unsubscribe
 * handles.
 *
 * Handlers are stored per event name in insertion order and invoked
 * synchronously. A throwing handler is logged (via {@link Utils.warn}) and does
 * not prevent the remaining handlers for that event from running, so one buggy
 * subscriber cannot break the chart's own internal wiring.
 */
export default class EventEmitter {
    /**
     * Event name -> ordered set of handlers.
     * @type {Map<string, Set<Function>>}
     */
    _handlers: Map<string, Set<Function>>;
    /**
     * Subscribe to an event.
     * @param {string} name - Event name (e.g. "crosshairMove").
     * @param {Function} handler - Called with the event payload.
     * @returns {() => void} An unsubscribe function; calling it removes `handler`.
     */
    on(name: string, handler: Function): () => void;
    /**
     * Subscribe to an event for a single emission; the handler is removed right
     * before it runs.
     * @param {string} name
     * @param {Function} handler
     * @returns {() => void} An unsubscribe function (useful if the event never fires).
     */
    once(name: string, handler: Function): () => void;
    /**
     * Unsubscribe. With a handler, removes just that handler; without one,
     * removes every handler for `name`.
     * @param {string} name
     * @param {Function} [handler]
     * @returns {void}
     */
    off(name: string, handler?: Function): void;
    /**
     * Emit an event to all current subscribers. Iterates over a snapshot so a
     * handler may safely subscribe/unsubscribe during dispatch.
     * @param {string} name
     * @param {*} [payload] - Passed as the single argument to each handler.
     * @returns {void}
     */
    emit(name: string, payload?: any): void;
    /**
     * Number of handlers registered for an event (0 if none).
     * @param {string} name
     * @returns {number}
     */
    listenerCount(name: string): number;
    /**
     * Remove every handler for every event. Called on {@link ApexStock#destroy}.
     * @returns {void}
     */
    clear(): void;
}
