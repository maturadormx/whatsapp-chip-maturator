import { getBehaviorSnapshot, getChipById, getUserChips, listBehaviorDecisionLogs } from "../../db";
import { simulateBehaviorPlan, type BehaviorIntent, type OpportunitySignal } from "../behaviorPlannerService";
import { recordAuditEvent } from "../audit/AuditEngine";

function resolveRiskStatus(score: number) {
  if (score >= 70) return "high" as const;
  if (score >= 40) return "attention" as const;
  return "low" as const;
}

export async function simulateChipDecision(params: {
  userId: number;
  chipId: number;
  intent?: BehaviorIntent;
  opportunity?: OpportunitySignal;
}) {
  const chip = await getChipById(params.chipId);
  if (!chip || chip.userId !== params.userId) {
    throw new Error(`chip_not_found:${params.chipId}`);
  }

  const [snapshot, decisionHistory] = await Promise.all([
    getBehaviorSnapshot(params.chipId),
    listBehaviorDecisionLogs(params.chipId, 20),
  ]);

  const history = decisionHistory.map((decision) => ({
    opportunityKey: decision.requestedAction,
    observedAt: new Date(decision.createdAt),
    decision: decision.decision as "act_now" | "wait" | "do_nothing",
    reason: decision.reason,
    riskStatus: resolveRiskStatus(decision.riskScore ?? 0),
    confidence: Number(decision.trustScore ?? 0) / 100,
  }));

  const simulation = simulateBehaviorPlan({
    intent: params.intent ?? "observe",
    opportunity: params.opportunity ?? {
      signalId: `chip:${params.chipId}:synthetic`,
      hasUnreadReply: false,
      hasRecentStatus: true,
      hasRecentGroupMovement: false,
      cooldownUntil: snapshot?.nextCheckAt ?? null,
    },
    history,
    risk: {
      overallRisk: Number(((snapshot?.riskScore ?? 20) / 100).toFixed(2)),
      status: resolveRiskStatus(snapshot?.riskScore ?? 0),
      dimensions: {
        connectionRisk: Number(((snapshot?.riskScore ?? 20) / 100).toFixed(2)),
        spamRisk: Number(((snapshot?.riskScore ?? 20) / 100).toFixed(2)),
        behaviorRisk: Number(((snapshot?.riskScore ?? 20) / 100).toFixed(2)),
        reputationRisk: Number(((snapshot?.riskScore ?? 20) / 100).toFixed(2)),
        timingRisk: 0.25,
        socialExposureRisk: 0.2,
      },
      summary: snapshot?.lastReason ?? "simulação gerada a partir do snapshot operacional atual",
    },
    identitySummary: chip.chipName,
    policyContext: {
      chipId: params.chipId,
      trustScore: snapshot?.trustScore ?? 0,
      riskScore: snapshot?.riskScore ?? 0,
      todayActionCount: snapshot?.dailyBudgetUsed ?? 0,
      todayActionTypes: [],
      inboundCount: snapshot?.inboundCount ?? 0,
      outboundCount: snapshot?.outboundCount ?? 0,
    },
  });

  await recordAuditEvent({
    userId: params.userId,
    chipId: params.chipId,
    engine: "DigitalTwinService",
    action: "chip_decision_simulated",
    entityType: "digital_twin",
    entityId: String(params.chipId),
    payload: {
      decision: simulation.decision,
      action: simulation.action,
      blockedBy: simulation.simulation.blockedBy,
    },
  }).catch(() => null);

  return {
    chipId: params.chipId,
    chipName: chip.chipName,
    twinState: {
      trustScore: snapshot?.trustScore ?? 0,
      riskScore: snapshot?.riskScore ?? 0,
      phase: snapshot?.phase ?? null,
    },
    simulation,
  };
}

export async function simulateFleetDecision(userId: number) {
  const chips = await getUserChips(userId);
  const simulations = await Promise.all(
    chips.slice(0, 20).map((chip) =>
      simulateChipDecision({
        userId,
        chipId: chip.id,
      }),
    ),
  );

  return {
    generatedAt: new Date().toISOString(),
    chips: simulations.length,
    blocked: simulations.filter((entry) => entry.simulation.simulation.blockedBy.length > 0).length,
    actNow: simulations.filter((entry) => entry.simulation.decision === "act_now").length,
    wait: simulations.filter((entry) => entry.simulation.decision === "wait").length,
    items: simulations,
  };
}
