export default class TradingOverlays {
    /** @param {import("../ApexStock.js").default} ctx */
    constructor(ctx: import("../ApexStock.js").default);
    ctx: import("../ApexStock.js").default;
    /** @type {Object.<string, object>} id -> normalized line */
    lines: {
        [x: string]: any;
    };
    _counter: number;
    /** The theme's trading-overlay color group (re-read so theme switches apply). */
    _palette(): any;
    /** Resolve a line's border color from its explicit color, side, then type. */
    _color(line: any): any;
    /** Default label text for a line (used until the consumer sets a custom one). */
    _defaultLabel(line: any): string;
    /** Build the ApexCharts y-axis annotation for a stored line. */
    _toAnnotation(line: any): {
        id: any;
        y: any;
        strokeDashArray: any;
        borderColor: any;
        borderWidth: any;
        label: {
            text: any;
            position: any;
            textAnchor: string;
            borderColor: any;
            style: {
                background: any;
                color: any;
                fontSize: string;
            };
        };
    };
    /** Validate + normalize a user config into a stored line, or null if invalid. */
    _normalize(config: any): {
        id: string;
        type: any;
        price: number;
        side: any;
        color: any;
        textColor: any;
        strokeDashArray: any;
        width: any;
        labelPosition: string;
        meta: any;
        _draggable: boolean;
        _closable: boolean;
        _onCross: any;
        _onMove: any;
        _onRemove: any;
        _lastSide: any;
    };
    /** The current close-vs-price side, for edge-triggered crossing detection. */
    _seedSide(price: any): 0 | 1 | -1;
    /** Public-facing copy of a line (drops private fields). */
    _public(line: any): {
        id: any;
        type: any;
        price: any;
        side: any;
        color: any;
        textColor: any;
        strokeDashArray: any;
        width: any;
        labelPosition: any;
        label: any;
        draggable: any;
        closable: any;
        meta: any;
    };
    /** Tell the interaction layer (if any) to reposition its drag handles. */
    _syncInteractions(): void;
    /**
     * Add (or replace, if `id` already exists) a price line.
     * @param {PriceLineConfig} config
     * @returns {string|null} the line id, or null on invalid input.
     */
    add(config: PriceLineConfig): string | null;
    /**
     * Patch an existing line (e.g. reprice). Auto-generated labels track the new
     * price/type/side; a custom label is preserved unless `patch.label` is given.
     * @param {string} id
     * @param {Partial<PriceLineConfig>} [patch]
     * @returns {boolean} false if no such line.
     */
    update(id: string, patch?: Partial<PriceLineConfig>): boolean;
    /**
     * Live reprice during a drag: moves the line + its auto label and re-draws the
     * annotation, WITHOUT firing callbacks or re-seeding crossing state.
     * @param {string} id
     * @param {number} price
     */
    repriceLive(id: string, price: number): void;
    /**
     * Edge-triggered crossing check for a newly-closed bar: fires `onCross` for any
     * line whose close-vs-price side flipped between the prior and the new bar.
     * @param {object} _prevBar - unused (side is carried in line state)
     * @param {object} newBar - the bar that just closed ({ y:[o,h,l,c] })
     */
    checkCrossings(_prevBar: object, newBar: object): void;
    /**
     * Remove a line in response to a UI affordance (the interaction layer's close
     * button), firing the line's `onRemove` callback. Programmatic removal should
     * use {@link remove}, which does not fire callbacks.
     * @param {string} id
     * @returns {boolean} false if no such line.
     */
    removeViaUI(id: string): boolean;
    /**
     * Remove a line.
     * @param {string} id
     * @returns {boolean} false if no such line.
     */
    remove(id: string): boolean;
    /** Remove every line. */
    clear(): void;
    /**
     * @param {string} id
     * @returns {object|null} a copy of the line config, or null.
     */
    get(id: string): object | null;
    /** @returns {object[]} copies of all line configs. */
    getAll(): object[];
    /**
     * Re-apply every line's annotation. Idempotent (removes then re-adds by id),
     * and re-reads theme colors so a theme switch recolors the lines. Called after
     * any chart re-render that may drop or stale dynamic annotations.
     */
    reapply(): void;
    /** Remove all annotations and drop state. */
    destroy(): void;
}
/**
 * Trading overlays: horizontal price lines (order lines, stop-loss, take-profit,
 * and alerts) drawn on the main chart as y-axis annotations. Each line is a
 * declarative config the consumer owns; this manager keeps the source-of-truth
 * map and mirrors it into ApexCharts annotations, re-applying them when the chart
 * re-renders (update / theme change / chart-type switch) so they persist.
 *
 * Lines are price-only (horizontal), so they are unaffected by appendData and the
 * x-axis. Colors default from the theme's `colors.tradingOverlays` group and are
 * re-read on every re-apply, so a theme switch recolors them.
 *
 * Interactivity (all opt-in per line):
 * - `draggable: true` -> the line can be dragged vertically to reprice it (drawn
 *   by {@link TradingOverlayInteractions}); `onMove({id, price})` fires on drop.
 * - `closable: true` -> the label gets a "✕" affordance; clicking it removes the
 *   line and fires `onRemove({id})`.
 * - `onCross({id, type, price, direction, bar})` -> fired from appendData when a
 *   newly-closed bar crosses the line (edge-triggered on close-to-close).
 */
export type PriceLineConfig = {
    /**
     * - The y value the line sits at (required).
     */
    price: number;
    /**
     * - Stable id; auto-generated ("tl-N") when omitted.
     */
    id?: string;
    type?: "order" | "stop-loss" | "take-profit" | "alert";
    /**
     * - For order lines; drives the default color.
     */
    side?: "buy" | "sell";
    /**
     * - Defaults to a type/side/price summary.
     */
    label?: string;
    /**
     * - Border + label color; defaults from the theme.
     */
    color?: string;
    /**
     * - Label text color; defaults to white.
     */
    textColor?: string;
    /**
     * - Dash length; default varies by type.
     */
    strokeDashArray?: number;
    /**
     * - Line width.
     */
    width?: number;
    labelPosition?: "left" | "right";
    /**
     * - Allow drag-to-reprice.
     */
    draggable?: boolean;
    /**
     * - Show a click-to-remove affordance.
     */
    closable?: boolean;
    /**
     * - Fired when a closed bar crosses the line.
     */
    onCross?: Function;
    /**
     * - Fired after a drag completes.
     */
    onMove?: Function;
    /**
     * - Fired when removed via the close affordance.
     */
    onRemove?: Function;
    /**
     * - Arbitrary consumer payload, returned by get()/getAll().
     */
    meta?: any;
};
