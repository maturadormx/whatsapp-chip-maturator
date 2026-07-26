import { recordAuditEvent } from "../audit/AuditEngine";
import { getConfigurationCenter } from "../config/ConfigurationCenter";
import { buildCapacityPlan } from "./CapacityPlannerService";
import { inspectPlatformResources } from "./ResourceManagerService";

const AUTOSCALING_KEY = "autoscaling.profile";

export async function getAutoScalingProfile() {
  return getConfigurationCenter().get<Record<string, unknown>>(AUTOSCALING_KEY, {
    enabled: false,
    minWorkers: 1,
    maxWorkers: 10,
    strategy: "queue_pressure",
  });
}

export async function updateAutoScalingProfile(profile: Record<string, unknown>, userId?: number | null) {
  await getConfigurationCenter().set({
    key: AUTOSCALING_KEY,
    value: profile,
    description: "Perfil de auto scaling de workers.",
  });

  await recordAuditEvent({
    userId: userId ?? null,
    engine: "AutoScalingManagerService",
    action: "autoscaling_profile_updated",
    entityType: "autoscaling_profile",
    entityId: "default",
    payload: profile,
  }).catch(() => null);

  return profile;
}

export async function evaluateAutoScaling(userId: number) {
  const [resources, capacity, profile] = await Promise.all([
    inspectPlatformResources(userId),
    buildCapacityPlan(userId),
    getAutoScalingProfile(),
  ]);

  const sessionPressure = resources.pressure?.sessionUsageRatio ?? 0;
  const degradedWorkers = resources.cluster.degradedWorkers;
  const currentWorkers = resources.cluster.workers;
  let targetWorkers = currentWorkers;
  let reason = "capacidade estável";

  if (sessionPressure >= 0.8 || degradedWorkers > 0) {
    targetWorkers = Math.max(currentWorkers + 1, capacity.scenarios[1]?.projectedWorkers ?? currentWorkers + 1);
    reason = "pressão de sessão alta ou workers degradados";
  } else if (sessionPressure <= 0.3 && currentWorkers > Number(profile.minWorkers ?? 1)) {
    targetWorkers = Math.max(Number(profile.minWorkers ?? 1), currentWorkers - 1);
    reason = "baixa utilização com espaço para redução";
  }

  return {
    generatedAt: new Date().toISOString(),
    currentWorkers,
    targetWorkers,
    action:
      targetWorkers > currentWorkers ? "scale_out" : targetWorkers < currentWorkers ? "scale_in" : "hold",
    reason,
    profile,
  };
}
