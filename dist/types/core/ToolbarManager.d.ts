export default ToolbarManager;
declare class ToolbarManager {
    /**
     * @param {HTMLElement} chartDiv - The chart container element
     * @param {string} initialColor - Initial drawing color
     * @param {number} initialWidth - Initial drawing width
     * @param {Function} toolClickHandler - Handler for tool button clicks
     * @param {Function} clearHandler - Handler for clear button clicks
     */
    constructor(ctx: any, chartDiv: HTMLElement, initialColor: string, initialWidth: number, toolClickHandler: Function, clearHandler: Function, availableTools: any);
    ctx: any;
    chartDiv: HTMLElement;
    drawingColor: string;
    drawingWidth: number;
    toolClickHandler: Function;
    clearHandler: Function;
    toolbarContainer: HTMLDivElement;
    onColorChange: any;
    onWidthChange: any;
    availableTools: any;
    /**
     * Creates the drawing toolbar with tools
     */
    createDrawingToolbar(): void;
    /**
     * Updates the active tool in the toolbar
     * @param {string} toolName - Name of the active tool
     */
    setActiveTool(toolName: string): void;
    /**
     * Updates the drawing color
     * @param {string} color - New color value
     */
    setColor(color: string): void;
    /**
     * Updates the drawing width
     * @param {number} width - New width value
     */
    setWidth(width: number): void;
    /**
     * Removes the toolbar from the DOM
     */
    destroy(): void;
}
