// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ApexStock from "../src/ApexStock.js";

// Vitest stubs the CSS import to "" (the real build inlines it via Rollup), so
// content assertions read the source stylesheet straight from disk. Vitest
// runs with the project root as cwd.
const SOURCE_CSS = readFileSync(
  resolve(process.cwd(), "src/ApexStock.css"),
  "utf8"
);

const STYLE_ID = "apexstock-css";
const styleTags = () => document.head.querySelectorAll(`#${STYLE_ID}`);

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
  const parent = document.createElement("div");
  const container = document.createElement("div");
  parent.appendChild(container);
  document.body.appendChild(parent);
  return container;
}

describe("ApexStock CSS isolation", () => {
  beforeEach(() => {
    // jsdom reuses one `document` across tests in a file; reset the per-scope
    // refcount so each test starts from a clean lifecycle state.
    ApexStock._styleRefs = new WeakMap();

    const apexInstance = {
      render: vi.fn().mockResolvedValue(undefined),
      updateSeries: vi.fn(),
      updateOptions: vi.fn(),
      destroy: vi.fn(),
      addEventListener: vi.fn(),
      w: { globals: { chartID: "test-chart" }, config: {} },
    };
    global.ApexCharts = vi.fn(function () {
      return apexInstance;
    });
  });

  afterEach(() => {
    styleTags().forEach((n) => n.remove());
    document.body.innerHTML = "";
    document.documentElement.style.removeProperty("--font-size-sm");
    delete global.ApexCharts;
  });

  it("scopes its variables away from the host's :root", () => {
    const css = SOURCE_CSS;
    // The variable block must not target the global :root...
    expect(css).not.toMatch(/:root\s*\{/);
    // ...it lives on apexstock's own scope instead.
    expect(css).toMatch(/\[class\^="apexstock-"\]\s*\{/);
    // No bare/un-prefixed generic custom property is *defined* anywhere.
    expect(css).not.toMatch(/(^|[^-])--font-size-sm\s*:/m);
    expect(css).not.toMatch(
      /(^|[^-])--(blue|danger|border-radius-md|gap-md)\s*:/m
    );
    // The namespaced names are present and referenced.
    expect(css).toMatch(/--apexstock-font-size-sm\s*:/);
    expect(css).toMatch(/var\(--apexstock-font-size-sm\)/);
  });

  it("injects the <style> once and dedupes across instances", () => {
    const a = new ApexStock(makeContainer(), makeOptions());
    const b = new ApexStock(makeContainer(), makeOptions());
    a._injectStyles();
    b._injectStyles();
    // Idempotent per instance, deduped across instances.
    a._injectStyles();
    expect(styleTags().length).toBe(1);
  });

  it("removes the injected <style> only when the last instance is destroyed", () => {
    const a = new ApexStock(makeContainer(), makeOptions());
    const b = new ApexStock(makeContainer(), makeOptions());
    a._injectStyles();
    b._injectStyles();

    a.destroy();
    expect(styleTags().length).toBe(1); // b still mounted

    b.destroy();
    expect(styleTags().length).toBe(0); // last one gone — nothing lingers in <head>
  });

  it("leaves a host :root token of the same name untouched through mount/destroy", () => {
    document.documentElement.style.setProperty("--font-size-sm", "0.875rem");
    const read = () =>
      document.documentElement.style.getPropertyValue("--font-size-sm");

    const before = read();
    const inst = new ApexStock(makeContainer(), makeOptions());
    inst._injectStyles();
    const during = read();
    inst.destroy();
    const after = read();

    expect(before).toBe("0.875rem");
    expect(during).toBe("0.875rem");
    expect(after).toBe("0.875rem");
    expect(styleTags().length).toBe(0);
  });

  it("destroy() is safe before render and idempotent", () => {
    const inst = new ApexStock(makeContainer(), makeOptions());
    expect(() => inst.destroy()).not.toThrow(); // never injected a style

    inst._injectStyles();
    inst.destroy();
    expect(() => inst.destroy()).not.toThrow(); // double destroy
    expect(styleTags().length).toBe(0);
  });
});
