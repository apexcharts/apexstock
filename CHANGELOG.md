# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
While the package is pre-1.0, minor version bumps may include breaking changes;
those are called out explicitly below.

## [Unreleased]

### Added

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
