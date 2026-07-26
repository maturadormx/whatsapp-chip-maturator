import { getConfigurationCenter } from "../config/ConfigurationCenter";
import { getClusterManager } from "./ClusterManager";

export async function enterRollingUpdateMode() {
  await getConfigurationCenter().set({
    key: "deployment.rolling_update",
    value: {
      enabled: true,
      startedAt: new Date().toISOString(),
    },
    description: "Controle de rolling update da plataforma distribuída.",
  });
  await getClusterManager().markDraining();
  return {
    success: true,
  };
}

export async function exitRollingUpdateMode() {
  await getConfigurationCenter().set({
    key: "deployment.rolling_update",
    value: {
      enabled: false,
      endedAt: new Date().toISOString(),
    },
    description: "Controle de rolling update da plataforma distribuída.",
  });
  await getClusterManager().heartbeat("running");
  return {
    success: true,
  };
}
