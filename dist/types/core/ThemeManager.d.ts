/**
 * ThemeManager.js
 * Handles theme management for ApexStock charts
 */
export default class ThemeManager {
    /**
     * Creates a new ThemeManager
     * @param {Object} ctx - The ApexStock context
     * @param {string} initialTheme - The initial theme ('light' or 'dark')
     */
    constructor(ctx: any, initialTheme?: string);
    ctx: any;
    themeStylesApplied: boolean;
    setTheme(themeName: any): void;
    theme: any;
    isDarkTheme: boolean;
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
                bollingerBands: string;
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
                chaikin: string;
                cci: string;
                tsi: string;
                ac: string;
                bPercent: string;
                bWidth: string;
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
                bollingerBands: string;
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
                chaikin: string;
                cci: string;
                tsi: string;
                ac: string;
                bPercent: string;
                bWidth: string;
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
