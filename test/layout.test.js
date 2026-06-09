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
