import { evaluateBehaviorPolicy } from "./behavior/behaviorPolicyEngine";
export type OpportunitySignal = {
  signalId?: string;
  hasUnreadReply?: boolean;
  hasRecentStatus?: boolean;
  hasRecentGroupMovement?: boolean;
  lastInteractionAt?: Date | null;
  cooldownUntil?: Date | null;
};

export type BehaviorIntent =
  | "increase_trust"
  | "socialize"
  | "observe"
  | "stay_low_profile"
  | "reply_if_prompted"
  | "do_nothing";

export type PlannerRiskDimensionName =
  | "connectionRisk"
  | "spamRisk"
  | "behaviorRisk"
  | "reputationRisk"
  | "timingRisk"
  | "socialExposureRisk";

export type PlannerDecision = "act_now" | "wait" | "do_nothing";

export type PlannerAction =
  | "reply"
  | "view_status"
  | "read_messages"
  | "join_group"
  | "observe_profile"
  | "message_sent"
  | "do_nothing";

export type PlannerReference = {
  id: string;
  label?: string;
};

export type PlannerConfidenceAssessment = {
  confidence: number;
  support: number;
  contradictions: number;
  sampleSize: number;
};

export type PlannerRiskAssessment = {
  overallRisk: number;
  status: "low" | "attention" | "high";
  dimensions: Record<PlannerRiskDimensionName, number>;
  summary?: string;
};

export type OpportunityHistoryEntry = {
  opportunityKey: string;
  observedAt: Date;
  decision: PlannerDecision;
  reason: string;
  riskStatus: PlannerRiskAssessment["status"];
  confidence: number;
};

export type BehaviorExplainability = {
  why: string;
  hypotheses: PlannerReference[];
  knowledge: PlannerReference[];
  identity: string;
  evidence: string[];
  risk: string;
};

export type BehaviorSimulationLog = {
  mode: "simulation" | "live";
  wouldExecute: boolean;
  expectedAction: PlannerAction;
  blockedBy: string[];
  comparisonHint: string;
};

export type BehaviorPlan = {
  opportunityKey: string;
  decision: PlannerDecision;
  action: PlannerAction;
  plannedAt: Date | null;
  delayMinutes: number | null;
  rationale: string;
  confidenceAssessment: PlannerConfidenceAssessment;
  explainability: BehaviorExplainability;
  history: {
    attempts: number;
    lastDecision: PlannerDecision | null;
    repeatedOpportunity: boolean;
  };
  risk: PlannerRiskAssessment;
  simulation: BehaviorSimulationLog;
};

function clamp01(value: number) {
  return Math.max(0, Math.min(1, Number(value.toFixed(4))));
}

function deriveOpportunityKey(opportunity: OpportunitySignal) {
  return (
    (opportunity.signalId ??
      [
        opportunity.hasUnreadReply ? "reply" : null,
        opportunity.hasRecentStatus ? "status" : null,
        opportunity.hasRecentGroupMovement ? "group" : null,
      ]
        .filter(Boolean)
        .join(":")) ||
    "no_opportunity"
  );
}

function defaultRiskAssessment(): PlannerRiskAssessment {
  return {
    overallRisk: 0.2,
    status: "low",
    summary: "sem leitura dimensional explícita; postura conservadora por padrão",
    dimensions: {
      connectionRisk: 0.2,
      spamRisk: 0.2,
      behaviorRisk: 0.2,
      reputationRisk: 0.2,
      timingRisk: 0.2,
      socialExposureRisk: 0.2,
    },
  };
}

function buildConfidenceAssessment(params: {
  decision: PlannerDecision;
  opportunity: OpportunitySignal;
  risk: PlannerRiskAssessment;
  history: OpportunityHistoryEntry[];
  hypotheses: PlannerReference[];
  knowledge: PlannerReference[];
}) {
  const support =
    (params.opportunity.hasUnreadReply ? 2 : 0) +
    (params.opportunity.hasRecentStatus ? 1 : 0) +
    (params.opportunity.hasRecentGroupMovement ? 1 : 0) +
    params.hypotheses.length +
    params.knowledge.length;
  const contradictions =
    (params.risk.overallRisk >= 0.75 ? 2 : 0) +
    (params.risk.dimensions.timingRisk >= 0.7 ? 1 : 0) +
    params.history.filter((item) => item.decision !== "act_now").length;
  const sampleSize = Math.max(params.history.length, support + contradictions, 1);
  const base =
    params.decision === "act_now"
      ? 0.72
      : params.decision === "wait"
        ? 0.78
        : 0.82;

  return {
    confidence: clamp01(base + support * 0.03 - contradictions * 0.04 - params.risk.overallRisk * 0.15),
    support,
    contradictions,
    sampleSize,
  } satisfies PlannerConfidenceAssessment;
}

function buildExplainability(params: {
  rationale: string;
  risk: PlannerRiskAssessment;
  hypotheses: PlannerReference[];
  knowledge: PlannerReference[];
  identitySummary?: string;
  evidenceReferences?: string[];
}) {
  return {
    why: params.rationale,
    hypotheses: params.hypotheses,
    knowledge: params.knowledge,
    identity: params.identitySummary ?? "identidade não informada; decisão operou em modo conservador",
    evidence: params.evidenceReferences ?? [],
    risk: params.risk.summary ?? `risco ${params.risk.status} com overall ${params.risk.overallRisk.toFixed(2)}`,
  } satisfies BehaviorExplainability;
}

function buildSimulation(params: {
  executionMode: "simulation" | "live";
  decision: PlannerDecision;
  action: PlannerAction;
  blockedBy: string[];
}) {
  const wouldExecute = params.executionMode === "live" && params.decision === "act_now" && params.blockedBy.length === 0;
  return {
    mode: params.executionMode,
    wouldExecute,
    expectedAction: params.action,
    blockedBy: params.blockedBy,
    comparisonHint:
      params.executionMode === "simulation"
        ? "simulação gerada para comparar plano do sistema com escolha humana antes de qualquer envio"
        : "plano pronto para execução somente se os bloqueios permanecerem vazios",
  } satisfies BehaviorSimulationLog;
}

export function buildBehaviorPlan(params: {
  intent: BehaviorIntent;
  opportunity: OpportunitySignal;
  now?: Date;
  history?: OpportunityHistoryEntry[];
  risk?: PlannerRiskAssessment | null;
  hypothesisReferences?: PlannerReference[];
  knowledgeReferences?: PlannerReference[];
  evidenceReferences?: string[];
  identitySummary?: string;
  executionMode?: "simulation" | "live";
  policyContext?: {
    chipId?: number;
    chipAgeDays?: number;
    trustScore?: number | null;
    riskScore?: number | null;
    inboundCount?: number;
    outboundCount?: number;
    todayActionCount?: number;
    todayActionTypes?: string[];
    lastInboundAt?: Date | null;
    lastOutboundAt?: Date | null;
  };
}) {
  const now = params.now ?? new Date();
  const risk = params.risk ?? defaultRiskAssessment();
  const history = params.history ?? [];
  const hypotheses = params.hypothesisReferences ?? [];
  const knowledge = params.knowledgeReferences ?? [];
  const executionMode = params.executionMode ?? "live";
  const opportunityKey = deriveOpportunityKey(params.opportunity);
  const relatedHistory = history.filter((item) => item.opportunityKey === opportunityKey);
  const lastHistory = relatedHistory.at(-1) ?? null;
  const repeatedOpportunity = relatedHistory.length > 0;
  const blockedBy: string[] = [];

  const desiredAction: PlannerAction = params.opportunity.hasUnreadReply
    ? "reply"
    : params.opportunity.hasRecentStatus
      ? "view_status"
      : params.opportunity.hasRecentGroupMovement && params.intent === "socialize"
        ? "read_messages"
        : params.intent === "increase_trust"
          ? "observe_profile"
          : params.intent === "do_nothing" || params.intent === "stay_low_profile"
            ? "do_nothing"
            : "do_nothing";

  let decision: PlannerDecision;
  let action: PlannerAction;
  let plannedAt: Date | null;
  let delayMinutes: number | null;
  let rationale: string;
  const hasPolicyContext = params.policyContext != null;

  const policyDecision = hasPolicyContext
    ? evaluateBehaviorPolicy({
        chipId: params.policyContext?.chipId ?? 0,
        action: desiredAction,
        chipAgeDays: params.policyContext?.chipAgeDays ?? 0,
        trustScore: params.policyContext?.trustScore,
        riskScore: params.policyContext?.riskScore ?? risk.overallRisk * 100,
        stats: {
          inboundCount: params.policyContext?.inboundCount ?? 0,
          outboundCount: params.policyContext?.outboundCount ?? 0,
          todayActionCount: params.policyContext?.todayActionCount ?? 0,
          todayActionTypes: params.policyContext?.todayActionTypes ?? [],
          lastInboundAt: params.policyContext?.lastInboundAt ?? null,
          lastOutboundAt: params.policyContext?.lastOutboundAt ?? null,
        },
        cooldownUntil: params.opportunity.cooldownUntil,
        now,
      })
    : null;

  if (repeatedOpportunity && lastHistory?.decision !== "act_now" && risk.overallRisk >= 0.55) {
    decision = "wait";
    action = "do_nothing";
    plannedAt = new Date(now.getTime() + 30 * 60000);
    delayMinutes = 30;
    rationale = "mesma oportunidade já foi recusada recentemente e segue com risco relevante";
    blockedBy.push("repeated_opportunity");
  } else if (!hasPolicyContext && params.opportunity.cooldownUntil && params.opportunity.cooldownUntil.getTime() > now.getTime()) {
    decision = "wait";
    action = "do_nothing";
    plannedAt = params.opportunity.cooldownUntil;
    delayMinutes = Math.max(1, Math.round((params.opportunity.cooldownUntil.getTime() - now.getTime()) / 60000));
    rationale = "cooldown ativo";
    blockedBy.push("cooldown");
  } else if (!hasPolicyContext && (risk.status === "high" || risk.overallRisk >= 0.75)) {
    decision = "wait";
    action = "do_nothing";
    plannedAt = new Date(now.getTime() + 60 * 60000);
    delayMinutes = 60;
    rationale = "risco alto; oportunidade registrada para reavaliação posterior";
    blockedBy.push("high_risk");
  } else if (!hasPolicyContext && params.opportunity.hasUnreadReply) {
    decision = "act_now";
    action = "reply";
    plannedAt = now;
    delayMinutes = 0;
    rationale = "existe oportunidade real de resposta";
  } else if (!hasPolicyContext && params.opportunity.hasRecentStatus) {
    decision = "act_now";
    action = "view_status";
    plannedAt = now;
    delayMinutes = 0;
    rationale = "status recente cria oportunidade passiva";
  } else if (!hasPolicyContext && params.opportunity.hasRecentGroupMovement && params.intent === "socialize") {
    decision = "act_now";
    action = "read_messages";
    plannedAt = now;
    delayMinutes = 0;
    rationale = "movimento recente em grupo justifica presença observável sem emissão imediata";
  } else if (!hasPolicyContext) {
    decision = params.intent === "do_nothing" || params.intent === "stay_low_profile" ? "do_nothing" : "wait";
    action = "do_nothing";
    plannedAt = null;
    delayMinutes = null;
    rationale = "não há oportunidade natural no momento";
  } else if (!policyDecision) {
    decision = "wait";
    action = "do_nothing";
    plannedAt = null;
    delayMinutes = null;
    rationale = "contexto de política indisponível";
    blockedBy.push("policy_context_unavailable");
  } else if (!policyDecision?.allowed) {
    decision = policyDecision.decision === "do_nothing" ? "do_nothing" : "wait";
    action = "do_nothing";
    plannedAt = policyDecision.nextCheckAt;
    delayMinutes = policyDecision.delayMinutes;
    rationale = policyDecision.reason;
    blockedBy.push(...policyDecision.restrictions);
  } else {
    decision = policyDecision.decision;
    action = policyDecision.action as PlannerAction;
    plannedAt = policyDecision.decision === "act_now" ? new Date(now.getTime() + policyDecision.delayMs) : null;
    delayMinutes = policyDecision.delayMinutes;
    rationale =
      policyDecision.action === "reply"
        ? "existe oportunidade real de resposta e a política permitiu atuação"
        : policyDecision.action === "view_status"
          ? "status recente cria oportunidade passiva aprovada pela política"
          : policyDecision.action === "read_messages"
            ? "movimento recente em grupo justifica observação dentro da política"
            : policyDecision.reason;
  }

  const confidenceAssessment = buildConfidenceAssessment({
    decision,
    opportunity: params.opportunity,
    risk,
    history: relatedHistory,
    hypotheses,
    knowledge,
  });

  return {
    opportunityKey,
    decision,
    action,
    plannedAt,
    delayMinutes,
    rationale,
    confidenceAssessment,
    explainability: buildExplainability({
      rationale,
      risk,
      hypotheses,
      knowledge,
      identitySummary: params.identitySummary,
      evidenceReferences: params.evidenceReferences,
    }),
    history: {
      attempts: relatedHistory.length,
      lastDecision: lastHistory?.decision ?? null,
      repeatedOpportunity,
    },
    risk,
    simulation: buildSimulation({
      executionMode,
      decision,
      action,
      blockedBy,
    }),
  } satisfies BehaviorPlan;
}

export function simulateBehaviorPlan(
  params: Omit<Parameters<typeof buildBehaviorPlan>[0], "executionMode">
) {
  return buildBehaviorPlan({
    ...params,
    executionMode: "simulation",
  });
}
