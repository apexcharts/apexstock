import { describe, it, expect, vi } from "vitest";
import EventEmitter from "../src/core/EventEmitter.js";

describe("EventEmitter", () => {
  it("delivers payloads to subscribers", () => {
    const em = new EventEmitter();
    const cb = vi.fn();
    em.on("evt", cb);
    em.emit("evt", { a: 1 });
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith({ a: 1 });
  });

  it("supports multiple handlers in insertion order", () => {
    const em = new EventEmitter();
    const order = [];
    em.on("evt", () => order.push("a"));
    em.on("evt", () => order.push("b"));
    em.emit("evt");
    expect(order).toEqual(["a", "b"]);
  });

  it("on() returns an unsubscribe handle", () => {
    const em = new EventEmitter();
    const cb = vi.fn();
    const off = em.on("evt", cb);
    off();
    em.emit("evt");
    expect(cb).not.toHaveBeenCalled();
    expect(em.listenerCount("evt")).toBe(0);
  });

  it("off(name) removes all handlers for that name", () => {
    const em = new EventEmitter();
    em.on("evt", vi.fn());
    em.on("evt", vi.fn());
    em.off("evt");
    expect(em.listenerCount("evt")).toBe(0);
  });

  it("once() fires exactly once", () => {
    const em = new EventEmitter();
    const cb = vi.fn();
    em.once("evt", cb);
    em.emit("evt", 1);
    em.emit("evt", 2);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith(1);
    expect(em.listenerCount("evt")).toBe(0);
  });

  it("emit is a no-op when there are no subscribers", () => {
    const em = new EventEmitter();
    expect(() => em.emit("nobody", 1)).not.toThrow();
  });

  it("a throwing handler does not stop later handlers", () => {
    const em = new EventEmitter();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const after = vi.fn();
    em.on("evt", () => {
      throw new Error("boom");
    });
    em.on("evt", after);
    em.emit("evt");
    expect(after).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it("a handler may unsubscribe itself during dispatch", () => {
    const em = new EventEmitter();
    const cb = vi.fn(() => em.off("evt", cb));
    em.on("evt", cb);
    em.emit("evt");
    em.emit("evt");
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("clear() removes every handler", () => {
    const em = new EventEmitter();
    em.on("a", vi.fn());
    em.on("b", vi.fn());
    em.clear();
    expect(em.listenerCount("a")).toBe(0);
    expect(em.listenerCount("b")).toBe(0);
  });

  it("ignores invalid subscriptions without throwing", () => {
    const em = new EventEmitter();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => em.on("evt", null)).not.toThrow();
    expect(() => em.on(123, vi.fn())).not.toThrow();
    expect(em.listenerCount("evt")).toBe(0);
    warn.mockRestore();
  });
});
