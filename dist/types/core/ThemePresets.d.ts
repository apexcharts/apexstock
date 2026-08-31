export default ThemePresets;
/**
 * ThemePresets — a curated pack of named themes layered on the base light/dark
 * modes, plus the registry behind `ApexStock.registerTheme`.
 *
 * A preset is a small, declarative description of an *appearance*. It resolves
 * to two things the rest of the theme system already understands:
 *
 * 1. **Chart colors** (candlestick up/down, grid, axis label, plot background),
 *    merged into {@link ThemeManager#getChartConfig} — these paint the
 *    ApexCharts SVG, which is driven from JS, not CSS.
 * 2. **Chrome tokens** (accent / surface / foreground / grid), applied as inline
 *    `--apx-*` family custom properties on the chart container so ApexStock's
 *    own chrome (toolbar, dropdowns, legend, tooltip) follows through the
 *    documented token cascade (see THEMING.md) with no extra plumbing.
 *
 * Every preset declares a base `mode` (`"light"` | `"dark"`) so the existing
 * `isDarkTheme` logic (ApexCharts `theme.mode`, indicator palette, etc.) keeps
 * working unchanged; the preset only overrides the handful of colors that give
 * it character. The built-in pack is light-first (fintech/SaaS dashboards);
 * consumers add their own with `ApexStock.registerTheme(name, def)`.
 */
export type ThemePreset = {
    /**
     * - Base mode the preset builds on.
     */
    mode: "light" | "dark";
    /**
     * - Candlestick up color.
     */
    up: string;
    /**
     * - Candlestick down color.
     */
    down: string;
    /**
     * - Grid + border color.
     */
    grid: string;
    /**
     * - Axis label text color.
     */
    axis: string;
    /**
     * - Plot background.
     */
    background: string;
    /**
     * - Brand/accent color (focus rings, order line, active tool).
     */
    accent: string;
};
declare namespace ThemePresets {
    /** @returns {boolean} true if `name` resolves to a built-in or custom preset. */
    function has(name: any): boolean;
    /**
     * @param {string} name
     * @returns {ThemePreset|null} a copy of the preset def, or null if unknown.
     */
    function get(name: string): ThemePreset | null;
    /** @returns {string[]} all known preset names (custom take precedence). */
    function names(): string[];
    /**
     * Register (or override) a named preset. Missing colors fall back to the
     * `paper` (light) or a dark baseline so a partial def is still valid.
     * @param {string} name
     * @param {Partial<ThemePreset>} def
     * @returns {ThemePreset|null} the stored def, or null on invalid input.
     */
    function register(name: string, def: Partial<ThemePreset>): ThemePreset | null;
    /**
     * Normalize a preset name or partial def into a complete {@link ThemePreset}.
     * @param {string|Partial<ThemePreset>} nameOrDef
     * @returns {ThemePreset|null} null if a name was given but is unknown.
     */
    function resolve(nameOrDef: string | Partial<ThemePreset>): ThemePreset | null;
}
