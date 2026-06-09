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
    };
    init(): void;
    createExportButton(): void;
    exportButton: HTMLButtonElement;
    buttonContainer: HTMLDivElement;
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
     * Convert SVG string to a downloadable file
     * @param {string} svgString - SVG string
     * @returns {Promise<string>} Promise that resolves with download URL
     */
    svgToPng(svgString: string, scale: any): Promise<string>;
    showNotification(message: any, type?: string): void;
}
