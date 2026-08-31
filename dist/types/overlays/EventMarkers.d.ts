export default class EventMarkers {
    /** @param {import("../ApexStock.js").default} ctx */
    constructor(ctx: import("../ApexStock.js").default);
    ctx: import("../ApexStock.js").default;
    /** @type {Object.<string, object>} id -> normalized marker */
    items: {
        [x: string]: any;
    };
    _counter: number;
    _layerEl: HTMLDivElement;
    _card: HTMLDivElement;
    /** @type {Map<string, HTMLElement>} id -> badge element */
    _els: Map<string, HTMLElement>;
    _active: boolean;
    _unsubRange: () => void;
    _boundPosition: () => void;
    /** Coerce an x value to axis space (epoch ms for date-like input). */
    _coerceX(x: any): any;
    /** Validate + normalize a user config into a stored item, or null if invalid. */
    _normalize(config: any): {
        id: string;
        type: any;
        x: any;
        label: string;
        color: any;
        glyph: any;
        position: string;
        meta: any;
    };
    /** Public-facing copy of a marker. */
    _public(item: any): {
        id: any;
        type: any;
        x: any;
        label: any;
        color: any;
        glyph: any;
        position: any;
        meta: any;
    };
    _emit(name: any, payload: any): void;
    /** Begin listening for zoom/pan/resize so markers track the axis. */
    _activate(): void;
    _unsubRanging: () => void;
    /** Stop listening (called when the last marker is removed). */
    _deactivate(): void;
    /** The overlay layer, created lazily over the chart element. */
    _ensureLayer(): HTMLDivElement;
    /** The shared hover card, created lazily. */
    _ensureCard(): HTMLDivElement;
    _cardTitle: HTMLDivElement;
    _cardDate: HTMLDivElement;
    /** Format an x value for the hover card (ISO date for epoch-ms, else raw). */
    _formatX(x: any): string;
    /** Chart axis globals for positioning, or null if not yet rendered. */
    _globals(): {
        minX: any;
        maxX: any;
        left: any;
        top: any;
        w: any;
        h: any;
    };
    /** Create (or replace) the badge element for one marker. */
    _renderOne(item: any): void;
    /** Position one badge from the current axis globals (hides it off-grid). */
    _positionOne(item: any, el: any): void;
    /** Reposition every badge (zoom/pan/resize). */
    _position(): void;
    _showCard(item: any, el: any): void;
    _hideCard(): void;
    /** Remove a single badge element by id. */
    _removeEl(id: any): void;
    /**
     * Add (or replace, if `id` already exists) an event marker.
     * @param {EventMarkerConfig} config
     * @returns {string|null} the marker id, or null on invalid input.
     */
    add(config: EventMarkerConfig): string | null;
    /**
     * Patch an existing marker (merges into its config).
     * @param {string} id
     * @param {Partial<EventMarkerConfig>} [patch]
     * @returns {boolean} false if no such marker.
     */
    update(id: string, patch?: Partial<EventMarkerConfig>): boolean;
    /**
     * Remove a marker by id.
     * @param {string} id
     * @returns {boolean} false if no such marker.
     */
    remove(id: string): boolean;
    /** Remove every marker. */
    clear(): void;
    /**
     * @param {string} id
     * @returns {object|null} a copy of the marker config, or null.
     */
    get(id: string): object | null;
    /** @returns {object[]} copies of all marker configs. */
    getAll(): object[];
    /**
     * Rebuild every badge from the stored items and reposition. Called after any
     * chart re-render (update / theme / chart-type switch) and once from
     * {@link ApexStock#render} to draw markers added before the chart existed.
     */
    reapply(): void;
    /**
     * Lossless plain-JSON snapshot of every marker, for state serialization.
     * @returns {object[]}
     */
    _serialize(): object[];
    /**
     * Replace all markers with a serialized list (from {@link _serialize}).
     * @param {object[]} list
     */
    _restore(list: object[]): void;
    /** Remove all markers and drop state. */
    destroy(): void;
}
/**
 * Event markers / timeline: time-anchored flags for earnings, dividends, splits,
 * news, and custom events, floating along the x-axis with a hover card. Distinct
 * from data-space annotations (which mark price/time via native ApexCharts
 * annotations) and from freehand drawings.
 *
 * This is the "approach B" renderer: a lightweight HTML overlay layer appended to
 * the chart element, with one absolutely-positioned badge per marker positioned
 * from the chart's own axis globals (the same reprojection ChartSync uses for its
 * crosshair guide). Markers reproject on zoom/pan (via the `rangeChange` event)
 * and on resize, and are rebuilt on every re-render (update / theme / chart-type
 * switch) so they persist. Because the badge is real DOM, it can carry a rich
 * hover card and fire hover/click events.
 *
 * The `rangeChange` subscription and the resize listener are bound lazily (only
 * while at least one marker exists) so a chart that never uses markers keeps the
 * event bus's "no listeners" fast path.
 */
export type EventMarkerConfig = {
    /**
     * - Anchor time (timestamp/date/category).
     */
    x: number | string | Date;
    /**
     * - Marker kind (sets the default glyph + color).
     */
    type?: "earnings" | "dividend" | "split" | "news" | "custom";
    /**
     * - Stable id; auto-generated ("evt-N") when omitted.
     */
    id?: string;
    /**
     * - Hover-card title; falls back to the type name.
     */
    label?: string;
    /**
     * - Badge color; defaults from the type.
     */
    color?: string;
    /**
     * - Badge text (1 to 3 chars); defaults from the type.
     */
    glyph?: string;
    /**
     * - Which edge the badge sits on.
     */
    position?: "top" | "bottom";
    /**
     * - Arbitrary consumer payload, returned by get()/getAll().
     */
    meta?: any;
};
