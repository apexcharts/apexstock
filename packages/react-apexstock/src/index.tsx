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

function mergeOptions(
  options: StockChartOptions,
  series?: StockChartOptions["series"]
): StockChartOptions {
  return series ? { ...options, series } : options;
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
        mergeOptions(options, series)
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
      instanceRef.current?.update(mergeOptions(options, series));
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [options, series]);

    return <div ref={elementRef} className={className} style={style} />;
  }
);

ApexStockComponent.displayName = "ApexStock";

export default ApexStockComponent;
export { ApexStockComponent as ApexStock };
