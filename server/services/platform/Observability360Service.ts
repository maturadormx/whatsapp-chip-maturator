import {
  getBehaviorSnapshot,
  getLatestBehaviorDecisionLog,
  getUserChips,
  listAuditEvents,
  listBehaviorActionExecutionsByChip,
  listClusterNodes,
  listDistributedChipSessions,
  listWorkerHeartbeats,
} from "../../db";
import { getGlobalHealthMonitor } from "../distributed/GlobalHealthMonitor";
import { isTracingStarted } from "../../telemetry";

export async function buildObservability360(userId?: number | null) {
  const [workers, nodes, sessions, recentAudit, chips] = await Promise.all([
    listWorkerHeartbeats({ limit: 200 }),
    listClusterNodes(200),
    listDistributedChipSessions({ limit: 500 }),
    listAuditEvents({ userId: userId ?? undefined, limit: 100 }),
    userId ? getUserChips(userId) : Promise.resolve([]),
  ]);

  const chipMetrics = await Promise.all(
    chips.slice(0, 50).map(async (chip) => {
      const [snapshot, decision, executions] = await Promise.all([
        getBehaviorSnapshot(chip.id),
        getLatestBehaviorDecisionLog(chip.id),
        listBehaviorActionExecutionsByChip(chip.id, 25),
      ]);

      return {
        chipId: chip.id,
        phoneNumber: chip.phoneNumber,
        status: chip.status,
        phase: snapshot?.phase ?? null,
        lastDecision: decision?.decision ?? null,
        lastReason: decision?.reason ?? null,
        executions: {
          total: executions.length,
          acked: executions.filter((execution) => execution.status === "ACKED").length,
          failed: executions.filter((execution) => execution.status === "FAILED").length,
        },
      };
    }),
  );

  return {
    generatedAt: new Date().toISOString(),
    tracing: {
      started: isTracingStarted(),
    },
    health: getGlobalHealthMonitor().getSnapshot(),
    nodes: nodes.map((node) => ({
      nodeId: node.nodeId,
      status: node.status,
      isLeader: Boolean(node.isLeader),
      rss: Number((node.payload as any)?.rss ?? 0),
      uptimeSec: Number((node.payload as any)?.uptimeSec ?? 0),
    })),
    workers: workers.map((worker) => ({
      workerId: worker.workerId,
      runtime: worker.runtime,
      status: worker.status,
      queueName: worker.queueName,
      lastHeartbeatAt: worker.lastHeartbeatAt,
    })),
    sessions: {
      total: userId ? sessions.filter((session) => session.userId === userId).length : sessions.length,
      unhealthy: (userId ? sessions.filter((session) => session.userId === userId) : sessions).filter((session) =>
        ["failed", "orphaned"].includes(session.sessionStatus),
      ).length,
    },
    chips: chipMetrics,
    recentAudit,
  };
}
