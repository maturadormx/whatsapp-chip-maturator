import {
  getBehaviorSnapshot,
  getUserChips,
  listAuditEvents,
  listBehaviorActionExecutionsByChip,
  listBehaviorDecisionLogs,
} from "../../db";
import { recordAuditEvent } from "../audit/AuditEngine";
import { getConfigurationCenter } from "../config/ConfigurationCenter";
import type { OptimizationRecommendation } from "./intelligenceTypes";

const OPTIMIZATION_PROFILE_KEY = "ai_optimization.profile";

export async function analyzeOptimizationOpportunities(userId: number) {
  const chips = await getUserChips(userId);
  const inspected = await Promise.all(
    chips.slice(0, 50).map(async (chip) => {
      const [snapshot, decisions, executions] = await Promise.all([
        getBehaviorSnapshot(chip.id),
        listBehaviorDecisionLogs(chip.id, 30),
        listBehaviorActionExecutionsByChip(chip.id, 30),
      ]);

      return {
        chip,
        snapshot,
        decisions,
        executions,
      };
    }),
  );

  const totals = inspected.reduce(
    (acc, item) => {
      acc.totalDecisions += item.decisions.length;
      acc.waitDecisions += item.decisions.filter((decision) => decision.decision === "wait").length;
      acc.failedExecutions += item.executions.filter((execution) => execution.status === "FAILED").length;
      acc.ackedExecutions += item.executions.filter((execution) => execution.status === "ACKED").length;
      acc.highRiskSnapshots += item.snapshot?.riskScore && item.snapshot.riskScore >= 70 ? 1 : 0;
      return acc;
    },
    {
      totalDecisions: 0,
      waitDecisions: 0,
      failedExecutions: 0,
      ackedExecutions: 0,
      highRiskSnapshots: 0,
    },
  );

  const waitRatio = totals.totalDecisions > 0 ? totals.waitDecisions / totals.totalDecisions : 0;
  const failureRatio =
    totals.failedExecutions + totals.ackedExecutions > 0
      ? totals.failedExecutions / (totals.failedExecutions + totals.ackedExecutions)
      : 0;

  const recommendations: OptimizationRecommendation[] = [];

  if (waitRatio > 0.45) {
    recommendations.push({
      key: "planner.reduce_default_cooldown",
      title: "Reduzir cooldown padrão",
      summary: "O planner está esperando demais; vale ajustar o cooldown base para recuperar fluidez sem romper o gating.",
      impact: "high",
      suggestedConfigKey: "runtime.ai_optimizer.cooldown_multiplier",
      suggestedValue: 0.85,
    });
  }

  if (failureRatio > 0.25) {
    recommendations.push({
      key: "planner.raise_risk_penalty",
      title: "Endurecer penalidade de risco",
      summary: "A taxa de falha recente sugere agressividade excessiva; convém elevar o peso de risco nas decisões automáticas.",
      impact: "high",
      suggestedConfigKey: "runtime.ai_optimizer.risk_weight",
      suggestedValue: 1.2,
    });
  }

  if (totals.highRiskSnapshots > Math.max(1, Math.ceil(inspected.length * 0.2))) {
    recommendations.push({
      key: "planner.raise_observation_bias",
      title: "Aumentar viés de observação",
      summary: "Há chips demais em faixa de risco alta; o sistema deve favorecer mais ações passivas e observacionais.",
      impact: "medium",
      suggestedConfigKey: "runtime.ai_optimizer.observe_bias",
      suggestedValue: 1.15,
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      key: "planner.keep_current_profile",
      title: "Manter perfil atual",
      summary: "Os sinais recentes não justificam ajuste automático relevante no planner.",
      impact: "low",
    });
  }

  const auditSignals = await listAuditEvents({
    userId,
    engine: "NotificationCenter",
    limit: 20,
  });

  return {
    generatedAt: new Date().toISOString(),
    fleet: {
      chips: inspected.length,
      totalDecisions: totals.totalDecisions,
      waitRatio: Number(waitRatio.toFixed(2)),
      failureRatio: Number(failureRatio.toFixed(2)),
      highRiskSnapshots: totals.highRiskSnapshots,
    },
    operationalSignals: {
      recentAlerts: auditSignals.length,
    },
    recommendations,
  };
}

export async function applyOptimizationRecommendation(params: {
  userId: number;
  key: string;
  value: unknown;
}) {
  const current = await getConfigurationCenter().get<Record<string, unknown>>(OPTIMIZATION_PROFILE_KEY, {});
  const next = {
    ...current,
    [params.key]: params.value,
    updatedAt: new Date().toISOString(),
  };

  await getConfigurationCenter().set({
    key: OPTIMIZATION_PROFILE_KEY,
    value: next,
    description: "Perfil de otimização automática do planner.",
  });

  await recordAuditEvent({
    userId: params.userId,
    engine: "AIOptimizationEngineService",
    action: "optimization_recommendation_applied",
    entityType: "optimization_profile",
    entityId: params.key,
    payload: {
      value: params.value,
    },
  }).catch(() => null);

  return next;
}

export async function getOptimizationProfile() {
  return getConfigurationCenter().get<Record<string, unknown>>(OPTIMIZATION_PROFILE_KEY, {});
}
