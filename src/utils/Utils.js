class Utils {
  static truncateNumber(val) {
    if (val === null) return val;
    return Number(val.toFixed(2));
  }
}

export default Utils;
