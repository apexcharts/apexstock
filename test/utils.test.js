import { describe, it, expect, vi, afterEach } from "vitest";
import Utils from "../src/utils/Utils.js";

describe("Utils.truncateNumber", () => {
  it("rounds to two decimals", () => {
    expect(Utils.truncateNumber(1.23456)).toBe(1.23);
    expect(Utils.truncateNumber(8.16497)).toBe(8.16);
  });

  it("passes null through unchanged", () => {
    expect(Utils.truncateNumber(null)).toBeNull();
  });
});

describe("Utils.isObject / is", () => {
  it("isObject distinguishes plain objects from arrays/null", () => {
    expect(Utils.isObject({})).toBe(true);
    expect(Utils.isObject([])).toBe(false);
    expect(Utils.isObject(null)).toBeFalsy();
  });

  it("is() does cross-realm-safe type checks", () => {
    expect(Utils.is("Array", [])).toBe(true);
    expect(Utils.is("Object", {})).toBe(true);
    expect(Utils.is("String", "x")).toBe(true);
  });
});

describe("Utils.extend (deep merge)", () => {
  it("deep-merges nested objects without mutating the target", () => {
    const target = { a: 1, nested: { x: 1, y: 2 } };
    const source = { b: 2, nested: { y: 20, z: 30 } };
    const result = Utils.extend(target, source);
    expect(result).toEqual({ a: 1, b: 2, nested: { x: 1, y: 20, z: 30 } });
    // target is untouched
    expect(target).toEqual({ a: 1, nested: { x: 1, y: 2 } });
  });
});

describe("Utils.rafThrottle", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("coalesces rapid calls into one invocation with the latest args", () => {
    vi.useFakeTimers();
    const spy = vi.fn();
    const throttled = Utils.rafThrottle(spy);
    throttled(1);
    throttled(2);
    throttled(3);
    expect(spy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(20);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(3);
  });

  it("cancel() drops a pending invocation", () => {
    vi.useFakeTimers();
    const spy = vi.fn();
    const throttled = Utils.rafThrottle(spy);
    throttled("a");
    throttled.cancel();
    vi.advanceTimersByTime(20);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("Utils logger", () => {
  afterEach(() => {
    Utils.silent = false;
    vi.restoreAllMocks();
  });

  it("warn is suppressed when silent, error always surfaces", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    Utils.silent = true;
    Utils.warn("hidden");
    Utils.error("shown");
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errSpy).toHaveBeenCalled();
  });

  it("prefixes output when not silent", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    Utils.warn("hello");
    expect(warnSpy).toHaveBeenCalledWith("[ApexStock]", "hello");
  });
});

describe("Utils.generateUniqueId", () => {
  it("produces a prefixed, reasonably unique id", () => {
    const a = Utils.generateUniqueId("line");
    const b = Utils.generateUniqueId("line");
    expect(a.startsWith("line-")).toBe(true);
    expect(a).not.toBe(b);
  });
});
