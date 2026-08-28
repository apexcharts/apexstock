/**
 * Minimal, dependency-free PDF construction for chart export. Builds a
 * single-page PDF that embeds a pre-encoded JPEG (via the PDF `DCTDecode`
 * filter, which takes JPEG bytes verbatim) scaled to fill the page. This keeps
 * the export path self-contained: no jsPDF or other runtime dependency, and the
 * rasterization (canvas -> JPEG) stays in the browser-only {@link Export} layer
 * while this byte assembly is pure and unit-testable.
 *
 * The MediaBox is sized in PDF points equal to the image's pixel dimensions, so
 * the chart fills the page 1:1 with its raster. Passing `lines` adds a text band
 * *below* the image (growing the page rather than covering the chart), set in
 * Helvetica: one of the PDF base-14 fonts, so there is still nothing to embed.
 */

/** Encode an ASCII/Latin1 string to bytes (one byte per char, masked to 8 bits). */
function enc(str) {
  const out = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) out[i] = str.charCodeAt(i) & 0xff;
  return out;
}

/**
 * Escape a string for a PDF literal string and force it into the byte range the
 * WinAnsi-encoded base-14 font can actually show. Anything outside it becomes
 * "?" rather than a byte the reader would draw as garbage.
 */
function pdfText(str) {
  let out = "";
  const src = String(str == null ? "" : str);
  for (let i = 0; i < src.length; i++) {
    const c = src.charCodeAt(i);
    // ( ) and backslash have to be escaped inside a PDF literal string.
    if (c === 0x28 || c === 0x29 || c === 0x5c) out += "\\" + src[i];
    else if (c >= 0x20 && c <= 0xff) out += src[i];
    else if (c === 0x09) out += " ";
    else out += "?";
  }
  return out;
}

/**
 * Build a single-page PDF (as bytes) embedding a JPEG image scaled to the page,
 * optionally followed by a text band underneath it.
 *
 * @param {Uint8Array} jpegBytes - Raw JPEG (JFIF) bytes.
 * @param {number} width - Image width in pixels (also the page width in points).
 * @param {number} height - Image height in pixels (the image's height in points).
 * @param {Object} [opts]
 * @param {string[]} [opts.lines] - Text lines drawn below the image. The page
 *   grows to fit them; an empty list produces the image-only page as before.
 * @param {number} [opts.fontSize=11]
 * @param {number} [opts.lineHeight] - Defaults to `fontSize * 1.45`.
 * @param {number} [opts.padding=18] - Margin around the text band.
 * @returns {Uint8Array} The complete PDF document bytes.
 */
export function buildPdfFromJpeg(jpegBytes, width, height, opts = {}) {
  const w = Math.max(1, Math.round(width) || 1);
  const h = Math.max(1, Math.round(height) || 1);
  const jpeg =
    jpegBytes instanceof Uint8Array ? jpegBytes : new Uint8Array(jpegBytes || []);

  const lines = (Array.isArray(opts.lines) ? opts.lines : []).map(pdfText);
  const fontSize = Number.isFinite(+opts.fontSize) ? +opts.fontSize : 11;
  const lineHeight = Number.isFinite(+opts.lineHeight)
    ? +opts.lineHeight
    : Math.round(fontSize * 1.45);
  const padding = Number.isFinite(+opts.padding) ? +opts.padding : 18;
  // The band sits below the image, so the page is taller than the raster and the
  // chart is never covered.
  const band = lines.length ? padding * 2 + lines.length * lineHeight : 0;
  const pageH = h + band;

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
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${pageH}] ` +
      `/Resources << /XObject << /Im0 4 0 R >> /Font << /F1 6 0 R >> >> ` +
      `/Contents 5 0 R >>\nendobj\n`
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

  // 5: Content stream: the image at full width, sitting on top of the band, then
  // the text lines from the top of the band downwards.
  let content = `q\n${w} 0 0 ${h} 0 ${band} cm\n/Im0 Do\nQ\n`;
  if (lines.length) {
    const firstBaseline = band - padding - fontSize;
    content += `BT\n/F1 ${fontSize} Tf\n${padding} ${firstBaseline} Td\n`;
    lines.forEach((line, i) => {
      if (i > 0) content += `0 -${lineHeight} Td\n`;
      content += `(${line}) Tj\n`;
    });
    content += "ET\n";
  }
  startObj();
  push(`5 0 obj\n<< /Length ${content.length} >>\nstream\n${content}endstream\nendobj\n`);

  // 6: Helvetica, one of the base-14 fonts (nothing to embed).
  startObj();
  push(
    `6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica ` +
      `/Encoding /WinAnsiEncoding >>\nendobj\n`
  );

  // Cross-reference table + trailer.
  const size = offsets.length + 1;
  const xrefOffset = len;
  let xref = `xref\n0 ${size}\n0000000000 65535 f \n`;
  for (const off of offsets) {
    xref += String(off).padStart(10, "0") + " 00000 n \n";
  }
  push(xref);
  push(
    `trailer\n<< /Size ${size} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
  );

  const total = new Uint8Array(len);
  let p = 0;
  for (const b of parts) {
    total.set(b, p);
    p += b.length;
  }
  return total;
}
