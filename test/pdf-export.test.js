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
    expect(s).toContain("/Size 6");
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
    expect(entries).toHaveLength(5);
    entries.forEach((off, i) => {
      expect(s.slice(off).startsWith(`${i + 1} 0 obj`)).toBe(true);
    });
  });

  it("rounds fractional dimensions and guards against zero", () => {
    const s = latin1(buildPdfFromJpeg(fakeJpeg(), 100.6, 0));
    expect(s).toContain("/MediaBox [0 0 101 1]");
  });
});
