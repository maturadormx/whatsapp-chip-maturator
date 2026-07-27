import { ENV } from "../../_core/env";
import { getClusterManager } from "./ClusterManager";
import { getDistributedSessionManager } from "./DistributedSessionManager";
import { getGlobalHealthMonitor } from "./GlobalHealthMonitor";
import { getRedisPubSubEventBus } from "./RedisPubSubEventBus";
import { getRedisCommandClient } from "./RedisClient";

class DistributedPlatformRuntime {
  private started = false;
  private syncTimer: NodeJS.Timeout | null = null;

  async start() {
    if (this.started || !ENV.distributedRuntimeEnabled || !ENV.redisEnabled) return;

    const redis = await getRedisCommandClient();
    if (!redis) {
      console.warn("[DistributedRuntime] Redis indisponível. Runtime distribuído desabilitado.");
      return;
    }

    this.started = true;

    await getRedisPubSubEventBus().start();
    await getClusterManager().start();
    await getDistributedSessionManager().syncLocalSessions();
    await getGlobalHealthMonitor().start();

    this.syncTimer = setInterval(() => {
      void getDistributedSessionManager().syncLocalSessions();
    }, Math.max(15_000, ENV.clusterHeartbeatMs));
  }
}

const globalDistributedPlatformRuntime = new DistributedPlatformRuntime();

export function getDistributedPlatformRuntime() {
  return globalDistributedPlatformRuntime;
}
