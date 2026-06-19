import { describe, it, expect, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import ApexStock from "../src/index";
// Same module the component imports (aliased to the mock in vitest.config.ts).
import { instances, __reset } from "apexstock";

const baseOptions = {
  chart: { height: 300 },
  series: [{ name: "Price", data: [{ x: 1, y: [1, 2, 0, 1] }] }],
};

describe("vue-apexstock <ApexStock>", () => {
  beforeEach(() => __reset());

  it("renders a container div and constructs the instance on mount", () => {
    const wrapper = mount(ApexStock, { props: { options: baseOptions } });
    expect(wrapper.find("div").exists()).toBe(true);
    expect(instances).toHaveLength(1);
    expect(instances[0].el).toBe(wrapper.find("div").element);
    expect(instances[0].options).toEqual(baseOptions);
    expect(instances[0].render).toHaveBeenCalledTimes(1);
  });

  it("passes a mutable plain copy, not the reactive prop (mutation-safe)", () => {
    const wrapper = mount(ApexStock, { props: { options: baseOptions } });
    const passed = instances[0].options as typeof baseOptions;
    // Content matches, but the paths the core mutates (chart, series) are clones.
    expect(passed).toEqual(baseOptions);
    expect(passed).not.toBe(baseOptions);
    expect(passed.chart).not.toBe(baseOptions.chart);
    expect(passed.series).not.toBe(baseOptions.series);
    wrapper.unmount();
  });

  it("merges the `series` prop over options.series", () => {
    const series = [{ name: "Override", data: [{ x: 9, y: [9, 9, 9, 9] }] }];
    mount(ApexStock, { props: { options: baseOptions, series } });
    expect(instances[0].options).toEqual({ ...baseOptions, series });
  });

  it("forwards later prop changes to instance.update (not on first render)", async () => {
    const wrapper = mount(ApexStock, { props: { options: baseOptions } });
    expect(instances[0].update).not.toHaveBeenCalled();

    const next = { ...baseOptions, theme: { mode: "dark" } };
    await wrapper.setProps({ options: next });
    expect(instances[0].update).toHaveBeenCalledTimes(1);
    expect(instances[0].update).toHaveBeenCalledWith(
      expect.objectContaining({ theme: { mode: "dark" } })
    );
  });

  it("destroys the instance on unmount", () => {
    const wrapper = mount(ApexStock, { props: { options: baseOptions } });
    const inst = instances[0];
    wrapper.unmount();
    expect(inst.destroy).toHaveBeenCalledTimes(1);
  });

  it("exposes the instance and element via getInstance/getElement", () => {
    const wrapper = mount(ApexStock, { props: { options: baseOptions } });
    const vm = wrapper.vm as unknown as {
      getInstance: () => unknown;
      getElement: () => unknown;
    };
    expect(vm.getInstance()).toBe(instances[0]);
    expect(vm.getElement()).toBe(wrapper.find("div").element);
  });
});
