// @vitest-environment jsdom
//
// Toolbar customization (#36): built-in section show/hide, whole-bar hide, and
// custom item injection (buttons + elements, ordering, sides, click, lifecycle).
import { describe, it, expect, vi } from "vitest";
import Toolbar from "../src/core/Toolbar.js";

function fakeCtx(toolbar) {
  const bar = document.createElement("div");
  const left = document.createElement("div");
  left.className = "apexstock-toolbar-left";
  const right = document.createElement("div");
  right.className = "apexstock-toolbar-right";
  bar.appendChild(left);
  bar.appendChild(right);

  const section = (cls, side) => {
    const d = document.createElement("div");
    d.className = cls;
    side.appendChild(d);
    return d;
  };
  section("apexstock-chart-type-wrapper", left);
  section("apexstock-custom-select-wrapper", left);
  section("apexstock-drawing-toolbar", left);
  section("apexstock-export-btn-container", right);

  return {
    primaryToolbar: bar,
    primaryToolbarLeft: left,
    primaryToolbarRight: right,
    chartOptions: { toolbar },
  };
}

const customButtons = (ctx) =>
  Array.from(ctx.primaryToolbar.querySelectorAll(".apexstock-toolbar-custom-item"));
const sectionEl = (ctx, cls) => ctx.primaryToolbar.querySelector("." + cls);

describe("Toolbar customization", () => {
  it("shows all built-in sections and no custom items by default", () => {
    const ctx = fakeCtx();
    const tb = new Toolbar(ctx);
    tb.reapply();
    expect(sectionEl(ctx, "apexstock-chart-type-wrapper").style.display).toBe("");
    expect(sectionEl(ctx, "apexstock-export-btn-container").style.display).toBe("");
    expect(customButtons(ctx)).toHaveLength(0);
  });

  it("hides built-in sections flagged false in items", () => {
    const ctx = fakeCtx({ items: { chartType: false, download: false } });
    new Toolbar(ctx).reapply();
    expect(sectionEl(ctx, "apexstock-chart-type-wrapper").style.display).toBe("none");
    expect(sectionEl(ctx, "apexstock-export-btn-container").style.display).toBe("none");
    // Not flagged -> still visible.
    expect(sectionEl(ctx, "apexstock-drawing-toolbar").style.display).toBe("");
  });

  it("hides the entire toolbar when show is false", () => {
    const ctx = fakeCtx({ show: false });
    new Toolbar(ctx).reapply();
    expect(ctx.primaryToolbar.style.display).toBe("none");
  });

  it("renders config.custom buttons on construction+reapply", () => {
    const ctx = fakeCtx({
      custom: [
        { id: "a", title: "Refresh", position: "right" },
        { id: "b", title: "Left one", position: "left" },
      ],
    });
    const tb = new Toolbar(ctx);
    tb.reapply();
    expect(customButtons(ctx)).toHaveLength(2);
    expect(ctx.primaryToolbarRight.querySelector('[data-toolbar-item="a"]')).toBeTruthy();
    expect(ctx.primaryToolbarLeft.querySelector('[data-toolbar-item="b"]')).toBeTruthy();
    // Falls back to the title as the label when no icon/html.
    expect(
      ctx.primaryToolbar.querySelector('[data-toolbar-item="a"]').textContent
    ).toBe("Refresh");
  });

  it("orders custom items by `order` within a side", () => {
    const ctx = fakeCtx();
    const tb = new Toolbar(ctx);
    tb.addItem({ id: "second", title: "2", position: "left", order: 10 });
    tb.addItem({ id: "first", title: "1", position: "left", order: 1 });
    const leftCustoms = Array.from(
      ctx.primaryToolbarLeft.querySelectorAll(".apexstock-toolbar-custom-item")
    ).map((el) => el.dataset.toolbarItem);
    expect(leftCustoms).toEqual(["first", "second"]);
  });

  it("left-start prepends before the built-in sections", () => {
    const ctx = fakeCtx();
    new Toolbar(ctx).addItem({ id: "lead", title: "Lead", position: "left-start" });
    expect(ctx.primaryToolbarLeft.firstChild.dataset.toolbarItem).toBe("lead");
  });

  it("wires onClick with (chart, event)", () => {
    const ctx = fakeCtx();
    const onClick = vi.fn();
    const tb = new Toolbar(ctx);
    tb.addItem({ id: "go", title: "Go", onClick });
    ctx.primaryToolbar.querySelector('[data-toolbar-item="go"]').click();
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClick.mock.calls[0][0]).toBe(ctx);
    expect(onClick.mock.calls[0][1]).toBeInstanceOf(Event);
  });

  it("injects a ready-made element as-is", () => {
    const ctx = fakeCtx();
    const el = document.createElement("span");
    el.textContent = "custom";
    new Toolbar(ctx).addItem({ id: "el", element: el, position: "right" });
    const injected = ctx.primaryToolbarRight.querySelector('[data-toolbar-item="el"]');
    expect(injected).toBe(el);
    expect(injected.classList.contains("apexstock-toolbar-custom-item")).toBe(true);
  });

  it("addItem replaces an item with the same id (no duplicates)", () => {
    const ctx = fakeCtx();
    const tb = new Toolbar(ctx);
    tb.addItem({ id: "x", title: "One" });
    tb.addItem({ id: "x", title: "Two" });
    expect(customButtons(ctx)).toHaveLength(1);
    expect(ctx.primaryToolbar.querySelector('[data-toolbar-item="x"]').textContent).toBe("Two");
    expect(tb.getItems()).toEqual([{ id: "x", title: "Two", position: "right" }]);
  });

  it("removeItem removes the item and its element", () => {
    const ctx = fakeCtx();
    const tb = new Toolbar(ctx);
    tb.addItem({ id: "x", title: "One" });
    expect(tb.removeItem("x")).toBe(true);
    expect(customButtons(ctx)).toHaveLength(0);
    expect(tb.removeItem("nope")).toBe(false);
  });

  it("ignores an item with no id", () => {
    const ctx = fakeCtx();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(new Toolbar(ctx).addItem({ title: "no id" })).toBeNull();
    warn.mockRestore();
  });

  it("destroy removes injected custom elements", () => {
    const ctx = fakeCtx();
    const tb = new Toolbar(ctx);
    tb.addItem({ id: "x", title: "One" });
    tb.destroy();
    expect(customButtons(ctx)).toHaveLength(0);
  });
});
