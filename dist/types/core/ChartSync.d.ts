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
    constructor(instances: import("../ApexStock.js").default[], options?: SyncOptions);
    instances: import("../ApexStock.js").default[];
    opts: {
        zoom: boolean;
        crosshair: boolean;
    };
    guideColor: string;
    _unsubs: any[];
    _leaveHandlers: any[];
    _guides: Map<any, any>;
    _lastRange: Map<any, any>;
    _applying: boolean;
    _connected: boolean;
    _connect(): void;
    /** Mirror a visible-range change from `source` to the other instances. */
    _onRange(source: any, payload: any): void;
    /** Draw/hide the crosshair guide on the other instances. */
    _onCrosshair(source: any, payload: any): void;
    _ensureGuide(inst: any): any;
    _positionGuide(inst: any, dataX: any): void;
    _hideGuide(inst: any): void;
    _hideAllGuides(): void;
    /** Unlink the instances and remove all guides/listeners. Idempotent. */
    disconnect(): void;
}
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
 */
export type SyncOptions = {
    /**
     * - Sync pan/zoom (visible x-range).
     */
    zoom?: boolean;
    /**
     * - Draw a crosshair guide on the others.
     */
    crosshair?: boolean;
    /**
     * - Guide line color (default a neutral gray).
     */
    crosshairColor?: string;
};
