export default class DataReadout {
    /**
     * Snapshot the chart at a data-point index.
     * @param {import("../ApexStock.js").default} ctx
     * @param {number} [index] - Defaults to (and is clamped to) the latest bar.
     * @returns {Readout|null} null if there is no series data.
     */
    static at(ctx: import("../ApexStock.js").default, index?: number): Readout | null;
    /**
     * Every active indicator as a whole column, for a data export: one entry per
     * bar, null through the warm-up period.
     *
     * Deliberately a separate traversal from {@link _indicators}, which answers a
     * different question with a different contract: that one is called per pointer
     * move and *omits* an indicator with no value at the index, this one is called
     * once per export and *null-pads* so the columns stay aligned to the bars.
     *
     * @param {import("../ApexStock.js").default} ctx
     * @param {number} [length] - Bars to cover; defaults to the series length.
     * @returns {ReadoutColumn[]}
     */
    static columns(ctx: import("../ApexStock.js").default, length?: number): ReadoutColumn[];
    /** Overlay (main-chart) + oscillator-pane indicator values at `idx`. */
    static _indicators(ctx: any, idx: any): {
        name: string;
        value: number;
        color: any;
        pane: string;
    }[];
}
/**
 * DataReadout — a read-only snapshot of the chart's values at a data-point
 * index: OHLC, volume, change-vs-previous, and every active indicator's value
 * (main-chart overlays AND oscillator panes). It is the programmatic complement
 * to the on-chart {@link Legend} and the `crosshairMove` event: the event tells
 * you *which* bar the pointer is over (its `dataPointIndex`), and this turns an
 * index into structured data a consumer can render in their own legend, side
 * panel, or tooltip.
 *
 * Everything is read defensively from the live chart state and returned as plain
 * numbers (no formatting, no rounding) so the values are faithful; the consumer
 * formats. Values that are unavailable come back `null` (volume, change) or are
 * simply omitted (an indicator with no value at that index, e.g. during its
 * warm-up period).
 */
export type ReadoutIndicator = {
    /**
     * - Series name (e.g. "MA 20", "RSI").
     */
    name: string;
    /**
     * - The indicator's value at the index.
     */
    value: number;
    /**
     * - The series color, if known.
     */
    color: string | null;
    /**
     * - "main" for overlays, else the oscillator key.
     */
    pane: "main" | string;
    /**
     * - The oscillator's indicator key (pane readouts only).
     */
    key?: string;
};
/**
 * DataReadout — a read-only snapshot of the chart's values at a data-point
 * index: OHLC, volume, change-vs-previous, and every active indicator's value
 * (main-chart overlays AND oscillator panes). It is the programmatic complement
 * to the on-chart {@link Legend} and the `crosshairMove` event: the event tells
 * you *which* bar the pointer is over (its `dataPointIndex`), and this turns an
 * index into structured data a consumer can render in their own legend, side
 * panel, or tooltip.
 *
 * Everything is read defensively from the live chart state and returned as plain
 * numbers (no formatting, no rounding) so the values are faithful; the consumer
 * formats. Values that are unavailable come back `null` (volume, change) or are
 * simply omitted (an indicator with no value at that index, e.g. during its
 * warm-up period).
 */
export type Readout = {
    /**
     * - The resolved data-point index.
     */
    index: number;
    /**
     * - The bar's x (timestamp in ms), or null.
     */
    x: number | null;
    ohlc: {
        open: number;
        high: number;
        low: number;
        close: number;
    };
    volume: number | null;
    /**
     * - vs the previous close.
     */
    change: {
        absolute: number;
        percent: number;
    } | null;
    indicators: ReadoutIndicator[];
};
/**
 * DataReadout — a read-only snapshot of the chart's values at a data-point
 * index: OHLC, volume, change-vs-previous, and every active indicator's value
 * (main-chart overlays AND oscillator panes). It is the programmatic complement
 * to the on-chart {@link Legend} and the `crosshairMove` event: the event tells
 * you *which* bar the pointer is over (its `dataPointIndex`), and this turns an
 * index into structured data a consumer can render in their own legend, side
 * panel, or tooltip.
 *
 * Everything is read defensively from the live chart state and returned as plain
 * numbers (no formatting, no rounding) so the values are faithful; the consumer
 * formats. Values that are unavailable come back `null` (volume, change) or are
 * simply omitted (an indicator with no value at that index, e.g. during its
 * warm-up period).
 */
export type ReadoutColumn = {
    /**
     * - Series name, used as the export column header.
     */
    name: string;
    /**
     * - "main" for overlays, else the oscillator key.
     */
    pane: "main" | string;
    /**
     * - The oscillator's indicator key (pane columns only).
     */
    key?: string;
    /**
     * - One entry per bar, null where the
     * indicator has no value (its warm-up period).
     */
    values: Array<number | null>;
};
