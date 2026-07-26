import type { Clock } from "./Clock";

/**
 * Contrato de teste: relógio mutável para cenários determinísticos.
 * O domínio deve depender apenas de `Clock`.
 */
export interface MutableClock extends Clock {
  advanceBy(ms: number): void;
  set(date: Date): void;
  reset(): void;
}

