// @vitest-environment jsdom
//
// Tests for data export (CSV/JSON of the OHLC series) and the programmatic
// image-export entry point. PNG rasterization needs a real browser canvas and
// is covered by the Playwright smoke; here we cover the data path fully and the
// SVG image path.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import DataExport from "../src/tools/export/DataExport.js";
import ApexStock from "../src/ApexStock.js";
import Statistics from "../src/analysis/Statistics.js";

function ohlcData(n = 5, start = 100, withVolume = true) {
  return Array.from({ length: n }, (_, i) => {
    const p = { x: new Date(2020, 0, i + 1).getTime(), y: [start + i, start + i + 2, start + i - 1, start + i + 1] };
    if (withVolume) p.v = 1000 + i;
    return p;
  });
}

describe("DataExport (pure)", () => {
  it("toCSV emits a header and one row per point, ISO time by default", () => {
    const csv = DataExport.toCSV(ohlcData(2));
    const lines = csv.split("\n");
    expect(lines[0]).toBe("time,open,high,low,close,volume");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toBe(
      `${new Date(2020, 0, 1).toISOString()},100,102,99,101,1000`
    );
  });

  it("toCSV omits the volume column when no point has volume", () => {
    const csv = DataExport.toCSV(ohlcData(2, 100, false));
    expect(csv.split("\n")[0]).toBe("time,open,high,low,close");
  });

  it("toCSV honors includeVolume:false and raw time", () => {
    const csv = DataExport.toCSV(ohlcData(1), { includeVolume: false, raw: true });
    const lines = csv.split("\n");
    expect(lines[0]).toBe("time,open,high,low,close");
    expect(lines[1]).toBe(`${new Date(2020, 0, 1).getTime()},100,102,99,101`);
  });

  it("toCSV quotes fields containing commas/quotes/newlines", () => {
    const csv = DataExport.toCSV([{ x: "a,b", y: [1, 2, 0, 1] }]);
    expect(csv.split("\n")[1].startsWith('"a,b",')).toBe(true);
  });

  it("toJSON returns an array of flat OHLC objects", () => {
    const json = JSON.parse(DataExport.toJSON(ohlcData(2)));
    expect(json).toHaveLength(2);
    expect(json[0]).toEqual({
      time: new Date(2020, 0, 1).toISOString(),
      open: 100,
      high: 102,
      low: 99,
      close: 101,
      volume: 1000,
    });
  });

  it("toJSON drops the volume key when there is no volume", () => {
    const json = JSON.parse(DataExport.toJSON(ohlcData(1, 100, false)));
    expect(json[0]).not.toHaveProperty("volume");
  });

  it("handles empty / non-array input", () => {
    expect(DataExport.toCSV([])).toBe("time,open,high,low,close");
    expect(DataExport.toJSON(null)).toBe("[]");
  });
});

// ── Instance-level export ───────────────────────────────────────────────────

function installApexChartsMock() {
  global.ApexCharts = vi.fn(function (el, opts) {
    return {
      el,
      options: opts,
      w: { globals: {}, config: { chart: { type: "candlestick" }, series: (opts && opts.series) || [], yaxis: [{}], annotations: {} } },
      render: vi.fn(),
      destroy: vi.fn(),
      addEventListener: vi.fn(),
      updateSeries: vi.fn(),
      updateOptions: vi.fn(),
      zoomX: vi.fn(),
    };
  });
}

function makeInstance() {
  const parent = document.createElement("div");
  const container = document.createElement("div");
  parent.appendChild(container);
  document.body.appendChild(parent);
  return new ApexStock(container, {
    chart: { height: 500, fontFamily: "Arial" },
    theme: { mode: "light" },
    series: [{ name: "Price", data: ohlcData(6) }],
  });
}

describe("ApexStock#exportData", () => {
  let inst;
  beforeEach(() => {
    installApexChartsMock();
    global.URL.createObjectURL = vi.fn(() => "blob:mock");
    global.URL.revokeObjectURL = vi.fn();
    inst = makeInstance();
  });
  afterEach(() => {
    document.body.innerHTML = "";
    delete global.ApexCharts;
    vi.restoreAllMocks();
  });

  it("returns CSV by default covering all points", () => {
    const csv = inst.exportData();
    expect(csv.split("\n")).toHaveLength(7); // header + 6 rows
    expect(csv.split("\n")[0]).toBe("time,open,high,low,close,volume");
  });

  it("returns JSON when asked", () => {
    const json = JSON.parse(inst.exportData({ format: "json" }));
    expect(json).toHaveLength(6);
  });

  it("range:'visible' filters to the visible x-window", () => {
    const data = inst.series;
    inst.xaxisRange = { min: data[1].x, max: data[3].x };
    const csv = inst.exportData({ range: "visible" });
    expect(csv.split("\n")).toHaveLength(4); // header + 3 rows (idx 1..3)
  });

  it("range:'visible' falls back to all points when range is unknown", () => {
    inst.xaxisRange = null;
    const csv = inst.exportData({ range: "visible" });
    expect(csv.split("\n")).toHaveLength(7);
  });

  it("download:true triggers an anchor download with the right filename", () => {
    let captured = null;
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function () {
      captured = { download: this.download, href: this.href };
    });
    inst.exportData({ format: "json", download: true });
    expect(captured).not.toBeNull();
    expect(captured.download).toBe("apexstock-data.json");
    expect(global.URL.createObjectURL).toHaveBeenCalled();
  });
});

describe("DataExport extra columns", () => {
  it("appends caller-supplied columns after the OHLC spine", () => {
    const csv = DataExport.toCSV(ohlcData(2), {
      columns: [{ name: "RSI", values: [null, 55.5] }],
    });
    const lines = csv.split("\n");
    expect(lines[0]).toBe("time,open,high,low,close,volume,RSI");
    expect(lines[1].endsWith(",1000,")).toBe(true); // null -> empty cell
    expect(lines[2].endsWith(",1001,55.5")).toBe(true);
  });

  it("adds the columns as JSON keys, nulls included", () => {
    const json = JSON.parse(
      DataExport.toJSON(ohlcData(2), {
        columns: [{ name: "RSI", values: [null, 55.5] }],
      })
    );
    expect(json[0].RSI).toBeNull();
    expect(json[1].RSI).toBe(55.5);
    // The spine keys stay first, so the shape is stable for a consumer.
    expect(Object.keys(json[0])).toEqual([
      "time",
      "open",
      "high",
      "low",
      "close",
      "volume",
      "RSI",
    ]);
  });

  it("suffixes a name that collides with a spine column or another extra", () => {
    const csv = DataExport.toCSV(ohlcData(1), {
      columns: [
        { name: "close", values: [1] },
        { name: "close", values: [2] },
      ],
    });
    expect(csv.split("\n")[0]).toBe(
      "time,open,high,low,close,volume,close (2),close (3)"
    );
  });

  it("ignores malformed column entries", () => {
    const csv = DataExport.toCSV(ohlcData(1), {
      columns: [null, { name: "x" }, { values: [7] }],
    });
    // Only the one with values survives, and an empty name gets a placeholder.
    expect(csv.split("\n")[0]).toBe("time,open,high,low,close,volume,column");
  });
});

describe("ApexStock#exportData include", () => {
  let inst;
  beforeEach(() => {
    installApexChartsMock();
    inst = makeInstance();
  });
  afterEach(() => {
    document.body.innerHTML = "";
    delete global.ApexCharts;
    vi.restoreAllMocks();
  });

  /** Stub the live chart state an active indicator would produce. */
  function withIndicators() {
    inst.chart.w.globals.seriesNames = ["Price", "MA 3"];
    inst.chart.w.globals.series = [
      [101, 102, 103, 104, 105, 106],
      [null, null, 102, 103, 104, 105],
    ];
    inst.indicatorChartMap = {
      rsi: {
        w: {
          globals: {
            seriesNames: ["RSI"],
            series: [[null, 50, 55, 60, 65, 70]],
          },
        },
      },
    };
  }

  it("exports the OHLC spine only by default", () => {
    expect(inst.exportData().split("\n")[0]).toBe(
      "time,open,high,low,close,volume"
    );
  });

  it('include:"indicators" adds a column per overlay and pane series', () => {
    withIndicators();
    const lines = inst.exportData({ include: ["indicators"] }).split("\n");
    expect(lines[0]).toBe("time,open,high,low,close,volume,MA 3,RSI");
    expect(lines[1].endsWith(",,")).toBe(true); // both still warming up
    expect(lines[3].endsWith(",102,55")).toBe(true);
  });

  it('include:"analysis" adds per-bar return and drawdown columns', () => {
    const json = JSON.parse(
      inst.exportData({ format: "json", include: ["ohlc", "analysis"] })
    );
    expect(Object.keys(json[0])).toContain("return");
    expect(Object.keys(json[0])).toContain("drawdown");
    // Closes run 101..106: every bar is a new high, so nothing is underwater
    // and the first bar has no previous close to compare against.
    expect(json[0].return).toBeNull();
    expect(json[1].return).toBeCloseTo((102 / 101 - 1) * 100, 10);
    expect(json[5].drawdown).toBe(0);
  });

  it("reports a drawdown once the series falls from its peak", () => {
    inst.series[4].y = [100, 100, 90, 95]; // close 95, below the running peak
    Statistics.invalidate(inst.series);
    const json = JSON.parse(
      inst.exportData({ format: "json", include: ["analysis"] })
    );
    // 95 against a peak of 104: -8.65%.
    expect(json[4].drawdown).toBeCloseTo((95 / 104 - 1) * 100, 10);
  });

  it("slices the extra columns to the visible window, aligned to the bars", () => {
    withIndicators();
    const data = inst.series;
    inst.xaxisRange = { min: data[2].x, max: data[4].x };
    const lines = inst
      .exportData({ range: "visible", include: ["indicators"] })
      .split("\n");
    expect(lines).toHaveLength(4); // header + bars 2..4
    // The first exported row is bar 2, so it carries bar 2's indicator values.
    expect(lines[1].endsWith(",102,55")).toBe(true);
  });

  it("warns about an unknown include and exports the spine", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const csv = inst.exportData({ include: ["nonsense"] });
    expect(csv.split("\n")[0]).toBe("time,open,high,low,close,volume");
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("accepts a bare string include", () => {
    const csv = inst.exportData({ include: "analysis" });
    expect(csv.split("\n")[0]).toBe(
      "time,open,high,low,close,volume,return,drawdown"
    );
  });
});

describe("ApexStock#exportImage (SVG path)", () => {
  let inst;
  beforeEach(() => {
    installApexChartsMock();
    global.URL.createObjectURL = vi.fn(() => "blob:mock");
    global.URL.revokeObjectURL = vi.fn();
    inst = makeInstance();
  });
  afterEach(() => {
    document.body.innerHTML = "";
    delete global.ApexCharts;
    vi.restoreAllMocks();
  });

  it("resolves to an SVG blob without needing render()/canvas", async () => {
    const res = await inst.exportImage({ format: "svg" });
    expect(res.format).toBe("svg");
    expect(res.blob).toBeInstanceOf(Blob);
    expect(res.url).toBe("blob:mock");
  });

  it("lazily creates a headless exporter when render() was not called", () => {
    expect(inst.exporter).toBeUndefined();
    inst.exportImage({ format: "svg" });
    expect(inst.exporter).toBeTruthy();
  });

  it("falls back to SVG when PNG rasterization is unavailable", async () => {
    // The mock ApexCharts has no dataURI(), so the PNG path cannot rasterize.
    const res = await inst.exportImage({ format: "png" });
    expect(res.format).toBe("svg");
    expect(res.fallback).toBe(true);
  });

  it("SVG download triggers an anchor with a .svg filename", async () => {
    let captured = null;
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function () {
      captured = this.download;
    });
    await inst.exportImage({ format: "svg", download: true, filename: "chart.png" });
    expect(captured).toBe("chart.svg");
  });
});
