export type BehaviorPhase = "birth" | "reactive" | "interactive" | "active" | "mature";

export type BehaviorPolicyAction =
  | "reply"
  | "initiate_dm"
  | "message_sent"
  | "view_status"
  | "status_view"
  | "read_messages"
  | "group_read"
  | "group_observe"
  | "group_interact"
  | "reaction"
  | "profile_update"
  | "observe_profile"
  | "join_group"
  | "do_nothing";

export type BehaviorPolicyRestriction =
  | "cooldown"
  | "high_risk"
  | "critical_risk"
  | "phase_block"
  | "daily_budget"
  | "reciprocity"
  | "require_inbound"
  | "session_window";

export type BehaviorPhaseConfig = {
  trustMin: number;
  trustMax: number;
  fallbackAgeDaysStart: number;
  fallbackAgeDaysEnd: number;
  maxDailyBudget: number;
  minReciprocityRatio: number;
  requireInboundFirst: boolean;
  sessionCountRange: [number, number];
  allowedActions: BehaviorPolicyAction[];
};

export type BehaviorPolicyConfig = {
  trustScoreBands: Record<BehaviorPhase, BehaviorPhaseConfig>;
  dailyBudgetCosts: Record<string, number>;
  jitter: {
    minReplyDelaySeconds: number;
    maxReplyDelaySeconds: number;
    interActionDelayMinSeconds: number;
    interActionDelayMaxSeconds: number;
    sessionTimeVarianceHours: number;
    sleepWindowStartHour: number;
    sleepWindowEndHour: number;
  };
  thresholds: {
    attentionRiskScore: number;
    blockRiskScore: number;
  };
  cooldown: {
    defaultMinutes: number;
    afterOutboundMinutes: number;
  };
};

export type BehaviorPolicyStats = {
  inboundCount: number;
  outboundCount: number;
  todayActionCount: number;
  todayActionTypes: string[];
  lastInboundAt: Date | null;
  lastOutboundAt: Date | null;
};

export type BehaviorPolicyCheckRule = "phase" | "risk" | "cooldown" | "budget" | "reciprocity" | "session";

export type BehaviorPolicyCheckStatus = "PASS" | "FAIL" | "SKIPPED";

export type BehaviorPolicyCheck = {
  rule: BehaviorPolicyCheckRule;
  status: BehaviorPolicyCheckStatus;
  passed: boolean;
  order: number;
  detail: string;
  metadata?: Record<string, unknown>;
};

export type BehaviorPolicyChecks = Record<BehaviorPolicyCheckRule, BehaviorPolicyCheck>;

export type BehaviorPolicyFingerprint = {
  engineVersion: string;
  policyVersion: string;
  policyHash: string;
  fingerprint: string;
};

export type BehaviorPolicyContributor = {
  rule: BehaviorPolicyCheckRule;
  impact: "allow" | "block" | "neutral";
  order: number;
  status: BehaviorPolicyCheckStatus;
  detail: string;
};

export type BehaviorPolicyEvaluation = {
  allowed: boolean;
  phase: BehaviorPhase;
  decision: "act_now" | "wait" | "do_nothing";
  action: BehaviorPolicyAction;
  confidence: number;
  riskLevel: "low" | "attention" | "high";
  delayMinutes: number | null;
  delayMs: number;
  sessionId: string;
  sessionActionBudget: number;
  reason: string;
  restrictions: BehaviorPolicyRestriction[];
  trustScore: number;
  chipAgeDays: number;
  dailyBudget: {
    spent: number;
    limit: number;
    nextCost: number;
    remaining: number;
  };
  reciprocity: {
    inboundCount: number;
    outboundCount: number;
    ratio: number;
    minRequired: number;
  };
  nextCheckAt: Date | null;
  checks: BehaviorPolicyChecks;
  executionTrace: BehaviorPolicyCheck[];
  contributors: BehaviorPolicyContributor[];
  fingerprint: BehaviorPolicyFingerprint;
};
