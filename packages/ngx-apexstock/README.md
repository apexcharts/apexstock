# ngx-apexstock

Angular component wrapper for [ApexStock](https://github.com/apexcharts/apexstock)
— financial charting (candlesticks, indicators, drawing tools) built on top of
ApexCharts.

A thin, typed **standalone** component around the imperative `ApexStock` class:
it creates the instance after the view initializes, forwards input changes to
`update()`, and tears it down on destroy.

## Install

```bash
npm install ngx-apexstock apexstock apexcharts
```

`apexcharts`, `apexstock`, `@angular/core`, and `@angular/common` are peer
dependencies. Provide ApexCharts either as a global (`window.ApexCharts`) or, in
a bundler app, via the `apexCharts` input below (no need to touch `window`).

## Usage

`ApexStockComponent` is standalone — import it directly:

```ts
import { Component } from "@angular/core";
import { ApexStockComponent } from "ngx-apexstock";

@Component({
  selector: "app-price",
  standalone: true,
  imports: [ApexStockComponent],
  template: `<apex-stock [options]="options" [series]="series"></apex-stock>`,
})
export class PriceComponent {
  options = { chart: { height: 420 } };
  series = [{ name: "Price", data: [] as { x: number; y: number[] }[] }];
}
```

Using `NgModule`s? Add `ApexStockComponent` to the module's `imports` (standalone
components are importable into modules).

OHLC points use the ApexStock shape `{ x, y: [open, high, low, close], v }`.

## Inputs

| Input | Type | Description |
| --- | --- | --- |
| `options` | `StockChartOptions` | Full chart options (the 2nd arg to `new ApexStock`). Required. |
| `series` | `StockChartOptions["series"]` | Convenience: overrides `options.series`. |
| `apexCharts` | `ApexChartsCtor` | Optional: the imported ApexCharts constructor, injected instead of using the `window.ApexCharts` global. Applied at view init. |

Injecting ApexCharts in a bundler app:

```ts
import ApexCharts from "apexcharts";

@Component({
  template: `<apex-stock [options]="options" [apexCharts]="apexCharts"></apex-stock>`,
  // ...
})
export class PriceComponent {
  apexCharts = ApexCharts; // bound into the [apexCharts] input above
  options = { chart: { height: 420 } };
}
```

Updates fire when an input changes via Angular change detection. Assign a new
object/array reference (rather than mutating in place) to trigger an update.

## Accessing the instance

```ts
@Component({
  standalone: true,
  imports: [ApexStockComponent],
  template: `
    <button (click)="addRSI()">Add RSI</button>
    <apex-stock #chart [options]="options"></apex-stock>
  `,
})
export class ChartComponent {
  @ViewChild("chart") chart!: ApexStockComponent;
  addRSI() {
    this.chart.getInstance()?.updateIndicator("rsi");
  }
}
```

- `getInstance()` → the live `ApexStock` instance (call any method: `update`,
  `updateIndicator`, `updateTheme`, export, …), or `null` before view init.
- `getElement()` → the container `<div>`.

## Live demo

A runnable demo lives in [`demo/`](demo/): a small standalone Angular app
(Vite + `@analogjs/vite-plugin-angular`) that consumes the built
`ngx-apexstock` package and drives the real ApexStock core (the unit tests mock
the core, this does not). Unlike the React/Vue demos it needs its own install,
because Angular's partial-Ivy output must be compiled/linked by a real build:

```bash
npm run build                       # build the wrapper -> dist/ (consumed by the demo)
(cd ../.. && npm run build)         # build the core -> dist/
cd demo && npm install && npm run dev
# http://localhost:5199/
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

```ts
options = { chart: { height: 420 }, theme: { designSystem: false } };
```

It is part of the core's options type, so the `options` input is typed for it.
See the ApexStock README (Using with Ignite UI) for what the theme reaches.

## SSR

The component renders only a container `<div>` on the server; the chart is
created in a client-only `ngAfterViewInit`. (The core `apexstock` package is
import-safe in Node, but rendering needs a DOM.)
