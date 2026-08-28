// Pure PDF byte-assembly for chart export (buildPdfFromJpeg). No DOM needed: the
// canvas -> JPEG step lives in the browser-only Export layer and is covered by
// the Playwright smoke; here we pin the PDF structure and that the JPEG bytes are
// embedded verbatim.
import { describe, it, expect } from "vitest";
import { buildPdfFromJpeg } from "../src/tools/export/PdfExport.js";

const latin1 = (bytes) => {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return s;
};

// A distinctive fake "JPEG" (SOI ... EOI) so we can locate it in the output.
function fakeJpeg() {
  return new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x01, 0x02, 0x03, 0xff, 0xd9]);
}

function indexOfBytes(hay, needle) {
  outer: for (let i = 0; i <= hay.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (hay[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}

describe("buildPdfFromJpeg", () => {
  it("produces a well-formed single-page PDF", () => {
    const jpeg = fakeJpeg();
    const pdf = buildPdfFromJpeg(jpeg, 640, 480);
    expect(pdf).toBeInstanceOf(Uint8Array);
    const s = latin1(pdf);

    expect(s.startsWith("%PDF-1.4")).toBe(true);
    expect(s).toContain("/Type /Catalog");
    expect(s).toContain("/Type /Pages");
    expect(s).toContain("/MediaBox [0 0 640 480]");
    expect(s).toContain("/Subtype /Image");
    expect(s).toContain("/Filter /DCTDecode");
    expect(s).toContain("/Width 640");
    expect(s).toContain("/Height 480");
    expect(s).toContain("/Length " + jpeg.length);
    expect(s).toContain("640 0 0 480 0 0 cm"); // draw matrix fills the page
    expect(s).toContain("/BaseFont /Helvetica");
    expect(s).toContain("/Size 7");
    expect(s).toContain("startxref");
    expect(s.trimEnd().endsWith("%%EOF")).toBe(true);
  });

  it("embeds the JPEG bytes verbatim", () => {
    const jpeg = fakeJpeg();
    const pdf = buildPdfFromJpeg(jpeg, 100, 100);
    expect(indexOfBytes(pdf, jpeg)).toBeGreaterThan(0);
  });

  it("the xref offsets point at the object headers", () => {
    const pdf = buildPdfFromJpeg(fakeJpeg(), 10, 10);
    const s = latin1(pdf);

    // Parse the startxref offset and the xref table, then check each entry's
    // offset lands on the matching "N 0 obj".
    const startxref = Number(s.match(/startxref\s+(\d+)/)[1]);
    const xrefText = s.slice(startxref);
    const entries = [...xrefText.matchAll(/(\d{10}) 00000 n /g)].map((m) =>
      Number(m[1])
    );
    expect(entries).toHaveLength(6);
    entries.forEach((off, i) => {
      expect(s.slice(off).startsWith(`${i + 1} 0 obj`)).toBe(true);
    });
  });

  it("rounds fractional dimensions and guards against zero", () => {
    const s = latin1(buildPdfFromJpeg(fakeJpeg(), 100.6, 0));
    expect(s).toContain("/MediaBox [0 0 101 1]");
  });

  it("grows the page for a text band below the image", () => {
    const lines = ["AAPL 2024-01-01 to 2024-03-01", "Change +12.00 (+8.00%)"];
    const s = latin1(
      buildPdfFromJpeg(fakeJpeg(), 600, 400, {
        lines,
        fontSize: 10,
        lineHeight: 14,
        padding: 20,
      })
    );
    // band = 2*20 + 2*14 = 68, so the page is 400 + 68 tall...
    expect(s).toContain("/MediaBox [0 0 600 468]");
    // ...the image keeps its own height and is lifted above the band...
    expect(s).toContain("/Height 400");
    expect(s).toContain("600 0 0 400 0 68 cm");
    // ...and the text starts one line below the band's top edge.
    expect(s).toContain("/F1 10 Tf");
    expect(s).toContain("20 38 Td");
    expect(s).toContain("(AAPL 2024-01-01 to 2024-03-01) Tj");
    expect(s).toContain("0 -14 Td");
    // The parentheses inside the line are escaped, so the reader sees them as
    // text rather than as the end of the string.
    expect(s).toContain("(Change +12.00 \\(+8.00%\\)) Tj");
  });

  it("leaves the page image-sized when there are no lines", () => {
    const s = latin1(buildPdfFromJpeg(fakeJpeg(), 600, 400, { lines: [] }));
    expect(s).toContain("/MediaBox [0 0 600 400]");
    expect(s).toContain("600 0 0 400 0 0 cm");
    expect(s).not.toContain(" Tj");
  });

  it("escapes parentheses and backslashes in the text", () => {
    const s = latin1(
      buildPdfFromJpeg(fakeJpeg(), 10, 10, { lines: ["a(b)c\\d"] })
    );
    expect(s).toContain("(a\\(b\\)c\\\\d) Tj");
  });

  it("replaces characters the base-14 font cannot show", () => {
    // A Greek delta is not in WinAnsi; drawing its low byte would be garbage.
    const s = latin1(buildPdfFromJpeg(fakeJpeg(), 10, 10, { lines: ["\u0394 %"] }));
    expect(s).toContain("(? %) Tj");
  });

  it("keeps the xref valid with a text band", () => {
    const pdf = buildPdfFromJpeg(fakeJpeg(), 10, 10, { lines: ["one", "two"] });
    const s = latin1(pdf);
    const startxref = Number(s.match(/startxref\s+(\d+)/)[1]);
    const entries = [...s.slice(startxref).matchAll(/(\d{10}) 00000 n /g)].map(
      (m) => Number(m[1])
    );
    expect(entries).toHaveLength(6);
    entries.forEach((off, i) => {
      expect(s.slice(off).startsWith(`${i + 1} 0 obj`)).toBe(true);
    });
    // The content stream's declared /Length has to match what follows it.
    const m = s.match(/5 0 obj\n<< \/Length (\d+) >>\nstream\n/);
    const body = s.slice(m.index + m[0].length);
    expect(body.slice(Number(m[1])).startsWith("endstream")).toBe(true);
  });
});
