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
ApexCharts must be available as a global (it's loaded the same way the core
library expects). See the ApexStock docs for details.

## Usage

```tsx
import { useMemo } from "react";
import ApexStock from "react-apexstock";

export function PriceChart({ data }) {
  // Memoize so the chart only updates when inputs actually change.
  const options = useMemo(
    () => ({
      chart: { height: 420 },
      theme: { mode: "light" },
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
| `className` | `string` | Class on the container element. |
| `style` | `React.CSSProperties` | Inline styles on the container element. |

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
core from the repo's `dist/`, so build both first and serve over a static
server (no bundler needed):

```bash
npm install                  # in this package, for the React UMD builds
npm run build                # build the wrapper -> dist/
(cd ../.. && npm run build)  # build the core -> dist/

# Serve from the apexcharts working dir (parent of this repo) so the sibling
# apexcharts-js checkout also resolves, then open the demo URL:
cd ../../.. && python3 -m http.server 8080
# http://localhost:8080/apexstock/packages/react-apexstock/demo/
```

## SSR

The component renders only a container `<div>` on the server; the chart is
created in a client-only effect. (The core `apexstock` package is import-safe in
Node, but rendering needs a DOM.)
