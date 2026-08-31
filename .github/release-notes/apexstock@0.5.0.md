The largest release since the library went commercial: sixteen additions, seven
behaviour changes, fifteen fixes.

**One breaking change.** The `apexcharts` peer requirement moves to `^7.1.0`
(was `^6.7.0`). Upgrade both together:

```sh
npm install apexstock@0.5.0 apexcharts@^7.1.0
```

Two reasons it had to move. The old range had gone stale, and did not admit the
7.x line that every example and test fixture here actually loads, so the suite
was validating a combination the manifest forbade. And the crosshair fix below
lives in ApexCharts 7.1.0: on a zoomed chart with indicators the crosshair drew
on the wrong bar, off by one bar-width per warm-up bar (259px three wheel
notches in, 2056px at nine), and the main chart and each oscillator pane
disagreed with each other because their warm-ups differ.

The headline additions are a **financial-analysis workspace** (`getRangeStats`,
`getDrawdown`, `measureRange`, a drawdown pane, weighted pane heights),
**comparison v2** with baseline policies and a benchmark role, **cross-chart
sync**, **event markers**, an on-chart **data legend**, **price-scale modes**
(linear / log / percent / indexed), a **theme preset pack** with
`registerTheme`, **toolbar customization**, and a unified **`export()`** covering
png / svg / pdf / csv / json, the PDF written without adding a dependency.

Also new is `rangeChanging`, a per-frame companion to `rangeChange`. If you have
custom chrome that must follow a zoom gesture, subscribe to it: `rangeChange`
fires once when the gesture settles, by design, so chrome hung off it alone
freezes for the duration of a wheel zoom.

The three framework wrappers are released alongside at 0.2.2 with the matching
peer requirement.
