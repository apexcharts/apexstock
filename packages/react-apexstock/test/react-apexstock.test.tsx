import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createRef } from "react";
import { render, cleanup } from "@testing-library/react";
import ApexStock, { type ApexStockRef } from "../src/index";
// Same module the component imports (aliased to the mock in vitest.config.ts).
import { instances, __reset } from "apexstock";

const baseOptions = {
  chart: { height: 300 },
  series: [{ name: "Price", data: [{ x: 1, y: [1, 2, 0, 1] }] }],
};

describe("react-apexstock <ApexStock>", () => {
  beforeEach(() => __reset());
  afterEach(() => cleanup());

  it("renders a container div and constructs the instance on mount", () => {
    const { container } = render(<ApexStock options={baseOptions} />);
    const div = container.querySelector("div");
    expect(div).not.toBeNull();
    expect(instances).toHaveLength(1);
    expect(instances[0].el).toBe(div);
    expect(instances[0].options).toEqual(baseOptions);
    expect(instances[0].render).toHaveBeenCalledTimes(1);
  });

  it("merges the `series` prop over options.series", () => {
    const series = [{ name: "Override", data: [{ x: 9, y: [9, 9, 9, 9] }] }];
    render(<ApexStock options={baseOptions} series={series} />);
    expect(instances[0].options).toEqual({ ...baseOptions, series });
  });

  it("forwards later prop changes to instance.update (and not on first render)", () => {
    const { rerender } = render(<ApexStock options={baseOptions} />);
    expect(instances[0].update).not.toHaveBeenCalled();

    const next = { ...baseOptions, theme: { mode: "dark" } };
    rerender(<ApexStock options={next} />);
    expect(instances[0].update).toHaveBeenCalledTimes(1);
    expect(instances[0].update).toHaveBeenCalledWith(next);
  });

  it("destroys the instance on unmount", () => {
    const { unmount } = render(<ApexStock options={baseOptions} />);
    const inst = instances[0];
    unmount();
    expect(inst.destroy).toHaveBeenCalledTimes(1);
  });

  it("exposes the instance and element via ref", () => {
    const ref = createRef<ApexStockRef>();
    const { container } = render(<ApexStock ref={ref} options={baseOptions} />);
    expect(ref.current?.getInstance()).toBe(instances[0]);
    expect(ref.current?.getElement()).toBe(container.querySelector("div"));
  });
});
