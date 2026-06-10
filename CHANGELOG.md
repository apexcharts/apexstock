# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
While the package is pre-1.0, minor version bumps may include breaking changes;
those are called out explicitly below.

## [Unreleased]

### Added

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

- Removed a redundant 1-second `setInterval` overlay-sync poll in `EventManager`
  (the `MutationObserver` and chart events already cover syncing) and disconnect
  the observer on `destroy()` to avoid a leak.
- Removed a duplicate `toolbar` key in the indicator chart options.
- Unknown indicator keys are now a no-op instead of creating a broken empty chart.
