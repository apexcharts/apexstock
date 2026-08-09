/**
 * Register a custom drawing tool. Idempotent per name unless `overwrite`.
 * @param {string} name - The drawing type (case-insensitive).
 * @param {DrawingToolDefinition} def
 * @returns {boolean} true if registered.
 */
export function registerDrawingTool(name: string, def: DrawingToolDefinition): boolean;
/** @returns {{name:string, render:Function, defaults:object}|null} */
export function getDrawingTool(type: any): {
    name: string;
    render: Function;
    defaults: object;
} | null;
/** @returns {boolean} */
export function hasDrawingTool(type: any): boolean;
/** @returns {string[]} the registered custom drawing-tool names. */
export function listDrawingTools(): string[];
/** @returns {boolean} true for a reserved built-in type. */
export function isBuiltinDrawingType(type: any): boolean;
/**
 * Public registry for custom drawing tools — the drawing-layer analogue of
 * `ApexStock.registerIndicator`. A custom tool supplies a `render(data, helpers)`
 * function that turns a data-space drawing record into an SVG element; the
 * drawing layer then reprojects, serializes, and manages it exactly like a
 * built-in shape.
 *
 * Registration is global/static (like indicators), so a custom tool registered
 * once is available to every ApexStock instance. Serialized drawings referencing
 * a custom type re-render after a reload only if the tool is registered again
 * first (document this to consumers).
 *
 * The `data` passed to `render` is the normalized drawing record:
 * `{ id, type, points: [{x, y}], color, width, dashArray?, locked, visible,
 * meta, ...toolDefaults, ...extraConfigFields }`. `helpers` provides the
 * data<->screen projection used by every built-in renderer.
 */
export type DrawingRenderHelpers = {
    /**
     * - The SVG namespace URI (for `createElementNS`).
     */
    svgNS: string;
    dataToScreen: (x: number, y: number) => {
        x: number;
        y: number;
    };
    screenToData: (x: number, y: number) => {
        x: number;
        y: number;
    };
    /**
     * - Grid bounds ({leftMargin, translateY, gridWidth, gridHeight, ...}).
     */
    getChartBounds: () => object;
    extendToBounds: (p1: {
        x: number;
        y: number;
    }, p2: {
        x: number;
        y: number;
    }) => {
        x: number;
        y: number;
    };
};
/**
 * Public registry for custom drawing tools — the drawing-layer analogue of
 * `ApexStock.registerIndicator`. A custom tool supplies a `render(data, helpers)`
 * function that turns a data-space drawing record into an SVG element; the
 * drawing layer then reprojects, serializes, and manages it exactly like a
 * built-in shape.
 *
 * Registration is global/static (like indicators), so a custom tool registered
 * once is available to every ApexStock instance. Serialized drawings referencing
 * a custom type re-render after a reload only if the tool is registered again
 * first (document this to consumers).
 *
 * The `data` passed to `render` is the normalized drawing record:
 * `{ id, type, points: [{x, y}], color, width, dashArray?, locked, visible,
 * meta, ...toolDefaults, ...extraConfigFields }`. `helpers` provides the
 * data<->screen projection used by every built-in renderer.
 */
export type DrawingToolDefinition = {
    /**
     * - Build the SVG element.
     */
    render: (data: object, helpers: DrawingRenderHelpers) => (SVGElement | null);
    /**
     * - Fields merged into every drawing of this type.
     */
    defaults?: object;
    /**
     * - Allow replacing an already-registered tool.
     */
    overwrite?: boolean;
};
