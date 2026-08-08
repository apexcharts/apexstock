import Utils from "../../utils/Utils";

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
 *
 * @typedef {Object} DrawingRenderHelpers
 * @property {string} svgNS - The SVG namespace URI (for `createElementNS`).
 * @property {(x:number, y:number) => {x:number, y:number}} dataToScreen
 * @property {(x:number, y:number) => {x:number, y:number}} screenToData
 * @property {() => object} getChartBounds - Grid bounds ({leftMargin, translateY, gridWidth, gridHeight, ...}).
 * @property {(p1:{x:number,y:number}, p2:{x:number,y:number}) => {x:number,y:number}} extendToBounds
 *
 * @typedef {Object} DrawingToolDefinition
 * @property {(data: object, helpers: DrawingRenderHelpers) => (SVGElement|null)} render - Build the SVG element.
 * @property {object} [defaults] - Fields merged into every drawing of this type.
 * @property {boolean} [overwrite] - Allow replacing an already-registered tool.
 */

/** Built-in drawing types a custom tool may not override. */
const BUILTIN_TYPES = new Set([
  "line",
  "ray",
  "hline",
  "vline",
  "fib",
  "rectangle",
  "circle",
  "ellipse",
  "brush",
  "highlighter",
  "text",
  "tooltip",
]);

/** @type {Object.<string, {name:string, render:Function, defaults:object}>} */
const CUSTOM_TOOLS = {};

/**
 * Register a custom drawing tool. Idempotent per name unless `overwrite`.
 * @param {string} name - The drawing type (case-insensitive).
 * @param {DrawingToolDefinition} def
 * @returns {boolean} true if registered.
 */
export function registerDrawingTool(name, def) {
  if (typeof name !== "string" || !name.trim()) {
    Utils.warn("registerDrawingTool: a non-empty string `name` is required.");
    return false;
  }
  const key = name.trim().toLowerCase();
  if (BUILTIN_TYPES.has(key)) {
    Utils.warn(`registerDrawingTool: "${name}" is a built-in drawing type.`);
    return false;
  }
  if (!def || typeof def.render !== "function") {
    Utils.warn(
      "registerDrawingTool: `def.render(data, helpers)` must be a function."
    );
    return false;
  }
  if (CUSTOM_TOOLS[key] && !def.overwrite) {
    Utils.warn(
      `registerDrawingTool: "${name}" is already registered (pass overwrite:true to replace).`
    );
    return false;
  }
  CUSTOM_TOOLS[key] = {
    name: key,
    render: def.render,
    defaults: def.defaults || {},
  };
  return true;
}

/** @returns {{name:string, render:Function, defaults:object}|null} */
export function getDrawingTool(type) {
  return type ? CUSTOM_TOOLS[String(type).toLowerCase()] || null : null;
}

/** @returns {boolean} */
export function hasDrawingTool(type) {
  return !!getDrawingTool(type);
}

/** @returns {string[]} the registered custom drawing-tool names. */
export function listDrawingTools() {
  return Object.keys(CUSTOM_TOOLS);
}

/** @returns {boolean} true for a reserved built-in type. */
export function isBuiltinDrawingType(type) {
  return BUILTIN_TYPES.has(String(type).toLowerCase());
}
