// @vitest-environment jsdom
//
// Unified export() dispatcher: routes csv/json to the data exporter (returning
// text + a Blob), png/svg to the image exporter, and pdf to the PDF exporter,
// and rejects unknown formats. The real rasterization (png/pdf pixels) is covered
// by the Playwright smoke; here the image/pdf branches use a stubbed exporter so
// the routing is asserted deterministically.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import ApexStock from "../src/ApexStock.js";

function ohlcData(n = 10) {
  return Array.from({ length: n }, (_, i) => ({
    x: new Date(2020, 0, i + 1).getTime(),
    y: [10 + i, 12 + i, 9 + i, 11 + i],
    v: 1000 + i,
  }));
}

function installApexChartsMock() {
  global.ApexCharts = vi.fn(function (el, opts) {
    const inst = {
      el,
      options: opts,
      w: { globals: { chartID: "chart", dataPoints: 10, minX: 0, maxX: 9 } },
      render: vi.fn(),
      destroy: vi.fn(),
      addEventListener: vi.fn(),
      updateSeries: vi.fn(),
      updateOptions: vi.fn(),
      removeAnnotation: vi.fn(),
      addYaxisAnnotation: vi.fn(),
      zoomX: vi.fn(),
    };
    return inst;
  });
}

function makeInstance() {
  const parent = document.createElement("div");
  const container = document.createElement("div");
  parent.appendChild(container);
  document.body.appendChild(parent);
  return new ApexStock(container, {
    chart: { height: 500 },
    theme: { mode: "light" },
    series: [{ name: "AAPL", data: ohlcData() }],
  });
}

describe("ApexStock#export (unified)", () => {
  let inst;
  beforeEach(() => {
    installApexChartsMock();
    inst = makeInstance();
  });
  afterEach(() => {
    document.body.innerHTML = "";
    delete global.ApexCharts;
  });

  it("exports CSV: text + Blob, with the standard header", async () => {
    const res = await inst.export({ format: "csv" });
    expect(res.format).toBe("csv");
    expect(res.text.split("\n")[0]).toBe("time,open,high,low,close,volume");
    expect(res.text).toContain("2020-01-01");
    expect(res.blob).toBeInstanceOf(Blob);
  });

  it("exports JSON: parseable array of row objects", async () => {
    const res = await inst.export({ format: "json" });
    expect(res.format).toBe("json");
    const parsed = JSON.parse(res.text);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(10);
    expect(parsed[0]).toMatchObject({ open: 10, high: 12, low: 9, close: 11 });
  });

  it("honors range: visible for data formats", async () => {
    inst.getVisibleRange = () => ({
      min: new Date(2020, 0, 3).getTime(),
      max: new Date(2020, 0, 6).getTime(),
    });
    const res = await inst.export({ format: "csv", range: "visible" });
    // Header + 4 in-range rows (days 3..6).
    expect(res.text.trim().split("\n")).toHaveLength(5);
  });

  it("routes png to the image exporter and pdf to the PDF exporter", async () => {
    const capture = vi.fn(() => Promise.resolve({ format: "png", blob: {}, url: "blob:img" }));
    const capturePdf = vi.fn(() => Promise.resolve({ format: "pdf", blob: {}, url: "blob:pdf" }));
    inst.exporter = { capture, capturePdf };

    const png = await inst.export({ format: "png", scale: 2 });
    expect(capture).toHaveBeenCalledWith(expect.objectContaining({ format: "png", scale: 2 }));
    expect(png.format).toBe("png");

    const pdf = await inst.export({ format: "pdf" });
    expect(capturePdf).toHaveBeenCalledTimes(1);
    expect(pdf.format).toBe("pdf");
  });

  it("defaults to png when no format is given", async () => {
    const capture = vi.fn(() => Promise.resolve({ format: "png", blob: {}, url: "x" }));
    inst.exporter = { capture };
    await inst.export();
    expect(capture).toHaveBeenCalledWith(expect.objectContaining({ format: "png" }));
  });

  it("rejects an unsupported format", async () => {
    await expect(inst.export({ format: "xml" })).rejects.toThrow(/unsupported format/i);
  });
});
