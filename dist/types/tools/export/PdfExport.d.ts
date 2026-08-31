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
export function buildPdfFromJpeg(jpegBytes: Uint8Array, width: number, height: number, opts?: {
    lines?: string[];
    fontSize?: number;
    lineHeight?: number;
    padding?: number;
}): Uint8Array;
