import { inspectPlatformResources } from "./ResourceManagerService";

export async function buildCapacityPlan(userId?: number | null) {
  const resources = await inspectPlatformResources(userId);
  const tenant = resources.tenant;
  const baselineWorkers = Math.max(1, resources.cluster.workers || resources.cluster.nodes || 1);
  const baselineNodes = Math.max(1, resources.cluster.nodes || 1);

  const scenarios = [1, 2, 5].map((multiplier) => {
    const projectedSessions = resources.sessions.connected * multiplier;
    const projectedWorkers = Math.max(
      baselineWorkers,
      Math.ceil(projectedSessions / Math.max(1, tenant?.quotas.workers ?? 5)),
    );
    const projectedNodes = Math.max(baselineNodes, Math.ceil(projectedWorkers / 4));

    return {
      multiplier,
      projectedSessions,
      projectedWorkers,
      projectedNodes,
      risk:
        multiplier >= 5
          ? "high"
          : multiplier >= 2 && resources.cluster.degradedWorkers > 0
            ? "attention"
            : "low",
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    baseline: {
      nodes: baselineNodes,
      workers: baselineWorkers,
      connectedSessions: resources.sessions.connected,
    },
    scenarios,
  };
}
