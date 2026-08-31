/**
 * ApexStock Chart Export Functionality
 * This module adds a screenshot/export capability to ApexStock charts
 * Uses SVG serialization for high-quality chart captures
 */
export default class Export {
    constructor(ctx: any, options?: {});
    ctx: any;
    chartEl: any;
    options: {
        filename: string;
        quality: number;
        scale: number;
        button: boolean;
    };
    init(): void;
    createExportButton(): void;
    exportButton: HTMLButtonElement;
    buttonContainer: HTMLDivElement;
    /** The download-arrow icon markup (idle button state). */
    _idleIcon(): string;
    addButtonEventListener(): void;
    /**
     * Get SVG string representation of the chart
     * @param {number} _scale - Scale factor for the output
     * @returns {Promise<string>} SVG string
     */
    getSvgString(_scale: number): Promise<string>;
    /**
     * Convert SVG string to DOM node
     * @param {string} svgString - SVG as string
     * @returns {Node} SVG DOM node
     */
    svgStringToNode(svgString: string): Node;
    /**
     * Scale SVG node
     * @param {Node} svgNode - SVG DOM node
     * @param {number} scale - Scale factor
     */
    scaleSvgNode(svgNode: Node, scale: number): void;
    /**
     * Convert all images in SVG to base64
     * @param {Node} svgNode - SVG DOM node
     * @returns {Promise} Promise that resolves when all images are converted
     */
    convertImagesToBase64(svgNode: Node): Promise<any>;
    /**
     * Convert URL to base64
     * @param {string} url - Image URL
     * @returns {Promise<string>} Promise that resolves with base64 string
     */
    getBase64FromUrl(url: string): Promise<string>;
    /**
     * Capture the chart as an image.
     *
     * SVG is always available (a serialized snapshot of the chart DOM). PNG is
     * produced by rasterizing that SVG onto a canvas; some browsers refuse to
     * rasterize `<foreignObject>` content (a security restriction) and taint the
     * canvas, in which case this transparently falls back to SVG and flags it via
     * `fallback: true` on the result.
     *
     * @param {{format?: "png"|"svg", scale?: number, download?: boolean, filename?: string}} [options]
     * @returns {Promise<{format:"png"|"svg", blob: Blob, url: string, fallback?: boolean}>}
     */
    capture(options?: {
        format?: "png" | "svg";
        scale?: number;
        download?: boolean;
        filename?: string;
    }): Promise<{
        format: "png" | "svg";
        blob: Blob;
        url: string;
        fallback?: boolean;
    }>;
    /**
     * Produce a PNG Blob by compositing the main chart and any oscillator panes,
     * stacked vertically, using each ApexCharts instance's native `dataURI()`.
     * @param {number} scale
     * @returns {Promise<Blob>}
     */
    rasterize(scale: number): Promise<Blob>;
    /** Load an image source into an <img>, resolving once decoded. */
    _loadImage(src: any): Promise<any>;
    /** Stack PNG data URLs vertically onto one opaque canvas. */
    _compositeToCanvas(dataUrls: any): Promise<HTMLCanvasElement>;
    /** Stack PNG data URLs vertically onto one canvas and return a PNG Blob. */
    _composite(dataUrls: any): Promise<any>;
    /**
     * Rasterize the chart (main chart + oscillator panes) to a single canvas.
     * @param {number} scale
     * @returns {Promise<HTMLCanvasElement>}
     */
    rasterizeToCanvas(scale: number): Promise<HTMLCanvasElement>;
    /**
     * Export the chart as a single-page PDF: rasterize to a canvas, encode it as a
     * JPEG, and embed that in a minimal PDF sized to the image (see
     * {@link buildPdfFromJpeg}). Browser-only (needs canvas + `atob`).
     *
     * With `include: ["analysis"]` a text summary is set below the chart, so the
     * export carries the numbers a screenshot cannot: the window's change, high,
     * low, averages, volatility, drawdown, and the comparison leaderboard when one
     * is active. Pass `summary` to write that block yourself.
     *
     * @param {Object} [options]
     * @param {number} [options.scale] - Output scale (resolution multiplier).
     * @param {Array<"analysis">|string} [options.include] - `"analysis"` adds the
     *   summary block below the chart.
     * @param {string[]} [options.summary] - Explicit summary lines, used instead of
     *   the generated ones (implies `include: ["analysis"]`).
     * @param {"all"|"visible"} [options.range="visible"] - Which window the
     *   generated summary describes.
     * @param {boolean} [options.download] - Also trigger a file download.
     * @param {string} [options.filename] - Download filename (extension added).
     * @returns {Promise<{format:"pdf", blob: Blob, url: string}>}
     */
    capturePdf(options?: {
        scale?: number;
        include?: Array<"analysis"> | string;
        summary?: string[];
        range?: "all" | "visible";
        download?: boolean;
        filename?: string;
    }): Promise<{
        format: "pdf";
        blob: Blob;
        url: string;
    }>;
    /**
     * The PDF's summary block: the consumer's own lines, or the analysis ones when
     * `include` asks for them. Gathers from the public API so an exported number is
     * the same number the chart shows.
     * @param {Object} options
     * @returns {string[]}
     * @private
     */
    private _summaryLines;
    /** The primary series' name, by position. @private */
    private _seriesName;
    /** Opaque background color for rasterized PNGs. */
    _backgroundColor(): string;
    /** Swap/append a file extension on the configured filename. */
    _withExt(name: any, ext: any): string;
    /** Trigger a browser download of a URL, then release it. */
    _triggerDownload(url: any, filename: any): void;
    showNotification(message: any, type?: string): void;
}
