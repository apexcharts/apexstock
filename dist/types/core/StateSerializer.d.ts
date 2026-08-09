export default class StateSerializer {
    /** Current schema version. */
    static VERSION: number;
    /**
     * Capture the current chart state as a plain, JSON-serializable object.
     * @param {import("../ApexStock.js").default} ctx - The ApexStock instance.
     * @returns {import("../types.js").ApexStockState}
     */
    static capture(ctx: import("../ApexStock.js").default): import("../types.js").ApexStockState;
    /**
     * Apply a captured state to a (rendered) ApexStock instance. Idempotent:
     * applying the state a chart is already in is a no-op-equivalent.
     *
     * Order matters — theme and chart type first, then indicators reconciled to
     * exactly the state's set (removed-then-added so restored params always take
     * effect), then the toolbar/`activeOscillator` resynced, and finally the zoom
     * (applied last so indicator churn does not clobber it).
     *
     * @param {import("../ApexStock.js").default} ctx - The ApexStock instance.
     * @param {import("../types.js").ApexStockState} state - A state (any supported version).
     * @returns {void}
     */
    static apply(ctx: import("../ApexStock.js").default, state: import("../types.js").ApexStockState): void;
    /**
     * Normalize a state object to the current schema version, applying any
     * stepwise migrations. A missing/invalid state yields an empty, valid v1
     * state so `setState(anything)` never throws.
     * @param {*} state
     * @returns {import("../types.js").ApexStockState}
     */
    static migrate(state: any): import("../types.js").ApexStockState;
}
