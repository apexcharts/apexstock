class Utils {
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
