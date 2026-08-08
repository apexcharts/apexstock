import { test, expect } from "@playwright/test";

// Programmatic data-space drawings in a real browser: addDrawing() renders
// SVG on the overlay, the drawings re-project when the visible range changes
// (proving they are anchored to price/time, not to the screen), and their data
// anchors survive zoom + a getState()/setState() round-trip. No console errors.
const FIXTURE = "/apexstock/test/e2e/fixtures/chart.html";

// Fixture data: bar i sits at BASE + i * DAY (see chart.html generateData).
const BASE = Date.UTC(2024, 0, 1);
const DAY = 86400000;
const at = (i) => BASE + i * DAY;

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

const overlayLines = (page) =>
  page.locator("#chart .apexstock-drawing-overlay line");
const overlayRects = (page) =>
  page.locator("#chart .apexstock-drawing-overlay rect");

test.describe("programmatic drawings", () => {
  test("renders trend/level/zone drawings on the overlay", async ({ page }) => {
    const errors = await gotoFixture(page);

    const count = await page.evaluate((ts) => {
      const c = window.__chart;
      c.addDrawing({ type: "trendline", points: [{ x: ts.a, y: 95 }, { x: ts.b, y: 110 }] });
      c.addDrawing({ type: "horizontalLine", points: [{ y: 102 }] });
      c.addDrawing({ type: "verticalLine", points: [{ x: ts.c }] });
      c.addDrawing({ type: "rectangle", points: [{ x: ts.a, y: 90 }, { x: ts.c, y: 100 }] });
      c.addDrawing({ type: "fibRetracement", points: [{ x: ts.a, y: 92 }, { x: ts.b, y: 112 }] });
      c.addDrawing({ type: "measure", points: [{ x: ts.a, y: 96 }, { x: ts.c, y: 104 }] });
      // A close-snapped level line (snap resolves to a real bar close).
      const snapId = c.addDrawing({ type: "horizontalLine", points: [{ x: ts.c, y: 100.4 }], snap: "close" });
      window.__snapY = c.getDrawing(snapId).points[0].y;
      return c.getDrawings().length;
    }, { a: at(20), b: at(80), c: at(50) });

    expect(count).toBe(7);
    // 3 line-family drawings + a fib group of 7 level lines + a snapped hline
    // => at least 11 <line> nodes; a rectangle and a measure box => >= 2 <rect>.
    expect(await overlayLines(page).count()).toBeGreaterThanOrEqual(11);
    expect(await overlayRects(page).count()).toBeGreaterThanOrEqual(2);
    // The snapped price equals an actual bar close (integer-free deterministic
    // data means it won't equal the raw 100.4 we asked for).
    const snapY = await page.evaluate(() => window.__snapY);
    expect(snapY).not.toBe(100.4);

    expect(errors).toEqual([]);
  });

  test("re-projects drawings when the visible range changes (data-anchored)", async ({
    page,
  }) => {
    await gotoFixture(page);

    // A vertical line anchored to a specific timestamp. Its screen x must move
    // when we zoom, because the same data x maps to a new pixel.
    const id = await page.evaluate(
      (x) => window.__chart.addDrawing({ type: "verticalLine", points: [{ x }] }),
      at(50)
    );

    const xBefore = await page.evaluate(() => {
      const l = document.querySelector("#chart .apexstock-drawing-overlay line");
      return l ? parseFloat(l.getAttribute("x1")) : null;
    });
    expect(xBefore).not.toBeNull();
    expect(Number.isFinite(xBefore)).toBe(true);

    // Zoom to a narrower window that still contains bar 50.
    await page.evaluate(
      (r) => window.__chart.setVisibleRange(r.min, r.max),
      { min: at(35), max: at(65) }
    );
    await page.waitForTimeout(400); // overlay re-sync is debounced (~300ms)

    const xAfter = await page.evaluate(() => {
      const l = document.querySelector("#chart .apexstock-drawing-overlay line");
      return l ? parseFloat(l.getAttribute("x1")) : null;
    });
    expect(Number.isFinite(xAfter)).toBe(true);
    // Reprojected: narrowing the range spreads bars out, so the pixel moved.
    expect(Math.abs(xAfter - xBefore)).toBeGreaterThan(5);

    // The data anchor itself is unchanged by zoom.
    const anchorX = await page.evaluate(
      (drawId) => window.__chart.getDrawing(drawId).points[0].x,
      id
    );
    expect(anchorX).toBe(at(50));
  });

  test("drawings round-trip through getState()/setState()", async ({ page }) => {
    const errors = await gotoFixture(page);

    const restored = await page.evaluate((ts) => {
      const c = window.__chart;
      c.addDrawing({ type: "trendline", points: [{ x: ts.a, y: 95 }, { x: ts.b, y: 112 }] });
      c.addDrawing({ type: "rectangle", points: [{ x: ts.a, y: 90 }, { x: ts.c, y: 100 }] });
      const state = JSON.parse(JSON.stringify(c.getState()));

      // Wipe, confirm empty, then restore from the serialized state.
      c.clearDrawings();
      const empty = c.getDrawings().length;
      c.setState(state);
      return {
        version: state.version,
        saved: state.drawings.length,
        empty,
        after: c.getDrawings().map((d) => d.type).sort(),
      };
    }, { a: at(20), b: at(80), c: at(50) });

    expect(restored.version).toBe(2);
    expect(restored.saved).toBe(2);
    expect(restored.empty).toBe(0);
    expect(restored.after).toEqual(["line", "rectangle"]);

    expect(errors).toEqual([]);
  });
});
