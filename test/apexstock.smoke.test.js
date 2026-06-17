// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import ApexStock from "../src/ApexStock.js";

function makeOptions() {
  const data = Array.from({ length: 40 }, (_, i) => ({
    x: new Date(2020, 0, i + 1).getTime(),
    y: [10 + i, 12 + i, 9 + i, 11 + i],
    v: 1000 + i,
  }));
  return {
    chart: { height: 400 },
    theme: { mode: "light" },
    series: [{ name: "Price", data }],
  };
}

function makeContainer() {
  // ApexStock reads chartEl.parentNode, so the container needs a parent.
  const parent = document.createElement("div");
  const container = document.createElement("div");
  parent.appendChild(container);
  document.body.appendChild(parent);
  return container;
}

describe("ApexStock (smoke)", () => {
  beforeEach(() => {
    const apexInstance = {
      render: vi.fn().mockResolvedValue(undefined),
      updateSeries: vi.fn(),
      updateOptions: vi.fn(),
      destroy: vi.fn(),
      addEventListener: vi.fn(),
      w: { globals: { chartID: "test-chart" }, config: {} },
    };
    // ApexStock instantiates `new ApexCharts(...)` from the global scope, so the
    // mock must be constructable (a regular function, not an arrow).
    global.ApexCharts = vi.fn(function () {
      return apexInstance;
    });
  });

  afterEach(() => {
    document.body.innerHTML = "";
    delete global.ApexCharts;
  });

  it("exposes the public static API", () => {
    expect(typeof ApexStock).toBe("function");
    expect(typeof ApexStock.setLicense).toBe("function");
  });

  it("constructs without throwing and builds the chart scaffold", () => {
    const container = makeContainer();
    const inst = new ApexStock(container, makeOptions());
    expect(inst).toBeTruthy();
    expect(container.querySelector(".apexstock-main-chart")).not.toBeNull();
    expect(global.ApexCharts).toHaveBeenCalled();
  });

  it("throws a clear error when given an invalid container", () => {
    expect(() => new ApexStock(null, makeOptions())).toThrow(/container/i);
  });

  it("throws when series data is missing", () => {
    const container = makeContainer();
    expect(() => new ApexStock(container, { chart: { height: 300 } })).toThrow();
  });

  it("does not throw when constructed with an explicit `theme: undefined`", () => {
    // ApexCharts v5 dereferences config.theme.mode unconditionally; an explicit
    // undefined theme must be stripped so it falls back to the default.
    const container = makeContainer();
    const opts = makeOptions();
    opts.theme = undefined;
    expect(() => new ApexStock(container, opts)).not.toThrow();
    // sanitizeTheme should have removed the nullish key from the merged options.
    const inst = new ApexStock(makeContainer(), { ...makeOptions(), theme: null });
    expect("theme" in inst.mainChartOptions).toBe(false);
  });

  it("sanitizeTheme drops a nullish theme but keeps a valid one", () => {
    const inst = new ApexStock(makeContainer(), makeOptions());
    const a = { theme: undefined };
    inst.sanitizeTheme(a);
    expect("theme" in a).toBe(false);

    const b = { theme: { mode: "dark" } };
    inst.sanitizeTheme(b);
    expect(b.theme).toEqual({ mode: "dark" });
  });
});
