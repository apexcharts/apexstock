export default class DrawingTools {
    constructor(ctx: any);
    chart: any;
    chartEl: any;
    isDrawing: boolean;
    currentTool: any;
    elements: any[];
    currentElement: any;
    startPoint: {
        x: number;
        y: number;
        dataX: number;
        dataY: number;
    } | {
        x: number;
        y: number;
        dataX: any;
        dataY: any;
    };
    drawingColor: string;
    drawingWidth: number;
    currentElementData: any;
    tooltipPinningEnabled: boolean;
    fillColor: string;
    fillOpacity: number;
    ctx: any;
    drawingToolsConfig: any;
    availableTools: {
        line: boolean;
        brush: boolean;
        highlighter: boolean;
        rectangle: boolean;
        circle: boolean;
        ellipse: boolean;
        text: boolean;
        pin: boolean;
        clear: boolean;
    };
    coordinateConverter: CoordinateConverter;
    overlayManager: OverlayManager;
    svgOverlay: SVGSVGElement;
    drawingGroup: SVGGElement;
    overlayWrapper: HTMLDivElement;
    textAnnotationManager: TextAnnotationManager;
    tooltipAnnotationManager: TooltipAnnotationManager;
    toolbarManager: ToolbarManager;
    toolbarContainer: HTMLDivElement;
    throttledDrawMove: Function & {
        cancel: () => void;
    };
    eventManager: EventManager;
    elementInteractionManager: ElementInteractionManager;
    /**
     * Set up handler for pinning tooltips on click
     */
    setupTooltipPinningHandler(): void;
    /**
     * Handle click event for pinning tooltips
     * @param {MouseEvent} e - Click event
     */
    handleTooltipPinning(e: MouseEvent): void;
    /**
     * Handles mousewheel events to deactivate the drawing mode
     * @param {WheelEvent} e - Wheel event
     */
    handleWheelEvent(e: WheelEvent): void;
    /**
     * Handles mouse down event to start drawing
     * @param {MouseEvent} e - Mouse event
     */
    handleMouseDown(e: MouseEvent): void;
    /**
     * Creates a new SVG element based on the current tool
     */
    createNewElement(): void;
    /**
     * Handles mouse move event for drawing
     * @param {MouseEvent} e - Mouse event
     */
    handleMouseMove(e: MouseEvent): void;
    /**
     * Performs the actual element update for a drawing drag. Invoked at most
     * once per animation frame via the rAF-throttled wrapper.
     * @param {MouseEvent} e - The most recent mouse move event
     */
    drawMove(e: MouseEvent): void;
    /**
     * Updates the current element during drawing
     * @param {number} x - Current x position
     * @param {number} y - Current y position
     * @param {Object} dataPoint - Current data point with x, y coordinates
     */
    updateElement(x: number, y: number, dataPoint: any): void;
    /**
     * Handle mouseup event to finish drawing
     */
    handleMouseUp(): void;
    /**
     * Callback for when text is created and confirmed by TextAnnotationManager
     * @param {SVGElement} element - The text element
     * @param {Object} data - The text data
     */
    handleTextCreated(element: SVGElement, data: any): void;
    /**
     * Callback for when tooltip is created by TooltipAnnotationManager
     * @param {SVGElement} element - The tooltip element
     * @param {Object} data - The tooltip data
     */
    handleTooltipCreated(element: SVGElement, data: any): void;
    /**
     * Handles window resize to adjust the SVG overlay
     */
    handleResize(): void;
    /**
     * Redraws all elements based on their data coordinates
     */
    redrawElements(): void;
    /**
     * Handles tool button clicks
     * @param {string} toolName - Name of the tool clicked
     */
    handleToolClick(toolName: string): void;
    /**
     * Deactivates all drawing tools and hides the overlay
     */
    deactivateAllTools(): void;
    /**
     * Clear all drawings
     */
    clearAllDrawings(): void;
    handleStyleChange(element: any, elementData: any, styleChanges: any): void;
    /**
     * Toggle tooltip pinning functionality
     * @param {boolean} enabled - Whether tooltip pinning should be enabled
     */
    toggleTooltipPinning(enabled: boolean): void;
    /**
     * Clean up event listeners and resources
     */
    destroy(): void;
}
import CoordinateConverter from "../../utils/CoordinateConverter";
import OverlayManager from "../drawing/OverlayManager";
import TextAnnotationManager from "./TextAnnotationManager";
import TooltipAnnotationManager from "./TooltipAnnotationManager";
import ToolbarManager from "../../core/ToolbarManager";
import EventManager from "../../core/EventManager";
import ElementInteractionManager from "../../core/ElementInteractionManager";
