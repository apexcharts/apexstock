import { test, expect } from "@playwright/test";

// Reshaping a measurement in a real browser. A measure box is two data-space
// anchors; before this it could only be translated, so its span was frozen at
// whatever created it and re-measuring meant deleting and redrawing. Selecting
// it now puts a drag handle on each anchor.
//
// Also pins the two behaviours that make the box useful together: dragging the
// BODY still preserves the span (that is how a measured move is projected onto
// a breakout), and the reported numbers follow the bars the box actually covers.
const FIXTURE = "/apexstock/test/e2e/fixtures/measure.html";

async function gotoFixture(page) {
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(FIXTURE);
  await page.waitForFunction(() => window.__ready === true, null, {
    timeout: 20000,
  });
  await expect(page.locator("#chart .apexcharts-svg").first()).toBeVisible();
  return errors;
}

/** The measure box's client rect (the first rect on the drawing overlay). */
const boxRect = (page) =>
  page.evaluate(() => {
    const b = document
      .querySelector(".apexstock-drawing-overlay rect")
      .getBoundingClientRect();
    return { x: b.x, y: b.y, w: b.width, h: b.height };
  });

/** Centres of the visible resize handles, in client coordinates. */
const handleCentres = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll(".apexstock-resize-handle")]
      .filter((h) => h.style.display !== "none")
      .map((h) => {
        const b = h.getBoundingClientRect();
        return { cx: b.x + b.width / 2, cy: b.y + b.height / 2 };
      })
  );

/** The most recent `rangeMeasured` payload, flattened. */
const lastEvent = (page) =>
  page.evaluate(() => {
    const e = window.__events[window.__events.length - 1];
    return e
      ? {
          bars: e.stats.bars,
          from: e.stats.from.index,
          to: e.stats.to.index,
          change: e.stats.change.absolute,
          selection: e.selection.absolute,
          source: e.source,
        }
      : null;
  });

/** Select the measurement. A zero-delay click does not select. */
async function selectBox(page) {
  const box = await boxRect(page);
  await page.mouse.click(box.x + box.w / 2, box.y + box.h / 2, { delay: 60 });
  await page.waitForTimeout(300);
}

async function dragFrom(page, point, dx) {
  await page.mouse.move(point.cx, point.cy);
  await page.mouse.down();
  const steps = Math.max(4, Math.round(Math.abs(dx) / 10));
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(point.cx + (dx * i) / steps, point.cy);
  }
  await page.mouse.up();
  await page.waitForTimeout(400);
}

test.describe("measurement handles", () => {
  test("selecting a measurement puts a handle on each anchor", async ({
    page,
  }) => {
    const errors = await gotoFixture(page);

    expect(await handleCentres(page)).toHaveLength(0); // nothing selected yet
    await selectBox(page);

    const handles = await handleCentres(page);
    expect(handles).toHaveLength(2);

    // One per anchor, i.e. on opposite corners of the box.
    const box = await boxRect(page);
    const xs = handles.map((h) => h.cx).sort((a, b) => a - b);
    expect(Math.abs(xs[0] - box.x)).toBeLessThan(3);
    expect(Math.abs(xs[1] - (box.x + box.w))).toBeLessThan(3);
    expect(errors).toEqual([]);
  });

  test("dragging a handle reshapes the span from that end", async ({
    page,
  }) => {
    const errors = await gotoFixture(page);
    await selectBox(page);
    const start = await lastEvent(page);
    expect(start).toMatchObject({ from: 40, to: 60, source: "api" });

    // Right handle outwards: the far end moves, the near end does not.
    let handles = await handleCentres(page);
    await dragFrom(
      page,
      handles.reduce((a, b) => (b.cx > a.cx ? b : a)),
      120
    );
    const grown = await lastEvent(page);
    expect(grown.from).toBe(40);
    expect(grown.to).toBeGreaterThan(start.to);
    expect(grown.bars).toBeGreaterThan(start.bars);
    expect(grown.source).toBe("drag");

    // Left handle inwards: now the near end moves and the far end holds.
    handles = await handleCentres(page);
    await dragFrom(
      page,
      handles.reduce((a, b) => (b.cx < a.cx ? b : a)),
      80
    );
    const shrunk = await lastEvent(page);
    expect(shrunk.to).toBe(grown.to);
    expect(shrunk.from).toBeGreaterThan(grown.from);
    expect(shrunk.bars).toBeLessThan(grown.bars);

    expect(errors).toEqual([]);
  });

  test("dragging the body still translates, preserving the span", async ({
    page,
  }) => {
    // Deliberate: measuring one leg and dragging that same box to a breakout is
    // how a measured move is projected, so a move must not reshape.
    const errors = await gotoFixture(page);
    await selectBox(page);
    const start = await lastEvent(page);

    const box = await boxRect(page);
    await dragFrom(page, { cx: box.x + box.w / 2, cy: box.y + box.h / 2 }, -70);

    const moved = await lastEvent(page);
    expect(moved.bars).toBe(start.bars); // span preserved
    expect(moved.from).toBeLessThan(start.from); // over earlier bars
    expect(moved.to).toBeLessThan(start.to);
    // ...and the statistics followed the bars it now covers.
    expect(moved.change).not.toBe(start.change);
    expect(errors).toEqual([]);
  });

  test("the reported selection matches the bars the box covers", async ({
    page,
  }) => {
    // The fixture snaps to bar closes, so the dragged delta and the series'
    // close-to-close change agree by construction. They diverged after a move
    // while the selection was read from the raw anchors: the label kept
    // reporting the move the box was created on.
    const errors = await gotoFixture(page);
    await selectBox(page);

    const box = await boxRect(page);
    await dragFrom(page, { cx: box.x + box.w / 2, cy: box.y + box.h / 2 }, -70);

    const moved = await lastEvent(page);
    expect(moved.selection).toBeCloseTo(moved.change, 6);

    // The on-chart label leads with that same delta, so its sign has to match.
    const label = await page.evaluate(
      () =>
        document.querySelector(".apexstock-drawing-overlay text").textContent
    );
    expect(label.startsWith(moved.change >= 0 ? "+" : "-")).toBe(true);
    expect(errors).toEqual([]);
  });

  test("a selected measurement is still draggable by its body", async ({
    page,
  }) => {
    // The selection outline is drawn on top of what it surrounds. A blanket
    // `pointer-events: all` on overlay shapes beat its `pointer-events="none"`
    // attribute, so it swallowed the drags meant for the element underneath.
    const errors = await gotoFixture(page);
    await selectBox(page);

    const box = await boxRect(page);
    const under = await page.evaluate(
      (p) => {
        const el = document.elementFromPoint(p.x, p.y);
        return el ? el.getAttribute("class") : null;
      },
      { x: box.x + box.w / 2, y: box.y + box.h / 2 }
    );
    expect(under).not.toBe("apexstock-selection-outline");
    expect(under).not.toBe("apexstock-hover-outline");
    expect(errors).toEqual([]);
  });

  test("the style popup does not cover the handles", async ({ page }) => {
    // It is ~220px wide and used to open at the pointer, which is on the
    // drawing, so it landed over the anchors it had just revealed.
    const errors = await gotoFixture(page);
    await selectBox(page);

    await expect(page.locator(".apexstock-element-popup")).toBeVisible();
    const handles = await handleCentres(page);
    expect(handles).toHaveLength(2);

    for (const h of handles) {
      const onTop = await page.evaluate((p) => {
        const el = document.elementFromPoint(p.cx, p.cy);
        return el ? el.getAttribute("class") : null;
      }, h);
      expect(onTop).toBe("apexstock-resize-handle");
    }
    expect(errors).toEqual([]);
  });
});
