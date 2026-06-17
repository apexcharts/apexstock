# Theming ApexStock

ApexStock's entire UI chrome — toolbar, dropdowns, drawing controls, zoom pill,
popups — is styled with **CSS custom properties** under a single
`--apexstock-*` namespace. You can retheme any of it **without forking the
stylesheet**: just override the tokens. This document lists every token and
shows the override recipe.

> Nothing here touches the *chart series* colors (candles, indicator lines).
> Those are ApexCharts options (`plotOptions.candlestick.colors`,
> `theme.mode`, per-series `colors`) — see the ApexCharts docs. This page is
> about the surrounding ApexStock UI.

---

## How theming works

1. **Tokens** are declared on `[class^="apexstock-"]` (every ApexStock element),
   so they are self-contained and never leak to or from your page's `:root`.
2. **Light/dark** is driven by a class ApexStock adds to the chart container's
   parent: `apexstock-theme-light` or `apexstock-theme-dark` (from
   `theme.mode` in your options). Base rules read the `--apexstock-light-*`
   tokens; the dark stylesheet re-points the same components at the
   `--apexstock-dark-*` tokens. So **each mode has its own palette** — override
   the `light-*` tokens to restyle light mode, the `dark-*` tokens for dark.
3. Popups that ApexStock appends to `document.body` (element settings, tooltip
   annotations) copy the `apexstock-theme-dark` class onto themselves, so the
   dark tokens reach them too.

---

## Override recipe (no fork)

Custom properties only override when your selector **matches the same elements
at higher specificity** than the library's `[class^="apexstock-"]` (specificity
`0,1,0`). The library injects its `<style>` at runtime, so simply matching the
specificity and "loading after" is not reliable — go one notch higher.

### Restyle every ApexStock chart on the page

The theme class is already on each chart's container, so target it:

```css
/* Light mode palette */
.apexstock-theme-light [class^="apexstock-"] {
  --apexstock-light-bg: #0b0e11;
  --apexstock-light-text: #e6edf3;
  --apexstock-blue: #f5a623; /* accent shared by both modes */
}

/* Dark mode palette */
.apexstock-theme-dark [class^="apexstock-"] {
  --apexstock-dark-bg: #000000;
  --apexstock-dark-text: #e6edf3;
}
```

Both selectors have specificity `0,2,0`, so they win regardless of load order.

### Restyle one chart only

Add your own class to the element you pass to `new ApexStock(el, …)` (or any
ancestor) and scope to it:

```html
<div class="my-chart">
  <div id="chart"></div>
</div>
```

```css
.my-chart [class^="apexstock-"] {
  --apexstock-blue: #16a34a;
  --apexstock-border-radius-md: 14px;
}
```

A ready-to-edit starting point with every token at its default ships as
`apexstock/theme-template.css` (in `dist/themes/apexstock-theme-template.css`) —
copy it, change values, drop one selector around it.

---

## Token reference

### Light palette (`apexstock-theme-light`)

| Token | Default | Controls |
| --- | --- | --- |
| `--apexstock-light-bg` | `#ffffff` | Surface background (toolbar controls, dropdowns) |
| `--apexstock-light-surface-2` | `#f8fafc` | Secondary surface |
| `--apexstock-light-border` | `#e4e7ec` | Default borders |
| `--apexstock-light-border-strong` | `#d0d5dd` | Hover/emphasis borders |
| `--apexstock-light-hover` | `#f2f4f7` | Hover background |
| `--apexstock-light-text` | `#1f2937` | Primary text / icon stroke |
| `--apexstock-light-muted` | `#667085` | Secondary text |
| `--apexstock-light-selected` | `#eef4ff` | Selected option background |
| `--apexstock-light-divider` | `#e4e7ec` | Toolbar dividers |
| `--apexstock-light-shadow` | `0 6px 24px rgba(16,24,40,.14)` | Dropdown/popup shadow |

### Dark palette (`apexstock-theme-dark`)

| Token | Default | Controls |
| --- | --- | --- |
| `--apexstock-dark-bg` | `#1e242b` | Surface background |
| `--apexstock-dark-surface-2` | `#272e36` | Secondary surface |
| `--apexstock-dark-bg-alpha` | `rgba(255,255,255,.04)` | Subtle raised fill |
| `--apexstock-dark-border` | `#3a434d` | Default borders |
| `--apexstock-dark-border-strong` | `#4a545f` | Hover/emphasis borders |
| `--apexstock-dark-hover` | `#2d353e` | Hover background |
| `--apexstock-dark-text` | `#e6eaf0` | Primary text / icon stroke |
| `--apexstock-dark-muted` | `#9aa4b2` | Secondary text |
| `--apexstock-dark-selected` | `#2b3a55` | Selected option background |
| `--apexstock-dark-divider` | `#3a434d` | Toolbar dividers |
| `--apexstock-dark-shadow` | `0 6px 24px rgba(0,0,0,.5)` | Dropdown/popup shadow |

### Accent (shared by both modes)

| Token | Default | Controls |
| --- | --- | --- |
| `--apexstock-blue` | `#2563eb` | Primary accent (active tool, focus ring, color swatch) |
| `--apexstock-blue-hover` | `#1d4ed8` | Accent hover |
| `--apexstock-accent-soft` | `rgba(37,99,235,.1)` | Active option background tint |
| `--apexstock-danger` | `#dc3545` | Destructive action (clear/delete) |
| `--apexstock-danger-light` | `#f8d7da` | Destructive hover tint |
| `--apexstock-success` | `#28a745` | Success accent |

### Sizing & motion (shared)

| Token | Default | Controls |
| --- | --- | --- |
| `--apexstock-button-size` | `32px` | Toolbar button square size |
| `--apexstock-border-radius-sm` | `6px` | Small radius (buttons, inputs) |
| `--apexstock-border-radius-md` | `8px` | Medium radius (controls) |
| `--apexstock-border-radius-lg` | `10px` | Large radius (dropdown menus) |
| `--apexstock-font-size-sm` | `10px` | Small UI label size |
| `--apexstock-gap-sm` | `5px` | Tight gap |
| `--apexstock-gap-md` | `8px` | Medium gap |
| `--apexstock-gap-lg` | `10px` | Large gap |
| `--apexstock-as-ease` | `0.15s ease` | Control transition timing |

---

## See it in action

`examples/theming.html` applies a full custom palette to a live chart (with a
light/dark toggle) using only the override recipe above — no stylesheet fork.
