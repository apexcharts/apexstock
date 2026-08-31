import { test, expect } from "@playwright/test";

// A zoom gesture in a real browser must carry ApexStock's chrome with it, frame
// by frame, rather than leaving it frozen until the gesture settles.
//
// ApexCharts re-renders the plot on every animation frame of a wheel zoom but
// defers its `zoomed` callback until 150ms after the last wheel event (by
// design: `zoomed` is a settled-gesture callback). ApexStock used to drive the
// custom x-axis, the event markers and any linked chart from `zoomed` alone, so
// the candles moved while everything around them stood still and then snapped
// into place. These specs pin the per-frame behaviour, which cannot be observed
// without real wheel events and real frames.
const FIXTURE = "/test/e2e/fixtures/chart.html";

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

/** Count the range events and the custom axis' repaints from now on. */
async function instrument(page) {
  await page.evaluate(() => {
    const c = window.__chart;
    window.__probe = { changing: [], change: [], axisPaints: 0 };
    c.on("rangeChanging", (p) => window.__probe.changing.push(p));
    c.on("rangeChange", (p) => window.__probe.change.push(p));
    const ticks = document.querySelector(".apexstock-xaxis");
    if (ticks) {
      new MutationObserver(() => {
        window.__probe.axisPaints += 1;
      }).observe(ticks, { childList: true, subtree: true });
    }
    window.__probe.hasAxis = !!ticks;
    window.__probe.firstLabel = ticks ? ticks.textContent.trim() : null;
  });
}

/** A wheel gesture of `n` notches, roughly one per animation frame. */
async function wheelGesture(page, n = 8) {
  const box = await page
    .locator("#chart .apexcharts-canvas")
    .first()
    .boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 3);
  await page.waitForTimeout(200);
  await instrument(page);
  for (let i = 0; i < n; i++) {
    await page.mouse.wheel(0, -100);
    await page.waitForTimeout(16);
  }
}

test.describe("live range tracking", () => {
  test("the custom x-axis repaints during a wheel gesture, not after it", async ({
    page,
  }) => {
    const errors = await gotoFixture(page);
    await wheelGesture(page, 8);

    // Read while the gesture is still "in flight": ApexCharts' settled callback
    // is 150ms behind the last notch, so anything observed here came from the
    // per-frame path.
    const mid = await page.evaluate(() => ({ ...window.__probe }));
    expect(mid.hasAxis).toBe(true);
    expect(mid.axisPaints).toBeGreaterThan(2);
    expect(mid.changing.length).toBeGreaterThan(2);
    // ...and the settled event has deliberately not fired yet.
    expect(mid.change).toHaveLength(0);

    // The labels actually changed, so those repaints were real work.
    const after = await page.evaluate(() =>
      document.querySelector(".apexstock-xaxis").textContent.trim()
    );
    expect(after).not.toBe(mid.firstLabel);

    // Then the settled event lands, exactly once.
    await page.waitForTimeout(500);
    const end = await page.evaluate(() => ({ ...window.__probe }));
    expect(end.change).toHaveLength(1);
    expect(end.change[0].source).toBe("zoom");
    expect(errors).toEqual([]);
  });

  test("rangeChanging tracks the window and agrees with the settled range", async ({
    page,
  }) => {
    const errors = await gotoFixture(page);
    await wheelGesture(page, 8);
    await page.waitForTimeout(500);

    const p = await page.evaluate(() => ({ ...window.__probe }));
    // Every live frame reports a valid, narrowing-or-equal window...
    p.changing.forEach((r) => {
      expect(Number.isFinite(r.min)).toBe(true);
      expect(Number.isFinite(r.max)).toBe(true);
      expect(r.max).toBeGreaterThan(r.min);
      expect(r.source).toBe("live");
    });
    const first = p.changing[0];
    const last = p.changing[p.changing.length - 1];
    expect(last.max - last.min).toBeLessThan(first.max - first.min);

    // ...and the last live frame agrees with the settled window, so the axis
    // does not need a correcting repaint once the gesture ends.
    const settled = p.change[p.change.length - 1];
    expect(Math.abs(settled.min - last.min)).toBeLessThan(1);
    expect(Math.abs(settled.max - last.max)).toBeLessThan(1);

    // getVisibleRange agrees with what was reported.
    const visible = await page.evaluate(() => window.__chart.getVisibleRange());
    expect(Math.abs(visible.min - settled.min)).toBeLessThan(1);
    expect(errors).toEqual([]);
  });

  test("a linked chart follows the gesture instead of jumping at the end", async ({
    page,
  }) => {
    const errors = await gotoFixture(page);

    // Build a second chart over the same data and link them.
    await page.evaluate(() => {
      const host = document.createElement("div");
      host.id = "chart2";
      document.querySelector("#chart-container").appendChild(host);
      const b = new window.ApexStock(host, {
        chart: { height: 260, redrawOnParentResize: false },
        theme: { mode: "light" },
        series: [{ name: "Price", data: window.__chart.series }],
      });
      b.render();
      window.__b = b;
      window.__sync = window.ApexStock.sync([window.__chart, b]);
      window.__follow = [];
      b.on("rangeChanging", (p) => window.__follow.push(p));
      b.on("rangeChange", (p) => window.__follow.push(p));
    });
    await page.waitForTimeout(400);

    const box = await page
      .locator("#chart .apexcharts-canvas")
      .first()
      .boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 3);
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      window.__follow = [];
    });
    for (let i = 0; i < 8; i++) {
      await page.mouse.wheel(0, -100);
      await page.waitForTimeout(16);
    }

    // The follower has already moved, before the source's gesture settles.
    const midFollow = await page.evaluate(() => window.__follow.length);
    expect(midFollow).toBeGreaterThan(1);

    await page.waitForTimeout(600);
    const windows = await page.evaluate(() => ({
      a: window.__chart.getVisibleRange(),
      b: window.__b.getVisibleRange(),
    }));
    // And it ends up on the same window as the chart that was zoomed.
    expect(Math.abs(windows.a.min - windows.b.min)).toBeLessThan(1);
    expect(Math.abs(windows.a.max - windows.b.max)).toBeLessThan(1);
    expect(errors).toEqual([]);
  });
});
