class Utils {
  /**
   * When true, suppresses non-error log/warn output. Errors always surface.
   * Consumers can silence library logging via `Utils.silent = true`.
   * @type {boolean}
   */
  static silent = false;

  /** @type {string} Prefix prepended to all library log output. */
  static logPrefix = "[ApexStock]";

  /**
   * Per-element bounding-rect cache backing {@link cachedRect}. A WeakMap so
   * entries are released when their element is garbage-collected.
   * @type {WeakMap<Element, {rect: DOMRect, time: number}>}
   */
  static _rectCache = new WeakMap();

  /**
   * Logs an informational message (suppressed when `Utils.silent` is true).
   * @param {...*} args
   */
  static log(...args) {
    if (Utils.silent) return;
    console.log(Utils.logPrefix, ...args);
  }

  /**
   * Logs a warning (suppressed when `Utils.silent` is true).
   * @param {...*} args
   */
  static warn(...args) {
    if (Utils.silent) return;
    console.warn(Utils.logPrefix, ...args);
  }

  /**
   * Logs an error. Always surfaces, even when `Utils.silent` is true.
   * @param {...*} args
   */
  static error(...args) {
    console.error(Utils.logPrefix, ...args);
  }

  static truncateNumber(val) {
    if (val === null) return val;
    return Number(val.toFixed(2));
  }

  // Type checking that works across different window objects
  static is(type, val) {
    return Object.prototype.toString.call(val) === "[object " + type + "]";
  }

  static isObject(item) {
    return (
      item && typeof item === "object" && !Array.isArray(item) && item != null
    );
  }

  // to extend defaults with user options
  // credit: http://stackoverflow.com/questions/27936772/deep-object-merging-in-es6-es7#answer-34749873
  static extend(target, source) {
    if (typeof Object.assign !== "function") {
      (function () {
        Object.assign = function (target) {
          "use strict";
          // We must check against these specific cases.
          if (target === undefined || target === null) {
            throw new TypeError("Cannot convert undefined or null to object");
          }

          let output = Object(target);
          for (let index = 1; index < arguments.length; index++) {
            let source = arguments[index];
            if (source !== undefined && source !== null) {
              for (let nextKey in source) {
                if (source.hasOwnProperty(nextKey)) {
                  output[nextKey] = source[nextKey];
                }
              }
            }
          }
          return output;
        };
      })();
    }

    let output = Object.assign({}, target);
    if (this.isObject(target) && this.isObject(source)) {
      Object.keys(source).forEach((key) => {
        if (this.isObject(source[key])) {
          if (!(key in target)) {
            Object.assign(output, {
              [key]: source[key],
            });
          } else {
            output[key] = this.extend(target[key], source[key]);
          }
        } else {
          Object.assign(output, {
            [key]: source[key],
          });
        }
      });
    }
    return output;
  }
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
  static normalizeOHLC(data) {
    if (!Array.isArray(data)) return [];

    const toTs = (x) => (typeof x === "number" ? x : new Date(x).getTime());
    const isFiniteNum = (n) => typeof n === "number" && Number.isFinite(n);

    let dropped = 0;
    const clean = [];
    for (const p of data) {
      const y = p && p.y;
      const valid =
        p &&
        p.x != null &&
        !Number.isNaN(toTs(p.x)) &&
        Array.isArray(y) &&
        y.length >= 4 &&
        isFiniteNum(y[0]) &&
        isFiniteNum(y[1]) &&
        isFiniteNum(y[2]) &&
        isFiniteNum(y[3]);
      if (valid) {
        clean.push(p);
      } else {
        dropped++;
      }
    }
    if (dropped > 0) {
      Utils.warn(
        `Dropped ${dropped} malformed OHLC point(s): each needs a parseable \`x\` and a \`y\` whose first four entries [open, high, low, close] are finite numbers.`
      );
    }

    let outOfOrder = false;
    for (let i = 1; i < clean.length; i++) {
      if (toTs(clean[i].x) < toTs(clean[i - 1].x)) {
        outOfOrder = true;
        break;
      }
    }
    if (outOfOrder) {
      clean.sort((a, b) => toTs(a.x) - toTs(b.x));
      Utils.warn(
        "OHLC series was not in ascending time order; reordered by timestamp."
      );
    }

    return clean;
  }

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
  static rafThrottle(fn) {
    const raf =
      typeof requestAnimationFrame === "function"
        ? requestAnimationFrame
        : (cb) => setTimeout(cb, 16);
    const caf =
      typeof cancelAnimationFrame === "function"
        ? cancelAnimationFrame
        : clearTimeout;

    let rafId = null;
    let lastArgs = null;

    const throttled = function (...args) {
      lastArgs = args;
      if (rafId !== null) return;
      rafId = raf(() => {
        rafId = null;
        fn.apply(this, lastArgs);
      });
    };

    throttled.cancel = () => {
      if (rafId !== null) {
        caf(rafId);
        rafId = null;
      }
    };

    return throttled;
  }

  /**
   * Returns an element's bounding rect, reused within `ttl` ms to avoid forcing
   * a layout reflow on every call (e.g. once per mousemove during a drag). The
   * cache is keyed on the element identity, so a fresh node (an ApexCharts
   * re-render) misses automatically, and it self-corrects after the TTL on
   * scroll / zoom / resize.
   * @param {Element} el
   * @param {number} [ttl=100]
   * @returns {DOMRect}
   */
  static cachedRect(el, ttl = 100) {
    const now = Date.now();
    const hit = Utils._rectCache.get(el);
    if (hit && now - hit.time < ttl) return hit.rect;
    const rect = el.getBoundingClientRect();
    Utils._rectCache.set(el, { rect, time: now });
    return rect;
  }

  /**
   * Generates a unique ID for an element
   * @param {string} type - Element type
   * @returns {string} - A unique ID
   */
  static generateUniqueId(type) {
    // Generate a UUID v4-like ID for maximum uniqueness
    return `${type}-${([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(
      /[018]/g,
      (c) =>
        (
          c ^
          (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))
        ).toString(16)
    )}`;
  }
}

export default Utils;
