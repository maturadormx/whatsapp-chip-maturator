import {
  getBehaviorPolicyHash,
  getBehaviorPolicyVersion,
  loadBehaviorPolicyConfig,
} from "./behaviorPolicyConfig";
import { calculateDailyBudget } from "./dailyBudget";
import { generateBehaviorDelayMs } from "./jitterEngine";
import { resolveBehaviorPhase, isActionAllowedInPhase } from "./phaseGate";
import { evaluateReciprocity } from "./reciprocity";
import { createBehaviorSession } from "./sessionEngine";
import type {
  BehaviorPolicyAction,
  BehaviorPolicyCheck,
  BehaviorPolicyChecks,
  BehaviorPolicyContributor,
  BehaviorPolicyEvaluation,
  BehaviorPolicyFingerprint,
  BehaviorPolicyStats,
} from "./types";

function normalizeRiskLevel(riskScore: number, attentionThreshold: number, blockThreshold: number) {
  if (riskScore >= blockThreshold) {
    return "high" as const;
  }
  if (riskScore >= attentionThreshold) {
    return "attention" as const;
  }
  return "low" as const;
}

export const BEHAVIOR_POLICY_ENGINE_VERSION = "2.1.0";

const CHECK_ORDER: BehaviorPolicyCheck["rule"][] = ["phase", "risk", "cooldown", "budget", "reciprocity", "session"];

function createCheck(params: {
  rule: BehaviorPolicyCheck["rule"];
  passed: boolean;
  order: number;
  detail: string;
  metadata?: Record<string, unknown>;
}): BehaviorPolicyCheck {
  return {
    rule: params.rule,
    status: params.passed ? "PASS" : "FAIL",
    passed: params.passed,
    order: params.order,
    detail: params.detail,
    metadata: params.metadata,
  };
}

function createSkippedCheck(params: {
  rule: BehaviorPolicyCheck["rule"];
  order: number;
  detail: string;
}): BehaviorPolicyCheck {
  return {
    rule: params.rule,
    status: "SKIPPED",
    passed: false,
    order: params.order,
    detail: params.detail,
  };
}

function buildChecksMap(trace: BehaviorPolicyCheck[]): BehaviorPolicyChecks {
  const map = {} as BehaviorPolicyChecks;
  for (const check of trace) {
    map[check.rule] = check;
  }
  return map;
}

function buildContributors(trace: BehaviorPolicyCheck[]): BehaviorPolicyContributor[] {
  return trace.map((check) => ({
    rule: check.rule,
    impact: check.status === "FAIL" ? "block" : check.status === "PASS" ? "allow" : "neutral",
    order: check.order,
    status: check.status,
    detail: check.detail,
  }));
}

function buildFingerprint(): BehaviorPolicyFingerprint {
  const config = loadBehaviorPolicyConfig();
  const policyVersion = getBehaviorPolicyVersion(config);
  const policyHash = getBehaviorPolicyHash(config);
  return {
    engineVersion: BEHAVIOR_POLICY_ENGINE_VERSION,
    policyVersion,
    policyHash,
    fingerprint: `${BEHAVIOR_POLICY_ENGINE_VERSION}:${policyVersion}:${policyHash}`,
  };
}

function buildWaitDecision(
  base: Omit<BehaviorPolicyEvaluation, "decision" | "reason" | "delayMinutes" | "delayMs" | "nextCheckAt">,
  params: {
    reason: string;
    delayMinutes: number;
    now: Date;
  },
): BehaviorPolicyEvaluation {
  const nextCheckAt = new Date(params.now.getTime() + params.delayMinutes * 60_000);
  return {
    ...base,
    allowed: false,
    decision: "wait",
    action: "do_nothing",
    reason: params.reason,
    delayMinutes: params.delayMinutes,
    delayMs: params.delayMinutes * 60_000,
    nextCheckAt,
  };
}

export function evaluateBehaviorPolicy(params: {
  chipId: number;
  action: BehaviorPolicyAction;
  chipAgeDays: number;
  trustScore?: number | null;
  riskScore?: number | null;
  stats?: Partial<BehaviorPolicyStats> | null;
  cooldownUntil?: Date | string | null;
  now?: Date;
}) {
  const now = params.now ?? new Date();
  const config = loadBehaviorPolicyConfig();
  const fingerprint = buildFingerprint();
  const trustScore = Math.max(0, Math.min(100, Math.round(params.trustScore ?? 0)));
  const riskScore = Math.max(0, Math.min(100, Math.round(params.riskScore ?? 0)));
  const stats: BehaviorPolicyStats = {
    inboundCount: params.stats?.inboundCount ?? 0,
    outboundCount: params.stats?.outboundCount ?? 0,
    todayActionCount: params.stats?.todayActionCount ?? 0,
    todayActionTypes: params.stats?.todayActionTypes ?? [],
    lastInboundAt: params.stats?.lastInboundAt ?? null,
    lastOutboundAt: params.stats?.lastOutboundAt ?? null,
  };

  const { phase } = resolveBehaviorPhase({
    chipAgeDays: params.chipAgeDays,
    trustScore,
    config,
  });

  const dailyBudget = calculateDailyBudget({
    phase,
    action: params.action,
    stats,
    config,
  });
  const reciprocity = evaluateReciprocity({
    phase,
    stats,
    config,
  });
  const session = createBehaviorSession({
    chipId: params.chipId,
    phase,
    config,
    now,
  });
  const riskLevel = normalizeRiskLevel(riskScore, config.thresholds.attentionRiskScore, config.thresholds.blockRiskScore);
  const restrictions: BehaviorPolicyEvaluation["restrictions"] = [];
  const outboundAction = params.action === "reply" || params.action === "message_sent" || params.action === "initiate_dm";
  const cooldownUntil = params.cooldownUntil ? new Date(params.cooldownUntil) : null;
  const cooldownRemainingMs =
    cooldownUntil && !Number.isNaN(cooldownUntil.getTime()) && cooldownUntil.getTime() > now.getTime()
      ? cooldownUntil.getTime() - now.getTime()
      : 0;

  const trace: BehaviorPolicyCheck[] = [];
  const appendRemainingSkipped = (fromRule: BehaviorPolicyCheck["rule"]) => {
    const fromIndex = CHECK_ORDER.indexOf(fromRule);
    for (const rule of CHECK_ORDER.slice(fromIndex + 1)) {
      if (!trace.some((entry) => entry.rule === rule)) {
        trace.push(
          createSkippedCheck({
            rule,
            order: CHECK_ORDER.indexOf(rule) + 1,
            detail: `validação ${rule} não executada após bloqueio anterior`,
          }),
        );
      }
    }
  };

  const base: Omit<BehaviorPolicyEvaluation, "decision" | "reason" | "delayMinutes" | "delayMs" | "nextCheckAt"> = {
    allowed: true,
    phase,
    action: params.action,
    confidence: Number(Math.max(0.1, 1 - riskScore / 100).toFixed(2)),
    riskLevel,
    restrictions,
    sessionId: session.sessionId,
    sessionActionBudget: session.actionBudget,
    trustScore,
    chipAgeDays: params.chipAgeDays,
    dailyBudget,
    reciprocity: {
      inboundCount: stats.inboundCount,
      outboundCount: stats.outboundCount,
      ratio: reciprocity.ratio,
      minRequired: reciprocity.minRequired,
    },
    checks: {} as BehaviorPolicyChecks,
    executionTrace: trace,
    contributors: [],
    fingerprint,
  };
  trace.push(
    createCheck({
      rule: "phase",
      passed: isActionAllowedInPhase({ phase, action: params.action, config }),
      order: 1,
      detail: isActionAllowedInPhase({ phase, action: params.action, config })
        ? `ação ${params.action} permitida na fase ${phase}`
        : `ação ${params.action} não liberada na fase ${phase}`,
      metadata: {
        phase,
        action: params.action,
        allowedActions: config.trustScoreBands[phase].allowedActions,
      },
    }),
  );

  if (!trace[0].passed) {
    restrictions.push("phase_block");
    appendRemainingSkipped("phase");
    base.checks = buildChecksMap(trace);
    base.contributors = buildContributors(trace);
    return buildWaitDecision(base, {
      reason: trace[0].detail,
      delayMinutes: config.cooldown.defaultMinutes,
      now,
    });
  }

  trace.push(
    createCheck({
      rule: "risk",
      passed: riskLevel !== "high",
      order: 2,
      detail: riskLevel === "high" ? "risco elevado para execução automática" : `risco ${riskLevel} dentro do limite operacional`,
      metadata: {
        score: riskScore,
        attentionThreshold: config.thresholds.attentionRiskScore,
        blockThreshold: config.thresholds.blockRiskScore,
      },
    }),
  );

  if (!trace[1].passed) {
    restrictions.push("critical_risk");
    appendRemainingSkipped("risk");
    base.checks = buildChecksMap(trace);
    base.contributors = buildContributors(trace);
    return buildWaitDecision(base, {
      reason: trace[1].detail,
      delayMinutes: config.cooldown.afterOutboundMinutes,
      now,
    });
  }

  trace.push(
    createCheck({
      rule: "cooldown",
      passed: cooldownRemainingMs <= 0,
      order: 3,
      detail: cooldownRemainingMs > 0 ? "cooldown ativo para o alvo" : "sem cooldown ativo",
      metadata: {
        cooldownUntil: cooldownUntil?.toISOString?.() ?? null,
        remainingMs: cooldownRemainingMs,
      },
    }),
  );

  if (!trace[2].passed) {
    restrictions.push("cooldown");
    appendRemainingSkipped("cooldown");
    base.checks = buildChecksMap(trace);
    base.contributors = buildContributors(trace);
    return buildWaitDecision(base, {
      reason: trace[2].detail,
      delayMinutes: Math.max(1, Math.ceil(cooldownRemainingMs / 60_000)),
      now,
    });
  }

  trace.push(
    createCheck({
      rule: "budget",
      passed: dailyBudget.allowed,
      order: 4,
      detail: dailyBudget.allowed ? "orçamento diário disponível" : "orçamento diário esgotado para a fase atual",
      metadata: {
        spent: dailyBudget.spent,
        limit: dailyBudget.limit,
        nextCost: dailyBudget.nextCost,
        remaining: dailyBudget.remaining,
      },
    }),
  );

  if (!trace[3].passed) {
    restrictions.push("daily_budget");
    appendRemainingSkipped("budget");
    base.checks = buildChecksMap(trace);
    base.contributors = buildContributors(trace);
    return buildWaitDecision(base, {
      reason: trace[3].detail,
      delayMinutes: 24 * 60,
      now,
    });
  }

  trace.push(
    createCheck({
      rule: "reciprocity",
      passed: !outboundAction || reciprocity.allowed,
      order: 5,
      detail: !outboundAction
        ? "ação não depende de reciprocidade"
        : reciprocity.requireInboundFirst && stats.inboundCount === 0
          ? "a fase atual exige inbound antes de outbound"
          : reciprocity.allowed
            ? "reciprocidade dentro do mínimo"
            : "relação inbound/outbound abaixo do mínimo",
      metadata: {
        inboundCount: stats.inboundCount,
        outboundCount: stats.outboundCount,
        ratio: reciprocity.ratio,
        minRequired: reciprocity.minRequired,
        requireInboundFirst: reciprocity.requireInboundFirst,
      },
    }),
  );

  if (!trace[4].passed) {
    restrictions.push(reciprocity.requireInboundFirst ? "require_inbound" : "reciprocity");
    appendRemainingSkipped("reciprocity");
    base.checks = buildChecksMap(trace);
    base.contributors = buildContributors(trace);
    return buildWaitDecision(base, {
      reason: trace[4].detail,
      delayMinutes: config.cooldown.defaultMinutes,
      now,
    });
  }

  trace.push(
    createCheck({
      rule: "session",
      passed: !session.withinSleepWindow,
      order: 6,
      detail: session.withinSleepWindow ? "janela de descanso ativa para o chip" : "janela de sessão válida",
      metadata: {
        sessionId: session.sessionId,
        actionBudget: session.actionBudget,
        withinSleepWindow: session.withinSleepWindow,
      },
    }),
  );

  if (!trace[5].passed) {
    restrictions.push("session_window");
    base.checks = buildChecksMap(trace);
    base.contributors = buildContributors(trace);
    return buildWaitDecision(base, {
      reason: trace[5].detail,
      delayMinutes: 60,
      now,
    });
  }

  const delayMs = generateBehaviorDelayMs({
    config,
    multiplier: riskLevel === "attention" ? 1.4 : 1,
  });

  return {
    ...base,
    checks: buildChecksMap(trace),
    executionTrace: trace,
    contributors: buildContributors(trace),
    decision: params.action === "do_nothing" ? "do_nothing" : "act_now",
    reason: params.action === "do_nothing" ? "sem ação ativa recomendada no momento" : "janela operacional aprovada",
    delayMinutes: Math.ceil(delayMs / 60_000),
    delayMs,
    nextCheckAt: new Date(now.getTime() + delayMs),
  } satisfies BehaviorPolicyEvaluation;
}
