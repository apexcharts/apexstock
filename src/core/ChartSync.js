import Utils from "../utils/Utils";

/**
 * Cross-chart synchronization: links independent ApexStock instances so that
 * panning/zooming one mirrors to the others, and a crosshair on one draws a
 * vertical guide at the same x on the others. The public entry point is the
 * static {@link ApexStock.sync}.
 *
 * Built entirely on the public surface (the event bus + `setVisibleRange`), not
 * on ApexCharts' native `group`, so the linked charts stay independently
 * constructed and can be unlinked at any time.
 *
 * **Zoom/pan** subscribes each instance's `rangeChange` and applies the new
 * window to the others via `setVisibleRange`. Because `setVisibleRange` itself
 * emits `rangeChange` (asynchronously, from ApexCharts' `zoomed`/`scrolled`
 * events), the echo is suppressed two ways: a re-entrancy flag for the
 * synchronous case, and value comparison (ignore a `rangeChange` equal to the
 * range we just pushed to that instance) for the asynchronous case.
 *
 * **Crosshair** (approach B) renders a lightweight DOM guide per target chart,
 * positioned from that chart's own axis globals — no coupling through
 * ApexCharts' tooltip group.
 *
 * @typedef {Object} SyncOptions
 * @property {boolean} [zoom=true] - Sync pan/zoom (visible x-range).
 * @property {boolean} [crosshair=true] - Draw a crosshair guide on the others.
 * @property {string} [crosshairColor] - Guide line color (default a neutral gray).
 */
export default class ChartSync {
  /**
   * @param {import("../ApexStock.js").default[]} instances
   * @param {SyncOptions} [options]
   */
  constructor(instances, options = {}) {
    this.instances = (Array.isArray(instances) ? instances : []).filter(Boolean);
    this.opts = {
      zoom: options.zoom !== false,
      crosshair: options.crosshair !== false,
    };
    this.guideColor = options.crosshairColor || "rgba(128, 128, 128, 0.7)";

    this._unsubs = []; // event-bus unsubscribe fns
    this._leaveHandlers = []; // [{ el, handler }] mouseleave listeners
    this._guides = new Map(); // instance -> guide <div>
    this._lastRange = new Map(); // instance -> { min, max } last pushed to it
    this._applying = false;
    this._connected = false;

    if (this.instances.length < 2) {
      Utils.warn("ApexStock.sync: needs at least two instances to link.");
      return;
    }
    this._connect();
  }

  _connect() {
    this.instances.forEach((inst) => {
      if (typeof inst.on !== "function") return;

      if (this.opts.zoom) {
        this._unsubs.push(inst.on("rangeChange", (p) => this._onRange(inst, p)));
      }

      if (this.opts.crosshair) {
        this._unsubs.push(
          inst.on("crosshairMove", (p) => this._onCrosshair(inst, p))
        );
        // crosshairMove does not fire when the pointer leaves the chart
        // entirely, so hide the guides on mouseleave of the source element.
        const el = inst.chartEl;
        if (el && typeof el.addEventListener === "function") {
          const handler = () => this._hideAllGuides();
          el.addEventListener("mouseleave", handler);
          this._leaveHandlers.push({ el, handler });
        }
      }
    });
    this._connected = true;
  }

  /** Mirror a visible-range change from `source` to the other instances. */
  _onRange(source, payload) {
    if (this._applying || !payload) return;
    const min = payload.min;
    const max = payload.max;
    if (!Number.isFinite(min) || !Number.isFinite(max)) return;

    // Ignore the echo of a range we just pushed into `source`.
    const eps = Math.max(1, Math.abs(max - min) * 1e-6);
    const last = this._lastRange.get(source);
    if (
      last &&
      Math.abs(last.min - min) <= eps &&
      Math.abs(last.max - max) <= eps
    ) {
      return;
    }

    this._applying = true;
    try {
      this.instances.forEach((inst) => {
        if (inst === source || inst._destroyed) return;
        this._lastRange.set(inst, { min, max });
        if (typeof inst.setVisibleRange === "function") {
          inst.setVisibleRange(min, max);
        }
      });
    } finally {
      this._applying = false;
    }
  }

  /** Draw/hide the crosshair guide on the other instances. */
  _onCrosshair(source, payload) {
    const x = payload ? payload.x : null;
    if (x == null || !Number.isFinite(x)) {
      this.instances.forEach((inst) => {
        if (inst !== source) this._hideGuide(inst);
      });
      return;
    }
    this.instances.forEach((inst) => {
      if (inst === source || inst._destroyed) return;
      this._positionGuide(inst, x);
    });
  }

  _ensureGuide(inst) {
    let guide = this._guides.get(inst);
    if (guide) return guide;
    const host = inst.chartEl;
    if (!host || typeof document === "undefined") return null;
    if (
      typeof getComputedStyle === "function" &&
      getComputedStyle(host).position === "static"
    ) {
      host.style.position = "relative";
    }
    guide = document.createElement("div");
    guide.className = "apexstock-sync-crosshair";
    guide.style.cssText =
      "position:absolute;width:0;border-left:1px dashed " +
      this.guideColor +
      ";pointer-events:none;display:none;z-index:5;";
    host.appendChild(guide);
    this._guides.set(inst, guide);
    return guide;
  }

  _positionGuide(inst, dataX) {
    const g = inst.chart && inst.chart.w && inst.chart.w.globals;
    if (!g) return;
    const minX = g.minX;
    const maxX = g.maxX;
    const left = g.translateX || 0;
    const top = g.translateY || 0;
    const w = g.gridWidth;
    const h = g.gridHeight;
    if (!(maxX > minX) || !w) return this._hideGuide(inst);

    const px = left + ((dataX - minX) / (maxX - minX)) * w;
    // Off the visible grid: hide rather than draw at the edge.
    if (px < left - 0.5 || px > left + w + 0.5) return this._hideGuide(inst);

    const guide = this._ensureGuide(inst);
    if (!guide) return;
    guide.style.left = px + "px";
    guide.style.top = top + "px";
    guide.style.height = h + "px";
    guide.style.display = "block";
  }

  _hideGuide(inst) {
    const guide = this._guides.get(inst);
    if (guide) guide.style.display = "none";
  }

  _hideAllGuides() {
    this._guides.forEach((guide) => {
      guide.style.display = "none";
    });
  }

  /** Unlink the instances and remove all guides/listeners. Idempotent. */
  disconnect() {
    if (!this._connected) return;
    this._unsubs.forEach((off) => {
      try {
        if (off) off();
      } catch {
        /* already gone */
      }
    });
    this._unsubs = [];
    this._leaveHandlers.forEach(({ el, handler }) => {
      try {
        el.removeEventListener("mouseleave", handler);
      } catch {
        /* already gone */
      }
    });
    this._leaveHandlers = [];
    this._guides.forEach((guide) => {
      if (guide && guide.parentNode) guide.parentNode.removeChild(guide);
    });
    this._guides.clear();
    this._lastRange.clear();
    this._connected = false;
  }
}
