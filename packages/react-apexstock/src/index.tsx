import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import ApexStock from "apexstock";

/** The chart-options object accepted by the `ApexStock` constructor. */
export type StockChartOptions = ConstructorParameters<typeof ApexStock>[1];

/** The underlying `ApexStock` instance type. */
export type ApexStockInstance = InstanceType<typeof ApexStock>;

export interface ApexStockProps {
  /**
   * Full ApexStock chart options — `chart`, `theme`, `series`, `plotOptions`,
   * `indicators`, etc. (the second argument to `new ApexStock(el, options)`).
   */
  options: StockChartOptions;
  /**
   * Optional convenience: the chart series. When provided it overrides
   * `options.series`, so you can keep static config in `options` and pass
   * frequently-changing data via `series`.
   */
  series?: StockChartOptions["series"];
  /** Class applied to the container element. */
  className?: string;
  /** Inline styles applied to the container element. */
  style?: React.CSSProperties;
}

/** Imperative handle exposed via `ref`. */
export interface ApexStockRef {
  /** The live `ApexStock` instance, or `null` before mount / after unmount. */
  getInstance: () => ApexStockInstance | null;
  /** The container `<div>`, or `null` before mount. */
  getElement: () => HTMLDivElement | null;
}

/**
 * ApexStock mutates the options it receives (sets `chart.id`, writes back the
 * normalized `series`, strips a nullish `theme`). Hand it a mutable plain copy
 * of the paths it touches (`chart` and each `series` entry) so the caller's
 * own `options`/`series` props are left untouched, while other references (e.g.
 * `chart.events` callbacks) are preserved. Large series `data` arrays are not
 * cloned; the core only reassigns `series[i].data`, never mutates in place.
 */
function toPlainOptions(
  options: StockChartOptions,
  series?: StockChartOptions["series"]
): StockChartOptions {
  const src = options as Record<string, unknown>;
  const out: Record<string, unknown> = { ...src };
  if (src.chart) out.chart = { ...(src.chart as object) };
  const srcSeries = series ?? (src.series as StockChartOptions["series"]);
  if (Array.isArray(srcSeries)) {
    out.series = srcSeries.map((s) => ({ ...(s as object) }));
  }
  return out as StockChartOptions;
}

/**
 * React wrapper around the imperative `ApexStock` class.
 *
 * The instance is created in a layout-free effect, so it only runs on the
 * client — server-side rendering emits just the container `<div>` (ApexStock
 * itself is import-safe but needs a DOM to render). Prop changes to `options`
 * or `series` are forwarded to `instance.update()`; pass stable/memoized
 * objects to avoid an update on every parent re-render.
 */
const ApexStockComponent = forwardRef<ApexStockRef, ApexStockProps>(
  function ApexStockComponent({ options, series, className, style }, ref) {
    const elementRef = useRef<HTMLDivElement>(null);
    const instanceRef = useRef<ApexStockInstance | null>(null);
    const isInitialRender = useRef(true);

    useImperativeHandle(
      ref,
      () => ({
        getInstance: () => instanceRef.current,
        getElement: () => elementRef.current,
      }),
      []
    );

    // Create the instance once, on mount (client only). Clean up on unmount.
    useEffect(() => {
      if (!elementRef.current) return undefined;

      const instance = new ApexStock(
        elementRef.current,
        toPlainOptions(options, series)
      );
      instance.render();
      instanceRef.current = instance;

      return () => {
        instance.destroy?.();
        instanceRef.current = null;
        isInitialRender.current = true;
      };
      // Mount-only: subsequent prop changes are handled by the update effect.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Forward later prop changes to the live instance.
    useEffect(() => {
      if (isInitialRender.current) {
        isInitialRender.current = false;
        return;
      }
      instanceRef.current?.update(toPlainOptions(options, series));
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [options, series]);

    return <div ref={elementRef} className={className} style={style} />;
  }
);

ApexStockComponent.displayName = "ApexStock";

export default ApexStockComponent;
export { ApexStockComponent as ApexStock };
