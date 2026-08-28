import { test, expect } from "@playwright/test";

// Comparison mode in a real browser: four instruments with different histories
// on a secondary y-axis, the normalized views, the benchmark role, and a
// visible-window baseline that follows a real zoom. jsdom cannot prove the
// multi-axis binding survives ApexCharts, which is the point of these.
const FIXTURE = "/apexstock/test/e2e/fixtures/comparison.html";

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

/** The plotted y of one comparison line at a bar index, read off the chart. */
const yAt = (page, name, index) =>
  page.evaluate(
    ([n, i]) => {
      const s = window.__chart.chart.w.config.series.find((x) => x.name === n);
      const x = window.__data[i].x;
      const p = s && s.data.find((q) => q.x === x);
      return p ? p.y : null;
    },
    [name, index]
  );

test.describe("comparison mode", () => {
  test("plots every instrument on a secondary axis without an axis-binding error", async ({
    page,
  }) => {
    const errors = await gotoFixture(page);

    const names = await page.evaluate(() =>
      window.__chart.chart.w.config.series.map((s) => s.name)
    );
    expect(names).toEqual(["AAPL", "MSFT", "NVDA", "SPY"]);

    // Two y-axes, and the comparison axis is labelled for percent mode.
    const axes = await page.evaluate(() =>
      window.__chart.chart.w.config.yaxis.map((a) => ({
        seriesName: a.seriesName,
        title: a.title && a.title.text,
      }))
    );
    expect(axes).toHaveLength(2);
    expect(axes[0].seriesName).toEqual(["AAPL"]);
    expect(axes[1].seriesName).toEqual(["MSFT", "NVDA", "SPY"]);
    expect(axes[1].title).toBe("Δ %");

    // Three line paths rendered alongside the candles.
    await expect(
      page.locator("#chart .apexcharts-line-series > g")
    ).toHaveCount(3);
    expect(errors).toEqual([]);
  });

  test("rebases every instrument at the first shared session", async ({
    page,
  }) => {
    const errors = await gotoFixture(page);

    // NVDA lists on bar 30, so that is the first x every instrument has.
    const at30 = await Promise.all([
      yAt(page, "MSFT", 30),
      yAt(page, "NVDA", 30),
      yAt(page, "SPY", 30),
    ]);
    expect(at30).toEqual([0, 0, 0]);

    // MSFT and SPY have history before the baseline; it plots as negative.
    expect(await yAt(page, "MSFT", 0)).toBeLessThan(0);
    expect(await yAt(page, "NVDA", 0)).toBeNull(); // did not exist yet

    const rows = await page.evaluate(() => window.__chart.getComparisonStats());
    const expected = await page.evaluate(() => window.__expected);
    const byName = Object.fromEntries(rows.map((r) => [r.name, r]));

    // The primary is a row too, measured from the same baseline.
    expect(rows.map((r) => r.name)).toEqual(["AAPL", "MSFT", "NVDA", "SPY"]);
    for (const name of ["AAPL", "MSFT", "NVDA", "SPY"]) {
      expect(byName[name].change.percent).toBeCloseTo(expected[name], 6);
      expect(byName[name].bars).toBe(90); // bars 30..119
    }
    expect(byName.AAPL.primary).toBe(true);
    expect(byName.NVDA.rank).toBe(1); // +89%
    expect(byName.AAPL.rank).toBe(2);
    expect(byName.MSFT.rank).toBe(3);
    expect(byName.SPY.rank).toBe(4);

    expect(errors).toEqual([]);
  });

  test('indexed mode is the "100 = starting value" view', async ({ page }) => {
    const errors = await gotoFixture(page);
    await page.evaluate(() => window.__chart.setComparisonMode("indexed"));

    for (const name of ["MSFT", "NVDA", "SPY"]) {
      expect(await yAt(page, name, 30)).toBe(100);
    }
    const expected = await page.evaluate(() => window.__expected);
    expect(await yAt(page, "NVDA", 119)).toBeCloseTo(100 + expected.NVDA, 2);

    const title = await page.evaluate(
      () => window.__chart.chart.w.config.yaxis[1].title.text
    );
    expect(title).toBe("index (100)");
    expect(errors).toEqual([]);
  });

  test("a benchmark is a role: relative mode against any instrument", async ({
    page,
  }) => {
    const errors = await gotoFixture(page);

    await page.evaluate(() => {
      window.__chart.setComparisonBenchmark("SPY");
      window.__chart.setComparisonMode("relative");
    });

    // The benchmark's spread against itself is the zero reference line.
    const spy = await page.evaluate(() => {
      const s = window.__chart.chart.w.config.series.find(
        (x) => x.name === "SPY"
      );
      return s.data.every((p) => p.y === 0);
    });
    expect(spy).toBe(true);

    const expected = await page.evaluate(() => window.__expected);
    expect(await yAt(page, "NVDA", 119)).toBeCloseTo(
      expected.NVDA - expected.SPY,
      2
    );

    const rows = await page.evaluate(() => window.__chart.getComparisonStats());
    const aapl = rows.find((r) => r.name === "AAPL");
    expect(aapl.relative).toBeCloseTo(expected.AAPL - expected.SPY, 6);
    expect(rows.find((r) => r.name === "SPY").benchmark).toBe(true);

    expect(errors).toEqual([]);
  });

  test('baseline: "visible" follows a real zoom', async ({ page }) => {
    const errors = await gotoFixture(page);

    await page.evaluate(() =>
      window.__chart.setComparisonOptions({ baseline: "visible" })
    );
    // The whole range is visible, so the baseline is each instrument's first
    // point at or after the left edge.
    expect(await yAt(page, "MSFT", 0)).toBe(0);

    await page.evaluate(() => {
      const d = window.__data;
      window.__chart.setVisibleRange(d[60].x, d[119].x);
    });
    await expect.poll(() => yAt(page, "MSFT", 60)).toBe(0);
    expect(await yAt(page, "NVDA", 60)).toBe(0);
    // Everything before the new left edge is now negative.
    expect(await yAt(page, "MSFT", 30)).toBeLessThan(0);

    expect(errors).toEqual([]);
  });

  test("an indicator overlay can be toggled while comparisons are active", async ({
    page,
  }) => {
    const errors = await gotoFixture(page);

    // Adding a main-chart series while two axes are bound is the case that
    // throws in ApexCharts if the bound/unbound invariant slips.
    await page.evaluate(() => window.__chart.updateIndicator("moving average"));
    await page.waitForTimeout(400);

    const axes = await page.evaluate(() =>
      window.__chart.chart.w.config.yaxis.map((a) => a.seriesName)
    );
    const names = await page.evaluate(() =>
      window.__chart.chart.w.config.series.map((s) => s.name)
    );
    expect(axes).toHaveLength(2);
    // Every series is bound to exactly one axis.
    expect([...axes[0], ...axes[1]].sort()).toEqual([...names].sort());
    expect(axes[1]).toEqual(["MSFT", "NVDA", "SPY"]);
    expect(axes[0].length).toBeGreaterThan(1); // AAPL + the overlay

    // And the comparison lines still hold their values.
    expect(await yAt(page, "NVDA", 30)).toBe(0);
    expect(errors).toEqual([]);
  });

  test("the setup survives a state round-trip, and asks for the data back", async ({
    page,
  }) => {
    const errors = await gotoFixture(page);

    const out = await page.evaluate(async () => {
      const chart = window.__chart;
      chart.setComparisonBenchmark("SPY");
      chart.setComparisonMode("indexed");
      chart.setComparisonOptions({ baseline: "own" });
      const state = JSON.parse(JSON.stringify(chart.getState()));
      window.__saved = state;

      // A restore on the same chart keeps the loaded data: nothing to re-supply.
      const askedSame = [];
      const off = chart.on("comparisonRestoreNeeded", (p) =>
        askedSame.push(p.names)
      );
      chart.setComparisonMode("percent");
      chart.clearComparisons();
      chart.setState(state);
      off();

      return {
        state: state.comparison,
        askedSame,
        mode: chart.getComparisonMode(),
        benchmark: chart.getComparisonBenchmark(),
        baseline: chart.getComparisonOptions().baseline,
        instruments: chart.getComparisons().map((i) => i.name),
      };
    });

    // The state carries identity and setup, never the bars.
    expect(out.state.instruments).toEqual([
      { name: "MSFT", color: "#2563eb" },
      { name: "NVDA", color: "#16a34a" },
      { name: "SPY", color: "#9333ea" },
    ]);
    expect(JSON.stringify(out.state).length).toBeLessThan(600);

    // The setup came back...
    expect(out.mode).toBe("indexed");
    expect(out.benchmark).toBe("SPY");
    expect(out.baseline).toBe("own");
    // ...and since the data was cleared, it was asked for by name.
    expect(out.askedSame).toEqual([[["MSFT", "NVDA", "SPY"]][0]]);
    expect(out.instruments).toEqual([]);

    // Re-supplying it puts the lines back, in their remembered colors.
    const restored = await page.evaluate(() => {
      const chart = window.__chart;
      chart.on("comparisonRestoreNeeded", ({ names }) => {
        names.forEach((name) =>
          chart.addComparison({ name, data: window.__peers[name] })
        );
      });
      // The saved state, not the current (emptied) one: this is the real
      // reload path, where the data has to come from the app.
      chart.setState(window.__saved);
      return chart.getComparisons();
    });
    expect(restored).toEqual([
      { name: "MSFT", color: "#2563eb", points: 120 },
      { name: "NVDA", color: "#16a34a", points: 90 },
      { name: "SPY", color: "#9333ea", points: 120 },
    ]);

    expect(errors).toEqual([]);
  });

  test("comparisonChange reports each mutation with the leaderboard", async ({
    page,
  }) => {
    const errors = await gotoFixture(page);

    // Three adds happened at load, before any listener existed, so the log
    // starts empty and fills from the first mutation after subscribing.
    await page.evaluate(() => {
      window.__events = [];
      window.__chart.setComparisonMode("indexed");
      window.__chart.setComparisonBenchmark("SPY");
      window.__chart.removeComparison("MSFT");
    });

    const events = await page.evaluate(() => window.__events);
    expect(events.map((e) => e.reason)).toEqual([
      "mode",
      "benchmark",
      "remove",
    ]);
    expect(events[0].baseline).toBe("common");
    expect(events[2].rows).toBe(3); // AAPL + NVDA + SPY
    expect(events[2].benchmark).toBe("SPY");

    expect(errors).toEqual([]);
  });
});
