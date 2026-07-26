import { listClusterNodes, listWorkerHeartbeats, listUserExecutionJobs } from "../../db";
import { getConfigurationCenter } from "../config/ConfigurationCenter";
import { getTenantPlatformSummary } from "./TenantPlatformService";

const DEFAULT_COSTS = {
  workerPerHour: 0.12,
  redisPerHour: 0.08,
  dbPerHour: 0.15,
  nodeMemoryGbHour: 0.03,
  actionAcked: 0.002,
  actionFailed: 0.001,
};

export async function buildCostManagementView(userId: number) {
  const [tenant, workers, nodes, jobs, configured] = await Promise.all([
    getTenantPlatformSummary(userId),
    listWorkerHeartbeats({ limit: 200 }),
    listClusterNodes(200),
    listUserExecutionJobs(userId, 200),
    getConfigurationCenter().get<typeof DEFAULT_COSTS>("costs.model", DEFAULT_COSTS),
  ]);

  const nodeMemoryGb = nodes.reduce((sum, node) => sum + Number((node.payload as any)?.rss ?? 0) / 1024 / 1024 / 1024, 0);
  const acked = jobs.reduce((sum, job) => sum + Number(job.successCount ?? 0), 0);
  const failed = jobs.reduce((sum, job) => sum + Number(job.failureCount ?? 0), 0);

  const estimatedHourlyCost =
    workers.length * configured.workerPerHour +
    configured.redisPerHour +
    configured.dbPerHour +
    nodeMemoryGb * configured.nodeMemoryGbHour;

  return {
    generatedAt: new Date().toISOString(),
    tenant: {
      userId,
      chipCount: tenant.usage.chips,
      scheduledTasks: tenant.usage.scheduledTasks,
      activeSessions: tenant.usage.activeSessions,
    },
    unitCosts: configured,
    hourly: {
      estimatedTotal: Number(estimatedHourlyCost.toFixed(4)),
      perChip: tenant.usage.chips > 0 ? Number((estimatedHourlyCost / tenant.usage.chips).toFixed(4)) : 0,
      perTenant: Number(estimatedHourlyCost.toFixed(4)),
    },
    actions: {
      acked,
      failed,
      estimatedCost: Number((acked * configured.actionAcked + failed * configured.actionFailed).toFixed(4)),
    },
    infrastructure: {
      workers: workers.length,
      nodes: nodes.length,
      nodeMemoryGb: Number(nodeMemoryGb.toFixed(2)),
    },
  };
}
