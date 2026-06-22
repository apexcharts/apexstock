# Contributing to ApexStock

ApexStock is a financial-charting extension layer built **on top of ApexCharts**
(a peer dependency). It adds OHLC chart types, technical indicators, drawing
tools, theming, and export on top of the base ApexCharts engine.

## Getting started

```bash
yarn install        # install dev dependencies (ApexCharts is a peer dep)
yarn dev            # rollup watch build
yarn build          # production build: bundles (IIFE/UMD/ESM) + types + standalone CSS
```

### Scripts

| Script | What it does |
| --- | --- |
| `yarn build` | `rollup -c` (bundles + `dist/apexstock.css`) then `tsc` (`dist/types/*.d.ts`) |
| `yarn build:types` | Emit `.d.ts` only |
| `yarn typecheck` | Type-check via JSDoc without emitting |
| `yarn lint` / `yarn lint:fix` | ESLint (flat config) |
| `yarn format` / `yarn format:check` | Prettier |
| `yarn test` / `yarn test:watch` | Vitest |
| `yarn test:coverage` | Vitest with coverage (enforces a threshold on `Indicators.js`) |

CI (`.github/workflows/ci.yml`) runs `install → lint → test → build` on Node 20/22.

## Conventions

- **Plain JavaScript with JSDoc types.** No TypeScript source; `.d.ts` files are
  generated from JSDoc by `tsc`. Annotate public APIs and reference shared types
  via `import("./types.js").TypeName`. Core domain types live in
  [`src/types.js`](src/types.js).
- **Logging** goes through `Utils.log` / `Utils.warn` / `Utils.error` (never raw
  `console.*`). Errors always surface; logs/warns honor `Utils.silent`.
- Run `yarn format` before committing. ESLint is permissive (most stylistic
  issues are warnings); the errors that block CI are real footguns
  (`no-undef`, `eqeqeq`, `no-unsafe-optional-chaining`).

## Architecture

```
src/
  ApexStock.js          Main class: builds DOM, wires sub-components, render()/update()
  types.js              Shared JSDoc @typedefs (public API surface)
  globals.d.ts          Ambient decls (the ApexStock.css import, the ApexCharts global)
  indicators/
    Indicators.js       Pure indicator math (SMA/EMA/RSI/MACD/...); memoized per-series
    IndicatorHandlers.js INDICATOR_REGISTRY + updateIndicator/removeIndicator orchestration
  core/
    LayoutManager.js    Pure chart-height math
    ThemeManager.js     Theme/colors/config
    ChartSwitch.js      Candlestick/Heikin-Ashi/Renko/OHLC/... switching
    EventManager.js     Drawing event listeners (rAF-throttled)
    ElementInteractionManager.js  Hover/select/move/delete of drawn elements
    ToolbarManager.js   Drawing toolbar UI
  components/           XAxis, ZoomControls, OscillatorSettings, SettingsControl
  tools/drawing/        DrawingTools + element factory, overlays, text/tooltip annotations
  tools/export/         PNG export
  utils/                Utils (truncate/extend/rafThrottle/logger), CoordinateConverter
  licensing/            LicenseManager, Watermark
```

### Data model

A series point is `{ x, y: [open, high, low, close], v }`. Indicators read the
close (`y[3]`), high (`y[1]`), and low (`y[2]`). `v` is volume.

### Indicators

Indicators are defined in a single registry, `INDICATOR_REGISTRY` in
[`IndicatorHandlers.js`](src/indicators/IndicatorHandlers.js). **To add an
indicator, add one registry entry** — no branching to edit:

- `kind: "overlay"` — drawn on the main chart. `build(context, params)` returns
  `{ series, replaceNames }`.
- `kind: "oscillator"` — drawn in a separate pane. `build(context, params, common)`
  returns chart options (or `null` to skip, e.g. missing volume data).
- `kind: "custom"` — handles the chart directly (e.g. fibonacci annotations) via
  `apply(context, params)` / `remove(context)`.

The available-indicators config (`this.overlays` / `this.oscillators`) is derived
from the registry via `IndicatorHandlers.getDefaultConfig()`. The math in
`Indicators.js` is pure and memoized per series-array identity, so results are
**read-only** — map them into new arrays, don't mutate.

### Gotchas

- **`ApexCharts` is a global**, not an import (it's the peer dependency).
- **`updateIndicator(key)` toggles**: calling it on an already-active indicator
  removes it. That's why `update()`/`updateTheme()` use `refreshIndicators()`
  (remove-all then re-add) rather than re-adding in place.
- **`update()` only rebuilds indicators when the series data or theme changed** —
  option-only updates leave the panes untouched.
- CSS is imported via the bare specifier `"ApexStock.css"`, resolved by a custom
  Rollup plugin at build time. Tests alias it to a stub; `tsc` resolves it via
  `globals.d.ts`.

## Testing

Tests use **Vitest** (jsdom for DOM-touching code). Patterns:

- **Indicator math** ([`test/indicators.test.js`](test/indicators.test.js)) —
  fixture-based, hand-computed expected values.
- **IndicatorHandlers** ([`test/indicator-handlers.test.js`](test/indicator-handlers.test.js))
  — characterization tests using a capturing `ApexCharts` mock under jsdom; they
  pin the observable `updateSeries`/annotation/oscillator-pane behavior. Run them
  before and after any refactor of the indicator orchestration.

> **Note:** the test suite is headless (jsdom + a mocked ApexCharts). Rendering
> and interaction (overlay alignment, zoom/pan, drawing) are **not** covered by
> automated tests — do a manual pass on `examples/basic.html` and
> `examples/advanced.html` for visual/interaction changes.

## Releasing

Publishing is automated by [`.github/workflows/publish.yml`](.github/workflows/publish.yml).
A push to `main` whose **head commit message** matches a package's release
trigger publishes that one package to npm via OIDC Trusted Publisher (no token)
with provenance. The workflow verifies the message version matches the package's
`package.json` version, runs the package's test + build, then publishes.

| Package | Commit message trigger | Publishes |
| --- | --- | --- |
| `apexstock` (core) | `release: X.Y.Z` | repo root (yarn build, `dist/`) |
| `react-apexstock` | `release(react-apexstock): X.Y.Z` | `packages/react-apexstock` root |
| `vue-apexstock` | `release(vue-apexstock): X.Y.Z` | `packages/vue-apexstock` root |
| `ngx-apexstock` | `release(ngx-apexstock): X.Y.Z` | `packages/ngx-apexstock/dist` (ng-packagr output) |

The scoped `release(<pkg>):` form never matches the core's literal `release: `
trigger, so exactly one package publishes per release commit. A version with a
hyphen (e.g. `0.3.0-beta.1`) publishes under the `next` dist-tag; otherwise
`latest`.

### To cut a release

1. Bump `version` in the package's `package.json` (and update `CHANGELOG.md`).
2. Commit with the matching trigger message and push to `main`:

   ```bash
   # core
   git commit -am "release: 0.3.0"
   # a wrapper
   git commit -am "release(react-apexstock): 0.2.0"
   git push origin main
   ```

3. Watch the run: `gh run watch $(gh run list --workflow=publish.yml -L1 --json databaseId -q '.[0].databaseId')`.

### Things that will bite you

- **All publish jobs must live in `publish.yml`.** npm's Trusted Publisher is
  configured per package to trust this exact workflow filename; a publish from
  any other workflow file is rejected. Add new packages as jobs here, do not
  split into separate workflow files.
- **Provenance needs a public repo and a `repository.url`.** Each package's
  `package.json` has `repository` (with the monorepo `directory`); ng-packagr
  copies it into `ngx-apexstock`'s generated `dist/package.json`. Without it npm
  rejects the publish (HTTP 422).
- **`ngx-apexstock` publishes its built `dist/`,** not the source root (the root
  has no `main`/`files`; ng-packagr writes the publishable manifest into `dist`).
- **Core `dist/` is committed; wrapper `dist/` is gitignored** and rebuilt in CI.
  Wrappers resolve the core's `apexstock` types from the committed
  `dist/types/`, so the core does not need rebuilding to publish a wrapper.
- The workflow runs on every push to `main` and no-ops when the message is not a
  release trigger, so normal commits are safe.
