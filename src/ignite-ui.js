/**
 * `apexstock/ignite-ui`: the Ignite UI add-on.
 *
 * Import it once (or load `dist/apexstock.ignite-ui.min.js` with a script tag)
 * and stock charts follow the Ignite UI theme on the page: the toolbar, its
 * menus and popups, the legend, the analysis panel, the drawings' rise and fall
 * colors, the candles, the font, light or dark. Without it the `--ig-*` tokens
 * are ignored, with no error; the `--apx-*` tokens work either way.
 * `theme.designSystem: false` turns it off for one chart.
 *
 * It registers the Ignite UI adapter the Apex products share (apex-commons),
 * and, for a bundler, imports ApexCharts' own add-on
 * (`apexcharts/features/ignite-ui`) so the charts ApexStock draws follow the
 * theme too: ApexStock sends them only the colors the page chose and leaves
 * the rest to them. A script-tag page loads ApexCharts' add-on itself
 * (`apexcharts/dist/features/ignite-ui.js`, after `apexcharts.js`).
 *
 * Import it before the first render: a chart built earlier picks it up on its
 * next `update()`.
 */
import "apex-commons/ignite-ui";
import "apexcharts/features/ignite-ui";
