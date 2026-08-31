export default class ThemeManager {
    /**
     * Creates a new ThemeManager
     * @param {Object} ctx - The ApexStock context
     * @param {string} initialTheme - The initial theme ('light' or 'dark')
     */
    constructor(ctx: any, initialTheme?: string);
    ctx: any;
    themeStylesApplied: boolean;
    /** Active preset def ({@link ThemePresets}), or null for a plain mode. */
    preset: import("./ThemePresets").ThemePreset;
    presetName: string;
    setTheme(themeName: any): void;
    theme: any;
    isDarkTheme: boolean;
    /**
     * Apply a named preset (or a resolved def). Sets the base mode from the
     * preset so all `isDarkTheme` logic keeps working; the preset then overrides
     * the chart colors ({@link getChartConfig}) and chrome tokens
     * ({@link applyThemeStyles}).
     * @param {string|object} nameOrDef
     * @returns {boolean} false if a name was given but is unknown.
     */
    applyPreset(nameOrDef: string | object): boolean;
    /** @returns {string|null} the active preset name, or null for a plain mode. */
    getPreset(): string | null;
    /**
     * Write the current theme's chart colors (candlestick, grid, axis labels,
     * background) into a chart-options object in place. This is the source of
     * truth for `mainChartOptions`: at construction and on every theme change,
     * `updateTheme` re-applies `Utils.extend(themeConfig, mainChartOptions)` with
     * `mainChartOptions` winning, so a preset's colors must live here or they are
     * overridden. For a plain mode it writes the exact built-in defaults, so
     * switching a preset off restores the original appearance with no drift.
     * @param {object} options - The chart-options object to mutate.
     * @returns {object} the same object.
     */
    syncChartOptionsToTheme(options: object): object;
    getTheme(): any;
    isDark(): boolean;
    getColors(): any;
    /**
     * Initializes the color schemes for light and dark themes
     */
    initColorSchemes(): void;
    colorSchemes: {
        light: {
            toolbar: {
                background: string;
                text: string;
                border: string;
            };
            dropdown: {
                background: string;
                hover: string;
                text: string;
                border: string;
                selectedBackground: string;
            };
            indicators: {
                movingAverage: string;
                ema: string;
                vwap: string;
                bollingerBands: string;
                donchian: string;
                keltner: string;
                fibonacci: string[];
                linearRegression: string;
                tenkanSen: string;
                kijunSen: string;
                volume: string;
                rsi: string;
                macd: string;
                signal: string;
                histogramPositive: string;
                histogramNegative: string;
                pvt: string;
                stochasticK: string;
                stochasticD: string;
                stdDev: string;
                adx: string;
                atr: string;
                chaikin: string;
                cci: string;
                tsi: string;
                ac: string;
                bPercent: string;
                bWidth: string;
                drawdown: string;
            };
            tradingOverlays: {
                buy: string;
                sell: string;
                stopLoss: string;
                takeProfit: string;
                alert: string;
                order: string;
                labelText: string;
            };
        };
        dark: {
            toolbar: {
                background: string;
                text: string;
                border: string;
            };
            dropdown: {
                background: string;
                hover: string;
                text: string;
                border: string;
                selectedBackground: string;
            };
            indicators: {
                movingAverage: string;
                ema: string;
                vwap: string;
                bollingerBands: string;
                donchian: string;
                keltner: string;
                fibonacci: string[];
                linearRegression: string;
                tenkanSen: string;
                kijunSen: string;
                volume: string;
                rsi: string;
                macd: string;
                signal: string;
                histogramPositive: string;
                histogramNegative: string;
                pvt: string;
                stochasticK: string;
                stochasticD: string;
                stdDev: string;
                adx: string;
                atr: string;
                chaikin: string;
                cci: string;
                tsi: string;
                ac: string;
                bPercent: string;
                bWidth: string;
                drawdown: string;
            };
            tradingOverlays: {
                buy: string;
                sell: string;
                stopLoss: string;
                takeProfit: string;
                alert: string;
                order: string;
                labelText: string;
            };
        };
    };
    /**
     * Apply theme styles to UI elements
     * @param {HTMLElement} chartContainer - The chart container element
     * @param {HTMLElement} toolbar - The toolbar element
     */
    applyThemeStyles(chartContainer: HTMLElement, toolbar: HTMLElement): void;
    /**
     * Inject theme-specific CSS into the document
     */
    injectThemeStyles(): void;
    /**
     * Apply theme to an element's style based on element type
     * @param {HTMLElement} element - The element to style
     * @param {string} elementType - Type of element ('dropdown', 'option', etc.)
     */
    applyElementStyle(element: HTMLElement, elementType: string): void;
    /**
     * Get theme-specific configuration for ApexCharts
     * @returns {Object} Theme-specific chart configuration
     */
    getChartConfig(): any;
}
