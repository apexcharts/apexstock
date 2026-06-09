/**
 * Watermark utility for ApexStock
 * Handles watermark display and removal
 */
export default class Watermark {
    static WATERMARK_CLASS: string;
    static WATERMARK_TEXT: string;
    /**
     * Add watermark to a container element
     */
    static add(container: any): void;
    /**
     * Check if watermark exists in container
     */
    static exists(container: any): boolean;
    /**
     * Remove watermark from a container element
     */
    static remove(container: any): void;
}
