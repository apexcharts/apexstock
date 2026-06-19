import {
  defineComponent,
  h,
  ref,
  toRaw,
  watch,
  onMounted,
  onBeforeUnmount,
  type PropType,
} from "vue";
import ApexStock from "apexstock";

/** The chart-options object accepted by the `ApexStock` constructor. */
export type StockChartOptions = ConstructorParameters<typeof ApexStock>[1];

/** The underlying `ApexStock` instance type. */
export type ApexStockInstance = InstanceType<typeof ApexStock>;

type SeriesProp = StockChartOptions["series"];

/**
 * ApexStock mutates the options it receives (sets `chart.id`, writes back the
 * normalized `series`, strips a nullish `theme`). Vue props are readonly
 * reactive proxies, so hand the core a mutable plain copy of the paths it
 * touches — `chart` and each `series` entry — while preserving everything else
 * by reference (so `chart.events` callbacks etc. survive). The (possibly large)
 * series `data` arrays are not cloned; the core only ever reassigns
 * `series[i].data`, never mutates the array in place.
 */
function toPlainOptions(
  options: StockChartOptions,
  series?: SeriesProp
): StockChartOptions {
  const raw = toRaw(options) as Record<string, unknown>;
  const out: Record<string, unknown> = { ...raw };
  if (raw.chart) out.chart = { ...(toRaw(raw.chart) as object) };
  const srcSeries = series ?? (raw.series as SeriesProp);
  if (Array.isArray(srcSeries)) {
    out.series = srcSeries.map((s) => ({ ...(toRaw(s) as object) }));
  }
  return out as StockChartOptions;
}

/**
 * Vue 3 wrapper around the imperative `ApexStock` class.
 *
 * The instance is created in `onMounted` (client only), so SSR renders just the
 * container `<div>` (ApexStock is import-safe but needs a DOM to render).
 * Changes to the `options` or `series` props are forwarded to
 * `instance.update()`; pass new object/array identities to trigger an update
 * (an in-place mutation of the same object won't, by design — avoids deep
 * watching large datasets). The instance is exposed via `getInstance()`.
 */
export default defineComponent({
  name: "ApexStock",
  props: {
    options: {
      type: Object as PropType<StockChartOptions>,
      required: true,
    },
    series: {
      type: Array as PropType<SeriesProp>,
      default: undefined,
    },
  },
  setup(props, { expose }) {
    const el = ref<HTMLDivElement | null>(null);
    let instance: ApexStockInstance | null = null;

    onMounted(() => {
      if (!el.value) return;
      instance = new ApexStock(
        el.value,
        toPlainOptions(props.options, props.series)
      );
      instance.render();
    });

    // Forward prop changes (by identity) to the live instance. Vue's watch does
    // not fire on initial mount, so the onMounted path owns the first render.
    watch(
      [() => props.options, () => props.series],
      () => {
        instance?.update(toPlainOptions(props.options, props.series));
      }
    );

    onBeforeUnmount(() => {
      instance?.destroy?.();
      instance = null;
    });

    expose({
      /** The live `ApexStock` instance, or `null` before mount / after unmount. */
      getInstance: (): ApexStockInstance | null => instance,
      /** The container `<div>`, or `null` before mount. */
      getElement: (): HTMLDivElement | null => el.value,
    });

    return () => h("div", { ref: el });
  },
});
