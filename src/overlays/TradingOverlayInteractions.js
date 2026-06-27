import Utils from "../utils/Utils";
import CoordinateConverter from "../utils/CoordinateConverter";

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
  /** @param {import("../ApexStock.js").default} ctx */
  constructor(ctx) {
    this.ctx = ctx;
    this.converter = CoordinateConverter.getInstance(ctx.chart, ctx.chartEl);
    this._drag = null;

    const layer = document.createElement("div");
    layer.className = "apexstock-trading-overlay";
    layer.style.position = "absolute";
    layer.style.top = "0";
    layer.style.left = "0";
    layer.style.right = "0";
    layer.style.pointerEvents = "none";
    layer.style.zIndex = "5";
    // chartEl needs a positioning context for the absolutely-placed strips.
    if (getComputedStyle(ctx.chartEl).position === "static") {
      ctx.chartEl.style.position = "relative";
    }
    ctx.chartEl.appendChild(layer);
    this.layer = layer;

    this._onMove = Utils.rafThrottle(this._handleMove.bind(this));
    this._onUp = this._endDrag.bind(this);
    this._onResize = () => this.sync();
    window.addEventListener("resize", this._onResize);
  }

  /** Pixel y (relative to chartEl top) for a price. */
  static yFromPrice(price, b) {
    return b.top + ((b.max - price) / (b.max - b.min)) * b.height;
  }

  /** Price for a pixel y (relative to chartEl top). */
  static priceFromY(y, b) {
    return b.max - ((y - b.top) / b.height) * (b.max - b.min);
  }

  /** Current y-axis bounds in the shape the static helpers expect. */
  _bounds(force = false) {
    const c = this.converter.getChartBounds(force);
    return { min: c.yaxis, max: c.yaxisMax, top: c.translateY, height: c.gridHeight, left: c.leftMargin, width: c.gridWidth };
  }

  /** Rebuild the grab strips from the current draggable lines. */
  sync() {
    if (!this.layer || this._drag) return; // don't reflow mid-drag
    this.layer.innerHTML = "";
    const lines = this.ctx.tradingOverlays.lines;
    const b = this._bounds(true);
    if (!Number.isFinite(b.max - b.min) || b.height <= 0) return;
    this.layer.style.height = this.ctx.mainChartDiv.offsetHeight + "px";

    for (const id of Object.keys(lines)) {
      const line = lines[id];
      if (!line._draggable && !line._closable) continue;
      const y = TradingOverlayInteractions.yFromPrice(line.price, b);
      // Skip lines whose level is outside the visible plot.
      if (!Number.isFinite(y) || y < b.top - 2 || y > b.top + b.height + 2) {
        continue;
      }
      if (line._draggable) {
        const strip = document.createElement("div");
        strip.className = "apexstock-trading-grab";
        strip.dataset.lineId = id;
        strip.style.position = "absolute";
        strip.style.left = b.left + "px";
        strip.style.width = b.width + "px";
        strip.style.top = y - 4 + "px";
        strip.style.height = "9px";
        strip.style.cursor = "ns-resize";
        strip.style.pointerEvents = "auto";
        strip.addEventListener("mousedown", (e) => this._startDrag(e, id));
        this.layer.appendChild(strip);
      }
      if (line._closable) {
        const btn = document.createElement("div");
        btn.className = "apexstock-trading-close";
        btn.dataset.lineId = id;
        btn.textContent = "✕";
        btn.style.position = "absolute";
        btn.style.top = y - 7 + "px";
        // Sit next to the label (which hugs the value axis).
        if (line.labelPosition === "left") btn.style.left = b.left + 2 + "px";
        else btn.style.right = "4px";
        btn.style.width = "14px";
        btn.style.height = "14px";
        btn.style.lineHeight = "14px";
        btn.style.textAlign = "center";
        btn.style.fontSize = "10px";
        btn.style.color = "#fff";
        btn.style.background = "rgba(0,0,0,0.4)";
        btn.style.borderRadius = "2px";
        btn.style.cursor = "pointer";
        btn.style.pointerEvents = "auto";
        btn.title = "Remove";
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          this.ctx.tradingOverlays.removeViaUI(id);
        });
        this.layer.appendChild(btn);
      }
    }
  }

  _startDrag(e, id) {
    e.preventDefault();
    e.stopPropagation();
    this._drag = { id, price: this.ctx.tradingOverlays.lines[id].price };
    document.addEventListener("mousemove", this._onMove);
    document.addEventListener("mouseup", this._onUp);
  }

  _handleMove(e) {
    if (!this._drag) return;
    const rect = Utils.cachedRect(this.ctx.chartEl);
    const b = this._bounds();
    let price = TradingOverlayInteractions.priceFromY(e.clientY - rect.top, b);
    if (!Number.isFinite(price)) return;
    price = Utils.truncateNumber(price);
    this._drag.price = price;
    this.ctx.tradingOverlays.repriceLive(this._drag.id, price);
    const strip = this.layer.querySelector(`[data-line-id="${this._drag.id}"]`);
    if (strip) {
      strip.style.top =
        TradingOverlayInteractions.yFromPrice(price, b) - 4 + "px";
    }
  }

  _endDrag() {
    document.removeEventListener("mousemove", this._onMove);
    document.removeEventListener("mouseup", this._onUp);
    const drag = this._drag;
    this._drag = null;
    if (drag) {
      const line = this.ctx.tradingOverlays.lines[drag.id];
      if (line && line._onMove && drag.price != null) {
        try {
          line._onMove({ id: drag.id, price: drag.price });
        } catch (err) {
          Utils.warn("price line onMove threw:", err);
        }
      }
      // Re-sync handle positions now that the drag has settled.
      this.sync();
    }
  }

  destroy() {
    this._endDrag();
    window.removeEventListener("resize", this._onResize);
    if (this.layer && this.layer.parentNode) {
      this.layer.parentNode.removeChild(this.layer);
    }
    this.layer = null;
  }
}
