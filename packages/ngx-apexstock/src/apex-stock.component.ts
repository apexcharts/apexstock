import {
  Component,
  ChangeDetectionStrategy,
  ElementRef,
  Input,
  ViewChild,
  type AfterViewInit,
  type OnChanges,
  type OnDestroy,
  type SimpleChanges,
} from "@angular/core";
import ApexStock from "apexstock";

/** The chart-options object accepted by the `ApexStock` constructor. */
export type StockChartOptions = ConstructorParameters<typeof ApexStock>[1];

/** The underlying `ApexStock` instance type. */
export type ApexStockInstance = InstanceType<typeof ApexStock>;

type SeriesProp = StockChartOptions["series"];

/**
 * ApexStock mutates the options it receives (sets `chart.id`, writes back the
 * normalized `series`, strips a nullish `theme`). Hand it a mutable plain copy
 * of the paths it touches — `chart` and each `series` entry — so the caller's
 * own `@Input` object is left untouched, while other references (e.g.
 * `chart.events` callbacks) are preserved. Large series `data` arrays are not
 * cloned; the core only reassigns `series[i].data`, never mutates in place.
 */
function toPlainOptions(
  options: StockChartOptions,
  series?: SeriesProp
): StockChartOptions {
  const src = options as Record<string, unknown>;
  const out: Record<string, unknown> = { ...src };
  if (src.chart) out.chart = { ...(src.chart as object) };
  const srcSeries = series ?? (src.series as SeriesProp);
  if (Array.isArray(srcSeries)) {
    out.series = srcSeries.map((s) => ({ ...(s as object) }));
  }
  return out as StockChartOptions;
}

/**
 * Angular wrapper around the imperative `ApexStock` class.
 *
 * The instance is created in `ngAfterViewInit` (client only), so server-side
 * rendering emits just the container `<div>` (ApexStock is import-safe but
 * needs a DOM to render). Changes to the `options` or `series` inputs are
 * forwarded to `instance.update()`. Access the instance via the component
 * reference's `getInstance()`.
 *
 * Standalone — import it directly into a component's `imports` (or an
 * `NgModule`'s `imports`); no module is required.
 */
@Component({
  selector: "apex-stock",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: "<div #chartEl></div>",
})
export class ApexStockComponent
  implements AfterViewInit, OnChanges, OnDestroy
{
  /**
   * Full ApexStock chart options — `chart`, `theme`, `series`, `plotOptions`,
   * `indicators`, etc. (the second argument to `new ApexStock(el, options)`).
   */
  @Input({ required: true }) options!: StockChartOptions;

  /**
   * Optional convenience: the chart series. When provided it overrides
   * `options.series`.
   */
  @Input() series?: SeriesProp;

  @ViewChild("chartEl", { static: true })
  private chartElRef!: ElementRef<HTMLDivElement>;

  private instance: ApexStockInstance | null = null;

  ngAfterViewInit(): void {
    this.instance = new ApexStock(
      this.chartElRef.nativeElement,
      toPlainOptions(this.options, this.series)
    );
    this.instance.render();
  }

  ngOnChanges(_changes: SimpleChanges): void {
    // ngOnChanges runs before ngAfterViewInit on the first render (instance is
    // still null -> skipped); later input changes forward to update().
    if (this.instance) {
      this.instance.update(toPlainOptions(this.options, this.series));
    }
  }

  ngOnDestroy(): void {
    this.instance?.destroy?.();
    this.instance = null;
  }

  /** The live `ApexStock` instance, or `null` before mount / after destroy. */
  getInstance(): ApexStockInstance | null {
    return this.instance;
  }

  /** The container `<div>`, or `null` before the view initializes. */
  getElement(): HTMLDivElement | null {
    return this.chartElRef?.nativeElement ?? null;
  }
}
