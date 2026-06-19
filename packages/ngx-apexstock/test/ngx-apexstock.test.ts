import { describe, it, expect, beforeEach } from "vitest";
import { ApexStockComponent } from "../src/apex-stock.component";
// Same module the component imports (aliased to the mock in vitest.config.ts).
import { instances, __reset } from "apexstock";

const baseOptions = {
  chart: { height: 300 },
  series: [{ name: "Price", data: [{ x: 1, y: [1, 2, 0, 1] }] }],
};

// Drive the component's lifecycle methods directly (no TestBed needed): the
// view-child ref is what ngAfterViewInit reads, so we assign a stub element.
function makeComponent(el: HTMLDivElement): ApexStockComponent {
  const c = new ApexStockComponent();
  (c as unknown as { chartElRef: { nativeElement: HTMLDivElement } }).chartElRef =
    { nativeElement: el };
  return c;
}

describe("ngx-apexstock ApexStockComponent", () => {
  beforeEach(() => __reset());

  it("constructs the instance and renders in ngAfterViewInit", () => {
    const el = document.createElement("div");
    const c = makeComponent(el);
    c.options = baseOptions;
    c.ngAfterViewInit();
    expect(instances).toHaveLength(1);
    expect(instances[0].el).toBe(el);
    expect(instances[0].options).toEqual(baseOptions);
    expect(instances[0].render).toHaveBeenCalledTimes(1);
  });

  it("passes a mutation-safe plain copy, not the input object", () => {
    const el = document.createElement("div");
    const c = makeComponent(el);
    c.options = baseOptions;
    c.ngAfterViewInit();
    const passed = instances[0].options as typeof baseOptions;
    expect(passed).toEqual(baseOptions);
    expect(passed).not.toBe(baseOptions);
    expect(passed.chart).not.toBe(baseOptions.chart);
    expect(passed.series).not.toBe(baseOptions.series);
  });

  it("merges the `series` input over options.series", () => {
    const el = document.createElement("div");
    const c = makeComponent(el);
    c.options = baseOptions;
    c.series = [{ name: "Override", data: [{ x: 9, y: [9, 9, 9, 9] }] }];
    c.ngAfterViewInit();
    expect((instances[0].options as typeof baseOptions).series).toEqual(
      c.series
    );
  });

  it("ngOnChanges is a no-op before view init, forwards update after", () => {
    const el = document.createElement("div");
    const c = makeComponent(el);
    c.options = baseOptions;
    c.ngOnChanges({}); // before ngAfterViewInit -> instance null -> skipped
    c.ngAfterViewInit();
    expect(instances[0].update).not.toHaveBeenCalled();

    c.options = { ...baseOptions, theme: { mode: "dark" } };
    c.ngOnChanges({});
    expect(instances[0].update).toHaveBeenCalledTimes(1);
    expect(instances[0].update).toHaveBeenCalledWith(
      expect.objectContaining({ theme: { mode: "dark" } })
    );
  });

  it("destroys on ngOnDestroy and exposes the instance/element", () => {
    const el = document.createElement("div");
    const c = makeComponent(el);
    c.options = baseOptions;
    c.ngAfterViewInit();
    expect(c.getInstance()).toBe(instances[0]);
    expect(c.getElement()).toBe(el);

    const inst = instances[0];
    c.ngOnDestroy();
    expect(inst.destroy).toHaveBeenCalledTimes(1);
    expect(c.getInstance()).toBeNull();
  });
});
