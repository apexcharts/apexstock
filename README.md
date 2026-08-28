# ApexStock

A comprehensive, feature-rich stock chart library built on top of ApexCharts. ApexStock provides professional-grade financial charting capabilities with technical indicators, drawing tools, theme support, and an intuitive interface.

## Features

- **Multiple Chart Types**: Candlestick, line, area, heikinashi, ohlc, etc
- **Technical Indicators**: 20+ built-in indicators including RSI, MACD, Bollinger Bands, and more
- **Real-time Streaming**: Incremental `appendData()` updates price, indicators, and panes without a full rebuild
- **Events**: Subscribe to `crosshairMove`, `click`, `rangeChange`, `indicatorToggle`, and drawing/marker lifecycle events via `on()` / `off()` / `once()`
- **State Persistence**: `getState()` / `setState()` serialize the theme, chart type, indicators, zoom, drawings, event markers, and the comparison setup to portable JSON
- **Custom Indicators**: Register your own indicators (overlay or oscillator, with optional live streaming) via `ApexStock.registerIndicator()`
- **Trading Overlays**: Order lines, stop-loss, take-profit, and alert price lines (draggable, closable)
- **Drawing Tools**: Interactive mouse toolbar plus a programmatic, price/time-anchored `addDrawing()` API (trend lines, rays, levels, zones)
- **Event Markers**: Time-anchored earnings/dividend/split/news flags on the x-axis with hover cards via `addEventMarker()`
- **Data Legend**: On-chart OHLC + change + volume + indicator readout that tracks the crosshair via `showLegend()`
- **Data Readout API**: `getDataAt(index)` returns structured OHLC + volume + change + all indicator values (overlays and oscillator panes) for custom legends/panels
- **Price Scale Modes**: Linear, logarithmic, percent, and indexed primary-axis scaling via `setPriceScale()`
- **Theme Support**: Light and dark modes plus a curated preset pack (`setThemePreset()`) and `registerTheme()` for custom looks
- **Toolbar Customization**: Hide built-in toolbar sections and inject custom controls via the `toolbar` option or `addToolbarItem()`
- **Zoom Controls**: Interactive zoom and pan functionality
- **Export Capabilities**: One `export({ format })` API for PNG, SVG, PDF, CSV, and JSON
- **Responsive Design**: Adaptive layout for different screen sizes
- **Shadow DOM Support**: Works within Shadow DOM environments

## Dependencies

- **ApexCharts**: The core charting library (required)
- **Modern Browser**: ES6+ support required

## Installation

```bash
npm install apexcharts
npm install apexstock
```

### Framework wrappers

Using a framework? Thin, typed component wrappers live under
[`packages/`](packages/):

- **React** — [`react-apexstock`](packages/react-apexstock) (`npm install react-apexstock`)
- **Vue 3** — [`vue-apexstock`](packages/vue-apexstock) (`npm install vue-apexstock`)
- **Angular** — [`ngx-apexstock`](packages/ngx-apexstock) (`npm install ngx-apexstock`)

Each wrapper ships a runnable browser demo that drives the **real** core (not a
mock) under its `demo/` folder; see the package README for how to run it.

To work on the core and all wrappers together, run any task across every package
in one go (core first, since the wrappers consume its built types):

```bash
npm run packages:install     # install deps in core + every wrapper
npm run packages:build       # build core, then react/vue/ngx
npm run packages:test        # run the test suite of each
npm run packages:typecheck   # type-check each
```

## Basic Usage

> **Provide ApexCharts.** ApexStock calls `new ApexCharts(...)` internally and
> does **not** import it. Load it as a global (`window.ApexCharts`, ideal for
> `<script>` tags) **or**, in a bundler/framework app, inject the imported
> constructor (see [Using a bundler](#using-a-bundler-inject-apexcharts) below)
> so you don't have to touch `window`.
>
> **Data shape (important):** each candle is `{ x, y: [open, high, low, close], v? }`.
> The four prices live in a single `y` array, **not** as separate `o`/`h`/`l`/`c`
> keys. Points missing a valid `x` or a 4-number `y` are dropped.

### Via script tags (UMD)

```html
<div id="chart-container"></div>

<script src="https://cdn.jsdelivr.net/npm/apexcharts"></script>
<script src="https://cdn.jsdelivr.net/npm/apexstock"></script>
<script>
  const apexStock = new ApexStock(
    document.getElementById("chart-container"),
    {
      chart: { height: 600 },
      series: [
        {
          name: "Stock Price",
          data: [
            // { x, y: [open, high, low, close], v: volume (optional) }
            { x: "2024-01-01", y: [100, 110, 95, 105], v: 1000000 },
            { x: "2024-01-02", y: [105, 115, 100, 112], v: 1200000 },
            // ...more bars (ascending by x)
          ],
        },
      ],
      theme: { mode: "light" }, // or "dark"
    }
  );
  apexStock.render();
</script>
```

### With a bundler (ESM)

```javascript
import ApexCharts from "apexcharts";
import ApexStock from "apexstock";
// import "apexstock/apexstock.css"; // optional: the CSS is auto-injected on import

// Inject the imported ApexCharts (no need to touch window). See below.
const apexStock = new ApexStock(
  document.getElementById("chart-container"),
  {
    chart: { height: 600 },
    series: [
      {
        name: "Stock Price",
        data: [
          { x: "2024-01-01", y: [100, 110, 95, 105], v: 1000000 },
          { x: "2024-01-02", y: [105, 115, 100, 112], v: 1200000 },
        ],
      },
    ],
    theme: { mode: "light" },
  },
  { ApexCharts } // <- inject the constructor
);
apexStock.render();
```

### Using a bundler (inject ApexCharts)

In a bundler/framework app, `ApexCharts` is a module local, not
`window.ApexCharts`. Rather than assigning the global yourself, hand ApexStock
the constructor. There are three ways, resolved in this order:

```javascript
import ApexCharts from "apexcharts";
import ApexStock from "apexstock";

// 1) Per instance (third constructor argument):
new ApexStock(el, options, { ApexCharts });

// 2) Once for the whole app (before creating any chart):
ApexStock.setApexCharts(ApexCharts);
new ApexStock(el, options); // picks up the registered constructor

// 3) The global, unchanged — ideal for <script> tags:
window.ApexCharts = ApexCharts;
new ApexStock(el, options);
```

Resolution order per instance is **`options.ApexCharts` → `setApexCharts` default
→ `window.ApexCharts`**. If none resolve, the constructor throws a clear error.

## Chart Options

### Basic Configuration

```javascript
const chartOptions = {
  chart: {
    height: 600, // Chart height in pixels
    id: "my-chart", // Chart ID (auto-generated if not provided)
  },

  series: [
    {
      name: "Stock Price",
      data: [
        // OHLCV data format: prices in a single `y` array.
        {
          x: timestamp, // number (epoch ms) | ISO date string | Date
          y: [
            openPrice, // y[0] open
            highPrice, // y[1] high
            lowPrice, // y[2] low
            closePrice, // y[3] close
          ],
          v: volume, // optional volume
        },
      ],
    },
  ],

  theme: {
    mode: "light", // 'light' or 'dark'
  },

  plotOptions: {
    stockChart: {
      indicators: {
        // Configure available indicators
        rsi: { enabled: true },
        macd: { enabled: true },
        "moving average": { enabled: true },
        "bollinger bands": { enabled: true },
        // ... more indicators
      },
    },
  },
};
```

### Theme Configuration

```javascript
{
  theme: {
    mode: "dark"; // 'light' or 'dark'
  }
}
```

Or start from a **named preset** (a curated look layered on light/dark):

```javascript
{
  theme: { preset: "mint" } // paper | arctic | mint | linen | rose | graphite
}
```

To **restyle the toolbar/UI** (colors, accent, radii) beyond light/dark, override
the `--apexstock-*` CSS custom properties — no stylesheet fork required. See
[THEMING.md](THEMING.md) for the full token reference and override recipe, the
copy-ready `apexstock/theme-template.css`, and `examples/theming.html`.

### Indicator Configuration

You can configure indicators in two ways:

**Object Format (Recommended):**

```javascript
plotOptions: {
  stockChart: {
    indicators: {
      'rsi': { enabled: true },
      'macd': { enabled: true },
      'moving average': { enabled: false },
      'bollinger bands': { enabled: true }
    }
  }
}
```

**Array Format:**

```javascript
plotOptions: {
  stockChart: {
    indicators: ["rsi", "macd", "bollinger bands"];
  }
}
```

## Available Indicators

### Overlays (displayed on main chart)

These indicators are drawn directly on the price chart:

| Indicator                      | Key                            | Description                                                       |
| ------------------------------ | ------------------------------ | ----------------------------------------------------------------- |
| **Moving Average**             | `"moving average"`             | Simple moving average line                                        |
| **Bollinger Bands**            | `"bollinger bands"`            | Price volatility bands (upper, middle, lower)                     |
| **Exponential Moving Average** | `"exponential moving average"` | EMA line with exponential weighting                               |
| **VWAP**                       | `"vwap"`                       | Volume-weighted average price (cumulative; `source: "hlc3"`/`"close"`) |
| **Donchian Channels**          | `"donchian channels"`          | Highest-high / lowest-low band over `period` (default 20)         |
| **Keltner Channels**           | `"keltner channels"`           | EMA midline +/- `multiplier`*ATR band (`emaPeriod` 20, `atrPeriod` 10, `multiplier` 2) |
| **Fibonacci Retracements**     | `"fibonacci retracements"`     | Fibonacci retracement levels (0%, 23.6%, 38.2%, 50%, 61.8%, 100%) |
| **Linear Regression**          | `"linear regression"`          | Linear regression trend line                                      |
| **Ichimoku Cloud Indicator**   | `"ichimoku cloud indicator"`   | Complete Ichimoku system with cloud, lines                        |

### Oscillators (displayed in separate panels)

These indicators are displayed in their own panels below the main chart. Multiple oscillators can be active at once; each gets its own pane, and the panes share the indicator area (evenly by default, or in proportion to a [`heightRatio`](#pane-heights)).

| Oscillator                       | Key                              | Description                                            |
| -------------------------------- | -------------------------------- | ------------------------------------------------------ |
| **RSI**                          | `"rsi"`                          | Relative Strength Index (0-100 scale)                  |
| **MACD**                         | `"macd"`                         | Moving Average Convergence Divergence with signal line |
| **Volumes**                      | `"volumes"`                      | Volume bars showing trading volume                     |
| **Price Volume Trend**           | `"price volume trend"`           | PVT cumulative indicator                               |
| **Stochastic Oscillator**        | `"stochastic oscillator"`        | %K and %D stochastic lines                             |
| **Standard Deviation Indicator** | `"standard deviation indicator"` | Price volatility measure                               |
| **Average Directional Index**    | `"average directional index"`    | ADX trend strength indicator                           |
| **Average True Range**           | `"atr"`                          | ATR volatility (Wilder-smoothed true range)            |
| **Chaikin Oscillator**           | `"chaikin oscillator"`           | Volume-based momentum oscillator                       |
| **Commodity Channel Index**      | `"commodity channel index"`      | CCI overbought/oversold indicator                      |
| **Trend Strength Index**         | `"trend strength index"`         | TSI momentum indicator                                 |
| **Accelerator Oscillator**       | `"accelerator oscillator"`       | Acceleration/deceleration of price movement            |
| **Bollinger Bands %B**           | `"bollinger bands %b"`           | Position within Bollinger Bands (0-1 scale)            |
| **Bollinger Bands Width**        | `"bollinger bands width"`        | Width of Bollinger Bands (volatility measure)          |

One more pane is not a technical indicator but a view of the same series, so it
is listed under an **Analysis** heading in the indicators dropdown:

| Analysis pane | Key | Description |
| --- | --- | --- |
| **Drawdown** | `"drawdown"` | Percent below the running peak, per bar. See [the drawdown pane](#the-drawdown-pane). |

### Usage Examples

**Adding Overlays (multiple allowed):**

```javascript
// Add multiple overlays simultaneously
apexStock.updateIndicator("moving average");
apexStock.updateIndicator("bollinger bands");
apexStock.updateIndicator("fibonacci retracements");
```

**Adding Oscillators (stack as many as you like):**

```javascript
// Each call toggles that oscillator's pane on/off, independently.
apexStock.updateIndicator("rsi");
apexStock.updateIndicator("macd"); // RSI stays; MACD is added below it
apexStock.updateIndicator("volumes"); // three panes now share the indicator area
```

**Configuration in Chart Options:**

```javascript
plotOptions: {
  stockChart: {
    indicators: {
      // Overlays (can have multiple)
      'moving average': { enabled: true },
      'bollinger bands': { enabled: true },
      'exponential moving average': { enabled: true },

      // Oscillators (multiple can be active, each in its own pane)
      'rsi': { enabled: true },
      'macd': { enabled: true },
      'volumes': { enabled: true }
    }
  }
}
```

## Custom Indicators (`registerIndicator`)

Add your own indicators without forking. Register once at app startup (before
constructing charts); registered indicators work with `updateIndicator(key)`,
appear in the indicators dropdown, and round-trip through `getState`/`setState`.

```javascript
// A simple overlay: 20-period highest-high channel top.
ApexStock.registerIndicator("hh channel", {
  type: "overlay", // or "oscillator"
  defaultParams: { period: 20 },
  calc(series, params) {
    const p = params.period;
    // Return one aligned line ((number|null)[])...
    return series.map((_, i) =>
      i < p - 1
        ? null
        : Math.max(...series.slice(i - p + 1, i + 1).map((b) => b.y[1]))
    );
  },
  colors: ["#00E396"],
});

ApexStock.registerIndicator("myosc", { type: "oscillator", yaxis: { min: 0, max: 100 }, calc });

// Then, on any instance created afterwards:
apexStock.updateIndicator("hh channel");
```

`calc(series, params)` can return **one** aligned line (`(number|null)[]`), a
named **multi-line** map (`{ Upper: [...], Lower: [...] }`), or ready-made
ApexCharts **series** (`[{ name, data }]`). Definition fields:

| Field | Description |
| --- | --- |
| `type` | `"overlay"` (on the price chart) or `"oscillator"` (own pane). Required for the declarative form. |
| `calc` | `(series, params) => output`. Required for the declarative form. |
| `defaultParams` | Default params merged into each `calc` call and captured by `getState`. |
| `color` / `colors` | Stroke color(s). |
| `chartType`, `yaxis`, `chartOptions` | Oscillator pane appearance (series type, y-axis, extra ApexCharts options). |
| `label` | Series/display name (defaults to a title-cased key). |
| `stream` | Optional streaming twin for live `appendData()` (see below). |
| `overwrite` | Allow replacing an already-registered key. |

**Advanced form:** pass `{ kind, build/apply/remove }` to plug a raw registry
entry in verbatim for full control over the ApexCharts series/options.

### Introspecting indicators

Enumerate the available indicators (built-in + custom) with their live state to
build a custom picker or settings panel:

```javascript
apexStock.listIndicators();
// [{ key: "rsi", label: "RSI", type: "oscillator", kind: "oscillator",
//    builtin: true, streamable: true, active: false, params: { period: 14 } }, ...]

apexStock.getIndicator("rsi"); // one entry (case-insensitive), or null if unknown
```

Each entry: `key`, `label` (display name), `type` (`"overlay"`/`"oscillator"`
for grouping), `kind` (raw registry kind), `builtin`, `active` (on this
instance), `streamable` (has a live `appendData()` twin), and `params` (current
configurable params, `{}` when none).

### Live streaming for custom indicators

Without a `stream` twin, a custom indicator is recomputed from the full series on
each `appendData()` (correct, but `O(n)`). Provide `stream` for incremental
`O(tail)` updates:

```javascript
ApexStock.registerIndicator("running max", {
  type: "overlay",
  label: "Running Max",
  calc: (series) => series.map((_, i) => Math.max(...series.slice(0, i + 1).map((b) => b.y[3]))),
  stream: {
    seed: (series) => ({ max: Math.max(...series.map((b) => b.y[3])) }),
    step: (state, series) => {
      const close = series[series.length - 1].y[3];
      const max = Math.max(state.max, close);
      return { value: max, state: { max } };
    },
    render: (value, x) => [{ name: "Running Max", point: { x, y: value } }],
  },
});
```

## Public Methods

### Core Methods

#### `render()`

Renders the chart and initializes all components.

```javascript
apexStock.render();
```

#### `update(newOptions)`

Updates the chart with new options while preserving state.

```javascript
apexStock.update({
  series: [{ data: newData }],
  theme: { mode: "dark" },
});
```

#### `destroy()`

Fully tears the chart down: destroys the underlying ApexCharts instances (main
chart + oscillator panes), removes every `window`/`document` listener and
observer the chart added, drops the shared stylesheet (when the last instance in
the scope is gone), and clears all event subscriptions. Idempotent and safe to
call before `render()` or more than once. Call it on unmount so SPA route
changes do not leak. The framework wrappers call it automatically.

```javascript
apexStock.destroy();
```

### Theme Methods

#### `updateTheme(newTheme)`

Changes the chart theme.

```javascript
apexStock.updateTheme("dark"); // or 'light'
```

#### `getTheme()`

Returns the current theme.

```javascript
const currentTheme = apexStock.getTheme(); // 'light' or 'dark'
```

#### Theme presets

A curated, **light-first** pack of named themes layered on light/dark. Each
preset re-tints the candlesticks, grid, background, and accent (and the price
lines follow the accent); the indicator palette stays the base mode's.

```javascript
apexStock.setThemePreset("mint"); // paper | arctic | mint | linen | rose | graphite
apexStock.getThemePreset();       // -> "mint", or null for a plain mode
apexStock.updateTheme("dark");    // clears any preset back to a plain mode

ApexStock.getThemePresets();      // -> all preset names (built-in + registered)

// Register your own (static; usable via theme:{preset} or setThemePreset).
// Missing colors are backfilled from the base mode.
ApexStock.registerTheme("corp", {
  mode: "light",
  up: "#2ecc71",
  down: "#e74c3c",
  grid: "#eef0f3",
  axis: "#334155",
  background: "#ffffff",
  accent: "#0a3d62",
});
```

Presets survive theme/chart-type switches and data updates, and the active
preset is captured by `getState()` (as `theme.preset`) and restored by
`setState()`.

### Indicator Methods

#### `updateIndicator(indicatorKey[, params])`

With one argument, **toggles** an indicator on/off. With a `params` object, sets
the indicator's parameters and ensures it is active (it never toggles off) —
inactive indicators are added, active ones are recomputed in place.

```javascript
apexStock.updateIndicator("rsi"); // toggle on/off
apexStock.updateIndicator("moving average");

apexStock.updateIndicator("rsi", { period: 21 }); // set params + ensure active
apexStock.updateIndicator("moving average", { period: 5 });
```

#### `setIndicatorParams(indicatorKey, params)`

Explicit form of the params overload above (chainable). Makes overlay periods
(e.g. moving average) configurable too.

```javascript
apexStock.setIndicatorParams("macd", { fastPeriod: 8, slowPeriod: 21 });
```

#### `removeIndicator(indicatorKey)`

Removes a specific indicator.

```javascript
apexStock.removeIndicator("rsi");
```

#### `getVisibleRange()` / `setVisibleRange(min, max)`

Read or set the visible x-axis window (same values as the `rangeChange` event).
`setVisibleRange` zooms the main chart and every pane and fires `rangeChange`.

```javascript
const { min, max } = apexStock.getVisibleRange();
apexStock.setVisibleRange(Date.UTC(2024, 0, 1), Date.UTC(2024, 5, 30));
```

### Chart Configuration Methods

#### `updateChartOptions(newOptions)`

Updates chart options with theme handling.

```javascript
apexStock.updateChartOptions({
  chart: { height: 800 },
  theme: { mode: "dark" },
});
```

### Technical Analysis Methods

#### Moving Averages

```javascript
const ma = apexStock.calculateMovingAverage(series, period);
const ema = apexStock.calculateEMA(series, period);
```

#### Oscillators

```javascript
const rsi = apexStock.calculateRSI(series, period);
const macd = apexStock.calculateMACD(
  series,
  fastPeriod,
  slowPeriod,
  signalPeriod
);
const stochastic = apexStock.calculateStochastic(series, period, smoothPeriod);
```

#### Volatility Indicators

```javascript
const bb = apexStock.calculateBollingerBands(series, period, stdDev);
const stdDev = apexStock.calculateStdDevIndicator(series, period);
```

#### Volume Indicators

```javascript
const pvt = apexStock.calculatePVT(series);
const chaikin = apexStock.calculateChaikinOsc(series, shortPeriod, longPeriod);
```

#### Trend Indicators

```javascript
const adx = apexStock.calculateADX(series, period);
const cci = apexStock.calculateCCI(series, period);
const tsi = apexStock.calculateTSI(series, longPeriod, shortPeriod);
```

#### Advanced Indicators

```javascript
const ichimoku = apexStock.calculateIchimoku(series);
const fibonacci = apexStock.calculateFibonacciRetracements(series);
const linearReg = apexStock.calculateLinearRegression(series, period);
```

## Events

Subscribe to chart events with `on(name, handler)`. It returns an unsubscribe
function; `off(name, handler?)` and `once(name, handler)` are also available.
Subscribing is safe any time after construction, including before `render()`.

```javascript
const off = apexStock.on("crosshairMove", (e) => {
  if (e.dataPointIndex < 0) return; // pointer is not over a candle
  console.log(e.x, e.ohlc.close, e.volume);
});

apexStock.on("rangeChange", ({ min, max, source }) => {
  // source: "zoom" | "pan" | "reset"
  loadDataForRange(min, max);
});

apexStock.on("indicatorToggle", ({ key, active }) => {
  console.log(key, active ? "added" : "removed");
});

off(); // stop listening
```

| Event | Payload | Fires when |
| --- | --- | --- |
| `crosshairMove` | `{ dataPointIndex, seriesIndex, x, ohlc, volume, nativeEvent }` | The pointer moves over the price chart. `dataPointIndex` is `-1` (and `x`/`ohlc`/`volume` are `null`) when not over a candle. |
| `click` | same as `crosshairMove` | The price chart is clicked. |
| `rangeChange` | `{ min, max, source }` | The visible x-range changes. `source` is `"zoom"`, `"pan"`, or `"reset"`. |
| `indicatorToggle` | `{ key, active }` | An indicator is added (`active: true`) or removed (`active: false`). |
| `drawingAdded` / `drawingUpdated` | `{ id, drawing }` | A programmatic drawing is added or patched. `drawingRemoved` fires `{ id }`; `drawingsCleared` fires `{}`. |
| `eventMarkerAdded` / `eventMarkerUpdated` | `{ id, marker }` | An event marker is added or patched. `eventMarkerRemoved` fires `{ id }`; `eventMarkersCleared` fires `{}`. |
| `eventMarkerHover` / `eventMarkerClick` | `{ id, marker, nativeEvent }` | The pointer enters or clicks a marker badge. |
| `priceScaleChange` | `{ mode, base, logBase, indexBase }` | The primary price-axis scale mode changes (`setPriceScale`). |
| `rangeMeasured` | `{ id, stats, selection, drawing, source }` | A measurement settles (created, or its anchors moved). One event per change, never on a plain zoom. See [the `rangeMeasured` event](#the-rangemeasured-event). |
| `measurementRemoved` | `{ id }` | A measurement is cleared. |
| `comparisonChange` | `{ reason, mode, benchmark, baseline, instruments, stats, warnings }` | The comparison set, mode, benchmark, or baseline changes. `stats` is the recomputed [leaderboard](#the-leaderboard). |

`emit(name, payload)` is also exposed so you can bridge your own events through
the same bus. All subscriptions are dropped automatically on `destroy()`.

### Data readout at a point (`getDataAt`)

`getDataAt(index)` returns a structured, read-only snapshot at a data-point
index: OHLC, volume, change vs the previous close, and **every active indicator's
value** (main-chart overlays *and* oscillator panes). It's the programmatic
complement to the on-chart legend: pair it with the `crosshairMove` event's
`dataPointIndex` to build your own legend, side panel, or tooltip.

```javascript
apexStock.on("crosshairMove", (e) => {
  if (e.dataPointIndex < 0) return;
  const d = apexStock.getDataAt(e.dataPointIndex);
  // {
  //   index, x,                                  // bar index + timestamp (ms)
  //   ohlc: { open, high, low, close },
  //   volume,                                    // or null
  //   change: { absolute, percent } | null,      // vs the previous close
  //   indicators: [                              // overlays + oscillator panes
  //     { name: "MA 20", value: 128.4, color: "#7D57C2", pane: "main" },
  //     { key: "rsi", name: "RSI", value: 61.2, color: "#7D57C2", pane: "rsi" }
  //   ]
  // }
});

apexStock.getDataAt();     // no argument -> the latest bar
```

Values are plain numbers (unformatted); unavailable ones are `null` (volume,
change) or omitted (an indicator still in its warm-up period). Returns `null`
when there's no data.

## Analysis: range statistics and drawdown

The analysis engine answers the two questions a price line cannot: *what
happened over this stretch*, and *what did holding it feel like*. It is pure and
memoized, so it also runs with no chart at all (a server-side report, a test, a
worker) via the `ApexStock.stats` static namespace.

### Measuring a region (`measureRange`)

Drag the **Measure** tool from the drawing toolbar across a stretch of the chart,
or create one in code, and ApexStock reports what happened over it:

```javascript
const { id, stats } = apexStock.measureRange("2024-01-02", "2024-03-15");

apexStock.getMeasurements();     // [{ id, from, to, selection, stats }]
apexStock.getMeasurement(id);
apexStock.clearMeasurement(id);  // or clearMeasurement() for all of them
```

A measurement **is** a `measure` drawing, so it renders on the chart, can be
selected and dragged, stays anchored to its bars through zoom and pan, and
persists through `getState()` / `setState()` with the rest of your drawings. No
separate save path, no separate API.

The on-chart box gets a two-line readout, and the **analysis panel** appears
alongside it with the full region statistics: change, duration, true high and
low, average price and volume, volatility, annualized return, max drawdown, and
how long the decline and the recovery took.

#### Two changes, both named

A measurement reports two different moves, and conflating them is the easy
mistake:

| Field | What it is |
| --- | --- |
| `stats.change` | The instrument's **close-to-close** move over the bars the selection spans. Every other statistic (the averages, the volatility, the drawdown) is consistent with this one, because they are all properties of the series. |
| `selection` | The delta between the two **anchors you dragged**. This is what the box's height shows, and the right number when you measure a swing from one bar's low to another's high. |

They are identical when the anchors sit on the closes (which is what
`measureRange` does). Set `analysis: { measure: { snap: true } }` to pull
hand-drawn anchors onto the bar values too, and the two agree by construction.

#### The analysis panel

Automatic by default: it appears when a measurement exists and disappears when
the last one is cleared, so a chart nobody has measured on carries no extra
chrome.

```javascript
new ApexStock(el, {
  chart: { height: 500 },
  series: [{ name: "AAPL", data }],
  analysis: {
    panel: {
      position: "top-right",          // opposite corner from the legend
      metrics: ["change", "duration", "high", "low", "drawdown"],
      formatters: {
        price: (v) => `$${v.toFixed(2)}`,
        date: (x) => new Date(x).toLocaleDateString(),
      },
    },
    measure: {
      snap: true,                     // or "high" / "low" / "open" / "close"
      label: (stats) => [`${stats.change.percent.toFixed(1)}%`, `${stats.bars} bars`],
    },
  },
});

apexStock.showAnalysisPanel({ position: "bottom-left" });  // pin it open
apexStock.hideAnalysisPanel();
apexStock.isAnalysisPanelVisible();
```

Available metrics: `change`, `selection`, `duration`, `high`, `low`, `average`,
`volume`, `volatility`, `annualized`, `drawdown`, `recovery`. Each row carries a
`data-metric` attribute and a stable class, so you can restyle it. Set
`analysis: { panel: false }` for **headless** use: no panel, no chrome, and you
render your own from `getRangeStats()`.

Statistics conventions (`periodsPerYear`, `minAnnualizeDays`, `drawdownBasis`,
`source`) are chart-level, not per-measurement, so a measurement restored from
state can never disagree with the chart it is on.

#### The `rangeMeasured` event

```javascript
apexStock.on("rangeMeasured", ({ id, stats, selection, source }) => {
  // source: "drag" | "api" | "coreRuler"
  console.log(stats.change.percent, stats.drawdown.max);
});

apexStock.on("measurementRemoved", ({ id }) => { /* ... */ });
```

It fires when a measurement **settles**, not on every drag frame: one drag
produces one event, and a plain zoom or pan produces none.

#### Using ApexCharts' measure ruler

ApexCharts ships its own measure ruler as an opt-in feature bundle. ApexStock
does not require it, but if you load it, ApexStock feeds it the same financial
readout and re-emits its result on the same event, so the two gestures never
disagree:

```javascript
import "apexcharts/features/measure";   // or dist/features/measure.js

new ApexStock(el, {
  chart: { height: 500, measure: { enabled: true } },   // hold "m" and drag
  series: [{ name: "AAPL", data }],
});

apexStock.on("rangeMeasured", (e) => e.source === "coreRuler" && render(e.stats));
```

ApexStock keeps its own measure drawing as the primary gesture for two reasons:
the core ruler's pins live on the chart instance rather than in ApexStock's
state (so they would not survive `getState()`/`setState()`), and its numbers are
geometric only (`dx`, `dy`, `%`, slope) with no view of the high, low, volume,
volatility, or drawdown across the span.

### Range statistics (`getRangeStats`)

Every statistic for a selected region, in one object:

```javascript
const stats = apexStock.getRangeStats(0, 42);              // by bar index
apexStock.getRangeStats("2024-01-02", "2024-03-15");       // by date
const { min, max } = apexStock.getVisibleRange();
apexStock.getRangeStats(min, max);                         // the visible window

// {
//   from:   { index: 0,  x: 1704153600000, value: 142 },
//   to:     { index: 42, x: 1707696000000, value: 171 },
//   change: { absolute: 29, percent: 20.42 },
//   bars: 43, upBars: 24, downBars: 18, flatBars: 0,
//   spanMs: 3542400000, calendarDays: 41,
//   annualized: { return: 18.4, basis: "calendar" } | null,
//   high: { value: 174.2, index: 39, x: ... },
//   low:  { value: 138.9, index: 3,  x: ... },
//   average: { close: 156.4, volume: 41200000 },
//   total:   { volume: 1771600000 },
//   volatility: { stdev: 1.31, annualized: 20.8, periodsPerYear: 252, inferred: true },
//   drawdown: {
//     max: -6.4,                       // percent below the peak
//     peak:   { index: 12, x: ..., value: 160.1 },
//     trough: { index: 19, x: ..., value: 149.8 },
//     recovery: { index: 27, x: ... } | null,
//     barsToTrough: 7,                 // peak -> trough   (the decline)
//     barsToRecovery: 8,               // trough -> peak   (the recovery)
//     barsUnderwater: 15,              // peak -> recovery (whole episode)
//     recovered: true
//   },
//   basis: { source: "close", drawdown: "close" },
//   warnings: []
// }
```

Endpoints may be given in either order as a bar index, an epoch-ms `x` value, a
`Date`, or a date string. A bare number is read as a bar index when it is a
valid one and as an `x` value otherwise, which is unambiguous for timestamps;
pass `{ by: "index" }` or `{ by: "x" }` to be explicit.

**Three contracts worth knowing:**

1. **Values are unrounded.** Statistics come back as plain numbers so they stay
   faithful; your UI formats them. (Same contract as `getDataAt`.)
2. **Every percent-like value is in percent units.** `change.percent: 20.42`
   means +20.42%, `drawdown.max: -6.4` means 6.4% below the peak. No fractions
   mixed in with percentages.
3. **Anything the data cannot support is `null`**, never `0` and never `NaN`, and
   the reason lands in `warnings`. In particular:
   - `annualized` is omitted for spans under `minAnnualizeDays` (default 30),
     because extrapolating a 3-day move to a yearly figure is misleading.
   - `volatility.annualized` is omitted for intraday bars unless you pass
     `periodsPerYear`, because annualizing intraday volatility depends on the
     session length (6.5h equity session? 24h crypto?) and guessing it would
     produce an authoritative-looking wrong number.
   - `bars` is a **bar** count, and is called one. A true trading-session count
     needs a per-exchange holiday calendar, which ApexStock does not own.

### Drawdown (`getDrawdown`)

How far below its own running peak the instrument has fallen at every bar, plus
each drawdown episode:

```javascript
const dd = apexStock.getDrawdown();

// {
//   values: [0, 0, -1.2, -4.8, ...],   // percent, <= 0, aligned to the series
//   points: [{ x, y }, ...],           // the same, ready to plot
//   max: -27.4,                        // the deepest
//   maxEpisodeIndex: 2,
//   current: -3.1,                     // at the last bar
//   episodes: [{ peak, trough, recovery, depth, barsToTrough,
//                barsToRecovery, barsUnderwater, ongoing }],
//   basis: "close"
// }

apexStock.getDrawdown({ basis: "intrabar" });   // low vs running high
```

`basis: "intrabar"` measures each bar's low against the running high instead of
close-against-close. It is strictly more conservative, and the right basis for a
stop-loss or margin question. It defaults to the chart's
`analysis.drawdownBasis`, so this, the range statistics, and the drawdown pane
all report the same figure.

### The drawdown pane

The same numbers as a chart: price on top, how far underwater it is below, on one
shared x-axis and one shared zoom.

```javascript
apexStock.updateIndicator("drawdown");   // toggles the pane on (and off again)
```

It is an ordinary pane, listed under **Analysis** in the indicators dropdown, so
everything that works for RSI works here: it stacks with other panes, follows the
zoom, survives a theme or chart-type switch, reports through `getDataAt`,
round-trips through `getState()`/`setState()`, and updates incrementally on
`appendData` (its running peak makes that O(1), with no warm-up period).

The pane plots percent below the peak, with zero pinned to the top of the axis
(a drawdown is never positive) and the deepest point labelled on the pane itself.
It measures on the chart's `analysis.drawdownBasis`, so the pane and
`getRangeStats()` cannot disagree.

#### Pane heights

A drawdown pane is cumulative, so it earns more room than a bounded oscillator:
it takes 1.4 shares of the indicator area where others take 1. Ratios are
relative, and configurable per pane:

```javascript
new ApexStock(el, {
  series: [{ name: "AAPL", data: bars }],
  panes: { drawdown: { heightRatio: 2 } },   // twice an RSI pane's height
});

apexStock.setPaneHeightRatio("drawdown", 3);  // at runtime
apexStock.setPaneHeightRatio("drawdown", null); // back to the pane's default
apexStock.getPaneHeightRatios();              // -> { drawdown: { heightRatio: 3 } }
```

The panes always add up to the indicator area exactly, so no gap opens at the
bottom, and the ratios you set are captured by `getState()` (as `panes`).

### Configuration

Set the defaults once on the constructor, override per call:

```javascript
new ApexStock(el, {
  chart: { height: 500 },
  series: [{ name: "AAPL", data }],
  analysis: {
    source: "close",            // which OHLC field the anchors and averages read
    drawdownBasis: "close",     // or "intrabar"
    periodsPerYear: 252,        // annualization convention; inferred when absent
    minAnnualizeDays: 30,
  },
});

apexStock.getRangeStats(0, 42, { drawdownBasis: "intrabar" });
```

`periodsPerYear` is inferred from the median bar spacing when you do not set it
(daily to 252, weekly to 52, monthly to 12), and the result says so via
`volatility.inferred` plus a `warnings` entry.

### Headless use (`ApexStock.stats`)

The whole engine is available as a static namespace, so nothing here needs a
chart, a DOM, or a browser:

```javascript
import ApexStock from "apexstock";

ApexStock.stats.rangeStats(series, "2024-01-02", "2024-03-15");
ApexStock.stats.drawdown(series);
ApexStock.stats.returns(series, { mode: "simple" });   // { mode, values, points }
ApexStock.stats.volatility(series, 0, 251, { periodsPerYear: 252 });
ApexStock.stats.annualize(21, 730);                    // -> { return: 10, basis }
ApexStock.stats.inferPeriodsPerYear(series);
```

### Aligning multiple instruments

`ApexStock.stats.align` is the primitive behind comparing instruments that do
not share a calendar, which is the normal case: different listings, different
exchanges, different holidays, feeds with holes.

```javascript
const aligned = ApexStock.stats.align(
  { AAPL: aaplData, MSFT: msftData, SPY: spyData },
  {
    primary: "AAPL",
    join: "primary",   // "primary" | "intersection" | "union"
    fill: "hold",      // "hold" | "gap" | "drop"
  }
);
// { x, columns: { AAPL: [...], MSFT: [...], SPY: [...] }, coverage, warnings }

// 100 = starting value, on the first date every instrument actually has data.
const { columns } = ApexStock.stats.rebase(aligned, {
  mode: "indexed",     // "percent" | "indexed" | "absolute"
  baseline: "common",  // "common" | "own" | "visible" | <x value>
  indexBase: 100,
});

// Relative performance. The benchmark is a role, filled by any instrument.
ApexStock.stats.relative(aligned, "AAPL", "SPY", { mode: "spread" }); // pct points
ApexStock.stats.relative(aligned, "AAPL", "SPY", { mode: "ratio" });  // A / B
```

- `join` picks the x grid: the primary's own dates (default), only dates every
  instrument shares (`intersection`), or every date seen (`union`).
- `fill` decides what an unobserved grid point becomes: the last observation
  carried forward (`hold`, the finance default, so one market's holiday does not
  put a hole in the line), a visible break (`gap`), or a removed row (`drop`).
- One rule overrides `fill` everywhere: a point **before** an instrument's first
  observation is always `null`. Carrying a value backwards would invent history.
- `baseline: "common"` is the default because it is the only policy under which
  instruments with different start dates are actually comparable. `coverage`
  reports how many points were carried forward, so you can disclose it.

## State Persistence (`getState` / `setState`)

Capture the chart's configurable state as portable JSON and restore it later,
so a user's layout survives a reload or moves between sessions and devices.

```javascript
// Save (after render) — e.g. persist per user/workspace.
const state = apexStock.getState();
localStorage.setItem("chart-state", JSON.stringify(state));

// Restore (after render) on the same or a new instance.
const saved = JSON.parse(localStorage.getItem("chart-state"));
apexStock.setState(saved);
```

`getState()` returns a schema-versioned, `JSON.stringify`-safe object:

```javascript
{
  version: 2,
  theme: { mode: "light" },      // or "dark"
  chartType: "candlestick",       // active type (candlestick, heikinashi, renko, line, area, ohlc, ...)
  indicators: [                   // active indicators, in application order
    { key: "moving average", params: {} },
    { key: "rsi", params: { period: 14 } }
  ],
  drawings: [                     // data-space drawings (trend/ray/level lines, zones, ...)
    { type: "line", x1: 1577836800000, y1: 130, x2: 1580515200000, y2: 145, /* ... */ }
  ],
  eventMarkers: [                 // time-anchored event markers
    { x: 1577836800000, type: "earnings", label: "Q1 earnings" }
  ],
  annotations: [                  // data-space annotations (y/x lines, bands, points, text)
    { type: "yLine", y: 130, label: "resistance" }
  ],
  priceLines: [                   // trading price lines (declarative config; no callbacks)
    { type: "stop-loss", price: 96, draggable: true }
  ],
  priceScale: { mode: "logarithmic", base: null, logBase: 10, indexBase: 100 }, // or null (default linear)
  panes: {                        // pane height ratios you set, or null
    drawdown: { heightRatio: 2 }
  },
  comparison: {                   // multi-instrument comparison, or null
    mode: "indexed",
    benchmark: "SPY",             // or "__primary__"
    options: { join: "union", fill: "hold", baseline: "common", /* ... */ },
    instruments: [{ name: "SPY", color: "#FEB019" }]  // identity only, no data
  },
  zoom: { minX: 1577836800000, maxX: 1580515200000 } // visible x-range, or null
}
```

`setState(state)` reconciles the live chart to that snapshot: it switches theme
and chart type, adds/removes indicators (restoring their params), keeps the
toolbar selection in sync, restores the drawings, event markers, annotations,
price lines, price-scale mode, pane heights, and comparison setup, and restores the zoom. It accepts any supported version (older
states are migrated automatically; `ApexStock.migrateState(state)` does the same
up-front). Call `setState` after `render()`.

Measurements need no key of their own: a measurement *is* a `measure` drawing,
so it round-trips inside `drawings` with everything else you have drawn.

### What the consumer owns

Two things are captured by *reference* rather than by value, because they are
yours, not the chart's:

**A price line's interactive callbacks** (`onCross` / `onMove` / `onRemove`) are
not serializable, so only the declarative config is captured. Re-bind them after
`setState` if you use them, e.g. `updatePriceLine(id, { onCross })`.

**A comparison instrument's price data** is fetched by your app, runs to
thousands of bars per instrument, and would be stale the moment it was written to
storage. So state carries each instrument's *name and color*, and `setState`
tells you which ones need their data back:

```javascript
apexStock.on("comparisonRestoreNeeded", ({ names }) => {
  names.forEach((name) => {
    apexStock.addComparison({ name, data: myCache[name] }); // color remembered
  });
});
apexStock.setState(saved);
```

The mode, benchmark, and alignment policy come back on their own, so the chart is
already configured when the data arrives, and a re-supplied instrument returns in
the color it had. An instrument whose data is *still loaded* is kept as it is, so
a save/restore inside a live session costs no round trip and the event does not
fire at all. A benchmark whose instrument has not come back yet is remembered by
name; the primary symbol fills the role until it does.

## Real-time Streaming (`appendData`)

For live data, `appendData` adds a bar (or updates the forming one) and refreshes
the price candles, every active overlay and oscillator pane, the volume pane, and
the x-axis incrementally, in `O(active indicators x small tail)` instead of the
full teardown/rebuild `update()` performs.

```javascript
apexStock.appendData(point | point[], options);
```

- **`point`** — an OHLC bar `{ x, y: [o, h, l, c], v? }` (or an array for a batch).
  Malformed points are dropped, like the constructor.
- **`options.view`** — `"follow"` (default) keeps the latest bars in view (shifts a
  zoomed window to the right edge); `"preserve"` keeps the current zoom window.
- **`options.maxPoints`** — rolling-window cap: trims the oldest bars from the
  front so the buffer stays fixed-width. Running indicators keep their carried
  state, so their values reflect all history seen (no jump when old bars age out).
- **`options.updateLast`** — when the incoming `x` equals the last bar's `x`,
  replace that (forming) bar instead of appending.

```javascript
// A completed bar arrived -> append it, ride the right edge.
apexStock.appendData({ x: t, y: [o, h, l, c], v }, { view: "follow" });

// Live ticker with a fixed 500-bar window.
apexStock.appendData(bar, { maxPoints: 500 });
```

### Tick-aggregation recipes

Consumers feed bars; ApexStock renders them. Two patterns cover building bars from
a raw tick/trade feed:

**1. Append completed bars.** Roll trades into bars yourself (or with the built-in
`ApexStock.aggregateOHLC`), then append each finished bar:

```javascript
// Roll a 1-minute series up to 5-minute bars, then stream the closed ones.
const fiveMin = ApexStock.aggregateOHLC(oneMinSeries, "5m");
apexStock.appendData(fiveMin[fiveMin.length - 1]);
// Accepted intervals: ApexStock.INTERVALS (e.g. "1m","5m","15m","1h","4h","1d","1w","1M").
```

**2. Forming candle (`updateLast`).** Keep the in-progress bar live as ticks
arrive, then start a new bar when the period rolls over:

```javascript
let bar = null; // the bar currently forming

function onTrade({ time, price, size }) {
  const bucket = Math.floor(time / 60000) * 60000; // 1-minute buckets
  if (!bar || bar.x !== bucket) {
    // New period: the previous bar has closed; start a fresh forming bar.
    bar = { x: bucket, y: [price, price, price, price], v: size };
  } else {
    // Same period: fold the trade into the forming bar.
    bar.y[1] = Math.max(bar.y[1], price); // high
    bar.y[2] = Math.min(bar.y[2], price); // low
    bar.y[3] = price; // close
    bar.v += size;
  }
  apexStock.appendData(bar, { updateLast: true });
}
```

Both keep indicators exact: a forming bar's indicator values recompute from the
last committed state each tick, and the bar's close commits in O(1).

## Trading Overlays (price lines)

Horizontal price lines for order/stop-loss/take-profit/alert levels. They persist
across zoom, theme change, chart-type switch, and streaming appends.

```javascript
const id = apexStock.addOrderLine({ price: 98.5, side: "buy", label: "Entry" });
apexStock.addStopLoss({ price: 95 });
apexStock.addTakeProfit({ price: 104 });
apexStock.addAlert({ price: 100, onCross: (e) => notify(e.direction) });

apexStock.updatePriceLine(id, { price: 97 }); // reprice
apexStock.removePriceLine(id);
apexStock.clearPriceLines();
apexStock.getPriceLines(); // -> array of line configs
```

`addPriceLine(config)` is the generic form; `addOrderLine` / `addStopLoss` /
`addTakeProfit` / `addAlert` are typed shortcuts. Config fields:

| Field | Description |
| --- | --- |
| `price` | Required. The y level for the line. |
| `id` | Stable id; auto-generated when omitted. |
| `side` | `"buy"` / `"sell"` for order lines (drives the default color). |
| `label`, `color`, `textColor`, `strokeDashArray`, `width`, `labelPosition` | Appearance. Colors default from the themeable `colors.tradingOverlays` group. |
| `draggable` | Drag the line vertically to reprice it; fires `onMove({id, price})` on drop. |
| `closable` | Shows a ✕ button; clicking it removes the line and fires `onRemove({id})`. |
| `onCross` | Fired as `{id, type, price, direction, bar}` when a closed bar (from `appendData`) crosses the line. |
| `meta` | Arbitrary payload returned by `getPriceLine`/`getPriceLines`. |

## Comparison mode (multi-symbol)

Overlay additional instruments to compare their movement against the primary
symbol. Because compared tickers rarely share the primary's price scale, they
render as lines on a dedicated **secondary y-axis**; the primary candlestick and
indicators keep their own axis.

```javascript
apexStock.addComparison({ name: "MSFT", data: msftBars }); // data: [{x, y}] or OHLC (uses `source`)
apexStock.addComparison({ name: "NVDA", data: nvdaBars });
apexStock.addComparison({ name: "SPY", data: spyBars, color: "#FEB019" });

apexStock.setComparisonMode("percent");  // % change from the baseline (default)
apexStock.setComparisonMode("indexed");  // 100 = starting value
apexStock.setComparisonMode("absolute"); // raw prices

apexStock.getComparisons(); // -> [{ name, color, points }]
apexStock.removeComparison("SPY");
apexStock.clearComparisons();
```

| Mode | What the line shows |
| --- | --- |
| `percent` (default) | Percent change from the baseline. The "who's up more" view. |
| `indexed` | An index where the baseline reads `indexBase` (default 100). |
| `absolute` | Raw close prices (best for same-scale peers). |
| `relative` | `percentChange(asset) - percentChange(benchmark)`, in percentage points. Zero means "kept pace". |
| `ratio` | `asset / benchmark`, rebased so the baseline reads `indexBase`. A rising line means outperformance. |

Comparisons persist across zoom, theme changes, chart-type switches, indicator
toggles, and `appendData`. The compared instrument's data is supplied by you
(ApexStock does not fetch it); pass `[{x, y}]` closes or full OHLC bars.

### Instruments with different histories

Instruments do not share a calendar: a newer listing starts later, exchanges keep
different holidays, and a feed can simply be missing a day. Every instrument
(**the primary included**) is put on one shared x grid before anything is
normalized, so the comparison is fair by construction rather than by luck.

```javascript
apexStock.setComparisonOptions({
  join: "union",        // "union" (default) | "primary" | "intersection"
  fill: "hold",         // "hold" (default) | "gap" | "drop"
  baseline: "common",   // "common" (default) | "own" | "visible" | <x value>
  indexBase: 100,       // baseline value for `indexed` and `ratio`
  source: "close",      // which OHLC field every instrument is compared on
});
```

- **`baseline: "common"`** rebases everything at the first x where *all* of them
  have data. That is the only basis on which lines with different start dates are
  comparable, so it is the default. History before that point still plots, as a
  negative percent, rather than being hidden.
- **`baseline: "own"`** is each instrument's own first point (the pre-0.5.0
  behavior), and **`"visible"`** follows the zoom: rebasing to the left edge of
  the window as you navigate.
- **`fill: "hold"`** carries the last observation across a hole so the math lines
  up; a carried-forward value is never *plotted*, so a line never shows a bar its
  instrument does not have. `getComparisonStats()` reports how many points were
  filled. `"gap"` leaves the hole, and `"drop"` removes x values not everyone has.
- **`join: "primary"`** resamples every instrument onto the primary's bars
  (useful for mixed bar spacings, and it plots the resampled grid);
  `"intersection"` keeps only x values every instrument has.

A single-instrument comparison on a matching calendar behaves exactly as before:
these policies only start to matter once the histories differ.

### Benchmarks and relative performance

The benchmark is a **role**, not a ticker: point it at any added instrument, or
at `"__primary__"` (the default) for the chart's own symbol. Nothing in ApexStock
hard-codes a benchmark symbol.

```javascript
apexStock.setComparisonBenchmark("SPY"); // any added instrument, or "__primary__"
apexStock.setComparisonMode("relative"); // excess return, in percentage points
```

In `relative` and `ratio` mode the benchmark's own line becomes the flat
reference (zero, or `indexBase`), so what everything is measured against is
visible on the chart. Removing the instrument that fills the role hands it back
to the primary.

### The leaderboard

`getComparisonStats()` returns the table you would otherwise have to recompute:
one row per instrument, the primary included, ranked by performance.

```javascript
const rows = apexStock.getComparisonStats();
// [{ name: "NVDA", rank: 1, change: { absolute, percent }, relative,
//    start, end, from, to, high, low, volatility, drawdown, bars,
//    coverage: { bars, filled, firstX, lastX }, primary, benchmark, color }, ...]

apexStock.getComparisonStats({ from: "2024-06-01", to: "2024-09-30" }); // scoped
```

The window runs from the baseline to the last observation, so with
`baseline: "visible"` the rows follow the zoom. Every row is computed from
`source` (close by default) for *every* instrument, so the rows are comparable
with each other; `getRangeStats()` is the OHLC-aware path for the primary alone.
Volatility and drawdown are measured on each instrument's **own** observations,
so a weekly line on a daily grid is not annualized as if it had 252 bars a year.

The same rows arrive with the `comparisonChange` event, which fires when the
instrument set, mode, benchmark, or baseline changes:

```javascript
apexStock.on("comparisonChange", ({ reason, mode, benchmark, stats, warnings }) => {
  renderLeaderboard(stats); // already computed, nothing to recalculate
});
```

Defaults can be set declaratively at construction, before any data arrives:

```javascript
new ApexStock(el, {
  series: [{ name: "AAPL", data: bars }],
  analysis: {
    comparison: { mode: "relative", benchmark: "SPY", baseline: "common" },
  },
});
```

A benchmark named here is remembered until its instrument is added; until then
the primary fills the role and says so in `warnings`. Anything the data cannot
support is `null` rather than a plausible-looking zero, with the reason in
`warnings`, the same contract as the rest of the analysis layer.

See [`examples/comparison.html`](examples/comparison.html) for the whole surface:
four instruments with four different histories, every mode, a live leaderboard.

## Price scale modes

Control how the **primary price axis** is scaled and labelled, the way analysts
expect from a price-scale menu:

```javascript
apexStock.setPriceScale("linear");                  // raw price, evenly spaced (default)
apexStock.setPriceScale("logarithmic");             // log-distributed price axis
apexStock.setPriceScale("logarithmic", { logBase: 2 });
apexStock.setPriceScale("percent");                 // % change from the first bar
apexStock.setPriceScale("percent", { base: 100 });  // ...or from an explicit baseline
apexStock.setPriceScale("indexed");                 // index where the baseline = 100
apexStock.setPriceScale("indexed", { indexBase: 1000 });

apexStock.getPriceScale(); // -> { mode, base, logBase, indexBase }
```

Or set it up front:

```javascript
new ApexStock(el, {
  chart: { height: 460 },
  series: [{ name: "AAPL", data }],
  priceScale: { mode: "logarithmic" },
});
```

- **`linear`** and **`logarithmic`** change how price is *distributed* on the
  axis (log makes equal percentage moves look equal). Logarithmic is delegated
  to ApexCharts' native log axis.
- **`percent`** and **`indexed`** are affine relabelings of price, so they leave
  the gridlines where they are and only change the labels. Because nothing is
  transformed in *data* space, your indicators, drawings, annotations, and
  trading price lines stay in true price space and are completely unaffected.

The mode persists across theme changes, chart-type switches, and `appendData`
(the percent/indexed baseline is recomputed from the current first bar), is
captured by `getState()`, and fires a `priceScaleChange` event. This is distinct
from comparison mode's `percent`, which normalizes *overlaid instruments*.

## Toolbar customization

Hide built-in toolbar sections and inject your own controls, either up front via
the `toolbar` option or at runtime.

```javascript
new ApexStock(el, {
  series: [{ name: "AAPL", data }],
  toolbar: {
    // show: false,               // hide the entire primary toolbar
    items: { download: false },   // hide a built-in section:
    //   chartType | indicators | drawing | download   (all shown by default)
    custom: [
      {
        id: "refresh",
        title: "Refresh",             // tooltip + aria-label (and label if no icon)
        icon: "<svg>...</svg>",       // inline SVG/HTML (or `html`, or a ready-made `element`)
        position: "right",            // "left" | "left-start" | "right" (default "right")
        order: 0,                     // sort within the side
        onClick: (chart, e) => chart.appendData(nextBar()),
      },
    ],
  },
});
```

Runtime API:

```javascript
apexStock.addToolbarItem({ id: "snap", title: "Snapshot", onClick: (c) => c.export({ format: "png", download: true }) });
apexStock.getToolbarItems();       // -> [{ id, title, position }]
apexStock.removeToolbarItem("snap");
```

Custom buttons pick up the active theme automatically. (`items.drawing`
shows/hides the whole drawing toolbar; toggling its individual tools is a
separate drawing-tools option.)

## Annotations (data-space)

Place lines, bands, points, and text at **data coordinates** (price/time).
Unlike the freehand drawing tools (screen space) and the trading price lines,
these are a general, id-based API and persist across update/theme/chart-type
switches.

```javascript
// Horizontal line + shaded price band
apexStock.addAnnotation({ type: "yLine", y: 128.5, label: "Resistance" });
apexStock.addAnnotation({ type: "yBand", y: 120, y2: 124, opacity: 0.15 });

// Vertical marker at a date + a highlighted date range
apexStock.addAnnotation({ type: "xLine", x: "2024-03-20", label: "Earnings" });
apexStock.addAnnotation({ type: "xBand", x: "2024-04-01", x2: "2024-04-08" });

// Point marker and a floating text label at (x, y)
const id = apexStock.addAnnotation({ type: "point", x: t, y: 131, label: "Buy" });
apexStock.addAnnotation({ type: "text", x: t, y: 118, text: "support zone" });

apexStock.updateAnnotation(id, { y: 130 }); // patch
apexStock.removeAnnotation(id);
apexStock.getAnnotations(); // -> array of annotation configs
apexStock.clearAnnotations(); // removes only annotations added this way
```

| Type | Required coords | Notes |
| --- | --- | --- |
| `yLine` | `y` | Horizontal line. |
| `yBand` | `y`, `y2` | Horizontal shaded band. |
| `xLine` | `x` | Vertical line (x is a timestamp/date/category). |
| `xBand` | `x`, `x2` | Vertical shaded band. |
| `point` | `x`, `y` | Marker (customize via `marker`). |
| `text` | `x`, `y` | Text label, no marker. |

Common fields: `label`/`text`, `color`, `fillColor`, `opacity`, `textColor`,
`strokeDashArray`, `width`, `labelPosition`, `marker`, `meta`, and a stable
`id` (auto-generated when omitted).

## Event markers (timeline)

Event markers are time-anchored flags (earnings, dividends, splits, news, or
custom) that float along the x-axis with a hover card. Unlike annotations (which
render through native ApexCharts annotations), markers are drawn on a lightweight
HTML overlay, so they carry a rich card and fire hover/click events. They
reproject as you zoom and pan, hide when their `x` scrolls off the visible range,
and persist across `update()`, theme changes, and chart-type switches.

```js
chart.addEventMarker({ x: Date.UTC(2024, 1, 1), type: "earnings", label: "Q1 earnings" });
chart.addEventMarker({ x: Date.UTC(2024, 2, 15), type: "dividend", label: "Dividend $0.24" });
chart.addEventMarker({ x: Date.UTC(2024, 3, 10), type: "news", label: "Product launch", position: "top" });

chart.on("eventMarkerClick", ({ marker }) => console.log("clicked", marker.label));
```

`addEventMarker(config)` returns the marker id; `updateEventMarker(id, patch)`,
`removeEventMarker(id)`, `clearEventMarkers()`, `getEventMarker(id)`, and
`getEventMarkers()` round out the API.

| Field | Default | Notes |
| --- | --- | --- |
| `x` | (required) | Anchor time: timestamp, `Date`, or category. |
| `type` | `"custom"` | `"earnings"` / `"dividend"` / `"split"` / `"news"` / `"custom"`; sets the default glyph + color. |
| `label` | type name | Hover-card title. |
| `color` | from `type` | Badge color. |
| `glyph` | from `type` | Badge text (1 to 3 chars). |
| `position` | `"bottom"` | `"bottom"` (near the x-axis) or `"top"`. |
| `meta` | | Arbitrary payload, returned by `getEventMarker(s)`. |

Markers emit `eventMarkerAdded` / `eventMarkerUpdated` / `eventMarkerRemoved` /
`eventMarkersCleared`, plus `eventMarkerHover` / `eventMarkerClick`
(`{ id, marker, nativeEvent }`), and are captured by `getState()` /
`setState()`. See [examples/event-markers.html](examples/event-markers.html).

## Data legend (OHLC readout)

The data legend is a small panel pinned in a corner of the price chart that reads
out the instrument's OHLC, change (vs the previous close), and volume at the
crosshair, plus the value of each main-chart overlay indicator. It tracks the
pointer (via the `crosshairMove` event) and falls back to the latest bar when the
pointer leaves the plot. The panel is `pointer-events:none`, so it never
intercepts chart interaction.

Enable it at construction with the `legend` option, or imperatively:

```js
// At construction
const chart = new ApexStock(el, {
  series: [{ name: "AAPL", data }],
  legend: { show: true, position: "top-left" },
});

// Or imperatively (chainable)
chart.showLegend({ position: "top-right" });
chart.hideLegend();
chart.toggleLegend();          // returns the new visibility
chart.isLegendVisible();
```

| Option | Default | Notes |
| --- | --- | --- |
| `show` | `false` | Show the legend. |
| `position` | `"top-left"` | `"top-left"` / `"top-right"` / `"bottom-left"` / `"bottom-right"`. |
| `showChange` | `true` | Include the change (absolute + percent) vs the previous close. |
| `showVolume` | `true` | Include a volume row. |
| `showIndicators` | `true` | Include main-chart overlay indicator values. |

See [examples/data-legend.html](examples/data-legend.html).

## Drawings (programmatic, price/time-anchored)

Create trend lines, rays, price levels, time markers, zones, Fibonacci levels,
and measurements **from code** or **with the mouse** (the on-chart drawing
toolbar includes a tool for each), anchored to data coordinates so they
re-project through zoom, pan, and resize. Mouse-drawn and programmatic drawings
share one model, so both appear in `getDrawings()` and round-trip through state.
Points are `{x, y}` in data space (`x` is a timestamp/date/category, `y` is a
price).

```javascript
// Trend line between two points
const id = apexStock.addDrawing({
  type: "trendline",
  points: [{ x: "2024-02-01", y: 118 }, { x: "2024-04-15", y: 134 }],
  color: "#00b746",
  width: 2,
});

// A horizontal support level and a vertical event marker
apexStock.addDrawing({ type: "horizontalLine", points: [{ y: 128.5 }], dashArray: 4 });
apexStock.addDrawing({ type: "verticalLine", points: [{ x: "2024-03-20" }] });

// A supply/demand zone (filled rectangle between two corners)
apexStock.addDrawing({
  type: "rectangle",
  points: [{ x: "2024-03-01", y: 120 }, { x: "2024-03-20", y: 126 }],
  fill: "#008FFB",
  fillOpacity: 0.15,
});

// Fibonacci retracement between a swing low and high (labeled level lines)
apexStock.addDrawing({
  type: "fibRetracement",
  points: [{ x: "2024-02-01", y: 112 }, { x: "2024-04-15", y: 138 }],
});

// A measurement box (price change, % change, and bars spanned)
apexStock.addDrawing({
  type: "measure",
  points: [{ x: "2024-03-01", y: 118 }, { x: "2024-03-20", y: 129 }],
});

// Snap a trend line's endpoints to the nearest bar closes
apexStock.addDrawing({
  type: "trendline",
  points: [{ x: "2024-02-01", y: 0 }, { x: "2024-04-15", y: 0 }],
  snap: "close",
});

apexStock.updateDrawing(id, { color: "#e91e63", visible: false }); // patch geometry/style
apexStock.getDrawing(id);   // -> a single drawing config
apexStock.getDrawings();    // -> all drawings (mouse-drawn shapes included)
apexStock.removeDrawing(id);
apexStock.clearDrawings();  // removes every drawing
```

| Type (aliases) | Points | Notes |
| --- | --- | --- |
| `trendline` (`line`) | 2 | A segment between two points. |
| `ray` | 2 | Half-line from point 0 through point 1, extended to the edge. |
| `horizontalLine` (`hline`) | 1 | Price level spanning the full width (uses `y`). |
| `verticalLine` (`vline`) | 1 | Time marker spanning the full height (uses `x`). |
| `rectangle` (`zone`) | 2 | Filled box between two corner points. |
| `fibRetracement` | 2 | Fibonacci level lines between two anchor prices (labeled). |
| `fibExtension` | 2 | Fibonacci extension levels (ratios beyond 1). |
| `measure` | 2 | A box labeled with the price change, % change, and bar count. |

The fib types accept `levels` (a custom ratio array) and `showLabels` (default
true); `measure` accepts `upColor` / `downColor` / `showLabel`. Pass `snap: true`
(or `"open"` / `"high"` / `"low"` / `"close"`) to snap each point to the nearest
bar's OHLC values. Common fields: `color`, `width`, `fill`, `fillOpacity`, `dashArray`, `locked`
(not selectable/draggable when true), `visible` (rendered when true, still
serialized when false), `meta`, and a stable `id` (auto-generated when omitted).
Adding, patching, removing, and clearing drawings emit `drawingAdded` /
`drawingUpdated` / `drawingRemoved` / `drawingsCleared` events, and the whole
drawing set is captured by `getState()` and restored by `setState()`.

### Custom drawing tools (`registerDrawingTool`)

Register your own data-space drawing type globally, then create it with
`addDrawing({ type, points })` like any built-in. The `render(data, helpers)`
function turns the drawing's data-space record into an SVG element; `helpers`
gives you the data-to-screen projection so the drawing reprojects on zoom/pan.
Custom drawings drag and serialize (into `getState()`) like built-ins.

```javascript
ApexStock.registerDrawingTool("markerDot", {
  defaults: { radius: 6 },
  render(data, helpers) {
    const p = helpers.dataToScreen(data.points[0].x, data.points[0].y);
    const c = document.createElementNS(helpers.svgNS, "circle");
    c.setAttribute("cx", p.x);
    c.setAttribute("cy", p.y);
    c.setAttribute("r", data.radius);
    c.setAttribute("fill", data.color);
    return c;
  },
});

apexStock.addDrawing({ type: "markerDot", points: [{ x: someTime, y: 132 }], color: "#e91e63" });
```

`helpers` exposes `svgNS`, `dataToScreen(x, y)`, `screenToData(x, y)`,
`getChartBounds()`, and `extendToBounds(p1, p2)`. Custom types may not shadow a
built-in type name; pass `overwrite: true` to replace a previous registration.
A serialized custom drawing re-renders after reload only if the tool has been
registered again first.

## Cross-chart synchronization

Link independent ApexStock instances (e.g. a price chart above a separate
indicator chart in a dashboard) so panning/zooming one mirrors to the others,
and a crosshair on one draws a vertical guide at the same time on the others.

```javascript
const price = new ApexStock(document.querySelector("#price"), priceOptions);
const rsi = new ApexStock(document.querySelector("#rsi"), rsiOptions);
price.render();
rsi.render();

const link = ApexStock.sync([price, rsi], { zoom: true, crosshair: true });

// later, to unlink:
link.disconnect();
```

`ApexStock.sync(instances, options)` takes two or more rendered instances and
returns a handle with `disconnect()`. Options: `zoom` (default true) mirrors the
visible x-range, `crosshair` (default true) draws the guide, and `crosshairColor`
overrides the guide color. It is built entirely on the public event bus and
`setVisibleRange` (not ApexCharts' native `group`), so the charts remain
independently constructed and the link can be added or removed at any time.

## Data adapters

Your data rarely arrives in the `{ x, y: [open, high, low, close], v? }` shape.
These static helpers convert the common shapes for you, and the output is already
validated and time-sorted (they reuse the same cleaning as the render pipeline),
so you can pass it straight into `series`.

```javascript
// 1) Arrays of objects or tuples. Columns are matched by case-insensitive
//    alias: date/time -> x, o -> open, c -> close, vol -> volume, ...
const series = ApexStock.normalize([
  { date: "2024-01-01", o: 100, h: 110, l: 95, c: 105, v: 1_000_000 },
  { date: "2024-01-02", o: 105, h: 115, l: 100, c: 112, v: 1_200_000 },
]);

// Different column names? Pass a mapping (it wins over the aliases).
ApexStock.normalize(rows, { x: "Date", close: "Adj Close" });

// Tuples are read positionally as [x, open, high, low, close, volume].
ApexStock.normalize([[1704067200000, 100, 110, 95, 105, 1_000_000]]);

// 2) Parallel column arrays. Only `close` is required; missing OHLC columns
//    are derived from it (a close-only feed becomes flat candles).
ApexStock.fromArrays({
  t: [t0, t1, t2],
  open: [100, 105, 112],
  high: [110, 115, 118],
  low: [95, 100, 108],
  close: [105, 112, 116],
});
ApexStock.fromArrays({ close: [105, 112, 116] }); // x falls back to 0,1,2

// 3) CSV text. The header row drives alias resolution by default.
ApexStock.fromCSV(`Date,Open,High,Low,Close,Volume
2024-01-01,100,110,95,105,1000000
2024-01-02,105,115,100,112,1200000`);

ApexStock.fromCSV(csvText, { header: false }); // positional columns
ApexStock.fromCSV(csvText, { delimiter: ";", mapping: { close: "Last" } });
```

`fromCSV` handles quoted fields, embedded delimiters, and CRLF/LF line endings.

## Export (image + data)

Besides the toolbar download button, export programmatically. **`export({ format })`**
is the one entry point for every format, returning a `Promise` of a consistent
result (`{ format, blob, url }`, plus `text` for data formats):

```javascript
const png = await apexStock.export({ format: "png", scale: 2 });   // { format, blob, url }
const pdf = await apexStock.export({ format: "pdf", download: true }); // single-page PDF of the chart
const csv = await apexStock.export({ format: "csv" });             // { format, text, blob, url }
await apexStock.export({ format: "json", range: "visible", download: true });
```

- **`export({ format, scale?, range?, include?, summary?, includeVolume?, raw?, pretty?, download?, filename? })`**
  → `Promise<{ format, blob, url, text?, fallback? }>`.
  `format` is `"png"` (default), `"svg"`, `"pdf"`, `"csv"`, or `"json"`. Image and
  PDF formats honor `scale`; data formats honor `range` / `includeVolume` / `raw`
  / `pretty`. Data formats also return the serialized `text`. `png` falls back to
  `svg` (`fallback: true`) on browsers that block raster capture. `pdf` is a
  single-page document with the chart (price + oscillator panes) embedded as a
  raster, sized to the image; no external PDF library is used.

### Exporting the analysis

`include` carries the analysis into the export. It means something slightly
different in each medium, because a spreadsheet and a report need different
things:

```javascript
// A spreadsheet: extra columns, one value per bar.
apexStock.exportData({ include: ["indicators", "analysis"] });
// time,open,high,low,close,volume,MA 20,RSI,return,drawdown

// A report: the numbers set below the chart image.
await apexStock.export({ format: "pdf", include: ["analysis"], download: true });
```

- **`"indicators"`** adds one column per active indicator series, main-chart
  overlays *and* oscillator panes, named after the series. A warm-up period is
  `null`, not zero, so the columns stay aligned to the bars.
- **`"analysis"`** adds `return` (percent change from the previous bar) and
  `drawdown` (percent below the running peak, per `analysis.drawdownBasis`) for
  csv/json. For `pdf` it sets a text block under the chart: the window's dates
  and bar count, change, high, low, average, volume, annualized return,
  volatility, max drawdown, and the comparison leaderboard when one is active.
  Pass `summary: ["your", "own", "lines"]` to write that block yourself.

Range statistics are a summary, not a per-bar value, so they are not columns:
read them from `getRangeStats()`. The OHLC columns are always present, so the CSV
keeps round-tripping through `ApexStock.fromCSV` whatever you add; an extra column
whose name collides with a spine column is suffixed rather than overwriting it.
The PDF summary follows `range` (defaulting to the visible window there), so
zoom in and the exported numbers describe what you were looking at.

The two lower-level methods remain available:

```javascript
const img = await apexStock.exportImage({ format: "png", scale: 2 }); // { format, blob, url, fallback? }
const csvText = apexStock.exportData({ format: "csv" });              // returns the string synchronously
```

- **`exportImage({ format, scale?, download?, filename? })`** → `Promise<{ format, blob, url, fallback? }>`.
  `format` is `"png"` (default) or `"svg"`.
- **`exportData({ format, range?, include?, includeVolume?, raw?, pretty?, download?, filename? })`** → the serialized string.
  `format` is `"csv"` (default) or `"json"`; `range` is `"all"` (default) or
  `"visible"` (only the points in the current x-window). Time is ISO-8601 for
  numeric timestamps (`raw: true` keeps the raw value). The CSV round-trips
  through `ApexStock.fromCSV`.

## Time-frame Aggregation

```javascript
// Roll an OHLC series up to a larger interval.
const hourly = ApexStock.aggregateOHLC(oneMinuteSeries, "1h");
const intervals = ApexStock.INTERVALS; // supported interval strings
```

## Advanced Usage

### Multiple Indicators

```javascript
const chartOptions = {
  // ... basic options
  plotOptions: {
    stockChart: {
      indicators: {
        rsi: { enabled: true },
        "moving average": { enabled: true },
        "bollinger bands": { enabled: true },
        macd: { enabled: true },
      },
    },
  },
};
```

### Dynamic Updates

```javascript
// Change theme dynamically
apexStock.updateTheme("dark");

// Add indicators programmatically
apexStock.updateIndicator("rsi");
apexStock.updateIndicator("bollinger bands");
```

## Browser Support

- Modern browsers with ES6+ support
- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## License

Please refer to the ApexCharts license for usage terms and conditions.
