import { recordAuditEvent } from "../audit/AuditEngine";
import { getConfigurationCenter } from "../config/ConfigurationCenter";
import { getDistributedCacheService } from "./DistributedCacheService";
import { getInternalEventBus } from "../events/InternalEventBus";
import type { ChaosExperimentDefinition } from "./types";

const CHAOS_STATUS_KEY = "chaos.last_experiment";

export async function getChaosStatus() {
  return getConfigurationCenter().get<Record<string, unknown> | null>(CHAOS_STATUS_KEY, null);
}

export async function runChaosExperiment(input: ChaosExperimentDefinition & { userId?: number | null }) {
  const startedAt = new Date().toISOString();

  if (input.target === "cache_flush") {
    await getDistributedCacheService().invalidate({
      namespace: "platform",
    });
  }

  if (input.target === "scheduler_pause") {
    await getConfigurationCenter().set({
      key: "runtime.chaos.scheduler_pause",
      value: true,
      description: "Flag de caos para pausar o scheduler durante testes controlados.",
    });
  }

  await getInternalEventBus().publish({
    type: "chaos.experiment_requested",
    source: "ChaosTestingService",
    payload: {
      target: input.target,
      mode: input.mode,
      durationSeconds: input.durationSeconds ?? null,
      metadata: input.metadata ?? {},
      startedAt,
    },
  });

  const result = {
    target: input.target,
    mode: input.mode,
    durationSeconds: input.durationSeconds ?? null,
    startedAt,
    metadata: input.metadata ?? {},
  };

  await getConfigurationCenter().set({
    key: CHAOS_STATUS_KEY,
    value: result,
    description: "Último experimento de caos solicitado.",
  });

  await recordAuditEvent({
    userId: input.userId ?? null,
    engine: "ChaosTestingService",
    action: "chaos_experiment_requested",
    entityType: "chaos_experiment",
    entityId: input.target,
    payload: result,
  }).catch(() => null);

  return result;
}
