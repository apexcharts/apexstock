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
dependencies. ApexCharts must be available as a global, the same way the core
library expects.

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
  options = { chart: { height: 420 }, theme: { mode: "light" as const } };
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

## SSR

The component renders only a container `<div>` on the server; the chart is
created in a client-only `ngAfterViewInit`. (The core `apexstock` package is
import-safe in Node, but rendering needs a DOM.)
