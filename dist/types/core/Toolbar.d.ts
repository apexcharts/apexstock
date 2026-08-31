export default class Toolbar {
    /** @param {import("../ApexStock.js").default} ctx */
    constructor(ctx: import("../ApexStock.js").default);
    ctx: import("../ApexStock.js").default;
    /** @type {ToolbarItem[]} buffered custom item defs (config + runtime adds). */
    _defs: ToolbarItem[];
    /** @type {Object.<string, HTMLElement>} rendered custom elements by id. */
    _els: {
        [x: string]: HTMLElement;
    };
    _config(): any;
    /** Insert or replace a def by id (no render). @returns {string|null} */
    _upsert(def: any): string | null;
    /**
     * Add (or replace) a custom toolbar item and render it.
     * @param {ToolbarItem} def
     * @returns {string|null} the item id, or null on invalid input.
     */
    addItem(def: ToolbarItem): string | null;
    /**
     * Remove a custom toolbar item.
     * @param {string} id
     * @returns {boolean} false if no such item.
     */
    removeItem(id: string): boolean;
    /** @returns {Array<{id:string, title:string|undefined, position:string}>} */
    getItems(): Array<{
        id: string;
        title: string | undefined;
        position: string;
    }>;
    /**
     * Apply the toolbar config to the live DOM: whole-bar visibility, built-in
     * section visibility, and the custom items. Idempotent; safe to call again
     * whenever items change. No-op before the toolbar exists.
     * @returns {void}
     */
    reapply(): void;
    _renderCustom(): void;
    _build(def: any): any;
    /** Remove all custom elements (built-in controls are torn down by the chart). */
    destroy(): void;
}
/**
 * Toolbar — customization of the primary toolbar: show/hide the whole bar or
 * individual built-in sections, and inject custom buttons/controls.
 *
 * The built-in controls (chart-type switcher, indicator dropdown, drawing
 * toolbar, download button) each append themselves to `primaryToolbarLeft` /
 * `primaryToolbarRight` during render. Rather than thread config through every
 * one of them, this manager runs *after* the toolbar is populated and (a)
 * toggles `display` on the known section wrappers per `toolbar.items`, and (b)
 * renders the consumer's custom items into either side. That keeps the built-in
 * controls untouched and the customization non-invasive.
 *
 * Config (all optional) under `options.toolbar`:
 *   {
 *     show: true,                 // false hides the entire primary toolbar
 *     items: {                    // false hides a built-in section (default shown)
 *       chartType, indicators, drawing, download
 *     },
 *     custom: [ ToolbarItem, ... ]
 *   }
 */
export type ToolbarItem = {
    /**
     * - Unique id (also used to remove the item).
     */
    id: string;
    /**
     * - Tooltip + aria-label (and the label if no icon/html).
     */
    title?: string;
    /**
     * - Inline SVG/HTML for the button contents.
     */
    icon?: string;
    /**
     * - Raw HTML contents (alternative to `icon`).
     */
    html?: string;
    /**
     * - A ready-made element to inject as-is.
     */
    element?: HTMLElement;
    /**
     * - Which side (and
     * `left-start` to prepend on the left).
     */
    position?: "left" | "left-start" | "right";
    /**
     * - Sort order within its side (lower first).
     */
    order?: number;
    /**
     * - Extra class(es) on the button.
     */
    className?: string;
    onClick?: (chart: import("../ApexStock.js").default, event: Event) => void;
};
