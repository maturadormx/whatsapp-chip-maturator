import {
  getUserChips,
  listAuditEvents,
  listBehaviorActionExecutionsByChip,
  listBehaviorDecisionLogs,
  listUserExecutionJobs,
} from "../../db";

export async function buildDataWarehouseSnapshot(userId: number) {
  const [chips, jobs, audit] = await Promise.all([
    getUserChips(userId),
    listUserExecutionJobs(userId, 200),
    listAuditEvents({ userId, limit: 200 }),
  ]);

  const chipRows = await Promise.all(
    chips.slice(0, 50).map(async (chip) => {
      const [decisions, executions] = await Promise.all([
        listBehaviorDecisionLogs(chip.id, 50),
        listBehaviorActionExecutionsByChip(chip.id, 50),
      ]);

      return {
        chipId: chip.id,
        chipName: chip.chipName,
        decisions: decisions.length,
        waits: decisions.filter((decision) => decision.decision === "wait").length,
        actionsAcked: executions.filter((execution) => execution.status === "ACKED").length,
        actionsFailed: executions.filter((execution) => execution.status === "FAILED").length,
      };
    }),
  );

  const totalAcked = chipRows.reduce((sum, row) => sum + row.actionsAcked, 0);
  const totalFailed = chipRows.reduce((sum, row) => sum + row.actionsFailed, 0);

  return {
    generatedAt: new Date().toISOString(),
    executiveIndicators: {
      chips: chips.length,
      executionJobs: jobs.length,
      completedJobs: jobs.filter((job) => job.status === "completed").length,
      successRate:
        totalAcked + totalFailed > 0 ? Number((totalAcked / (totalAcked + totalFailed)).toFixed(2)) : 0,
      recentAuditEvents: audit.length,
    },
    chips: chipRows,
    jobMix: {
      maturation: jobs.filter((job) => job.executionType === "maturation").length,
      dispatch: jobs.filter((job) => job.executionType === "dispatch").length,
    },
  };
}
