import {
  createLearningEngineEvent,
  listChipLearningMetrics,
  upsertChipLearningMetric,
  upsertFleetLearningCohort,
  upsertFleetLearningPattern,
  upsertLearningHypothesis,
} from "../../db";
import type { BehaviorPlan } from "../planner/BehaviorPlanner";

export type LearningMetricsMap = Record<
  string,
  {
    successCount: number;
    failureCount: number;
    successRate: number;
    failureRate: number;
    averageResponse: number;
    averageDelay: number;
  }
>;

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function resolveCohortStatus(successRate: number, failureRate: number) {
  if (successRate >= 80) return "elite" as const;
  if (successRate >= 60) return "stable" as const;
  if (failureRate >= 60) return "critical" as const;
  return "emerging" as const;
}

function resolvePatternStatus(successRate: number, failureRate: number, totalCount: number) {
  if (failureRate >= 70 && totalCount >= 5) return "retired" as const;
  if (successRate >= 78 && totalCount >= 8) return "active" as const;
  if (successRate >= 65 && totalCount >= 4) return "promoted" as const;
  return "candidate" as const;
}

function resolveRecommendationType(successRate: number, failureRate: number) {
  if (failureRate >= 70) return "throttle";
  if (successRate >= 75) return "reinforce";
  return "observe";
}

export async function loadLearningMetricsMap(chipId: number, userId: number): Promise<LearningMetricsMap> {
  const rows = await listChipLearningMetrics(chipId, userId);
  return Object.fromEntries(
    rows.map((row) => [
      row.actionKey,
      {
        successCount: Number(row.successCount ?? 0),
        failureCount: Number(row.failureCount ?? 0),
        successRate: Number(row.successRate ?? 0),
        failureRate: Number(row.failureRate ?? 0),
        averageResponse: Number(row.averageResponse ?? 0),
        averageDelay: Number(row.averageDelay ?? 0),
      },
    ])
  );
}

export function applyLearningToPlan(
  plan: BehaviorPlan,
  metrics: LearningMetricsMap
): BehaviorPlan {
  const metric = metrics[plan.action];
  if (!metric) {
    return plan;
  }

  const learningBias = (metric.successRate - metric.failureRate) / 100;
  const adjustedProbability = Math.max(0.05, Math.min(0.99, Number((plan.probability + learningBias * 0.18).toFixed(2))));
  const reasonSuffix =
    metric.successCount + metric.failureCount > 0
      ? `Aprendizado: sucesso ${metric.successRate}% / falha ${metric.failureRate}%.`
      : "Aprendizado ainda sem amostra suficiente.";

  if (metric.failureRate >= 75 && metric.successCount + metric.failureCount >= 4) {
    return {
      ...plan,
      action: "do_nothing",
      engine: "none",
      probability: Math.max(0.05, Number((1 - adjustedProbability).toFixed(2))),
      reason: `${plan.reason} ${reasonSuffix} A ação foi temporariamente freada pelo histórico ruim.`,
    };
  }

  return {
    ...plan,
    probability: adjustedProbability,
    reason: `${plan.reason} ${reasonSuffix}`,
  };
}

export async function registerLearningOutcome(params: {
  chipId: number;
  userId: number;
  plan: BehaviorPlan;
  result: "success" | "failed" | "skipped";
  durationMs?: number;
  responseDelayMs?: number;
}) {
  const { chipId, userId, plan, result } = params;
  const currentMap = await loadLearningMetricsMap(chipId, userId);
  const current = currentMap[plan.action] ?? {
    successCount: 0,
    failureCount: 0,
    successRate: 0,
    failureRate: 0,
    averageResponse: 0,
    averageDelay: 0,
  };

  const successCount = current.successCount + (result === "success" ? 1 : 0);
  const failureCount = current.failureCount + (result === "failed" ? 1 : 0);
  const totalCount = Math.max(1, successCount + failureCount);
  const averageResponse =
    params.responseDelayMs !== undefined
      ? Math.round(((current.averageResponse * (totalCount - 1)) + params.responseDelayMs) / totalCount)
      : current.averageResponse;
  const averageDelay =
    params.durationMs !== undefined
      ? Math.round(((current.averageDelay * (totalCount - 1)) + params.durationMs) / totalCount)
      : current.averageDelay;
  const successRate = clamp((successCount / totalCount) * 100);
  const failureRate = clamp((failureCount / totalCount) * 100);

  await upsertChipLearningMetric({
    userId,
    chipId,
    actionKey: plan.action,
    successCount,
    failureCount,
    successRate,
    failureRate,
    averageResponse,
    averageDelay,
    payload: {
      engine: plan.engine,
      lastResult: result,
      reason: plan.reason,
    },
  });

  const hypothesisKey = `action:${plan.action}`;
  await upsertLearningHypothesis({
    userId,
    hypothesisKey,
    status: totalCount >= 8 && successRate >= 70 ? "validated" : totalCount >= 3 ? "candidate" : "draft",
    title: `Efetividade da ação ${plan.action}`,
    confidence: clamp(Math.min(100, totalCount * 12)),
    sampleSize: totalCount,
    successRate,
    contradictionRate: failureRate,
    temporalStability: clamp(100 - Math.abs(successRate - failureRate)),
    segmentConsistency: clamp(50 + successRate * 0.4 - failureRate * 0.2),
    lastValidatedAt: totalCount >= 3 ? new Date() : null,
    payload: {
      chipId,
      averageResponse,
      averageDelay,
    },
  });

  await upsertFleetLearningCohort({
    userId,
    cohortKey: `action:${plan.action}`,
    status: resolveCohortStatus(successRate, failureRate),
    title: `Coorte da ação ${plan.action}`,
    chipCount: 1,
    averageSuccessRate: successRate,
    averageRiskScore: 0,
    averageCredibilityScore: clamp((successRate + (100 - failureRate)) / 2),
    lastComputedAt: new Date(),
    payload: {
      chipId,
      sampleSize: totalCount,
      contradictionRate: failureRate,
    },
  });

  await upsertFleetLearningPattern({
    userId,
    patternKey: `pattern:${plan.action}`,
    cohortKey: `action:${plan.action}`,
    status: resolvePatternStatus(successRate, failureRate, totalCount),
    title: `Padrão de ${plan.action}`,
    confidence: clamp(Math.min(100, totalCount * 10)),
    sampleSize: totalCount,
    successRate,
    riskScore: failureRate,
    recommendationType: resolveRecommendationType(successRate, failureRate),
    lastValidatedAt: totalCount >= 3 ? new Date() : null,
    payload: {
      averageResponse,
      averageDelay,
      contradictionRate: failureRate,
    },
  });

  await createLearningEngineEvent({
    userId,
    chipId,
    eventType:
      result === "success"
        ? "validated"
        : result === "failed"
          ? "contradicted"
          : "observed",
    referenceKey: hypothesisKey,
    payload: {
      action: plan.action,
      result,
      successRate,
      failureRate,
    },
  });

  return {
    successCount,
    failureCount,
    successRate,
    failureRate,
    averageResponse,
    averageDelay,
  };
}
