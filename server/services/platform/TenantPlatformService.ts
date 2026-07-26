import { listDistributedChipSessions } from "../../db";
import { getConfigurationCenter } from "../config/ConfigurationCenter";
import { getTenantLicenseSummary } from "../licensing/TenantLicenseService";
import type { TenantPlatformSummary, TenantResourcePolicy } from "./types";

const DEFAULT_TENANT_POLICY: TenantResourcePolicy = {
  chips: 5,
  scheduledTasks: 20,
  workers: 2,
  workflowsPerHour: 60,
  cacheTtlSeconds: 300,
  replayWindowHours: 24,
  dailyActions: 250,
};

function buildPolicyFromPlan(plan: any | null | undefined): TenantResourcePolicy {
  if (!plan) {
    return { ...DEFAULT_TENANT_POLICY };
  }

  return {
    chips: Math.max(1, Number(plan.maxChips ?? DEFAULT_TENANT_POLICY.chips)),
    scheduledTasks: Math.max(1, Number(plan.maxScheduledTasks ?? DEFAULT_TENANT_POLICY.scheduledTasks)),
    workers: Math.max(1, Math.ceil(Number(plan.maxChips ?? DEFAULT_TENANT_POLICY.chips) / 5)),
    workflowsPerHour: Math.max(10, Number(plan.maxScheduledTasks ?? DEFAULT_TENANT_POLICY.workflowsPerHour) * 2),
    cacheTtlSeconds: DEFAULT_TENANT_POLICY.cacheTtlSeconds,
    replayWindowHours: DEFAULT_TENANT_POLICY.replayWindowHours,
    dailyActions: Math.max(100, Number(plan.maxMessagesPerMonth ?? 0) > 0 ? Math.ceil(Number(plan.maxMessagesPerMonth) / 30) : 250),
  };
}

function tenantPolicyKey(userId: number) {
  return `tenant.${userId}.resource_policy`;
}

export async function getTenantResourcePolicy(userId: number): Promise<TenantResourcePolicy> {
  const summary = await getTenantLicenseSummary(userId);
  const baseline = buildPolicyFromPlan(summary.plan);
  const stored = await getConfigurationCenter().get<Partial<TenantResourcePolicy> | null>(
    tenantPolicyKey(userId),
    null,
  );

  return {
    ...baseline,
    ...(stored ?? {}),
  };
}

export async function upsertTenantResourcePolicy(userId: number, partial: Partial<TenantResourcePolicy>) {
  const current = await getTenantResourcePolicy(userId);
  const next = {
    ...current,
    ...partial,
  };

  await getConfigurationCenter().set({
    key: tenantPolicyKey(userId),
    value: next,
    description: "Quotas, limites e recursos isolados por tenant.",
  });

  return next;
}

export async function getTenantPlatformSummary(userId: number): Promise<TenantPlatformSummary> {
  const [license, quotas, distributedSessions] = await Promise.all([
    getTenantLicenseSummary(userId),
    getTenantResourcePolicy(userId),
    listDistributedChipSessions({ limit: 500 }),
  ]);

  const tenantSessions = distributedSessions.filter((session) => session.userId === userId);
  const activeSessions = tenantSessions.filter((session) => session.sessionStatus === "connected").length;

  return {
    userId,
    tenantKey: `tenant:${userId}`,
    isolatedByUserId: true,
    subscription: license.subscription,
    plan: license.plan,
    usage: {
      chips: license.usage.chips,
      scheduledTasks: license.usage.scheduledTasks,
      distributedSessions: tenantSessions.length,
      activeSessions,
    },
    quotas,
    capacity: {
      chips: license.usage.chips <= quotas.chips,
      scheduledTasks: license.usage.scheduledTasks <= quotas.scheduledTasks,
      workers: activeSessions <= quotas.workers,
      workflowsPerHour: true,
    },
  };
}
