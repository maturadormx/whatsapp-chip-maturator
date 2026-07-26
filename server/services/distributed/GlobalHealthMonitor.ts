import { ENV } from "../../_core/env";
import {
  listDistributedChipSessions,
  listWorkerHeartbeats,
} from "../../db";
import { getInternalEventBus } from "../events/InternalEventBus";
import { getRedisCommandClient } from "./RedisClient";

class GlobalHealthMonitor {
  private timer: NodeJS.Timeout | null = null;
  private snapshot: Record<string, unknown> | null = null;

  async collect() {
    const [workers, sessions, redis] = await Promise.all([
      listWorkerHeartbeats({ limit: 200 }),
      listDistributedChipSessions({ limit: 500 }),
      getRedisCommandClient(),
    ]);

    let redisPingMs: number | null = null;
    if (redis) {
      const started = Date.now();
      await redis.ping().catch(() => null);
      redisPingMs = Date.now() - started;
    }

    const unhealthySessions = sessions.filter((session) => Number(session.healthScore ?? 0) < 50).length;

    this.snapshot = {
      generatedAt: new Date().toISOString(),
      process: {
        uptimeSec: Math.round(process.uptime()),
        rss: process.memoryUsage().rss,
        heapUsed: process.memoryUsage().heapUsed,
      },
      cluster: {
        workers: workers.length,
        degradedWorkers: workers.filter((worker) => worker.status === "degraded").length,
      },
      redis: {
        enabled: Boolean(redis),
        pingMs: redisPingMs,
      },
      sessions: {
        total: sessions.length,
        unhealthy: unhealthySessions,
      },
    };

    if (unhealthySessions > 0) {
      await getInternalEventBus().publish({
        type: "runtime.alert",
        source: "GlobalHealthMonitor",
        payload: {
          unhealthySessions,
          snapshot: this.snapshot,
        },
      }).catch(() => null);
    }

    return this.snapshot;
  }

  async start() {
    if (this.timer) return;
    await this.collect();
    this.timer = setInterval(() => {
      void this.collect();
    }, ENV.globalHealthIntervalMs);
  }

  getSnapshot() {
    return this.snapshot;
  }
}

const globalGlobalHealthMonitor = new GlobalHealthMonitor();

export function getGlobalHealthMonitor() {
  return globalGlobalHealthMonitor;
}
