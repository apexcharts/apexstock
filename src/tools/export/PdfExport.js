/**
 * Minimal, dependency-free PDF construction for chart export. Builds a
 * single-page PDF that embeds a pre-encoded JPEG (via the PDF `DCTDecode`
 * filter, which takes JPEG bytes verbatim) scaled to fill the page. This keeps
 * the export path self-contained: no jsPDF or other runtime dependency, and the
 * rasterization (canvas -> JPEG) stays in the browser-only {@link Export} layer
 * while this byte assembly is pure and unit-testable.
 *
 * The MediaBox is sized in PDF points equal to the image's pixel dimensions, so
 * the chart fills the page 1:1 with its raster.
 */

/** Encode an ASCII/Latin1 string to bytes (one byte per char, masked to 8 bits). */
function enc(str) {
  const out = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) out[i] = str.charCodeAt(i) & 0xff;
  return out;
}

/**
 * Build a single-page PDF (as bytes) embedding a JPEG image scaled to the page.
 *
 * @param {Uint8Array} jpegBytes - Raw JPEG (JFIF) bytes.
 * @param {number} width - Image width in pixels (also the page width in points).
 * @param {number} height - Image height in pixels (also the page height in points).
 * @returns {Uint8Array} The complete PDF document bytes.
 */
export function buildPdfFromJpeg(jpegBytes, width, height) {
  const w = Math.max(1, Math.round(width) || 1);
  const h = Math.max(1, Math.round(height) || 1);
  const jpeg =
    jpegBytes instanceof Uint8Array ? jpegBytes : new Uint8Array(jpegBytes || []);

  const parts = [];
  let len = 0;
  const offsets = [];
  const push = (chunk) => {
    const b = chunk instanceof Uint8Array ? chunk : enc(chunk);
    parts.push(b);
    len += b.length;
  };
  const startObj = () => offsets.push(len);

  // Header, with a binary-marker comment so tools treat the file as binary.
  push("%PDF-1.4\n%âãÏÓ\n");

  // 1: Catalog.
  startObj();
  push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

  // 2: Pages.
  startObj();
  push("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");

  // 3: Page.
  startObj();
  push(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] ` +
      `/Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`
  );

  // 4: Image XObject (JPEG passed through DCTDecode).
  startObj();
  push(
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} ` +
      `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode ` +
      `/Length ${jpeg.length} >>\nstream\n`
  );
  push(jpeg);
  push("\nendstream\nendobj\n");

  // 5: Content stream that draws the image across the full MediaBox.
  const content = `q\n${w} 0 0 ${h} 0 0 cm\n/Im0 Do\nQ\n`;
  startObj();
  push(`5 0 obj\n<< /Length ${content.length} >>\nstream\n${content}endstream\nendobj\n`);

  // Cross-reference table + trailer.
  const xrefOffset = len;
  let xref = "xref\n0 6\n0000000000 65535 f \n";
  for (const off of offsets) {
    xref += String(off).padStart(10, "0") + " 00000 n \n";
  }
  push(xref);
  push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  const total = new Uint8Array(len);
  let p = 0;
  for (const b of parts) {
    total.set(b, p);
    p += b.length;
  }
  return total;
}
