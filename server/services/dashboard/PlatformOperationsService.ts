import { listAuditEvents, listWorkerHeartbeats } from "../../db";
import { getResolvedFeatureFlags } from "../featureFlags/FeatureFlagService";
import { getTenantLicenseSummary } from "../licensing/TenantLicenseService";
import { inspectRecoveryCandidates } from "../recovery/AutoRecoveryService";
import { getConfigurationCenter } from "../config/ConfigurationCenter";
import { getClusterManager } from "../distributed/ClusterManager";
import { getLeaderElectionService } from "../distributed/LeaderElectionService";
import { getDistributedSessionManager } from "../distributed/DistributedSessionManager";
import { getGlobalHealthMonitor } from "../distributed/GlobalHealthMonitor";
import { getDeploymentProfile } from "../distributed/DeploymentManager";
import { listClusterBackupSnapshots } from "../../db";
import { getTenantPlatformSummary } from "../platform/TenantPlatformService";
import { listSecretsCatalog } from "../platform/SecretsManagerService";
import { getDistributedCacheService } from "../platform/DistributedCacheService";
import { listReplayStreams } from "../platform/MessageReplayService";
import { listWorkflowDefinitions } from "../platform/WorkflowEngineService";
import { listPolicyRules } from "../platform/PolicyEngineService";
import { inspectPlatformResources } from "../platform/ResourceManagerService";
import { buildCapacityPlan } from "../platform/CapacityPlannerService";
import { getChaosStatus } from "../platform/ChaosTestingService";
import { buildObservability360 } from "../platform/Observability360Service";
import { analyzeOptimizationOpportunities, getOptimizationProfile } from "../platform/AIOptimizationEngineService";
import { listExperiments } from "../platform/ExperimentEngineService";
import { simulateFleetDecision } from "../platform/DigitalTwinService";
import { listInstalledPlugins } from "../platform/PluginMarketplaceService";
import { exportRuleDesignerDocument } from "../platform/RuleDesignerService";
import { buildDataWarehouseSnapshot } from "../platform/DataWarehouseAnalyticsService";
import { buildCostManagementView } from "../platform/CostManagementService";
import { evaluateAutoScaling, getAutoScalingProfile } from "../platform/AutoScalingManagerService";
import { buildComplianceGovernanceView, getComplianceGovernancePolicy } from "../platform/ComplianceGovernanceService";
import {
  generateOpenApiDocument,
  generateSdkArtifact,
  listWebhookRegistrations,
} from "../platform/PublicApiService";

export async function buildPlatformOperationsDashboard(userId: number) {
  const [
    featureFlags,
    tenant,
    workerHeartbeats,
    recentAudit,
    recoveryCandidates,
    configs,
    clusterNodes,
    distributedSessions,
    deployment,
    backups,
    tenantPlatform,
    secretsCatalog,
    replayStreams,
    workflows,
    policies,
    resources,
    capacity,
    chaos,
    observability,
    optimization,
    optimizationProfile,
    experiments,
    digitalTwin,
    plugins,
    ruleDesigner,
    warehouse,
    costs,
    autoscaling,
    autoscalingProfile,
    compliance,
    compliancePolicy,
    openapi,
    webhooks,
    sdkArtifact,
  ] =
    await Promise.all([
      getResolvedFeatureFlags(),
      getTenantLicenseSummary(userId),
      listWorkerHeartbeats({ limit: 50 }),
      listAuditEvents({ userId, limit: 50 }),
      inspectRecoveryCandidates(),
      getConfigurationCenter().list("runtime."),
      getClusterManager().listNodes(),
      getDistributedSessionManager().listSessions(),
      getDeploymentProfile(),
      listClusterBackupSnapshots(20),
      getTenantPlatformSummary(userId),
      listSecretsCatalog({ scope: "tenant", tenantId: userId }),
      listReplayStreams(20),
      listWorkflowDefinitions(),
      listPolicyRules(),
      inspectPlatformResources(userId),
      buildCapacityPlan(userId),
      getChaosStatus(),
      buildObservability360(userId),
      analyzeOptimizationOpportunities(userId),
      getOptimizationProfile(),
      listExperiments(),
      simulateFleetDecision(userId),
      listInstalledPlugins(),
      exportRuleDesignerDocument(),
      buildDataWarehouseSnapshot(userId),
      buildCostManagementView(userId),
      evaluateAutoScaling(userId),
      getAutoScalingProfile(),
      buildComplianceGovernanceView(userId),
      getComplianceGovernancePolicy(),
      Promise.resolve(generateOpenApiDocument()),
      listWebhookRegistrations(),
      Promise.resolve(generateSdkArtifact()),
    ]);

  return {
    generatedAt: new Date().toISOString(),
    featureFlags,
    tenant,
    workers: workerHeartbeats,
    recovery: {
      candidates: recoveryCandidates,
    },
    distributed: {
      nodes: clusterNodes,
      sessions: distributedSessions,
      leader: {
        nodeId: deployment.nodeId,
        active: getLeaderElectionService().isLeader(),
      },
      health: getGlobalHealthMonitor().getSnapshot(),
      backups,
      deployment,
    },
    recentAudit,
    configs,
    platform3: {
      tenantPlatform,
      secrets: {
        total: secretsCatalog.length,
        catalog: secretsCatalog,
      },
      cache: getDistributedCacheService().getStats(),
      replay: replayStreams,
      workflows,
      policies,
      resources,
      capacity,
      chaos,
      observability,
    },
    platform4: {
      optimization,
      optimizationProfile,
      experiments,
      digitalTwin,
      plugins,
      ruleDesigner,
      warehouse,
      costs,
      autoscaling,
      autoscalingProfile,
      compliance,
      compliancePolicy,
      publicApi: {
        openapi,
        webhooks,
        sdkArtifact,
      },
    },
  };
}
