// Tests for the data adapters (fromArrays / fromCSV / normalize) that convert
// common real-world shapes into the ApexStock `{ x, y:[o,h,l,c], v? }` shape.
import { describe, it, expect, vi, afterEach } from "vitest";
import DataAdapter from "../src/utils/DataAdapter.js";
import ApexStock from "../src/ApexStock.js";

afterEach(() => vi.restoreAllMocks());

describe("DataAdapter.normalize", () => {
  it("maps objects by alias (date/o/h/l/c/v) without an explicit mapping", () => {
    const rows = [
      { date: "2020-01-01", o: 10, h: 12, l: 9, c: 11, v: 100 },
      { date: "2020-01-02", o: 11, h: 13, l: 10, c: 12, v: 200 },
    ];
    const out = DataAdapter.normalize(rows);
    expect(out).toHaveLength(2);
    expect(out[0].y).toEqual([10, 12, 9, 11]);
    expect(out[0].v).toBe(100);
    expect(out[0].x).toBe(new Date("2020-01-01").getTime());
  });

  it("honors an explicit mapping over aliases", () => {
    const rows = [{ Date: "2020-01-01", Open: 1, High: 2, Low: 0.5, "Adj Close": 1.5 }];
    const out = DataAdapter.normalize(rows, {
      x: "Date",
      open: "Open",
      high: "High",
      low: "Low",
      close: "Adj Close",
    });
    expect(out[0].y).toEqual([1, 2, 0.5, 1.5]);
  });

  it("derives missing open/high/low from close-only rows", () => {
    const out = DataAdapter.normalize([
      { t: 1, close: 10 },
      { t: 2, close: 20 },
    ]);
    expect(out[0].y).toEqual([10, 10, 10, 10]);
    expect(out[1].y).toEqual([20, 20, 20, 20]);
  });

  it("reads tuples positionally [x,o,h,l,c,v]", () => {
    const out = DataAdapter.normalize([
      [1, 10, 12, 9, 11, 100],
      [2, 11, 13, 10, 12, 200],
    ]);
    expect(out[0].x).toBe(1);
    expect(out[0].y).toEqual([10, 12, 9, 11]);
    expect(out[1].v).toBe(200);
  });

  it("time-sorts out-of-order input", () => {
    const out = DataAdapter.normalize([
      { t: 3, c: 30 },
      { t: 1, c: 10 },
      { t: 2, c: 20 },
    ]);
    expect(out.map((p) => p.x)).toEqual([1, 2, 3]);
  });

  it("warns and returns [] when no close column is resolvable", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const out = DataAdapter.normalize([{ foo: 1, bar: 2 }]);
    expect(out).toEqual([]);
    expect(warn).toHaveBeenCalled();
  });

  it("warns and returns [] on empty / non-array input", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(DataAdapter.normalize([])).toEqual([]);
    expect(DataAdapter.normalize(null)).toEqual([]);
  });
});

describe("DataAdapter.fromArrays", () => {
  it("zips parallel columns resolved by alias", () => {
    const out = DataAdapter.fromArrays({
      t: [1, 2, 3],
      o: [10, 11, 12],
      h: [12, 13, 14],
      l: [9, 10, 11],
      c: [11, 12, 13],
      v: [100, 200, 300],
    });
    expect(out).toHaveLength(3);
    expect(out[1].y).toEqual([11, 13, 10, 12]);
    expect(out[2].v).toBe(300);
  });

  it("supports a close-only column and falls back to positional x", () => {
    const out = DataAdapter.fromArrays({ close: [5, 6, 7] });
    expect(out.map((p) => p.x)).toEqual([0, 1, 2]);
    expect(out[0].y).toEqual([5, 5, 5, 5]);
  });

  it("warns and returns [] without a close column", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(DataAdapter.fromArrays({ x: [1, 2] })).toEqual([]);
    expect(warn).toHaveBeenCalled();
  });
});

describe("DataAdapter.fromCSV", () => {
  it("parses a header CSV and alias-resolves columns", () => {
    const csv = [
      "Date,Open,High,Low,Close,Volume",
      "2020-01-01,10,12,9,11,100",
      "2020-01-02,11,13,10,12,200",
    ].join("\n");
    const out = DataAdapter.fromCSV(csv);
    expect(out).toHaveLength(2);
    expect(out[0].y).toEqual([10, 12, 9, 11]);
    expect(out[0].v).toBe(100);
    expect(out[0].x).toBe(new Date("2020-01-01").getTime());
  });

  it("handles quoted fields containing the delimiter", () => {
    const csv = 'Date,Close\n"2020-01-01",1000\n"2020-01-02",1001';
    const out = DataAdapter.fromCSV(csv);
    expect(out.map((p) => p.y[3])).toEqual([1000, 1001]);
  });

  it("handles CRLF line endings", () => {
    const csv = "t,c\r\n1,10\r\n2,20\r\n";
    const out = DataAdapter.fromCSV(csv);
    expect(out.map((p) => p.x)).toEqual([1, 2]);
  });

  it("supports headerless CSV with a positional read", () => {
    const csv = "1,10,12,9,11\n2,11,13,10,12";
    const out = DataAdapter.fromCSV(csv, { header: false });
    expect(out[0].y).toEqual([10, 12, 9, 11]);
    expect(out[1].x).toBe(2);
  });

  it("supports a custom delimiter", () => {
    const csv = "t;c\n1;10\n2;20";
    const out = DataAdapter.fromCSV(csv, { delimiter: ";" });
    expect(out.map((p) => p.y[3])).toEqual([10, 20]);
  });

  it("warns and returns [] on empty input", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(DataAdapter.fromCSV("")).toEqual([]);
    expect(DataAdapter.fromCSV(null)).toEqual([]);
  });
});

describe("ApexStock static adapters", () => {
  it("exposes fromArrays / fromCSV / normalize", () => {
    expect(typeof ApexStock.fromArrays).toBe("function");
    expect(typeof ApexStock.fromCSV).toBe("function");
    expect(typeof ApexStock.normalize).toBe("function");
    const out = ApexStock.normalize([{ t: 1, c: 10 }]);
    expect(out[0].y).toEqual([10, 10, 10, 10]);
  });
});
