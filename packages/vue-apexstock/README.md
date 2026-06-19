# vue-apexstock

Vue 3 component wrapper for [ApexStock](https://github.com/apexcharts/apexstock)
— financial charting (candlesticks, indicators, drawing tools) built on top of
ApexCharts.

A thin, typed wrapper around the imperative `ApexStock` class: it creates the
instance on mount, forwards prop changes to `update()`, and tears it down on
unmount.

## Install

```bash
npm install vue-apexstock apexstock apexcharts
```

`apexcharts`, `apexstock`, and `vue` (3.x) are peer dependencies. ApexCharts
must be available as a global, the same way the core library expects.

## Usage

```vue
<script setup>
import { ref } from "vue";
import ApexStock from "vue-apexstock";

const options = { chart: { height: 420 }, theme: { mode: "light" } };
// New array identity on data change triggers an update.
const series = ref([{ name: "Price", data: [] }]);
</script>

<template>
  <ApexStock :options="options" :series="series" style="width: 100%" />
</template>
```

OHLC points use the ApexStock shape `{ x, y: [open, high, low, close], v }`.

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `options` | `StockChartOptions` | Full chart options (the 2nd arg to `new ApexStock`). Required. |
| `series` | `StockChartOptions["series"]` | Convenience: overrides `options.series`. |

> Updates fire when the `options` or `series` **identity** changes (assign a new
> object/array). In-place mutation of the same object is intentionally not
> deep-watched, to avoid the cost of deep-watching large datasets.

## Accessing the instance

```vue
<script setup>
import { ref } from "vue";
import ApexStock from "vue-apexstock";

const chart = ref();
const addRSI = () => chart.value?.getInstance()?.updateIndicator("rsi");
</script>

<template>
  <button @click="addRSI">Add RSI</button>
  <ApexStock ref="chart" :options="{ chart: { height: 400 }, series }" />
</template>
```

- `getInstance()` → the live `ApexStock` instance (call any method: `update`,
  `updateIndicator`, `updateTheme`, export, …), or `null` before mount.
- `getElement()` → the container `<div>`.

## Live demo

A no-build demo lives in [`demo/`](demo/): the real wrapper driving the real
ApexStock core (the unit tests mock the core, this does not). It loads Vue from
this package's `node_modules` (the ESM-browser build) and the core from the
repo's `dist/`, so build both first and serve over a static server (no bundler
needed):

```bash
npm install                  # in this package, for the Vue ESM build
npm run build                # build the wrapper -> dist/
(cd ../.. && npm run build)  # build the core -> dist/

# Serve from the apexcharts working dir (parent of this repo) so the sibling
# apexcharts-js checkout also resolves, then open the demo URL:
cd ../../.. && python3 -m http.server 8080
# http://localhost:8080/apexstock/packages/vue-apexstock/demo/
```

## SSR

The component renders only a container `<div>` on the server; the chart is
created in a client-only `onMounted` hook. (The core `apexstock` package is
import-safe in Node, but rendering needs a DOM.)
