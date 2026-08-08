import Utils from "../utils/Utils";

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
  constructor() {
    /**
     * Event name -> ordered set of handlers.
     * @type {Map<string, Set<Function>>}
     */
    this._handlers = new Map();
  }

  /**
   * Subscribe to an event.
   * @param {string} name - Event name (e.g. "crosshairMove").
   * @param {Function} handler - Called with the event payload.
   * @returns {() => void} An unsubscribe function; calling it removes `handler`.
   */
  on(name, handler) {
    if (typeof name !== "string" || typeof handler !== "function") {
      Utils.warn("on(name, handler) requires an event name and a function.");
      return () => {};
    }
    let set = this._handlers.get(name);
    if (!set) {
      set = new Set();
      this._handlers.set(name, set);
    }
    set.add(handler);
    return () => this.off(name, handler);
  }

  /**
   * Subscribe to an event for a single emission; the handler is removed right
   * before it runs.
   * @param {string} name
   * @param {Function} handler
   * @returns {() => void} An unsubscribe function (useful if the event never fires).
   */
  once(name, handler) {
    if (typeof handler !== "function") {
      Utils.warn("once(name, handler) requires a function.");
      return () => {};
    }
    const wrapped = (payload) => {
      this.off(name, wrapped);
      handler(payload);
    };
    return this.on(name, wrapped);
  }

  /**
   * Unsubscribe. With a handler, removes just that handler; without one,
   * removes every handler for `name`.
   * @param {string} name
   * @param {Function} [handler]
   * @returns {void}
   */
  off(name, handler) {
    const set = this._handlers.get(name);
    if (!set) return;
    if (handler) set.delete(handler);
    else set.clear();
    if (set.size === 0) this._handlers.delete(name);
  }

  /**
   * Emit an event to all current subscribers. Iterates over a snapshot so a
   * handler may safely subscribe/unsubscribe during dispatch.
   * @param {string} name
   * @param {*} [payload] - Passed as the single argument to each handler.
   * @returns {void}
   */
  emit(name, payload) {
    const set = this._handlers.get(name);
    if (!set || set.size === 0) return;
    for (const handler of Array.from(set)) {
      try {
        handler(payload);
      } catch (err) {
        Utils.warn(`A "${name}" event handler threw:`, err);
      }
    }
  }

  /**
   * Number of handlers registered for an event (0 if none).
   * @param {string} name
   * @returns {number}
   */
  listenerCount(name) {
    const set = this._handlers.get(name);
    return set ? set.size : 0;
  }

  /**
   * Remove every handler for every event. Called on {@link ApexStock#destroy}.
   * @returns {void}
   */
  clear() {
    this._handlers.clear();
  }
}
