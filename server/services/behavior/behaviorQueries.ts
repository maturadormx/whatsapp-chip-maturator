import { and, desc, eq, gte, lte } from "drizzle-orm";
import { behaviorDecisionLog, behaviorSnapshots, type BehaviorDecisionLog, type BehaviorSnapshot } from "../../../drizzle/schema";
import { getDb } from "../../db";

export type TopBlockReason = {
  reason: string;
  count: number;
  percentage: number;
};

export type PhaseDistribution = {
  phase: string;
  count: number;
  percentage: number;
};

export type StuckChip = {
  chipId: number;
  phase: string;
  hoursInPhase: number;
  lastDecisionAt: string;
  lastReason: string | null;
};

export type PhaseDuration = {
  phase: string;
  averageHours: number;
  chipCount: number;
};

export type PolicyVersionUsage = {
  policyFingerprint: string;
  policyVersion: string;
  rulesRevision: string;
  engineVersion: string;
  decisionCount: number;
  lastUsedAt: string;
};

function percentage(count: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((count / total) * 1000) / 10;
}

function diffHours(now: Date, then: Date) {
  return Math.round(((now.getTime() - then.getTime()) / 36e5) * 10) / 10;
}

export function parsePolicyFingerprint(raw: string | null | undefined) {
  if (!raw) {
    return {
      policyFingerprint: "N/D",
      engineVersion: "N/D",
      policyVersion: "N/D",
      rulesRevision: "N/D",
    };
  }

  const [engineVersion, policyVersion, rulesRevision] = raw.split(":");
  return {
    policyFingerprint: raw,
    engineVersion: engineVersion || "N/D",
    policyVersion: policyVersion || "N/D",
    rulesRevision: rulesRevision || "N/D",
  };
}

export function buildTopBlockReasons(rows: Array<Pick<BehaviorDecisionLog, "reason">>) {
  const map = new Map<string, number>();
  for (const row of rows) {
    const key = row.reason || "sem motivo";
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  const total = rows.length;
  return Array.from(map.entries())
    .map(([reason, count]) => ({ reason, count, percentage: percentage(count, total) }))
    .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason));
}

export function buildPhaseDistribution(rows: Array<Pick<BehaviorSnapshot, "phase">>) {
  const map = new Map<string, number>();
  for (const row of rows) {
    const key = row.phase || "unknown";
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  const total = rows.length;
  return Array.from(map.entries())
    .map(([phase, count]) => ({ phase, count, percentage: percentage(count, total) }))
    .sort((a, b) => b.count - a.count || a.phase.localeCompare(b.phase));
}

export function buildStuckChips(rows: Array<Pick<BehaviorSnapshot, "chipId" | "phase" | "updatedAt" | "lastReason">>, hours = 24, now = new Date()) {
  const threshold = new Date(now.getTime() - hours * 36e5);
  return rows
    .filter((row) => new Date(row.updatedAt) <= threshold)
    .map((row) => ({
      chipId: row.chipId,
      phase: row.phase,
      hoursInPhase: diffHours(now, new Date(row.updatedAt)),
      lastDecisionAt: new Date(row.updatedAt).toISOString(),
      lastReason: row.lastReason ?? null,
    }))
    .sort((a, b) => b.hoursInPhase - a.hoursInPhase || a.chipId - b.chipId);
}

export function buildAveragePhaseDuration(
  rows: Array<Pick<BehaviorSnapshot, "phase" | "updatedAt">>,
  now = new Date(),
) {
  const buckets = new Map<string, { totalHours: number; count: number }>();
  for (const row of rows) {
    const phase = row.phase || "unknown";
    const hours = diffHours(now, new Date(row.updatedAt));
    const current = buckets.get(phase) ?? { totalHours: 0, count: 0 };
    current.totalHours += hours;
    current.count += 1;
    buckets.set(phase, current);
  }

  return Array.from(buckets.entries())
    .map(([phase, bucket]) => ({
      phase,
      averageHours: Math.round((bucket.totalHours / Math.max(bucket.count, 1)) * 10) / 10,
      chipCount: bucket.count,
    }))
    .sort((a, b) => b.chipCount - a.chipCount || a.phase.localeCompare(b.phase));
}

export function buildRecentPolicyVersions(
  rows: Array<Pick<BehaviorDecisionLog, "policyFingerprint" | "engineVersion" | "createdAt">>,
  limit = 10,
) {
  const map = new Map<string, PolicyVersionUsage>();
  for (const row of rows) {
    const parsed = parsePolicyFingerprint(row.policyFingerprint);
    const current = map.get(parsed.policyFingerprint) ?? {
      policyFingerprint: parsed.policyFingerprint,
      policyVersion: parsed.policyVersion,
      rulesRevision: parsed.rulesRevision,
      engineVersion: row.engineVersion || parsed.engineVersion,
      decisionCount: 0,
      lastUsedAt: new Date(0).toISOString(),
    };
    current.decisionCount += 1;
    const rowTime = new Date(row.createdAt).toISOString();
    if (rowTime > current.lastUsedAt) {
      current.lastUsedAt = rowTime;
    }
    map.set(parsed.policyFingerprint, current);
  }

  return Array.from(map.values()).sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt)).slice(0, limit);
}

export function buildOperationalAlerts(params: {
  stuckChips: StuckChip[];
  topBlockReasons: TopBlockReason[];
}) {
  const alerts: string[] = [];
  const birthStuck = params.stuckChips.filter((chip) => chip.phase === "birth" && chip.hoursInPhase >= 48);
  if (birthStuck.length > 0) {
    alerts.push(`${birthStuck.length} chip(s) em birth há mais de 48h.`);
  }

  const cooldownStuck = params.stuckChips.filter(
    (chip) => (chip.lastReason || "").toLowerCase().includes("cooldown") && chip.hoursInPhase >= 24,
  );
  if (cooldownStuck.length > 0) {
    alerts.push(`${cooldownStuck.length} chip(s) com bloqueio de cooldown há mais de 24h.`);
  }

  if (params.topBlockReasons[0] && params.topBlockReasons[0].percentage >= 50) {
    alerts.push(`"${params.topBlockReasons[0].reason}" concentra ${params.topBlockReasons[0].percentage}% dos bloqueios recentes.`);
  }

  return alerts;
}

export async function getTopBlockReasons(days = 7): Promise<TopBlockReason[]> {
  const db = await getDb();
  if (!db) return [];

  const since = new Date();
  since.setDate(since.getDate() - days);

  const rows = await db
    .select({
      reason: behaviorDecisionLog.reason,
    })
    .from(behaviorDecisionLog)
    .where(and(eq(behaviorDecisionLog.decision, "BLOCK"), gte(behaviorDecisionLog.createdAt, since)))
    .orderBy(desc(behaviorDecisionLog.createdAt));

  return buildTopBlockReasons(rows);
}

export async function getPhaseDistribution(): Promise<PhaseDistribution[]> {
  const db = await getDb();
  if (!db) return [];

  const rows = await db
    .select({
      phase: behaviorSnapshots.phase,
    })
    .from(behaviorSnapshots);

  return buildPhaseDistribution(rows);
}

export async function getStuckChips(hours = 24): Promise<StuckChip[]> {
  const db = await getDb();
  if (!db) return [];

  const threshold = new Date(Date.now() - hours * 36e5);
  const rows = await db
    .select({
      chipId: behaviorSnapshots.chipId,
      phase: behaviorSnapshots.phase,
      updatedAt: behaviorSnapshots.updatedAt,
      lastReason: behaviorSnapshots.lastReason,
    })
    .from(behaviorSnapshots)
    .where(lte(behaviorSnapshots.updatedAt, threshold))
    .orderBy(behaviorSnapshots.updatedAt);

  return buildStuckChips(rows, hours);
}

export async function getAveragePhaseDuration(): Promise<PhaseDuration[]> {
  const db = await getDb();
  if (!db) return [];

  const rows = await db
    .select({
      phase: behaviorSnapshots.phase,
      updatedAt: behaviorSnapshots.updatedAt,
    })
    .from(behaviorSnapshots);

  return buildAveragePhaseDuration(rows);
}

export async function getRecentPolicyVersions(limit = 10): Promise<PolicyVersionUsage[]> {
  const db = await getDb();
  if (!db) return [];

  const rows = await db
    .select({
      policyFingerprint: behaviorDecisionLog.policyFingerprint,
      engineVersion: behaviorDecisionLog.engineVersion,
      createdAt: behaviorDecisionLog.createdAt,
    })
    .from(behaviorDecisionLog)
    .where(gte(behaviorDecisionLog.createdAt, new Date(0)))
    .orderBy(desc(behaviorDecisionLog.createdAt))
    .limit(Math.max(limit * 10, 50));

  return buildRecentPolicyVersions(rows, limit);
}

export async function getOperationalAlerts(): Promise<string[]> {
  const [topBlockReasons, stuckChips] = await Promise.all([getTopBlockReasons(1), getStuckChips(24)]);
  return buildOperationalAlerts({ topBlockReasons, stuckChips });
}
