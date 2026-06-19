import {
  Component,
  ViewChild,
  type AfterViewInit,
} from "@angular/core";
// The REAL wrapper package (built with ng-packagr) driving the REAL ApexStock
// core - no mocks, unlike the unit tests.
import { ApexStockComponent, type StockChartOptions } from "ngx-apexstock";

// Deterministic OHLC sample data.
function sampleData(n = 90) {
  const out: { x: string; y: number[]; v: number }[] = [];
  const base = new Date("2024-01-01");
  let price = 100;
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647), (seed - 1) / 2147483646);
  for (let i = 0; i < n; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const change = (rand() - 0.5) * 4;
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + rand() * 2;
    const low = Math.min(open, close) - rand() * 2;
    out.push({
      x: d.toISOString().slice(0, 10),
      y: [open, high, low, close].map((v) => Number(v.toFixed(2))),
      v: Math.floor(rand() * 1_000_000) + 100_000,
    });
    price = close;
  }
  return out;
}

@Component({
  selector: "app-root",
  standalone: true,
  imports: [ApexStockComponent],
  template: `
    <h1>ngx-apexstock - live demo</h1>
    <p class="sub">
      The real wrapper build driving the real ApexStock core (no mocks).
    </p>
    <div class="controls">
      <button (click)="addIndicator('rsi')">Add RSI</button>
      <button (click)="addIndicator('macd')">Add MACD</button>
      <button (click)="addIndicator('moving average')">Add MA</button>
      <button (click)="toggleTheme()">Toggle theme (now: {{ theme }})</button>
    </div>
    <div class="status">{{ status }}</div>
    <apex-stock [options]="options"></apex-stock>
  `,
})
export class AppComponent implements AfterViewInit {
  @ViewChild(ApexStockComponent) chart!: ApexStockComponent;

  theme: "light" | "dark" = "light";
  status = "mounting…";
  options: StockChartOptions = this.buildOptions();

  private buildOptions(): StockChartOptions {
    return {
      chart: { height: 460 },
      theme: { mode: this.theme },
      series: [{ name: "ACME", data: sampleData() }],
    } as StockChartOptions;
  }

  ngAfterViewInit(): void {
    // Defer to the next microtask: writing during the same change-detection
    // pass that just rendered the view would trip NG0100 in dev mode.
    Promise.resolve().then(() => {
      const inst = this.chart?.getInstance();
      this.status = inst
        ? `live ApexStock instance: ${inst.constructor.name} - element ${
            this.chart.getElement()?.tagName
          }`
        : "no instance";
    });
  }

  addIndicator(key: string): void {
    this.chart?.getInstance()?.updateIndicator(key);
    this.status = `called updateIndicator("${key}") on the live instance`;
  }

  toggleTheme(): void {
    this.theme = this.theme === "light" ? "dark" : "light";
    // New object reference so ngOnChanges fires and forwards to update().
    this.options = this.buildOptions();
  }
}
