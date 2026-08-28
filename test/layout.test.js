import { describe, it, expect } from "vitest";
import LayoutManager from "../src/core/LayoutManager.js";

describe("LayoutManager.computeHeights", () => {
  it("gives the main chart full available height when there are no indicators", () => {
    const { newMainHeight, indicatorContainerHeight, indicatorHeight } =
      LayoutManager.computeHeights({
        totalHeight: 400,
        xAxisHeight: 30,
        indicatorCount: 0,
      });
    // available = 370; main = floor(0.6*370)=222; indicator area = floor(0.4*370)=148
    expect(newMainHeight).toBe(222);
    expect(indicatorContainerHeight).toBe(148);
    expect(indicatorHeight).toBe(0);
  });

  it("splits the indicator area evenly across indicators", () => {
    const { indicatorContainerHeight, indicatorHeight } =
      LayoutManager.computeHeights({
        totalHeight: 400,
        xAxisHeight: 30,
        indicatorCount: 2,
      });
    expect(indicatorContainerHeight).toBe(148);
    expect(indicatorHeight).toBe(74); // floor(148 / 2)
  });

  it("floors fractional indicator heights", () => {
    const { indicatorHeight } = LayoutManager.computeHeights({
      totalHeight: 400,
      xAxisHeight: 30,
      indicatorCount: 3,
    });
    expect(indicatorHeight).toBe(49); // floor(148 / 3)
  });
});

describe("LayoutManager weighted panes", () => {
  const heights = (indicatorCount, weights) =>
    LayoutManager.computeHeights({
      totalHeight: 400,
      xAxisHeight: 30,
      indicatorCount,
      weights,
    }).indicatorHeights;

  it("divides the indicator area in proportion to the weights", () => {
    // area = 148, weights 1 + 3 -> 37 and the rest.
    expect(heights(2, [1, 3])).toEqual([37, 111]);
    expect(heights(3, [1, 1, 2])).toEqual([37, 37, 74]);
  });

  it("always adds up to the container height exactly", () => {
    // The remainder goes to the last pane, so no gap opens at the bottom.
    for (const w of [[1, 1, 1], [1, 1.4], [2, 3, 5, 7], [1]]) {
      const hs = heights(w.length, w);
      expect(hs.reduce((a, b) => a + b, 0)).toBe(148);
    }
  });

  it("falls back to an even split for missing or unusable weights", () => {
    // floor(148/3) twice, then the remainder.
    expect(heights(3, undefined)).toEqual([49, 49, 50]);
    expect(heights(3, [1, 1])).toEqual([49, 49, 50]); // wrong length
    expect(heights(3, [1, 0, 2])).toEqual([49, 49, 50]); // a zero weight
    expect(heights(3, [1, NaN, 2])).toEqual([49, 49, 50]);
    expect(heights(3, [1, -2, 2])).toEqual([49, 49, 50]);
  });

  it("gives a single pane the whole area, weighted or not", () => {
    expect(heights(1, [5])).toEqual([148]);
    expect(heights(1)).toEqual([148]);
  });

  it("returns no heights when there are no panes", () => {
    expect(heights(0, [])).toEqual([]);
    expect(LayoutManager.distribute(100, 0)).toEqual([]);
  });

  it("keeps indicatorHeight as the even split, for the pre-render sizing", () => {
    const r = LayoutManager.computeHeights({
      totalHeight: 400,
      xAxisHeight: 30,
      indicatorCount: 2,
      weights: [1, 3],
    });
    expect(r.indicatorHeight).toBe(74); // unchanged by the weights
    expect(r.indicatorHeights).toEqual([37, 111]);
  });
});
