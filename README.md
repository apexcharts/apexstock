# ApexStock

A comprehensive, feature-rich stock chart library built on top of ApexCharts. ApexStock provides professional-grade financial charting capabilities with technical indicators, drawing tools, theme support, and an intuitive interface.

## Features

- **Multiple Chart Types**: Candlestick, line, area, heikinashi, ohlc, etc
- **Technical Indicators**: 20+ built-in indicators including RSI, MACD, Bollinger Bands, and more
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

## Basic Usage

```javascript
// Basic HTML structure
<div id="chart-container"></div>;

// JavaScript
const chartEl = document.getElementById("chart-container");

const chartOptions = {
  chart: {
    height: 600,
  },
  series: [
    {
      name: "Stock Price",
      data: [
        {
          x: new Date("2024-01-01"),
          o: 100,
          h: 110,
          l: 95,
          c: 105,
          v: 1000000,
        },
        {
          x: new Date("2024-01-02"),
          o: 105,
          h: 115,
          l: 100,
          c: 112,
          v: 1200000,
        },
        // ... more OHLCV data
      ],
    },
  ],
  theme: {
    mode: "light", // or 'dark'
  },
};

const apexStock = new ApexStock(chartEl, chartOptions);
apexStock.render();
```

## Chart Options

### Basic Configuration

```javascript
const chartOptions = {
  chart: {
    height: 600, // Chart height in pixels
    id: "my-chart", // Chart ID (auto-generated if not provided)
    type: "candlestick", // Chart type (set automatically)
  },

  series: [
    {
      name: "Stock Price",
      data: [
        // OHLCV data format
        {
          x: timestamp, // Date/timestamp
          o: openPrice, // Open price
          h: highPrice, // High price
          l: lowPrice, // Low price
          c: closePrice, // Close price
          v: volume, // Volume (optional)
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
