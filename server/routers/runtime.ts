import { z } from "zod";
import { adminProcedure } from "../_core/rbac";
import { router } from "../_core/trpc";
import {
  buildRuntimeSupervisorOverview,
  getRuntimeChipConsole,
  restartRuntimeServices,
  triggerShadowRuntimeCycle,
} from "../services/runtimeSupervisorService";
import { getChipProjectionWorkerService } from "../services/chipProjectionWorkerService";
import { getChipAuditService } from "../services/chipAuditService";
import { getChipLegacyBridgeService } from "../services/chipLegacyBridgeService";
import { getChipReconciliationService } from "../services/chipReconciliationService";
import { getConfigurationCenter } from "../services/config/ConfigurationCenter";
import { buildPlatformOperationsDashboard } from "../services/dashboard/PlatformOperationsService";
import { createOperationalSnapshot, restoreOperationalSnapshot } from "../services/distributed/BackupRestoreEngine";
import { getClusterManager } from "../services/distributed/ClusterManager";
import { getDeploymentProfile } from "../services/distributed/DeploymentManager";
import { runAutomaticFailover } from "../services/distributed/AutomaticFailoverService";
import { getLeaderElectionService } from "../services/distributed/LeaderElectionService";
import { enterRollingUpdateMode, exitRollingUpdateMode } from "../services/distributed/RollingUpdateManager";
import {
  getResolvedFeatureFlags,
  updateFeatureFlagsInConfig,
} from "../services/featureFlags/FeatureFlagService";
import { getTenantLicenseSummary } from "../services/licensing/TenantLicenseService";
import { sendOperationalNotification } from "../services/notifications/NotificationCenter";
import {
  analyzeOptimizationOpportunities,
  applyOptimizationRecommendation,
  getOptimizationProfile,
} from "../services/platform/AIOptimizationEngineService";
import { runChaosExperiment, getChaosStatus } from "../services/platform/ChaosTestingService";
import { buildCapacityPlan } from "../services/platform/CapacityPlannerService";
import { buildCostManagementView } from "../services/platform/CostManagementService";
import { buildDataWarehouseSnapshot } from "../services/platform/DataWarehouseAnalyticsService";
import { simulateChipDecision, simulateFleetDecision } from "../services/platform/DigitalTwinService";
import { getDistributedCacheService } from "../services/platform/DistributedCacheService";
import { evaluateExperiment, listExperiments, upsertExperimentDefinition } from "../services/platform/ExperimentEngineService";
import { evaluateAutoScaling, getAutoScalingProfile, updateAutoScalingProfile } from "../services/platform/AutoScalingManagerService";
import {
  buildComplianceGovernanceView,
  getComplianceGovernancePolicy,
  updateComplianceGovernancePolicy,
} from "../services/platform/ComplianceGovernanceService";
import { replayChipHistory, replayObservationStream, listReplayStreams } from "../services/platform/MessageReplayService";
import { buildObservability360 } from "../services/platform/Observability360Service";
import { evaluatePolicyRules, listPolicyRules, upsertPolicyRule } from "../services/platform/PolicyEngineService";
import {
  executePluginHook,
  installPluginManifest,
  listInstalledPlugins,
  setPluginEnabled,
} from "../services/platform/PluginMarketplaceService";
import {
  dispatchWebhookTest,
  generateOpenApiDocument,
  generateSdkArtifact,
  listWebhookRegistrations,
  simulatePlannerViaPublicApi,
  upsertWebhookRegistration,
} from "../services/platform/PublicApiService";
import { inspectPlatformResources } from "../services/platform/ResourceManagerService";
import {
  exportRuleDesignerDocument,
  importRuleDesignerDocument,
  saveRuleDesignerCanvas,
} from "../services/platform/RuleDesignerService";
import {
  deleteSecretRecord,
  listSecretsCatalog,
  resolveSecretValue,
  upsertSecretRecord,
} from "../services/platform/SecretsManagerService";
import { getTenantPlatformSummary, upsertTenantResourcePolicy } from "../services/platform/TenantPlatformService";
import { executeWorkflow, listWorkflowDefinitions, upsertWorkflowDefinition } from "../services/platform/WorkflowEngineService";
import { inspectRecoveryCandidates, runAutoRecoveryCycle } from "../services/recovery/AutoRecoveryService";
import { listAuditEvents, listWorkerHeartbeats } from "../db";
import {
  getRuntimeControlState,
  updateRuntimeSupervisorConfig,
} from "../utils/runtimeControl";

const featureFlagsSchema = z.object({
  venomRuntime: z.boolean().optional(),
  shadowMode: z.boolean().optional(),
  adaptiveLearning: z.boolean().optional(),
  fleetLearning: z.boolean().optional(),
  replayInspector: z.boolean().optional(),
  alerting: z.boolean().optional(),
  metricsApi: z.boolean().optional(),
  adminConsole: z.boolean().optional(),
});

const supervisorSchema = z.object({
  autoRestoreSessions: z.boolean().optional(),
  autoStartPassiveEngine: z.boolean().optional(),
  autoEnsureHeartbeats: z.boolean().optional(),
  shadowWindowHours: z.number().int().min(1).max(168).optional(),
  schedulerLookaheadHours: z.number().int().min(1).max(168).optional(),
  maxRetryAttempts: z.number().int().min(0).max(10).optional(),
  retryBackoffSeconds: z.number().int().min(5).max(3600).optional(),
  alertHealthThreshold: z.number().int().min(0).max(100).optional(),
  alertCoverageThreshold: z.number().int().min(0).max(100).optional(),
  alertIdentityDriftThreshold: z.number().int().min(0).max(100).optional(),
  alertSnapshotMaxAgeMinutes: z.number().int().min(5).max(1440).optional(),
});

const jsonValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.record(z.string(), z.unknown()),
  z.array(z.unknown()),
  z.null(),
]);

const workflowStepSchema = z.union([
  z.object({
    type: z.literal("emit_event"),
    eventType: z.string().min(2),
    payload: z.record(z.string(), z.unknown()).optional(),
  }),
  z.object({
    type: z.literal("set_config"),
    key: z.string().min(3),
    value: jsonValueSchema,
    description: z.string().optional(),
  }),
  z.object({
    type: z.literal("notify"),
    title: z.string().min(2),
    content: z.string().min(2),
    severity: z.enum(["info", "warning", "critical"]).optional(),
  }),
  z.object({
    type: z.literal("invalidate_cache"),
    namespace: z.string().min(2),
    key: z.string().min(1).optional(),
    tenantId: z.number().int().positive().optional(),
  }),
  z.object({
    type: z.literal("record_audit"),
    action: z.string().min(2),
    entityType: z.string().min(2).optional(),
    payload: z.record(z.string(), z.unknown()).optional(),
  }),
]);

const policyConditionSchema = z.object({
  field: z.string().min(1),
  operator: z.enum(["eq", "neq", "gte", "lte", "includes", "exists"]),
  value: z.unknown().optional(),
});

const policyRuleSchema = z.object({
  key: z.string().min(2),
  scope: z.enum(["tenant", "runtime", "compliance", "workflow", "chaos"]),
  effect: z.enum(["allow", "deny", "warn"]),
  enabled: z.boolean(),
  description: z.string().nullable().optional(),
  conditions: z.array(policyConditionSchema).min(1),
  actions: z.array(z.string()).optional(),
});

const chaosExperimentSchema = z.object({
  target: z.enum(["worker_restart", "redis_disconnect", "leader_loss", "scheduler_pause", "cache_flush"]),
  mode: z.enum(["simulate", "flag_only"]),
  durationSeconds: z.number().int().min(1).max(3600).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const experimentSchema = z.object({
  key: z.string().min(2),
  name: z.string().min(2),
  description: z.string().nullable().optional(),
  strategyA: z.string().min(2),
  strategyB: z.string().min(2),
  enabled: z.boolean(),
  autoPromoteWinner: z.boolean(),
  cohortChipIds: z.array(z.number().int().positive()).optional(),
  metric: z.enum(["ack_rate", "failure_rate", "decision_confidence"]),
});

const pluginManifestSchema = z.object({
  key: z.string().min(2),
  name: z.string().min(2),
  version: z.string().min(1),
  description: z.string().nullable().optional(),
  hooks: z.array(z.string().min(2)).min(1),
  apiVersion: z.string().min(1),
  enabled: z.boolean(),
  config: z.record(z.string(), z.unknown()).optional(),
});

const webhookSchema = z.object({
  key: z.string().min(2),
  url: z.string().url(),
  eventTypes: z.array(z.string().min(2)).min(1),
  enabled: z.boolean(),
  secretName: z.string().nullable().optional(),
});

const ruleDesignerSchema = z.object({
  name: z.string().min(2),
  version: z.string().min(1),
  workflows: z.array(z.unknown()),
  policies: z.array(z.unknown()),
  canvas: z.object({
    nodes: z.array(z.record(z.string(), z.unknown())),
    edges: z.array(z.record(z.string(), z.unknown())),
  }).optional(),
  exportedAt: z.string().min(1),
});

type RuntimeRouterDependencies = {
  triggerChipProjectionCycle?: (input?: { limit?: number }) => Promise<unknown>;
  getChipProjection?: (chipId: string) => Promise<unknown>;
  runChipAudit?: (chipId: string) => Promise<unknown>;
  getChipAuditEvidence?: (chipId: string) => Promise<unknown>;
  migrateLegacyChip?: (legacyChipId: number) => Promise<unknown>;
  migrateLegacyUserChips?: (userId: number) => Promise<unknown>;
  migrateLegacyFleet?: () => Promise<unknown>;
  reconcileLegacyUser?: (userId: number) => Promise<unknown>;
  reconcileLegacyFleet?: () => Promise<unknown>;
};

export function buildRuntimeRouter(deps: RuntimeRouterDependencies = {}) {
  return router({
    getControl: adminProcedure.query(async () => {
      const fileState = getRuntimeControlState();
      const featureFlags = await getResolvedFeatureFlags();
      return {
        ...fileState,
        featureFlags,
      };
    }),

    getOverview: adminProcedure.query(async ({ ctx }) => {
      return buildRuntimeSupervisorOverview(ctx.user.id);
    }),

    getOperationsDashboard: adminProcedure.query(async ({ ctx }) => {
      return buildPlatformOperationsDashboard(ctx.user.id);
    }),

    getDistributedStatus: adminProcedure.query(async () => {
      const profile = await getDeploymentProfile();
      return {
        nodeId: profile.nodeId,
        isLeader: getLeaderElectionService().isLeader(),
        clusterNodes: await getClusterManager().listNodes(),
      };
    }),

    listWorkerHeartbeats: adminProcedure
      .input(
        z.object({
          runtime: z.string().min(1).optional(),
          status: z.enum(["starting", "running", "degraded", "stopped"]).optional(),
          limit: z.number().int().min(1).max(500).optional(),
        }).optional(),
      )
      .query(async ({ input }) => {
        return listWorkerHeartbeats(input);
      }),

    listAuditEvents: adminProcedure
      .input(
        z.object({
          chipId: z.number().int().positive().optional(),
          engine: z.string().min(1).optional(),
          workerId: z.string().min(1).optional(),
          limit: z.number().int().min(1).max(500).optional(),
        }).optional(),
      )
      .query(async ({ ctx, input }) => {
        return listAuditEvents({
          ...input,
          userId: ctx.user.id,
        });
      }),

    getChipConsole: adminProcedure
      .input(
        z.object({
          chipId: z.number(),
        })
      )
      .query(async ({ ctx, input }) => {
        return getRuntimeChipConsole(ctx.user.id, input.chipId);
      }),

    updateFeatureFlags: adminProcedure
      .input(featureFlagsSchema)
      .mutation(async ({ input }) => {
        return updateFeatureFlagsInConfig(input);
      }),

    updateSupervisorConfig: adminProcedure
      .input(supervisorSchema)
      .mutation(({ input }) => {
        return updateRuntimeSupervisorConfig(input);
      }),

    listRuntimeConfigs: adminProcedure
      .input(
        z.object({
          prefix: z.string().min(1).optional(),
        }).optional(),
      )
      .query(async ({ input }) => {
        return getConfigurationCenter().list(input?.prefix);
      }),

    setRuntimeConfig: adminProcedure
      .input(
        z.object({
          key: z.string().min(3),
          value: z.union([
            z.string(),
            z.number(),
            z.boolean(),
            z.record(z.string(), z.unknown()),
            z.array(z.unknown()),
            z.null(),
          ]),
          description: z.string().optional(),
        }),
      )
      .mutation(async ({ input }) => {
        await getConfigurationCenter().set({
          key: input.key,
          value: input.value,
          description: input.description,
        });
        return {
          success: true,
        };
      }),

    getTenantLicense: adminProcedure.query(async ({ ctx }) => {
      return getTenantLicenseSummary(ctx.user.id);
    }),

    getTenantPlatformSummary: adminProcedure.query(async ({ ctx }) => {
      return getTenantPlatformSummary(ctx.user.id);
    }),

    setTenantResourcePolicy: adminProcedure
      .input(
        z.object({
          chips: z.number().int().min(1).optional(),
          scheduledTasks: z.number().int().min(1).optional(),
          workers: z.number().int().min(1).optional(),
          workflowsPerHour: z.number().int().min(1).optional(),
          cacheTtlSeconds: z.number().int().min(1).optional(),
          replayWindowHours: z.number().int().min(1).optional(),
          dailyActions: z.number().int().min(1).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        return upsertTenantResourcePolicy(ctx.user.id, input);
      }),

    listSecretsCatalog: adminProcedure
      .input(
        z.object({
          scope: z.enum(["global", "tenant"]).optional(),
        }).optional(),
      )
      .query(async ({ ctx, input }) => {
        return listSecretsCatalog({
          scope: input?.scope ?? "tenant",
          tenantId: ctx.user.id,
        });
      }),

    upsertSecretRecord: adminProcedure
      .input(
        z.object({
          scope: z.enum(["global", "tenant"]),
          name: z.string().min(2),
          value: z.string().optional(),
          provider: z.enum(["local", "vault", "aws", "gcp", "azure"]).optional(),
          description: z.string().nullable().optional(),
          remoteRef: z.string().nullable().optional(),
          tags: z.array(z.string()).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        return upsertSecretRecord({
          ...input,
          tenantId: input.scope === "tenant" ? ctx.user.id : null,
          userId: ctx.user.id,
        });
      }),

    deleteSecretRecord: adminProcedure
      .input(
        z.object({
          scope: z.enum(["global", "tenant"]),
          name: z.string().min(2),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        return deleteSecretRecord({
          ...input,
          tenantId: input.scope === "tenant" ? ctx.user.id : null,
          userId: ctx.user.id,
        });
      }),

    resolveSecretValue: adminProcedure
      .input(
        z.object({
          scope: z.enum(["global", "tenant"]),
          name: z.string().min(2),
        }),
      )
      .query(async ({ ctx, input }) => {
        return resolveSecretValue({
          ...input,
          tenantId: input.scope === "tenant" ? ctx.user.id : null,
        });
      }),

    getDistributedCacheStatus: adminProcedure.query(async () => {
      return getDistributedCacheService().getStats();
    }),

    invalidateDistributedCache: adminProcedure
      .input(
        z.object({
          namespace: z.string().min(2),
          key: z.string().min(1).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        return getDistributedCacheService().invalidate({
          ...input,
          tenantId: ctx.user.id,
        });
      }),

    listReplayStreams: adminProcedure.query(async () => {
      return listReplayStreams(50);
    }),

    replayObservationStream: adminProcedure
      .input(
        z.object({
          stream: z.string().min(1),
          fromVersion: z.number().int().min(1).optional(),
          limit: z.number().int().min(1).max(500).optional(),
          dryRun: z.boolean().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        return replayObservationStream({
          ...input,
          userId: ctx.user.id,
        });
      }),

    replayChipHistory: adminProcedure
      .input(
        z.object({
          chipId: z.string().min(1),
          fromSequence: z.number().int().min(1).optional(),
          limit: z.number().int().min(1).max(500).optional(),
          dryRun: z.boolean().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        return replayChipHistory({
          ...input,
          userId: ctx.user.id,
        });
      }),

    listWorkflowDefinitions: adminProcedure.query(async () => {
      return listWorkflowDefinitions();
    }),

    upsertWorkflowDefinition: adminProcedure
      .input(
        z.object({
          name: z.string().min(2),
          enabled: z.boolean().optional(),
          description: z.string().nullable().optional(),
          trigger: z.string().nullable().optional(),
          steps: z.array(workflowStepSchema).min(1),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        return upsertWorkflowDefinition({
          ...input,
          steps: input.steps as any,
          userId: ctx.user.id,
        });
      }),

    executeWorkflow: adminProcedure
      .input(
        z.object({
          name: z.string().min(2),
          context: z.record(z.string(), z.unknown()).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        return executeWorkflow({
          ...input,
          userId: ctx.user.id,
        });
      }),

    listPolicyRules: adminProcedure.query(async () => {
      return listPolicyRules();
    }),

    upsertPolicyRule: adminProcedure
      .input(policyRuleSchema)
      .mutation(async ({ ctx, input }) => {
        return upsertPolicyRule({
          ...input,
          userId: ctx.user.id,
        });
      }),

    evaluatePolicyRules: adminProcedure
      .input(
        z.object({
          resource: z.string().min(2),
          context: z.record(z.string(), z.unknown()),
        }),
      )
      .query(async ({ ctx, input }) => {
        return evaluatePolicyRules({
          ...input,
          userId: ctx.user.id,
        });
      }),

    getResourceStatus: adminProcedure.query(async ({ ctx }) => {
      return inspectPlatformResources(ctx.user.id);
    }),

    getCapacityPlan: adminProcedure.query(async ({ ctx }) => {
      return buildCapacityPlan(ctx.user.id);
    }),

    getChaosStatus: adminProcedure.query(async () => {
      return getChaosStatus();
    }),

    runChaosExperiment: adminProcedure
      .input(chaosExperimentSchema)
      .mutation(async ({ ctx, input }) => {
        return runChaosExperiment({
          ...input,
          userId: ctx.user.id,
        });
      }),

    getObservability360: adminProcedure.query(async ({ ctx }) => {
      return buildObservability360(ctx.user.id);
    }),

    getOptimizationProfile: adminProcedure.query(async () => {
      return getOptimizationProfile();
    }),

    analyzeOptimizationOpportunities: adminProcedure.query(async ({ ctx }) => {
      return analyzeOptimizationOpportunities(ctx.user.id);
    }),

    applyOptimizationRecommendation: adminProcedure
      .input(
        z.object({
          key: z.string().min(2),
          value: z.unknown(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        return applyOptimizationRecommendation({
          userId: ctx.user.id,
          key: input.key,
          value: input.value,
        });
      }),

    listExperiments: adminProcedure.query(async () => {
      return listExperiments();
    }),

    upsertExperimentDefinition: adminProcedure
      .input(experimentSchema)
      .mutation(async ({ ctx, input }) => {
        return upsertExperimentDefinition({
          ...input,
          userId: ctx.user.id,
        });
      }),

    evaluateExperiment: adminProcedure
      .input(
        z.object({
          key: z.string().min(2),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        return evaluateExperiment(ctx.user.id, input.key);
      }),

    simulateChipDecision: adminProcedure
      .input(
        z.object({
          chipId: z.number().int().positive(),
          intent: z.enum(["increase_trust", "socialize", "observe", "stay_low_profile", "reply_if_prompted", "do_nothing"]).optional(),
          opportunity: z.object({
            signalId: z.string().optional(),
            hasUnreadReply: z.boolean().optional(),
            hasRecentStatus: z.boolean().optional(),
            hasRecentGroupMovement: z.boolean().optional(),
          }).optional(),
        }),
      )
      .query(async ({ ctx, input }) => {
        return simulateChipDecision({
          userId: ctx.user.id,
          chipId: input.chipId,
          intent: input.intent,
          opportunity: input.opportunity,
        });
      }),

    simulateFleetDecision: adminProcedure.query(async ({ ctx }) => {
      return simulateFleetDecision(ctx.user.id);
    }),

    listInstalledPlugins: adminProcedure.query(async () => {
      return listInstalledPlugins();
    }),

    installPluginManifest: adminProcedure
      .input(pluginManifestSchema)
      .mutation(async ({ ctx, input }) => {
        return installPluginManifest({
          ...input,
          userId: ctx.user.id,
        });
      }),

    setPluginEnabled: adminProcedure
      .input(
        z.object({
          key: z.string().min(2),
          enabled: z.boolean(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        return setPluginEnabled(input.key, input.enabled, ctx.user.id);
      }),

    executePluginHook: adminProcedure
      .input(
        z.object({
          key: z.string().min(2),
          hook: z.string().min(2),
          payload: z.record(z.string(), z.unknown()).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        return executePluginHook({
          ...input,
          userId: ctx.user.id,
        });
      }),

    exportRuleDesignerDocument: adminProcedure.query(async () => {
      return exportRuleDesignerDocument();
    }),

    saveRuleDesignerCanvas: adminProcedure
      .input(
        z.object({
          name: z.string().min(2).optional(),
          canvas: z.object({
            nodes: z.array(z.record(z.string(), z.unknown())),
            edges: z.array(z.record(z.string(), z.unknown())),
          }),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        return saveRuleDesignerCanvas({
          ...input,
          userId: ctx.user.id,
        });
      }),

    importRuleDesignerDocument: adminProcedure
      .input(ruleDesignerSchema)
      .mutation(async ({ ctx, input }) => {
        return importRuleDesignerDocument({
          document: input as any,
          userId: ctx.user.id,
        });
      }),

    getDataWarehouseSnapshot: adminProcedure.query(async ({ ctx }) => {
      return buildDataWarehouseSnapshot(ctx.user.id);
    }),

    getCostManagementView: adminProcedure.query(async ({ ctx }) => {
      return buildCostManagementView(ctx.user.id);
    }),

    getAutoScalingProfile: adminProcedure.query(async () => {
      return getAutoScalingProfile();
    }),

    updateAutoScalingProfile: adminProcedure
      .input(z.record(z.string(), z.unknown()))
      .mutation(async ({ ctx, input }) => {
        return updateAutoScalingProfile(input, ctx.user.id);
      }),

    evaluateAutoScaling: adminProcedure.query(async ({ ctx }) => {
      return evaluateAutoScaling(ctx.user.id);
    }),

    getComplianceGovernancePolicy: adminProcedure.query(async () => {
      return getComplianceGovernancePolicy();
    }),

    updateComplianceGovernancePolicy: adminProcedure
      .input(z.record(z.string(), z.unknown()))
      .mutation(async ({ ctx, input }) => {
        return updateComplianceGovernancePolicy({
          policy: input,
          userId: ctx.user.id,
        });
      }),

    getComplianceGovernanceView: adminProcedure.query(async ({ ctx }) => {
      return buildComplianceGovernanceView(ctx.user.id);
    }),

    getOpenApiDocument: adminProcedure.query(async () => {
      return generateOpenApiDocument();
    }),

    generateSdkArtifact: adminProcedure.query(async () => {
      return generateSdkArtifact();
    }),

    listWebhookRegistrations: adminProcedure.query(async () => {
      return listWebhookRegistrations();
    }),

    upsertWebhookRegistration: adminProcedure
      .input(webhookSchema)
      .mutation(async ({ ctx, input }) => {
        return upsertWebhookRegistration({
          ...input,
          updatedAt: new Date().toISOString(),
          userId: ctx.user.id,
        });
      }),

    dispatchWebhookTest: adminProcedure
      .input(
        z.object({
          key: z.string().min(2),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        return dispatchWebhookTest({
          key: input.key,
          userId: ctx.user.id,
        });
      }),

    simulatePlannerPublicContract: adminProcedure
      .input(
        z.object({
          intent: z.enum(["increase_trust", "socialize", "observe", "stay_low_profile", "reply_if_prompted", "do_nothing"]),
          opportunity: z.object({
            signalId: z.string().optional(),
            hasUnreadReply: z.boolean().optional(),
            hasRecentStatus: z.boolean().optional(),
            hasRecentGroupMovement: z.boolean().optional(),
          }),
        }),
      )
      .query(async ({ input }) => {
        return simulatePlannerViaPublicApi({
          intent: input.intent,
          opportunity: input.opportunity,
        } as any);
      }),

    runAutoRecovery: adminProcedure.mutation(async () => {
      return runAutoRecoveryCycle();
    }),

    inspectRecoveryCandidates: adminProcedure.query(async () => {
      return inspectRecoveryCandidates();
    }),

    runAutomaticFailover: adminProcedure.mutation(async () => {
      return runAutomaticFailover();
    }),

    createClusterSnapshot: adminProcedure
      .input(
        z.object({
          scope: z.string().min(2).optional(),
        }).optional(),
      )
      .mutation(async ({ input }) => {
        return createOperationalSnapshot(input?.scope ?? "cluster");
      }),

    restoreClusterSnapshot: adminProcedure
      .input(
        z.object({
          snapshotKey: z.string().min(3),
        }),
      )
      .mutation(async ({ input }) => {
        return restoreOperationalSnapshot(input.snapshotKey);
      }),

    enterRollingUpdate: adminProcedure.mutation(async () => {
      return enterRollingUpdateMode();
    }),

    exitRollingUpdate: adminProcedure.mutation(async () => {
      return exitRollingUpdateMode();
    }),

    getDeploymentProfile: adminProcedure.query(async () => {
      return getDeploymentProfile();
    }),

    sendTestNotification: adminProcedure
      .input(
        z.object({
          title: z.string().min(2),
          content: z.string().min(2),
        }),
      )
      .mutation(async ({ input }) => {
        return sendOperationalNotification({
          title: input.title,
          content: input.content,
          severity: "info",
        });
      }),

    triggerShadowCycle: adminProcedure
      .input(
        z.object({
          windowHours: z.number().int().min(1).max(168).optional(),
        }).optional()
      )
      .mutation(async ({ input }) => {
        return triggerShadowRuntimeCycle(input?.windowHours);
      }),

    triggerChipProjectionCycle: adminProcedure
      .input(
        z.object({
          limit: z.number().int().min(1).max(1000).optional(),
        }).optional()
      )
      .mutation(async ({ input }) => {
        return (
          deps.triggerChipProjectionCycle?.(input) ??
          getChipProjectionWorkerService().processPersistedEvents({
            limit: input?.limit,
          })
        );
      }),

    getChipProjection: adminProcedure
      .input(
        z.object({
          chipId: z.string().min(1),
        })
      )
      .query(async ({ input }) => {
        return deps.getChipProjection?.(input.chipId) ?? getChipProjectionWorkerService().getProjection(input.chipId);
      }),

    runChipAudit: adminProcedure
      .input(
        z.object({
          chipId: z.string().min(1),
        })
      )
      .mutation(async ({ input }) => {
        return deps.runChipAudit?.(input.chipId) ?? getChipAuditService().auditChip(input.chipId);
      }),

    getChipAuditEvidence: adminProcedure
      .input(
        z.object({
          chipId: z.string().min(1),
        })
      )
      .query(async ({ input }) => {
        return deps.getChipAuditEvidence?.(input.chipId) ?? getChipAuditService().getAuditEvidence(input.chipId);
      }),

    migrateLegacyChipToOfficialStream: adminProcedure
      .input(
        z.object({
          legacyChipId: z.number().int().positive(),
        })
      )
      .mutation(async ({ input }) => {
        return deps.migrateLegacyChip?.(input.legacyChipId) ?? getChipLegacyBridgeService().migrateLegacyChipById(input.legacyChipId);
      }),

    migrateLegacyUserFleetToOfficialStream: adminProcedure
      .input(
        z.object({
          userId: z.number().int().positive(),
        })
      )
      .mutation(async ({ input }) => {
        return deps.migrateLegacyUserChips?.(input.userId) ?? getChipLegacyBridgeService().migrateLegacyUserChips(input.userId);
      }),

    migrateLegacyFleetToOfficialStream: adminProcedure
      .mutation(async () => {
        return deps.migrateLegacyFleet?.() ?? getChipLegacyBridgeService().migrateLegacyFleet();
      }),

    reconcileLegacyUserAgainstOfficialProjection: adminProcedure
      .input(
        z.object({
          userId: z.number().int().positive(),
        })
      )
      .query(async ({ input }) => {
        return deps.reconcileLegacyUser?.(input.userId) ?? getChipReconciliationService().reconcileUser(input.userId);
      }),

    reconcileLegacyFleetAgainstOfficialProjection: adminProcedure
      .query(async () => {
        return deps.reconcileLegacyFleet?.() ?? getChipReconciliationService().reconcileFleet();
      }),

    restartServices: adminProcedure.mutation(async () => {
      return restartRuntimeServices();
    }),
  });
}

export const runtimeRouter = buildRuntimeRouter();
