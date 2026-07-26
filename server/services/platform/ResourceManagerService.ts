import { listClusterNodes, listDistributedChipSessions, listWorkerHeartbeats } from "../../db";
import { getTenantPlatformSummary } from "./TenantPlatformService";

export async function inspectPlatformResources(userId?: number | null) {
  const [nodes, workers, sessions, tenant] = await Promise.all([
    listClusterNodes(200),
    listWorkerHeartbeats({ limit: 200 }),
    listDistributedChipSessions({ limit: 500 }),
    userId ? getTenantPlatformSummary(userId) : Promise.resolve(null),
  ]);

  const relevantSessions = userId ? sessions.filter((session) => session.userId === userId) : sessions;
  const totalNodeRss = nodes.reduce((sum, node) => sum + Number((node.payload as any)?.rss ?? 0), 0);
  const degradedWorkers = workers.filter((worker) => worker.status !== "running").length;

  return {
    generatedAt: new Date().toISOString(),
    tenant,
    cluster: {
      nodes: nodes.length,
      workers: workers.length,
      degradedWorkers,
      totalNodeRss,
    },
    sessions: {
      total: relevantSessions.length,
      connected: relevantSessions.filter((session) => session.sessionStatus === "connected").length,
      unhealthy: relevantSessions.filter((session) => ["failed", "orphaned"].includes(session.sessionStatus)).length,
    },
    pressure: tenant
      ? {
          chipUsageRatio: tenant.quotas.chips > 0 ? Number((tenant.usage.chips / tenant.quotas.chips).toFixed(2)) : 0,
          taskUsageRatio:
            tenant.quotas.scheduledTasks > 0
              ? Number((tenant.usage.scheduledTasks / tenant.quotas.scheduledTasks).toFixed(2))
              : 0,
          sessionUsageRatio:
            tenant.quotas.workers > 0 ? Number((tenant.usage.activeSessions / tenant.quotas.workers).toFixed(2)) : 0,
        }
      : null,
  };
}
