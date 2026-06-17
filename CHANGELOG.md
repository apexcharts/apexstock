# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
While the package is pre-1.0, minor version bumps may include breaking changes;
those are called out explicitly below.

## [Unreleased]

### Added

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
- **Accessibility baseline**: ARIA roles/labels on the zoom controls, drawing
  toolbar, and indicator dropdown (`aria-expanded`/`aria-selected` kept in sync).
  Full keyboard navigation is still a follow-up.
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
- Removed a redundant 1-second `setInterval` overlay-sync poll in `EventManager`
  (the `MutationObserver` and chart events already cover syncing) and disconnect
  the observer on `destroy()` to avoid a leak.
- Removed a duplicate `toolbar` key in the indicator chart options.
- Unknown indicator keys are now a no-op instead of creating a broken empty chart.
