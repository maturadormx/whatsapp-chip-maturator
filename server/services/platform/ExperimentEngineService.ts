import { getUserChips, listBehaviorActionExecutionsByChip, listBehaviorDecisionLogs } from "../../db";
import { recordAuditEvent } from "../audit/AuditEngine";
import { getConfigurationCenter } from "../config/ConfigurationCenter";
import { applyOptimizationRecommendation } from "./AIOptimizationEngineService";
import type { ExperimentDefinition } from "./intelligenceTypes";

function experimentKey(key: string) {
  return `experiment.definition.${key.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "_")}`;
}

export async function listExperiments() {
  const rows = await getConfigurationCenter().list("experiment.definition.");
  return rows
    .map((row) => row.payload as ExperimentDefinition | null)
    .filter((row): row is ExperimentDefinition => Boolean(row))
    .sort((a, b) => a.key.localeCompare(b.key));
}

export async function upsertExperimentDefinition(input: Omit<ExperimentDefinition, "updatedAt"> & { userId?: number | null }) {
  const next: ExperimentDefinition = {
    ...input,
    updatedAt: new Date().toISOString(),
  };

  await getConfigurationCenter().set({
    key: experimentKey(input.key),
    value: next,
    description: "Experimento A/B entre estratégias de chips.",
  });

  await recordAuditEvent({
    userId: input.userId ?? null,
    engine: "ExperimentEngineService",
    action: "experiment_upserted",
    entityType: "experiment",
    entityId: input.key,
    payload: next,
  }).catch(() => null);

  return next;
}

function splitCohorts(chipIds: number[]) {
  const a: number[] = [];
  const b: number[] = [];
  for (const chipId of chipIds) {
    if (chipId % 2 === 0) {
      a.push(chipId);
    } else {
      b.push(chipId);
    }
  }
  return { a, b };
}

export async function evaluateExperiment(userId: number, experimentKeyValue: string) {
  const experiment = await getConfigurationCenter().get<ExperimentDefinition | null>(experimentKey(experimentKeyValue), null);
  if (!experiment) {
    throw new Error(`experiment_not_found:${experimentKeyValue}`);
  }

  const chips = await getUserChips(userId);
  const chipIds = experiment.cohortChipIds?.length ? experiment.cohortChipIds : chips.map((chip) => chip.id);
  const cohorts = splitCohorts(chipIds);

  const evaluateCohort = async (ids: number[]) => {
    const entries = await Promise.all(
      ids.map(async (chipId) => {
        const [executions, decisions] = await Promise.all([
          listBehaviorActionExecutionsByChip(chipId, 20),
          listBehaviorDecisionLogs(chipId, 20),
        ]);
        const acked = executions.filter((execution) => execution.status === "ACKED").length;
        const failed = executions.filter((execution) => execution.status === "FAILED").length;
        const confidence =
          decisions.length > 0
            ? decisions.reduce((sum, decision) => sum + Number((decision.trustScore ?? 0) - (decision.riskScore ?? 0)), 0) / decisions.length
            : 0;
        return { acked, failed, confidence };
      }),
    );

    const acked = entries.reduce((sum, entry) => sum + entry.acked, 0);
    const failed = entries.reduce((sum, entry) => sum + entry.failed, 0);
    const averageConfidence =
      entries.length > 0 ? Number((entries.reduce((sum, entry) => sum + entry.confidence, 0) / entries.length).toFixed(2)) : 0;

    return {
      chips: ids.length,
      ackRate: acked + failed > 0 ? Number((acked / (acked + failed)).toFixed(2)) : 0,
      failureRate: acked + failed > 0 ? Number((failed / (acked + failed)).toFixed(2)) : 0,
      decisionConfidence: averageConfidence,
    };
  };

  const [cohortA, cohortB] = await Promise.all([evaluateCohort(cohorts.a), evaluateCohort(cohorts.b)]);
  const winner =
    experiment.metric === "failure_rate"
      ? cohortA.failureRate <= cohortB.failureRate
        ? "A"
        : "B"
      : experiment.metric === "decision_confidence"
        ? cohortA.decisionConfidence >= cohortB.decisionConfidence
          ? "A"
          : "B"
        : cohortA.ackRate >= cohortB.ackRate
          ? "A"
          : "B";

  if (experiment.autoPromoteWinner) {
    await applyOptimizationRecommendation({
      userId,
      key: `experiment.${experiment.key}.winner`,
      value: winner === "A" ? experiment.strategyA : experiment.strategyB,
    }).catch(() => null);
  }

  const result = {
    experiment: experiment.key,
    metric: experiment.metric,
    cohorts: {
      A: cohortA,
      B: cohortB,
    },
    winner,
    promoted: experiment.autoPromoteWinner,
  };

  await recordAuditEvent({
    userId,
    engine: "ExperimentEngineService",
    action: "experiment_evaluated",
    entityType: "experiment",
    entityId: experiment.key,
    payload: result,
  }).catch(() => null);

  return result;
}
