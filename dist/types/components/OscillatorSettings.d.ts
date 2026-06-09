/**
 * OscillatorSettings.js
 * Manages customizable settings for oscillator indicators
 */
export default class OscillatorSettings {
    /**
     * Creates settings controls for oscillator indicators
     * @param {import("../ApexStock.js").default} ctx - The ApexStock context
     */
    constructor(ctx: import("../ApexStock.js").default);
    ctx: import("../ApexStock.js").default;
    settingsControls: {};
    defaultParams: any;
    indicatorParams: {};
    /**
     * Creates a container for oscillator settings
     */
    createSettingsContainer(): void;
    settingsContainer: HTMLDivElement;
    /**
     * Gets default parameters for each indicator type
     * @returns {Object} Default parameters for all indicator types
     */
    getDefaultParams(): any;
    /**
     * Creates settings control for an indicator
     * @param {string} indicator - The indicator type
     * @param {HTMLElement} container - The indicator container (for positioning reference)
     * @returns {Object} The settings control instance
     */
    createSettingsControl(indicator: string, container: HTMLElement): any;
    /**
     * Positions a settings control relative to an indicator div
     * @param {Object} settingsControl - The settings control instance
     * @param {HTMLElement} indicatorDiv - The indicator div element
     */
    positionSettingsControl(settingsControl: any, indicatorDiv: HTMLElement): void;
    /**
     * Updates the position of all settings controls
     * Called when chart layout changes
     */
    updatePositions(): void;
    /**
     * Formats parameter label for display
     * @param {string} param - The parameter name
     * @returns {string} Formatted label
     */
    formatParamLabel(param: string): string;
    /**
     * Applies minimal styling to settings control
     * @param {Object} settingsControl - The settings control instance
     */
    applyMinimalStyling(settingsControl: any): void;
    /**
     * Updates the indicator with new parameters
     * @param {string} indicator - The indicator to update
     */
    updateIndicator(indicator: string): void;
    /**
     * Gets the current parameters for an indicator
     * @param {string} indicator - The indicator type
     * @returns {Object} Current parameters
     */
    getIndicatorParams(indicator: string): any;
    /**
     * Updates theme for all settings controls
     * @param {string} theme - The theme ('light' or 'dark')
     */
    updateTheme(theme: string): void;
    /**
     * Shows settings for the active indicator
     * @param {string} indicator - The indicator type
     */
    showSettings(indicator: string): void;
    /**
     * Hides settings for an indicator
     * @param {string} indicator - The indicator type
     */
    hideSettings(indicator: string): void;
    /**
     * Hides all settings controls
     */
    hideAllSettings(): void;
    /**
     * Removes a settings element from the DOM
     * @param {string} indicator - The indicator type
     */
    removeSettingsElement(indicator: string): void;
    /**
     * Destroys all settings controls and the container
     */
    destroy(): void;
}
