import {
  createBehaviorDecisionLog,
  upsertBehaviorSnapshot,
} from "../../db";
import { BEHAVIOR_POLICY_ENGINE_VERSION } from "./behaviorPolicyEngine";
import type { BehaviorPolicyEvaluation } from "./types";
import {
  notifyPolicyEvaluated,
  onActionExecuted,
  onPolicyEvaluated,
  type PolicyEvaluatedContext,
  type PolicyEvaluatedEvent,
} from "./dispatcher";

export type BehaviorPolicyLogContext = {
  userId: number;
  chipId: number;
  requestedAction: string;
  destination?: "console" | "db" | "both";
};

export function formatPolicyDecisionForConsole(entry: {
  chipId: number;
  decision: string;
  reason: string;
  phase: string;
  trustScore: number | null;
  riskScore: number | null;
  budgetUsed: number;
  budgetTotal: number;
  delayMs: number | null;
  engineVersion: string;
  policyFingerprint: string;
}) {
  const delayMinutes = entry.delayMs == null ? "N/D" : `${Math.ceil(entry.delayMs / 60000)} min`;
  return `[POLICY] Chip: ${entry.chipId} | Decision: ${entry.decision} | Reason: ${entry.reason} | Phase: ${entry.phase} | Trust: ${entry.trustScore ?? "N/D"} | Risk: ${entry.riskScore ?? "N/D"} | Budget: ${entry.budgetUsed}/${entry.budgetTotal} | Delay: ${delayMinutes} | Engine: ${entry.engineVersion} | Policy: ${entry.policyFingerprint}`;
}

let loggerRegistered = false;

async function handlePolicyEvaluated(event: PolicyEvaluatedEvent) {
  const destination = event.context.destination ?? "both";
  const decision = event.decision;
  const engineVersion = decision.fingerprint.engineVersion ?? BEHAVIOR_POLICY_ENGINE_VERSION;
  const budgetUsed = decision.dailyBudget.spent;
  const budgetTotal = decision.dailyBudget.limit;
  const decisionLabel = decision.allowed ? (decision.decision === "do_nothing" ? "DEFER" : "ALLOW") : "BLOCK";
  const riskScore =
    typeof decision.checks.risk.metadata?.score === "number"
      ? Number(decision.checks.risk.metadata.score)
      : Math.round((1 - decision.confidence) * 100);

  const consoleEntry = {
    chipId: event.context.chipId,
    decision: decisionLabel,
    reason: decision.reason,
    phase: decision.phase,
    trustScore: decision.trustScore,
    riskScore,
    budgetUsed,
    budgetTotal,
    delayMs: decision.delayMs ?? null,
    engineVersion,
    policyFingerprint: decision.fingerprint.fingerprint,
  };

  if (destination === "console" || destination === "both") {
    console.log(formatPolicyDecisionForConsole(consoleEntry));
  }

  if (destination === "db" || destination === "both") {
    const checksJson = JSON.stringify({
      checks: decision.checks,
      executionTrace: decision.executionTrace,
      fingerprint: decision.fingerprint,
    });
    const contributorsJson = JSON.stringify(decision.contributors);
    const snapshotJson = JSON.stringify({
      phase: decision.phase,
      trustScore: decision.trustScore,
      riskLevel: decision.riskLevel,
      dailyBudget: decision.dailyBudget,
      reciprocity: decision.reciprocity,
      checks: decision.checks,
      executionTrace: decision.executionTrace,
      contributors: decision.contributors,
      fingerprint: decision.fingerprint,
    });

    await createBehaviorDecisionLog({
      userId: event.context.userId,
      chipId: event.context.chipId,
      phase: decision.phase,
      trustScore: decision.trustScore,
      riskScore,
      dailyBudgetUsed: budgetUsed,
      dailyBudgetTotal: budgetTotal,
      sessionId: decision.sessionId,
      requestedAction: event.context.requestedAction,
      decision: decisionLabel,
      reason: decision.reason,
      delayMs: decision.delayMs ?? null,
      nextCheckAt: decision.nextCheckAt,
      engineVersion,
      policyFingerprint: decision.fingerprint.fingerprint,
      checksJson,
      contributorsJson,
    });

    await upsertBehaviorSnapshot({
      userId: event.context.userId,
      chipId: event.context.chipId,
      phase: decision.phase,
      trustScore: decision.trustScore,
      riskScore,
      dailyBudgetUsed: budgetUsed,
      dailyBudgetTotal: budgetTotal,
      inboundCount: decision.reciprocity.inboundCount,
      outboundCount: decision.reciprocity.outboundCount,
      sessionId: decision.sessionId,
      lastDecision: decisionLabel,
      lastReason: decision.reason,
      nextCheckAt: decision.nextCheckAt,
      engineVersion,
      policyFingerprint: decision.fingerprint.fingerprint,
      snapshotJson,
    });
  }
}

async function handleActionExecuted(event: {
  executionId: string;
  decisionId: string;
  chipId: number;
  requestedAction: string;
  status: string;
  budgetState: string;
  messageId: string | null;
  timestamp: string;
  error?: string;
}) {
  console.log(
    `[ACTION] Chip: ${event.chipId} | Execution: ${event.executionId} | Decision: ${event.decisionId} | Action: ${event.requestedAction} | Status: ${event.status} | Budget: ${event.budgetState} | Message: ${event.messageId ?? "N/D"}${event.error ? ` | Error: ${event.error}` : ""}`,
  );
}

export function ensurePolicyLoggerRegistered() {
  if (loggerRegistered) return;
  onPolicyEvaluated(handlePolicyEvaluated);
  onActionExecuted(handleActionExecuted);
  loggerRegistered = true;
}

ensurePolicyLoggerRegistered();

export async function logPolicyDecision(
  decision: BehaviorPolicyEvaluation,
  context: BehaviorPolicyLogContext,
) {
  await notifyPolicyEvaluated(decision, context as PolicyEvaluatedContext);
}
