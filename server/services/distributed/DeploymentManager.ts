import { ENV } from "../../_core/env";
import { getConfigurationCenter } from "../config/ConfigurationCenter";

export async function getDeploymentProfile() {
  const rollingUpdate = await getConfigurationCenter().get<Record<string, unknown> | null>(
    "deployment.rolling_update",
    null,
  );

  return {
    nodeId: ENV.clusterNodeId,
    role: ENV.clusterNodeRole,
    distributedRuntimeEnabled: ENV.distributedRuntimeEnabled,
    redisUrlConfigured: Boolean(ENV.redisUrl),
    rollingUpdate,
    recommended: {
      docker: true,
      kubernetes: true,
      horizontalScaling: true,
      sharedRedis: Boolean(ENV.redisUrl),
    },
  };
}
