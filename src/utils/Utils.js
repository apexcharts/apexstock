class Utils {
  static truncateNumber(val) {
    if (val === null) return val;
    return Number(val.toFixed(2));
  }

  // Type checking that works across different window objects
  static is(type, val) {
    return Object.prototype.toString.call(val) === "[object " + type + "]";
  }
}

export default Utils;
