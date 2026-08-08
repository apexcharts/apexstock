# ApexStock

A comprehensive, feature-rich stock chart library built on top of ApexCharts. ApexStock provides professional-grade financial charting capabilities with technical indicators, drawing tools, theme support, and an intuitive interface.

## Features

- **Multiple Chart Types**: Candlestick, line, area, heikinashi, ohlc, etc
- **Technical Indicators**: 20+ built-in indicators including RSI, MACD, Bollinger Bands, and more
- **Real-time Streaming**: Incremental `appendData()` updates price, indicators, and panes without a full rebuild
- **Events**: Subscribe to `crosshairMove`, `click`, `rangeChange`, and `indicatorToggle` via `on()` / `off()` / `once()`
- **State Persistence**: `getState()` / `setState()` serialize the theme, chart type, indicators, and zoom to portable JSON
- **Custom Indicators**: Register your own indicators (overlay or oscillator, with optional live streaming) via `ApexStock.registerIndicator()`
- **Trading Overlays**: Order lines, stop-loss, take-profit, and alert price lines (draggable, closable)
- **Drawing Tools**: Interactive drawing capabilities for technical analysis
- **Theme Support**: Light and dark theme modes with seamless switching
- **Zoom Controls**: Interactive zoom and pan functionality
- **Export Capabilities**: Export charts as images
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

These indicators are displayed in their own panels below the main chart. Multiple oscillators can be active at once; each gets its own pane and the panes share the indicator area evenly.

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

`emit(name, payload)` is also exposed so you can bridge your own events through
the same bus. All subscriptions are dropped automatically on `destroy()`.

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
  version: 1,
  theme: { mode: "light" },      // or "dark"
  chartType: "candlestick",       // active type (candlestick, heikinashi, renko, line, area, ohlc, ...)
  indicators: [                   // active indicators, in application order
    { key: "moving average", params: {} },
    { key: "rsi", params: { period: 14 } }
  ],
  zoom: { minX: 1577836800000, maxX: 1580515200000 } // visible x-range, or null
}
```

`setState(state)` reconciles the live chart to that snapshot: it switches theme
and chart type, adds/removes indicators (restoring their params), keeps the
toolbar selection in sync, and restores the zoom. It accepts any supported
version (older states are migrated automatically; `ApexStock.migrateState(state)`
does the same up-front). Call `setState` after `render()`.

Not captured in v1: drawings and trading price lines (they carry
non-serializable callbacks and land in a later version). Persist those
separately via `getPriceLines()` if you need them today.

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
apexStock.addComparison({ name: "MSFT", data: msftBars }); // data: [{x, y}] or OHLC (uses close)
apexStock.addComparison({ name: "SPY", data: spyBars, color: "#FEB019" });

apexStock.setComparisonMode("percent"); // indexed % change from each series' first point (default)
apexStock.setComparisonMode("absolute"); // raw prices instead

apexStock.getComparisons(); // -> [{ name, color, points }]
apexStock.removeComparison("SPY");
apexStock.clearComparisons();
```

- **`percent`** (default): every instrument is indexed to its first point (0%),
  so you compare *performance* ("who's up more") regardless of nominal price.
- **`absolute`**: raw close prices on the secondary axis (best for same-scale peers).

Comparisons persist across zoom, theme changes, chart-type switches, indicator
toggles, and `appendData`. The compared instrument's data is supplied by you
(ApexStock does not fetch it); pass `[{x, y}]` closes or full OHLC bars (the
close is used).

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

Besides the toolbar download button, export programmatically:

```javascript
// Image. PNG composites the price chart + oscillator panes into one raster;
// SVG is a full vector snapshot. Both return { format, blob, url }.
const png = await apexStock.exportImage({ format: "png", scale: 2 });
await apexStock.exportImage({ format: "svg", download: true }); // triggers a download

// Data. CSV or JSON of the OHLC series; columns time,open,high,low,close[,volume].
const csv = apexStock.exportData({ format: "csv" });
apexStock.exportData({ format: "json", range: "visible", download: true });
```

- **`exportImage({ format, scale?, download?, filename? })`** → `Promise<{ format, blob, url, fallback? }>`.
  `format` is `"png"` (default) or `"svg"`. A few browsers block rasterizing the
  vector snapshot; PNG then falls back to SVG and sets `fallback: true`.
- **`exportData({ format, range?, includeVolume?, raw?, pretty?, download?, filename? })`** → the serialized string.
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
