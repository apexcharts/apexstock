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
    /** Stack PNG data URLs vertically onto one canvas and return a PNG Blob. */
    _composite(dataUrls: any): Promise<any>;
    /** Opaque background color for rasterized PNGs. */
    _backgroundColor(): any;
    /** Swap/append a file extension on the configured filename. */
    _withExt(name: any, ext: any): string;
    /** Trigger a browser download of a URL, then release it. */
    _triggerDownload(url: any, filename: any): void;
    showNotification(message: any, type?: string): void;
}
