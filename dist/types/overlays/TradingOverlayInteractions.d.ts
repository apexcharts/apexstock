/**
 * Drag-to-reprice layer for trading overlays. Renders a thin, full-width "grab
 * strip" over each `draggable` price line; dragging it vertically reprices the
 * line live (via {@link TradingOverlays#repriceLive}) and fires the line's
 * `onMove({id, price})` on drop.
 *
 * The strip is positioned with the same {@link CoordinateConverter} the drawing
 * tools use, anchored to `ctx.chartEl` (whose first child is the main chart, so
 * the converter's y maps directly). It re-syncs on add/update/remove (via
 * {@link TradingOverlays}), on zoom/scroll, on appendData, and on resize.
 */
export default class TradingOverlayInteractions {
    /** Pixel y (relative to chartEl top) for a price. */
    static yFromPrice(price: any, b: any): any;
    /** Price for a pixel y (relative to chartEl top). */
    static priceFromY(y: any, b: any): number;
    /** @param {import("../ApexStock.js").default} ctx */
    constructor(ctx: import("../ApexStock.js").default);
    ctx: import("../ApexStock.js").default;
    converter: CoordinateConverter;
    _drag: {
        id: any;
        price: any;
    };
    layer: HTMLDivElement;
    _onMove: Function & {
        cancel: () => void;
    };
    _onUp: any;
    _onResize: () => void;
    /** Current y-axis bounds in the shape the static helpers expect. */
    _bounds(force?: boolean): {
        min: any;
        max: any;
        top: any;
        height: any;
        left: any;
        width: any;
    };
    /** Rebuild the grab strips from the current draggable lines. */
    sync(): void;
    _startDrag(e: any, id: any): void;
    _handleMove(e: any): void;
    _endDrag(): void;
    destroy(): void;
}
import CoordinateConverter from "../utils/CoordinateConverter";
