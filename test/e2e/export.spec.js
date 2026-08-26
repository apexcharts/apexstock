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
});
