import { vi } from "vitest";

/**
 * Lightweight stand-in for the real `ApexStock` class. The real one requires a
 * browser DOM and the global `ApexCharts`; here we only assert that the Vue
 * wrapper drives its lifecycle (construct → render → update → destroy).
 */
export const instances: MockApexStock[] = [];

export class MockApexStock {
  el: HTMLElement;
  options: unknown;
  render = vi.fn();
  update = vi.fn();
  destroy = vi.fn();

  constructor(el: HTMLElement, options: unknown) {
    this.el = el;
    this.options = options;
    instances.push(this);
  }
}

/** Clear the recorded instances between tests. */
export function __reset(): void {
  instances.length = 0;
}

export default MockApexStock;
