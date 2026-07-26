export type TenantResourcePolicy = {
  chips: number;
  scheduledTasks: number;
  workers: number;
  workflowsPerHour: number;
  cacheTtlSeconds: number;
  replayWindowHours: number;
  dailyActions: number;
};

export type TenantPlatformSummary = {
  userId: number;
  tenantKey: string;
  isolatedByUserId: boolean;
  subscription: unknown;
  plan: unknown;
  usage: {
    chips: number;
    scheduledTasks: number;
    distributedSessions: number;
    activeSessions: number;
  };
  quotas: TenantResourcePolicy;
  capacity: {
    chips: boolean;
    scheduledTasks: boolean;
    workers: boolean;
    workflowsPerHour: boolean;
  };
};

export type SecretProvider = "local" | "vault" | "aws" | "gcp" | "azure";

export type SecretDescriptor = {
  scope: "global" | "tenant";
  name: string;
  provider: SecretProvider;
  description?: string | null;
  remoteRef?: string | null;
  tags?: string[];
  updatedAt: string;
  version: number;
  encryptedValue?: string | null;
};

export type PlatformWorkflowStep =
  | {
      type: "emit_event";
      eventType: string;
      payload?: Record<string, unknown>;
    }
  | {
      type: "set_config";
      key: string;
      value: string | number | boolean | Record<string, unknown> | Array<unknown> | null;
      description?: string;
    }
  | {
      type: "notify";
      title: string;
      content: string;
      severity?: "info" | "warning" | "critical";
    }
  | {
      type: "invalidate_cache";
      namespace: string;
      key?: string;
      tenantId?: number;
    }
  | {
      type: "record_audit";
      action: string;
      entityType?: string;
      payload?: Record<string, unknown>;
    };

export type PlatformWorkflowDefinition = {
  name: string;
  enabled: boolean;
  description?: string | null;
  trigger?: string | null;
  steps: PlatformWorkflowStep[];
  updatedAt: string;
};

export type PlatformWorkflowRunResult = {
  workflow: string;
  executedAt: string;
  executedSteps: number;
  events: string[];
};

export type PlatformPolicyCondition = {
  field: string;
  operator: "eq" | "neq" | "gte" | "lte" | "includes" | "exists";
  value?: unknown;
};

export type PlatformPolicyRule = {
  key: string;
  scope: "tenant" | "runtime" | "compliance" | "workflow" | "chaos";
  effect: "allow" | "deny" | "warn";
  enabled: boolean;
  description?: string | null;
  conditions: PlatformPolicyCondition[];
  actions?: string[];
  updatedAt: string;
};

export type PlatformPolicyEvaluation = {
  resource: string;
  allowed: boolean;
  matched: Array<{
    key: string;
    effect: "allow" | "deny" | "warn";
    description?: string | null;
  }>;
  warnings: string[];
};

export type ChaosExperimentDefinition = {
  target: "worker_restart" | "redis_disconnect" | "leader_loss" | "scheduler_pause" | "cache_flush";
  mode: "simulate" | "flag_only";
  durationSeconds?: number;
  metadata?: Record<string, unknown>;
};
