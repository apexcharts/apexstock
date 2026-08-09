# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
While the package is pre-1.0, minor version bumps may include breaking changes;
those are called out explicitly below.

## [Unreleased]

### Changed

- **Indicator display labels are now title-cased per word** (e.g. "Bollinger
  Bands", "Stochastic Oscillator" instead of "Bollinger bands"). Affects the
  dropdown labels and `listIndicators()`/`getIndicator()` `label` fields;
  indicator keys and series names are unchanged.
- **Multiple oscillator panes can now be active at once.** The previous
  one-oscillator-at-a-time cap is lifted: the indicators dropdown treats
  oscillators as independent toggles (like overlays), so RSI + MACD + Volume can
  be stacked together. Each oscillator gets its own pane and the panes share the
  indicator area evenly (auto-resized on add/remove). Adding a new oscillator no
  longer evicts the current one. Multiple oscillators round-trip through
  `getState`/`setState`.

### Added

- **Programmatic drawing API (data-space, price/time-anchored).** New instance
  methods `addDrawing(config)`, `updateDrawing(id, patch)`, `removeDrawing(id)`,
  `clearDrawings()`, `getDrawing(id)`, and `getDrawings()`. Drawings are anchored
  in data coordinates (price/time) and re-project through zoom/pan/resize like a
  mouse-drawn shape. Supported types: `trendline` (alias `line`), `ray`,
  `horizontalLine` (alias `hline`), `verticalLine` (alias `vline`), and
  `rectangle` (alias `zone`), `fibRetracement` / `fibExtension` (Fibonacci
  level lines between two anchor prices, with configurable `levels` and
  `showLabels`), and `measure` (a box labeled with the price change, percent
  change, and bar count, tinted by direction). Each takes `points: [{x, y}]`
  plus optional `color`, `width`, `fill`, `fillOpacity`, `dashArray`, `locked`,
  and `visible`. A `snap` option (`true` or `"open"` / `"high"` / `"low"` /
  `"close"`) snaps points to the nearest bar's OHLC values. The line-family
  drawings (trend/ray/level/time/fib/measure) are also draggable in the UI.
  `getDrawings()` also reports shapes made with the mouse toolbar. Adding,
  patching, removing, and clearing drawings emit `drawingAdded` / `drawingUpdated`
  / `drawingRemoved` / `drawingsCleared` events.
- **Interactive mouse tools for the anchored drawings.** The drawing toolbar now
  includes ray, horizontal line, vertical line, Fibonacci retracement, and measure
  tools alongside the existing freehand tools, so the anchored types can be drawn
  by dragging on the chart (not only via `addDrawing()`). They share the same
  data-space model, so mouse-drawn ones reproject, drag, serialize, and appear in
  `getDrawings()` identically. The former "Line" tool is now labeled "Trend line".
- **Custom drawing tools via `ApexStock.registerDrawingTool(name, def)`.** Register
  a new data-space drawing type globally (the drawing-layer analogue of
  `registerIndicator`); `def.render(data, helpers)` returns an SVG element from
  the drawing's data-space record, with `helpers` exposing the data<->screen
  projection. Afterwards `addDrawing({ type: name, points, ...customFields })`
  creates it, and it reprojects, drags, and serializes like a built-in. Custom
  types may not shadow built-ins; pass `overwrite: true` to replace one.
- **State serialization now persists drawings (schema v2).** `getState()`
  captures the full data-space drawing set and `setState()` restores it
  losslessly; `ApexStock.STATE_VERSION` is now `2`. Older v1 states migrate
  forward automatically (drawings default to empty).
- **Three new studies: ATR, Donchian Channels, Keltner Channels.**
  - **ATR (`"atr"`)** - Average True Range volatility as an oscillator pane
    (Wilder-smoothed true range, `period` default 14).
  - **Donchian Channels (`"donchian channels"`)** - a band overlay of the
    highest high / lowest low over a trailing `period` (default 20).
  - **Keltner Channels (`"keltner channels"`)** - a band overlay of an EMA
    midline offset by `multiplier * ATR` (`emaPeriod` 20, `atrPeriod` 10,
    `multiplier` 2).
  Each ships with a streaming twin (exact under `appendData()`; Keltner composes
  the EMA + ATR steppers), round-trips through `getState`/`setState`, and
  appears in `listIndicators()` and the dropdown like the built-ins.
- **VWAP indicator (`"vwap"`).** Volume-weighted average price as a main-chart
  overlay, cumulative from the first bar: `sum(price*volume)/sum(volume)`, where
  `price` is the typical price `(high+low+close)/3` (`source: "hlc3"`, default)
  or the close (`source: "close"`), e.g. `updateIndicator("vwap", { source:
  "close" })`. Volume-less bars contribute 0 (the line uses the price until
  volume accrues). Ships with a streaming twin, so it stays exact under
  `appendData()` in O(1), and it round-trips through `getState`/`setState` and
  appears in `listIndicators()` like the built-ins. Heavily requested; a common
  gap. Session-anchored resets (per trading day) are a planned follow-up.
- **`llms.txt` (agent-readable API surface).** A machine-readable summary of
  ApexStock at the repo root (and shipped in the npm tarball) following the
  llmstxt.org convention: setup, the data-point shape, the public `ApexStock`
  API grouped by area, event names and payloads, indicator keys, and the
  framework wrappers, so an LLM/coding agent can drive the library accurately.
- **Programmatic export: images and data (`exportImage` / `exportData`).**
  `exportImage({ format: "png" | "svg", scale, download, filename })` returns a
  `Promise<{ format, blob, url, fallback? }>`. **PNG now produces a real raster**
  by compositing the price chart and any oscillator panes via each ApexChart's
  native `dataURI()` (pure SVG, so the canvas isn't tainted); browsers that
  can't rasterize fall back to SVG and set `fallback: true`. SVG remains a full
  vector snapshot. `exportData({ format: "csv" | "json", range: "all" |
  "visible", includeVolume, raw, pretty, download, filename })` serializes the
  OHLC series (columns `time, open, high, low, close[, volume]`; ISO-8601 time
  by default) and round-trips through `ApexStock.fromCSV`. The toolbar download
  button now uses this path (real PNG, with the SVG fallback). Backed by a new
  `DataExport` helper and a reworked `Export` module. See the README "Export"
  section.
- **Optional ApexCharts injection.** ApexStock no longer forces you to assign
  `window.ApexCharts` in a bundler/framework app. Pass the imported constructor
  per instance (`new ApexStock(el, options, { ApexCharts })`) or register it
  once app-wide (`ApexStock.setApexCharts(ApexCharts)`). Resolution order is
  per-instance injection → app-wide default → the `window.ApexCharts` global, so
  the existing global path (script tags) keeps working unchanged. The resolved
  constructor is used for the oscillator panes too. The "not found" error now
  spells out all three options. The React/Vue/Angular wrappers expose it as an
  optional `apexCharts` prop/input that is forwarded at mount. See the README
  "Using a bundler" section.
- **Data adapters (`ApexStock.normalize` / `ApexStock.fromArrays` /
  `ApexStock.fromCSV`).** Convert the common real-world shapes into the
  `{ x, y: [open, high, low, close], v? }` point shape without hand-mapping:
  arrays of objects/tuples (`normalize`), parallel column arrays (`fromArrays`),
  and CSV text (`fromCSV`). Columns are matched by case-insensitive alias
  (`date/time` -> x, `o` -> open, `vol` -> volume, ...) with an optional
  `mapping` override; only `close` is required (missing OHLC is derived from it).
  `fromCSV` handles quoted fields, embedded delimiters, headerless data, custom
  delimiters, and CRLF/LF endings. Output is validated and time-sorted (reusing
  the render pipeline's cleaning). Backed by a new `DataAdapter` helper
  (`src/utils/DataAdapter.js`). See the README "Data adapters" section.
- **Comparison mode (`addComparison` / `removeComparison` / `clearComparisons` /
  `getComparisons` / `setComparisonMode` / `getComparisonMode`).** Overlay
  additional instruments (e.g. AAPL vs MSFT vs SPY) as lines on a dedicated
  **secondary y-axis**, so differing price scales never distort the primary
  candlestick. Two modes: `"percent"` (default) shows indexed performance —
  each instrument as % change from its first point — and `"absolute"` shows raw
  prices. Comparisons persist across zoom, theme, chart-type switch, indicator
  toggles, and `appendData` (the multi-axis binding is rebuilt safely around
  each). Backed by a new `Comparison` manager (`src/overlays/Comparison.js`).
  See the README "Comparison mode" section.
- **Data-space annotation API (`addAnnotation` / `updateAnnotation` /
  `removeAnnotation` / `clearAnnotations` / `getAnnotation` / `getAnnotations`).**
  Place horizontal/vertical lines, bands, point markers, and text at data
  coordinates (price/time): `type` is `"yLine"`, `"yBand"`, `"xLine"`,
  `"xBand"`, `"point"`, or `"text"`. Distinct from the freehand drawing tools
  (screen space) and the trading price lines. Annotations are id-based, persist
  across update/theme/chart-type switches (re-applied like trading overlays),
  and are removed by id so they never disturb price lines or indicator
  annotations. Backed by a new `Annotations` manager
  (`src/overlays/Annotations.js`). See the README "Annotations" section.
- **Programmatic indicator params (`updateIndicator(key, params)` /
  `setIndicatorParams(key, params)`).** Configure an indicator without the
  settings popover, e.g. `updateIndicator("rsi", { period: 21 })`. The two-arg
  form sets params and ensures the indicator is active (it never toggles it
  off): an inactive indicator is added with the params; an active one is
  recomputed in place (data + streaming state), preserving zoom. This also makes
  overlay periods (e.g. moving average) configurable for the first time. The
  one-arg `updateIndicator(key)` keeps its toggle behavior.
- **Visible-range accessors (`getVisibleRange()` / `setVisibleRange(min, max)`).**
  Read the currently visible x-window (the same values the `rangeChange` event
  reports) or set it across the main chart and every indicator pane (fires
  `rangeChange`, like an interactive zoom). Handy for lazy-loading data for the
  visible window or syncing an external control.
- **Indicator introspection (`listIndicators()` / `getIndicator(key)`).**
  Enumerate every available indicator (built-in + custom) with its metadata and
  live state — `key`, `label`, `type` (`"overlay"`/`"oscillator"`), `kind`,
  `builtin`, `active` (on this instance), `streamable`, and current `params` —
  for building custom indicator pickers and settings panels. `getIndicator` is
  case-insensitive and returns null for unknown keys. See the README
  "Introspecting indicators" section.
- **Custom indicators (`ApexStock.registerIndicator(name, def)`).** Register your
  own indicators without forking — they work with `updateIndicator(key)`, appear
  in the indicators dropdown, and round-trip through `getState`/`setState`. A
  declarative form (`{ type: "overlay"|"oscillator", calc(series, params),
  defaultParams, colors, yaxis, chartOptions, ... }`) covers most cases; `calc`
  may return one aligned line, a named multi-line map, or ready-made ApexCharts
  series. An advanced form (`{ kind, build/apply/remove }`) plugs a raw registry
  entry in verbatim. An optional `stream` twin (`{ seed, step, render }`) enables
  incremental `appendData()` updates; without one, custom indicators are
  recomputed from the full series on append (still exact). The previously
  internal indicator registry (`INDICATOR_REGISTRY`) and streaming map
  (`STREAM_MAP`) now have public registration surfaces
  (`IndicatorHandlers.register`, `IndicatorStep.register`). See the README
  "Custom Indicators" section.
- **State serialization (`getState()` / `setState()`).** Capture the chart's
  configurable state as portable, schema-versioned JSON (theme mode, active
  chart type, active indicators with their params, and the visible x-range) and
  restore it later, so a user's layout survives a reload or moves between
  sessions/devices. `getState()` returns a `JSON.stringify`-safe object;
  `setState(state)` reconciles theme, chart type, indicators (+params), the
  toolbar selection, and zoom, and accepts any supported version (older states
  are migrated internally; `ApexStock.migrateState(state)` and
  `ApexStock.STATE_VERSION` are also exposed). Backed by a new internal
  `StateSerializer` (`src/core/StateSerializer.js`), the serialization backbone
  that later releases extend (drawings, trading overlays, event markers, panes).
  Drawings and trading price lines are intentionally not part of v1 (they carry
  non-serializable callbacks). See the README "State Persistence" section.
- **Public event API.** Subscribe to chart events with `on(name, handler)`
  (returns an unsubscribe function), plus `off(name, handler?)`, `once(name,
  handler)`, and `emit(name, payload)`. Four built-in events are emitted:
  `crosshairMove` and `click` (`{ dataPointIndex, seriesIndex, x, ohlc, volume,
  nativeEvent }`, with `dataPointIndex: -1` and null fields when the pointer is
  not over a candle), `rangeChange` (`{ min, max, source }` where `source` is
  `"zoom"`, `"pan"`, or `"reset"`), and `indicatorToggle` (`{ key, active }`).
  Subscribing is safe before `render()`; all subscriptions are dropped on
  `destroy()`. See the README "Events" section. Backed by a new internal
  `EventEmitter` (`src/core/EventEmitter.js`).

### Fixed

- **`destroy()` now fully tears the chart down (no leaks on SPA unmount).**
  Previously `destroy()` left the underlying ApexCharts instances alive and
  several `window`/`document` listeners registered, so unmounting/remounting in
  a single-page app (the framework wrappers, or manual use) leaked listeners,
  observers, and detached DOM over time. `destroy()` now: destroys the main
  chart and every oscillator-pane ApexCharts instance; removes all listeners and
  observers added by the axis, drawing tools, chart-type switch, overlay/event/
  interaction managers, the element popup, and the indicator dropdowns (several
  of which were previously anonymous and unremovable); drops the shared
  stylesheet; and clears all event subscriptions. It is now idempotent and safe
  to call before `render()` or more than once (e.g. React StrictMode). Also
  hardened `syncOverlayPosition` against a pending post-`destroy()` timer firing
  on detached DOM. Guarded by new mount/unmount leak tests.

## [0.3.1] - 2026-07-17

### Fixed

- **Chart-type switch duplicated the candles when the price series was not named
  `"Price"`.** `ChartSwitch` identified the price series by a hard-coded name
  (`"Price"` / `"Heikin-Ashi"` / `"Renko"`) when deciding which existing series
  were indicators to carry across a switch. A series with any other name (e.g. a
  ticker like `"AAPL"`) was mistaken for an indicator and kept, so switching to
  Heikin-Ashi (or any other type) added a second candlestick series alongside
  the original: every candle rendered duplicated side by side, and the duplicate
  persisted (and compounded) on subsequent switches. The price series is now
  identified by position (index 0, with overlays appended after it), and its
  user-supplied name is preserved across switches.
- **`appendData()` did not stream into a price series that was not named
  `"Price"`.** The streaming path matched the price series by the same
  hard-coded `"Price"` name, so a renamed series (e.g. a ticker) silently
  stopped receiving new candles on `appendData()`. It is now matched by position
  (index 0), consistent with the chart-type-switch fix above. Streaming while a
  non-candlestick transform (Heikin-Ashi, Renko, line, ...) is displayed remains
  unsupported (unchanged behavior); switch back to candlestick/OHLC to stream.

### Changed

- **`update()` refreshes indicators in place on a series-only change.** Previously
  every data `update()` tore down and recreated each active indicator, destroying
  and recreating oscillator panes (a fresh ApexCharts instance + render per pane).
  Now a series-only update recomputes indicator data and pushes it into the
  existing overlays and oscillator panes in place (no teardown), preserving zoom
  and re-seeding streaming state. Theme changes still do a full rebuild (they also
  restyle pane chrome). Measured in a browser, `update()`-per-tick with an active
  oscillator dropped from ~590ms/bar to ~190ms/bar.

### Added

- **Real-time streaming via `appendData()`.** A new incremental path appends a
  bar (or replaces a forming one) and updates the price candles, every active
  overlay and oscillator pane, the volume pane, and the x-axis in
  O(active indicators x small tail) instead of the full teardown/rebuild
  `update()` performs (no `normalizeOHLC` over all history, no memoized full
  indicator recompute, no pane destroy/recreate). API:
  `appendData(point | point[], { view, maxPoints, updateLast })` where
  `view: "follow" | "preserve"` rides the right edge or keeps the current zoom
  window, `maxPoints` caps a rolling window (running indicators keep their carried
  state, so values reflect all history seen, not the trimmed buffer), and
  `updateLast` replaces the last bar for a forming candle. Backed by exact
  streaming twins for all 17 indicators (`IndicatorStep`); ADX and TSI run as O(1)
  running state. Measured ~12-14x faster than `update()`-per-tick in a browser.
  A forming candle's close commits in O(1) (no full re-seed). The README
  documents the options and tick-aggregation recipes (append completed bars, or
  keep a forming candle live via `updateLast`). See `examples/streaming.html`.
- **Trading overlays (price lines).** Order lines, stop-loss, take-profit, and
  alert lines as horizontal y-axis annotations on the main chart, via
  `addPriceLine`, `addOrderLine`, `addStopLoss`, `addTakeProfit`, `addAlert`,
  `updatePriceLine`, `removePriceLine`, `clearPriceLines`, `getPriceLine`, and
  `getPriceLines`. Each line takes a price, optional label, side (buy/sell),
  color, dash, width, and label position; colors default from a new themeable
  `colors.tradingOverlays` group. Lines persist across `update()`, theme change,
  chart-type switch, and streaming appends. See `examples/trading-overlays.html`.
  Interactivity (opt-in per line): `draggable` enables drag-to-reprice (fires
  `onMove({id, price})` on drop), `closable` adds a click-to-remove ✕ button
  (fires `onRemove({id})`), and `onCross({id, type, price, direction, bar})`
  fires when a newly-closed bar (from `appendData`) crosses the line.

### Fixed

- `updateTheme()` no longer throws: it called `this.zoomControls.updateTheme`
  without checking the method exists (the zoom control restyles via CSS theme
  classes and exposes no such method). Guarded like the sibling calls.
- README: corrected the OHLC candle shape in the examples to
  `{ x, y: [open, high, low, close], v? }` (a single `y` array, not flat
  `o`/`h`/`l`/`c` keys — the latter were silently dropped by `normalizeOHLC`),
  and documented the ApexCharts-as-global requirement. Following the old example
  produced an empty chart.

## [0.2.0] - 2026-06-22

### Added

- **Framework wrappers (separate packages).** Thin, typed component wrappers
  now live under `packages/`: `react-apexstock`, `vue-apexstock`, and
  `ngx-apexstock`. Each wraps the imperative `ApexStock` class for its framework
  (create on mount, forward prop/input changes to `update()`, tear down on
  unmount), exposes the instance via a ref, ships its own types/README and a
  runnable browser demo, and peer-depends on this core. They are versioned and
  published independently of `apexstock`.
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
