import { ENV } from "../../_core/env";
import { recordAuditEvent } from "../audit/AuditEngine";
import { getInternalEventBus } from "../events/InternalEventBus";
import { getRedisCommandClient } from "./RedisClient";
import { getLeaderLease, upsertLeaderLease } from "../../db";

class LeaderElectionService {
  private timer: NodeJS.Timeout | null = null;
  private leaseToken = `${ENV.clusterNodeId}:${process.pid}`;
  private leader = false;

  async tick() {
    const redis = await getRedisCommandClient();
    const leaseKey = "global_runtime";

    if (redis) {
      const result = await redis.set(
        `leader:${leaseKey}`,
        this.leaseToken,
        "PX",
        ENV.leaderLeaseMs,
        "NX",
      );

      if (result === "OK") {
        this.leader = true;
      } else {
        const current = await redis.get(`leader:${leaseKey}`);
        this.leader = current === this.leaseToken;
        if (this.leader) {
          await redis.pexpire(`leader:${leaseKey}`, ENV.leaderLeaseMs);
        }
      }
    } else {
      const current = await getLeaderLease(leaseKey);
      if (!current || new Date(current.expiresAt).getTime() < Date.now() || current.leaderNodeId === ENV.clusterNodeId) {
        this.leader = true;
      } else {
        this.leader = false;
      }
    }

    if (this.leader) {
      await upsertLeaderLease({
        leaseKey,
        leaderNodeId: ENV.clusterNodeId,
        leaseToken: this.leaseToken,
        expiresAt: new Date(Date.now() + ENV.leaderLeaseMs),
        payload: {
          pid: process.pid,
        },
      }).catch(() => null);
    }

    await getInternalEventBus().publish({
      type: this.leader ? "cluster.leader_acquired" : "cluster.leader_observed",
      source: "LeaderElectionService",
      payload: {
        nodeId: ENV.clusterNodeId,
        leader: this.leader,
      },
    }).catch(() => null);
  }

  async start() {
    if (this.timer) return;
    await this.tick();
    this.timer = setInterval(() => {
      void this.tick();
    }, Math.max(5_000, Math.floor(ENV.leaderLeaseMs / 2)));
    await recordAuditEvent({
      engine: "LeaderElectionService",
      action: "started",
      payload: {
        nodeId: ENV.clusterNodeId,
      },
    }).catch(() => null);
  }

  isLeader() {
    return this.leader;
  }
}

const globalLeaderElectionService = new LeaderElectionService();

export function getLeaderElectionService() {
  return globalLeaderElectionService;
}
