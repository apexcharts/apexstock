import { test, expect } from "@playwright/test";

// The main chart and its oscillator panes are separate ApexCharts instances in
// one group. Everything else about them is asserted at the STATE level -- that
// they agree on minX/maxX -- and that is not the same as agreeing on screen.
//
// They can share a window exactly and still draw the crosshair on different
// bars, which is what a reader actually sees. That happened: an indicator's
// warm-up period is a run of leading nulls, and the hovered index was resolved
// against a null-stripped copy of the series, so each chart landed short by its
// own warm-up length (an EMA overlay by 9 bars, an RSI pane by 13). The error is
// one bar-width per warm-up bar, so it hid at full extent and grew without bound
// as the chart was zoomed in -- 259px at 3 wheel notches, 2056px at 9.
//
// These sweep zoom levels and pointer positions and assert the rendered
// crosshairs agree, which is the invariant no state-level test can express.
const FIXTURE = "/test/e2e/fixtures/chart.html";

// The panes differ from the main plot by half a bar: ApexCharts insets a
// candlestick's grid by one bar-width and a line pane's by nothing. That is a
// few pixels, it does not change with zoom, and it is invisible. A real index
// mismatch is orders of magnitude bigger.
const INSET_TOLERANCE_PX = 12;

async function gotoWithPanes(page) {
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(FIXTURE);
  await page.waitForFunction(() => !!window.__chart, null, { timeout: 20000 });
  await expect(page.locator("#chart .apexcharts-svg").first()).toBeVisible();

  // An overlay with a warm-up on the main chart, and two panes whose warm-ups
  // differ from it and from each other. Identical warm-ups would cancel out.
  await page.evaluate(() => {
    window.__chart.updateIndicator("exponential moving average");
    window.__chart.updateIndicator("rsi");
    window.__chart.updateIndicator("macd");
  });
  await expect
    .poll(() =>
      page.evaluate(
        () => document.querySelectorAll("#chart .apexcharts-canvas").length
      )
    )
    .toBe(3);
  await page.waitForTimeout(300);
  return errors;
}

/** Every chart's canvas box, main chart first. */
const canvases = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("#chart .apexcharts-canvas")].map((el) => {
      const r = el.querySelector(".apexcharts-svg").getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    })
  );

/**
 * Move the pointer over `box` and report how far apart the charts' crosshairs
 * are. Two moves: ApexCharts ignores a pointer that arrives without travelling.
 */
async function spreadAt(page, box, fraction) {
  const x = box.x + box.w * fraction;
  const y = box.y + box.h * 0.5;
  await page.mouse.move(x - 8, y);
  await page.waitForTimeout(60);
  await page.mouse.move(x, y);
  await page.waitForTimeout(220);

  return page.evaluate(() => {
    const xs = [...document.querySelectorAll("#chart .apexcharts-canvas")]
      .map((el) => el.querySelector(".apexcharts-xcrosshairs"))
      .filter((c) => c && getComputedStyle(c).display !== "none")
      .map((c) => {
        const r = c.getBoundingClientRect();
        return r.left + r.width / 2;
      });
    return xs.length > 1 ? Math.max(...xs) - Math.min(...xs) : 0;
  });
}

/** Zoom in `notches` wheel steps centred on the main plot. */
async function wheelZoom(page, mainBox, notches) {
  await page.mouse.move(
    mainBox.x + mainBox.w * 0.5,
    mainBox.y + mainBox.h * 0.4
  );
  for (let i = 0; i < notches; i++) {
    await page.mouse.wheel(0, -120);
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(500);
}

test.describe("main chart and indicator panes", () => {
  test("the crosshairs agree at every zoom level, wherever the pointer is", async ({
    page,
  }) => {
    const errors = await gotoWithPanes(page);
    const boxes = await canvases(page);
    const main = boxes[0];
    const lastPane = boxes[boxes.length - 1];

    const worstByZoom = [];
    for (const notches of [0, 3, 3, 3]) {
      if (notches) await wheelZoom(page, main, notches);

      let worst = 0;
      // Hovering a PANE has to hold too: that is how the mismatch was noticed,
      // and it is the direction a group syncs least often.
      for (const box of [main, lastPane]) {
        for (const fraction of [0.25, 0.5, 0.75]) {
          worst = Math.max(worst, await spreadAt(page, box, fraction));
        }
      }
      worstByZoom.push(worst);
    }

    for (const worst of worstByZoom) {
      expect(worst).toBeLessThan(INSET_TOLERANCE_PX);
    }

    // The sharper half of the invariant. A per-bar error is invisible at full
    // extent, so an absolute bound alone can pass on an unzoomed chart while
    // the bug is live; what gives it away is the disagreement growing as the
    // bars get wider.
    const [unzoomed] = worstByZoom;
    for (const worst of worstByZoom.slice(1)) {
      expect(worst).toBeLessThan(unzoomed + INSET_TOLERANCE_PX);
    }

    expect(errors).toEqual([]);
  });

  test("the date chip tracks the crosshair, not a stale bar", async ({
    page,
  }) => {
    const errors = await gotoWithPanes(page);
    const boxes = await canvases(page);
    const main = boxes[0];
    await wheelZoom(page, main, 6);

    // The chip mirrors the main chart's crosshair, so it inherits any index
    // error: once the crosshair left the plot it clamped to the strip's edge
    // and stopped moving, which read as the axis freezing.
    const seen = [];
    for (const fraction of [0.3, 0.5, 0.7]) {
      await spreadAt(page, main, fraction);
      seen.push(
        await page.evaluate(() => {
          const chip = document.querySelector(".apexstock-xaxis-tooltip");
          const cross = document.querySelector(
            "#chart .apexcharts-canvas .apexcharts-xcrosshairs"
          );
          const c = chip.getBoundingClientRect();
          const x = cross.getBoundingClientRect();
          return {
            text: chip.textContent,
            offset: c.left + c.width / 2 - (x.left + x.width / 2),
          };
        })
      );
    }

    // Three distinct dates, left to right, each chip centred on the crosshair.
    expect(new Set(seen.map((s) => s.text)).size).toBe(3);
    for (const s of seen) expect(Math.abs(s.offset)).toBeLessThan(2);

    expect(errors).toEqual([]);
  });
});
