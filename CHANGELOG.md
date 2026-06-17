# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
While the package is pre-1.0, minor version bumps may include breaking changes;
those are called out explicitly below.

## [Unreleased]

### Added

- **Consumer theming API (no stylesheet fork).** The toolbar/UI chrome is fully
  styled with `--apexstock-*` custom properties; you can now retheme any of it
  by overriding those tokens instead of forking the CSS. New `THEMING.md`
  documents all 36 tokens (light palette, dark palette, accent, sizing) and a
  reliable override recipe (`.apexstock-theme-light [class^="apexstock-"] { … }`,
  specificity `0,2,0`, so it wins regardless of stylesheet load order). A
  copy-ready starting point ships as `apexstock/theme-template.css`
  (`dist/themes/apexstock-theme-template.css`), and `examples/theming.html`
  demonstrates a full custom palette with a light/dark toggle. Covered by an
  e2e test asserting overridden tokens reach the rendered controls, plus a
  visual baseline.
- **End-to-end + visual-regression tests (Playwright).** A new `test/e2e` suite
  drives a deterministic fixture (animations disabled, fixed data) in a real
  browser: the toolbar renders all control groups, the candlestick bodies draw,
  the chart-type dropdown switches type, and a trendline can be drawn on the
  overlay. Two committed visual baselines (toolbar + chart) guard against
  styling/layout regressions, with a small per-pixel tolerance for cross-machine
  font rendering. Run with `yarn test:e2e`; regenerate baselines intentionally
  with `yarn test:e2e:update`. Baselines are generated on the maintainer's
  machine — review diffs rather than blindly accepting churn.
- **Expanded unit coverage for the DOM-heavy modules' logic**: the Heikin-Ashi
  and Renko conversions (`ChartSwitch`) and the x-axis timestamp helper
  (`XAxis`) now have focused tests, plus indicator edge-case and
  `Utils.normalizeOHLC` suites.
- **SSR / import-time safety.** The library is now verified import-safe in a
  Node/server environment — importing `apexstock` (and its transitive deps and
  the CSS-injection shim) touches no `window`/`document` at module load, and the
  pure `ApexStock.aggregateOHLC` / `ApexStock.INTERVALS` helpers run
  server-side. Rendering still needs a DOM: constructing an `ApexStock` without
  one now throws a clear, actionable error ("No DOM is available … create the
  chart on the client") instead of a cryptic `document is not defined`. Covered
  by a node-environment test suite (`test/ssr.test.js`).
- **Time-frame aggregation**: `ApexStock.aggregateOHLC(series, interval)` rolls
  fine-grained candles up into a coarser time frame (`1m`,`5m`,`15m`,`30m`,`1h`,
  `2h`,`4h`,`12h`,`1d`,`1w`,`1M`) — open = first, high = max, low = min,
  close = last, volume summed. UTC/epoch-aligned buckets (`1w` Monday-anchored,
  `1M` by calendar month); accepts timestamp/`Date`/date-string `x`; pure (no
  mutation). `ApexStock.INTERVALS` lists the accepted keys. See
  `examples/timeframe.html` for an interval switcher wired to `update()`.
- **Large-dataset performance options pass through to the whole stock chart.**
  `chart.dataReducer` (zoom-aware LTTB / OHLC downsampling) and
  `chart.zoom.autoScaleYaxis` (rescale Y to the visible window) — both native
  ApexCharts v5 options — now reach the main chart *and* the indicator panes,
  so a multi-thousand-candle chart decimates consistently across panes and the
  Y-axis tracks the zoomed range. See `examples/large-dataset.html` (4,000
  candles → ~300 rendered per view). `autoScaleYaxis` defaults on; both are
  overridable per chart.
- **Indicator registry**: technical indicators are defined in a single
  `INDICATOR_REGISTRY` (overlay | oscillator | custom). Adding an indicator is
  one registry entry; the available-indicator config is derived from it.
- **Keyboard accessibility**: the indicator **and** chart-type dropdowns are now
  fully keyboard operable (ARIA listbox pattern) — the trigger is focusable and
  responds to `Enter`/`Space`/`ArrowDown` to open; `↑`/`↓`/`Home`/`End` move
  between options via a roving tabindex; `Enter`/`Space` selects; `Esc` closes
  and returns focus to the trigger; `Tab` closes. On the drawing canvas, `Esc`
  cancels an in-progress drawing and deselects the selected element (`Delete`/
  `Backspace` already removed it). Builds on the existing ARIA roles/labels
  (`aria-expanded`/`aria-selected` kept in sync) on the zoom controls, drawing
  toolbar, and dropdowns.
- **Standalone `dist/apexstock.css`** (in addition to the inlined CSS), exposed
  via the `apexstock/apexstock.css` export subpath.
- `CONTRIBUTING.md` with an architecture overview and the testing approach.
- **TypeScript type definitions**: shipped `.d.ts` files (generated from JSDoc
  via `tsc`, no TS rewrite). Core domain types live in `src/types.js`
  (`OHLCPoint`, `Series`, `StockChartOptions`, `IndicatorConfig`,
  `IndicatorPoint`, `ThemeMode`, `ZoomState`); the public `ApexStock` API and
  all `Indicators.*` methods are annotated. `package.json` now exposes `types`
  and a `types` export condition (`dist/types/ApexStock.d.ts`). New scripts:
  `build:types` and `typecheck`; `build` now also emits declarations.
- **Production-readiness foundation**: ESLint (flat config) + Prettier, a Vitest
  test suite (unit coverage for all indicator math plus an ApexStock construction
  smoke test), and a GitHub Actions CI pipeline (`install → lint → test → build`)
  on Node 20.x and 22.x.
- `Utils.rafThrottle()` helper for coalescing high-frequency events into one
  update per animation frame.
- `Utils.log` / `Utils.warn` / `Utils.error` logger wrapper with a `Utils.silent`
  flag so consumers can suppress non-error library output.
- Validation guards at the `ApexStock` constructor boundary that throw clear,
  actionable errors for an invalid container, a missing `ApexCharts` global, or
  malformed `chartOptions`/series data.
- `package.json` `exports` map, `sideEffects: false`, and a `browserslist` field.

### Changed

- **BREAKING: the `apexcharts` peer dependency is now `^5.15.0`** (was `^4.7.0`).
  v5 carries the candlestick/large-dataset performance fixes and changed some
  config handling (e.g. it no longer back-fills an explicit `theme: undefined`),
  which is the version the library is now built and verified against. Note:
  ApexStock relies on ApexCharts' annotations, toolbar, and zoom features, so
  consumers must use the **full** `apexcharts` bundle (the default import) — a
  v5 tree-shaken sub-entry would silently drop Fibonacci annotations and the
  zoom controls.
- **Licensing & watermark now come from the shared `apex-commons` package**
  instead of being duplicated in-tree. `ApexStock.setLicense()` delegates to
  `apex-commons`' `LicenseManager` (which adds domain-locking and a more robust
  key parser), and the licensing watermark is the shared `apex-commons` overlay.
  The local `src/licensing/LicenseManager.js` and `Watermark.js` were removed,
  along with the now-unused `.apexstock-watermark` CSS. `apex-commons` is bundled
  inline, so the standalone builds remain self-contained. Note: the watermark
  changed from the small "Powered by apexcharts.com" corner badge to the shared
  repeating-diagonal overlay.
- **Modernized the toolbar UI**: replaced the inconsistent Unicode-glyph/emoji
  drawing-tool icons with a consistent monochrome SVG icon set (theme-aware via
  `currentColor`); refreshed buttons, dropdowns, color/width inputs, and the
  zoom control (pill); softened the toolbar divider; added keyboard focus rings;
  and gave the indicator dropdown proper dark-theme styling (previously unstyled
  in dark mode).
- **Indicator math is memoized** per series-array identity (SMA/EMA/RSI/Bollinger
  and everything that builds on them), avoiding recomputation within an update.
- `IndicatorHandlers` replaced its 28-branch `if/else` dispatch with the registry
  (behavior-preserving; cyclomatic complexity ~28 → ~4).
- `update()` now rebuilds indicators only when the series data or theme actually
  changed (option-only updates no longer churn the panes).
- Pure layout/height math extracted into `LayoutManager`; shared indicator-refresh
  loop extracted into `refreshIndicators()`.
- `redrawElements()` batches drawn-element DOM writes through a `DocumentFragment`.
- Swapped the deprecated `rollup-plugin-terser` for the maintained
  `@rollup/plugin-terser`.
- Drawing drag updates (`mousemove`) are now rAF-throttled, reducing coordinate
  conversions and DOM mutations during drawing.
- Browser targets are now sourced from the `browserslist` field instead of being
  hardcoded in the Babel config.
- Scattered `console.*` calls across the library now route through the
  `Utils` logger.

### Fixed

- **Zoom buttons and the custom x-axis now work on numeric/datetime axes**
  (e.g. epoch-timestamp `x` data, as produced by `aggregateOHLC` and used in
  `examples/timeframe.html`). The zoom controls previously clamped the new
  range to `dataPoints` — an index count — which is meaningless against a
  timestamp range, so the buttons silently no-op'd; and the scroll/zoom handlers
  always treated `e.xaxis.min/max` as data indices, so on a numeric axis they
  read past the end of the array, produced `NaN`, and froze the x-axis labels
  while the candles panned. Both now detect index-vs-value by magnitude and
  operate in the axis's own value space, so category (index) axes and
  numeric/datetime (timestamp) axes both zoom and keep their labels in sync.
- **Data edge-case hardening.** Malformed or out-of-order input no longer throws
  or silently corrupts output:
  - A new `Utils.normalizeOHLC()` runs at the data boundary (constructor and
    `update()`): it drops malformed points (nullish/unparseable `x`, or a `y`
    that isn't four finite `[open, high, low, close]` numbers) and stably
    reorders out-of-sequence points by timestamp, emitting a single suppressible
    warning per problem class. The whole pipeline — chart, indicators, x-axis,
    drawing-coordinate math — now sees clean, ascending data. An empty series
    renders an empty chart instead of misbehaving.
  - `calculateEMA` no longer throws when `period > series.length` (and so
    `calculateMACD`, which builds on it, no longer throws on short series) — it
    returns the all-null warm-up array.
  - `calculateFibonacciRetracements` returns zeroed levels for an empty series
    instead of `NaN` (from `Math.max`/`min` of an empty array).
  - `calculateStochastic` reports `0` instead of `NaN` on a perfectly flat
    window, and `calculatePVT` guards a zero previous close instead of emitting
    `Infinity`.
- **`require("apexstock")` returned an empty object** in CommonJS/Node consumers
  (the common SSR interop path). Because `package.json` is `"type": "module"`,
  the `.js` UMD bundle the `require`/`default` export conditions pointed at was
  parsed as ESM, so its `module.exports` branch never ran. The CommonJS bundle
  is now emitted as `dist/apexstock.cjs` (and `main`/`require`/`default` point at
  it), so `require("apexstock")` correctly yields the `ApexStock` class. The
  former `dist/apexstock.umd.js` is gone; browser `<script>` users should keep
  loading the IIFE `dist/apexstock.min.js`.
- **Oscillator panes threw `theme.mode` errors under ApexCharts 5**: the pane
  chart options passed a top-level `theme: mainChartOptions.theme`, which is
  `undefined` (the main chart only sets `chart.theme`). An explicit
  `theme: undefined` overwrites ApexCharts' default rather than being back-filled
  like an absent key, so `cnf.theme.mode` threw in the core's `setupElements`
  (surfaced against the v5 core; v4 tolerated it). Panes now pass a proper
  `theme: { mode }` object.
- **Main chart hardened against an explicit `theme: undefined`.** Because the
  option merge propagates explicit-undefined values, a caller passing
  `theme: undefined` (e.g. `theme: someUnsetVar`) would hit the same v5
  `theme.mode` throw on the *main* chart. A `theme` key that is present but
  nullish is now stripped before reaching ApexCharts (a valid theme object is
  left intact), in both the constructor and `update()`.
- **CSS variable leakage into the host page**: the injected stylesheet declared
  ~27 generic, un-namespaced custom properties (`--font-size-sm`, `--blue`,
  `--danger`, `--border-radius-*`, `--gap-*`, `--light-*`/`--dark-*`, …) on the
  global `:root`. Because the `<style>` is appended after the host's sheets, it
  won the cascade and clobbered any host design token of the same name (most
  visibly `--font-size-sm: 10px`, shrinking host text). Every property is now
  prefixed `--apexstock-*` and the block is scoped to `[class^="apexstock-"]`
  instead of `:root`, so nothing touches the host document. The injected
  `<style>` is also reference-counted and removed from `<head>` when the last
  instance is destroyed, so it no longer lingers across SPA navigation.
- Removed a redundant 1-second `setInterval` overlay-sync poll in `EventManager`
  (the `MutationObserver` and chart events already cover syncing) and disconnect
  the observer on `destroy()` to avoid a leak.
- Removed a duplicate `toolbar` key in the indicator chart options.
- Unknown indicator keys are now a no-op instead of creating a broken empty chart.
