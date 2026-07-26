import { Registry, collectDefaultMetrics } from "prom-client";

/**
 * Registry único (singleton) do Prometheus.
 * Todas as métricas do sistema são registradas aqui.
 *
 * `collectDefaultMetrics()` é chamado uma vez no nível do módulo
 * para evitar registros duplicados em inicializações subsequentes.
 */
export const registry = new Registry();
collectDefaultMetrics({ register: registry });

let initialized = false;

/**
 * Inicializa o sistema de métricas.
 * Idempotente: chamadas subsequentes não fazem nada.
 */
export function initMetrics(): void {
  if (initialized) return;
  initialized = true;
  console.log("[Metrics] Registro Prometheus inicializado");
}

export function getRegistry(): Registry {
  return registry;
}

