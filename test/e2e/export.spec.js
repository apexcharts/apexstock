import { test, expect } from "@playwright/test";

// Unified export() in a real browser: csv returns text + a Blob, png returns a
// real raster Blob (or the svg fallback), and pdf returns an application/pdf Blob
// that begins with the PDF magic bytes.
const FIXTURE = "/apexstock/test/e2e/fixtures/chart.html";

async function gotoFixture(page) {
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(FIXTURE);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 20000 });
  await expect(page.locator("#chart .apexcharts-svg").first()).toBeVisible();
  return errors;
}

test.describe("unified export", () => {
  test("csv/png/pdf all resolve with the expected result shape", async ({ page }) => {
    const errors = await gotoFixture(page);

    // CSV: text + a Blob.
    const csv = await page.evaluate(async () => {
      const r = await window.__chart.export({ format: "csv" });
      return { format: r.format, header: r.text.split("\n")[0], isBlob: r.blob instanceof Blob };
    });
    expect(csv.format).toBe("csv");
    expect(csv.header).toBe("time,open,high,low,close,volume");
    expect(csv.isBlob).toBe(true);

    // PNG: a non-empty raster Blob (or the documented svg fallback).
    const png = await page.evaluate(async () => {
      const r = await window.__chart.export({ format: "png" });
      return { format: r.format, type: r.blob.type, size: r.blob.size, hasUrl: !!r.url };
    });
    expect(["png", "svg"]).toContain(png.format);
    expect(png.size).toBeGreaterThan(0);
    expect(png.hasUrl).toBe(true);

    // PDF: an application/pdf Blob beginning with "%PDF".
    const pdf = await page.evaluate(async () => {
      const r = await window.__chart.export({ format: "pdf" });
      const head = await r.blob.slice(0, 5).text();
      return { format: r.format, type: r.blob.type, size: r.blob.size, head };
    });
    expect(pdf.format).toBe("pdf");
    expect(pdf.type).toBe("application/pdf");
    expect(pdf.size).toBeGreaterThan(0);
    expect(pdf.head).toBe("%PDF-");

    expect(errors).toEqual([]);
  });

  test("include adds indicator and analysis columns to the data export", async ({
    page,
  }) => {
    const errors = await gotoFixture(page);

    // A real indicator, so the columns come from real ApexCharts state rather
    // than a stub: this is the part jsdom cannot prove.
    await page.evaluate(() => {
      window.__chart.updateIndicator("moving average"); // main-chart overlay
      window.__chart.updateIndicator("rsi"); // oscillator pane
    });
    await page.waitForTimeout(500);

    const out = await page.evaluate(() =>
      window.__chart.exportData({
        format: "json",
        include: ["ohlc", "indicators", "analysis"],
      })
    );
    const rows = JSON.parse(out);
    const keys = Object.keys(rows[0]);

    // The OHLC spine comes first, then the indicators, then the analysis.
    expect(keys.slice(0, 6)).toEqual([
      "time",
      "open",
      "high",
      "low",
      "close",
      "volume",
    ]);
    expect(keys).toContain("return");
    expect(keys).toContain("drawdown");
    expect(keys.some((k) => /MA|moving/i.test(k))).toBe(true);
    expect(keys.some((k) => /RSI/i.test(k))).toBe(true);

    // Warm-up periods are nulls, not zeros, and the columns stay bar-aligned.
    const rsiKey = keys.find((k) => /RSI/i.test(k));
    expect(rows[0][rsiKey]).toBeNull();
    expect(rows[0].return).toBeNull();
    expect(rows.at(-1)[rsiKey]).toBeGreaterThan(0);
    expect(rows.every((r) => r.drawdown == null || r.drawdown <= 0)).toBe(true);

    const csv = await page.evaluate(() =>
      window.__chart.exportData({ include: "analysis" })
    );
    expect(csv.split("\n")[0]).toBe(
      "time,open,high,low,close,volume,return,drawdown"
    );

    expect(errors).toEqual([]);
  });

  test('pdf include:"analysis" sets a summary below the chart', async ({
    page,
  }) => {
    const errors = await gotoFixture(page);

    const out = await page.evaluate(async () => {
      const plain = await window.__chart.export({ format: "pdf" });
      const withSummary = await window.__chart.export({
        format: "pdf",
        include: ["analysis"],
      });
      // The header carries the page box; the content stream and the font object
      // come after the embedded JPEG, so the text lives at the tail.
      return {
        plain: plain.blob.size,
        plainHead: await plain.blob.slice(0, 512).text(),
        summary: withSummary.blob.size,
        head: await withSummary.blob.slice(0, 512).text(),
        tail: await withSummary.blob.slice(-4096).text(),
      };
    });

    // The summary grows the page and the document.
    expect(out.summary).toBeGreaterThan(out.plain);
    const box = (s) =>
      s
        .match(/MediaBox \[0 0 (\d+) (\d+)\]/)
        .slice(1)
        .map(Number);
    const [plainW, plainH] = box(out.plainHead);
    const [wideW, wideH] = box(out.head);
    expect(wideW).toBe(plainW); // same width...
    expect(wideH).toBeGreaterThan(plainH); // ...taller page for the band

    expect(out.tail).toContain("/BaseFont /Helvetica");
    // The chart's own series name leads the block, followed by the numbers.
    expect(out.tail).toMatch(/\(Price[^)]*bars\) Tj/);
    expect(out.tail).toContain("Change");

    expect(errors).toEqual([]);
  });
});
