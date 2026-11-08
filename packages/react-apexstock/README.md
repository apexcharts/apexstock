# react-apexstock

React component wrapper for [ApexStock](https://github.com/apexcharts/apexstock)
— financial charting (candlesticks, indicators, drawing tools) built on top of
ApexCharts.

It's a thin, typed wrapper around the imperative `ApexStock` class: it creates
the instance on mount, forwards prop changes to `update()`, and tears it down on
unmount.

## Install

```bash
npm install react-apexstock apexstock apexcharts
```

`apexcharts`, `apexstock`, `react`, and `react-dom` are peer dependencies.
Provide ApexCharts either as a global (`window.ApexCharts`) or, in a bundler
app, via the `apexCharts` prop below (no need to touch `window`).

## Usage

```tsx
import { useMemo } from "react";
import ApexStock from "react-apexstock";

export function PriceChart({ data }) {
  // Memoize so the chart only updates when inputs actually change.
  const options = useMemo(
    () => ({
      chart: { height: 420 },
    }),
    []
  );
  const series = useMemo(() => [{ name: "Price", data }], [data]);

  return <ApexStock options={options} series={series} style={{ width: "100%" }} />;
}
```

OHLC points use the ApexStock shape `{ x, y: [open, high, low, close], v }`.

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `options` | `StockChartOptions` | Full chart options (the 2nd arg to `new ApexStock`). Required. |
| `series` | `StockChartOptions["series"]` | Convenience: overrides `options.series` (handy for frequently-changing data). |
| `apexCharts` | `ApexChartsCtor` | Optional: the imported ApexCharts constructor, injected instead of using the `window.ApexCharts` global. Applied at mount. |
| `className` | `string` | Class on the container element. |
| `style` | `React.CSSProperties` | Inline styles on the container element. |

Injecting ApexCharts in a bundler app:

```tsx
import ApexCharts from "apexcharts";
import ApexStock from "react-apexstock";

<ApexStock options={options} apexCharts={ApexCharts} />;
```

> Pass **stable/memoized** `options` and `series` — a new object identity on
> every render triggers an `update()`.

## Imperative ref

```tsx
import { useRef } from "react";
import ApexStock, { type ApexStockRef } from "react-apexstock";

function Toolbar() {
  const ref = useRef<ApexStockRef>(null);
  const addRSI = () => ref.current?.getInstance()?.updateIndicator("rsi");
  return (
    <>
      <button onClick={addRSI}>Add RSI</button>
      <ApexStock ref={ref} options={{ chart: { height: 400 }, series }} />
    </>
  );
}
```

- `getInstance()` → the live `ApexStock` instance (call any of its methods:
  `update`, `updateIndicator`, `updateTheme`, export, …), or `null` before mount.
- `getElement()` → the container `<div>`.

## Live demo

A no-build demo lives in [`demo/`](demo/): the real wrapper driving the real
ApexStock core (the unit tests mock the core, this does not). It loads
React/ReactDOM from this package's `node_modules` via small ESM shims, and the
core plus its ApexCharts peer from the repo root, so build both first and serve
over a static server (no bundler needed):

```bash
npm install                  # in this package, for the React UMD builds
npm run build                # build the wrapper -> dist/
(cd ../.. && npm run build)  # build the core -> dist/

# Serve from the repo root, so the core's dist/ and its installed ApexCharts
# both resolve, then open the demo URL:
cd ../.. && python3 -m http.server 8080
# http://localhost:8080/packages/react-apexstock/demo/
```

## Using with Ignite UI

From ApexStock 0.6.0, stock charts can follow the Ignite UI theme on the page:
the toolbar, its menus and popups, the legend, the analysis panel, the rise and
fall colors, the font, and light or dark. Import the core's add-on once,
anywhere in the app, before the first chart renders:

```ts
import "apexstock/ignite-ui"; // also loads apexcharts/features/ignite-ui
```

`apexstock/ignite-ui` loads the ApexCharts add-on for you, so the charts inside
the stock chart follow the theme too; it needs the ApexCharts release that
ships `apexcharts/features/ignite-ui`. A page that loads the libraries with
script tags loads the ApexCharts add-on first, then the ApexStock one:

```html
<script src="apexcharts/dist/apexcharts.min.js"></script>
<script src="apexcharts/dist/features/ignite-ui.js"></script>
<script src="apexstock/dist/apexstock.min.js"></script>
<script src="apexstock/dist/apexstock.ignite-ui.min.js"></script>
```

The add-ons are free and need no licence key. Without them the `--ig-*` tokens
are ignored; the `--apexstock-*` and `--apx-*` tokens work either way, and
everything you set ranks above the theme. Without a `theme.mode`, a dark
Ignite UI theme makes the chart dark; a mode you set wins.

To turn it off for one chart, set `theme.designSystem` in the options:

```tsx
const options = useMemo(
  () => ({ chart: { height: 420 }, theme: { designSystem: false } }),
  []
);
```

It is part of the core's options type, so the `options` prop is typed for it.
See the ApexStock README (Using with Ignite UI) for what the theme reaches.

## SSR

The component renders only a container `<div>` on the server; the chart is
created in a client-only effect. (The core `apexstock` package is import-safe in
Node, but rendering needs a DOM.)
