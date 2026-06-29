# ApexStock

A comprehensive, feature-rich stock chart library built on top of ApexCharts. ApexStock provides professional-grade financial charting capabilities with technical indicators, drawing tools, theme support, and an intuitive interface.

## Features

- **Multiple Chart Types**: Candlestick, line, area, heikinashi, ohlc, etc
- **Technical Indicators**: 20+ built-in indicators including RSI, MACD, Bollinger Bands, and more
- **Real-time Streaming**: Incremental `appendData()` updates price, indicators, and panes without a full rebuild
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

> **ApexCharts must be available as a global.** ApexStock calls
> `new ApexCharts(...)` internally and does **not** import it, so ApexCharts has
> to be loaded first (as `window.ApexCharts`).
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

// ApexStock expects ApexCharts on the global scope.
window.ApexCharts = ApexCharts;

const apexStock = new ApexStock(document.getElementById("chart-container"), {
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
});
apexStock.render();
```

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
| **Fibonacci Retracements**     | `"fibonacci retracements"`     | Fibonacci retracement levels (0%, 23.6%, 38.2%, 50%, 61.8%, 100%) |
| **Linear Regression**          | `"linear regression"`          | Linear regression trend line                                      |
| **Ichimoku Cloud Indicator**   | `"ichimoku cloud indicator"`   | Complete Ichimoku system with cloud, lines                        |

### Oscillators (displayed in separate panels)

These indicators are displayed in their own panels below the main chart. **Note**: Only one oscillator can be active at a time.

| Oscillator                       | Key                              | Description                                            |
| -------------------------------- | -------------------------------- | ------------------------------------------------------ |
| **RSI**                          | `"rsi"`                          | Relative Strength Index (0-100 scale)                  |
| **MACD**                         | `"macd"`                         | Moving Average Convergence Divergence with signal line |
| **Volumes**                      | `"volumes"`                      | Volume bars showing trading volume                     |
| **Price Volume Trend**           | `"price volume trend"`           | PVT cumulative indicator                               |
| **Stochastic Oscillator**        | `"stochastic oscillator"`        | %K and %D stochastic lines                             |
| **Standard Deviation Indicator** | `"standard deviation indicator"` | Price volatility measure                               |
| **Average Directional Index**    | `"average directional index"`    | ADX trend strength indicator                           |
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

**Adding Oscillators (only one at a time):**

```javascript
// Add RSI (removes any existing oscillator)
apexStock.updateIndicator("rsi");

// Switch to MACD (removes RSI)
apexStock.updateIndicator("macd");
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

      // Oscillators (only one will be active)
      'rsi': { enabled: false },
      'macd': { enabled: true },  // This will be the active oscillator
      'volumes': { enabled: false }
    }
  }
}
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

Cleans up the chart instance and removes event listeners.

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

#### `updateIndicator(indicatorKey)`

Adds or updates a specific indicator.

```javascript
apexStock.updateIndicator("rsi");
apexStock.updateIndicator("moving average");
```

#### `removeIndicator(indicatorKey)`

Removes a specific indicator.

```javascript
apexStock.removeIndicator("rsi");
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
