import os from "os";
import { ENV } from "../../_core/env";
import { listClusterNodes, upsertClusterNode } from "../../db";
import { recordAuditEvent } from "../audit/AuditEngine";
import { getInternalEventBus } from "../events/InternalEventBus";
import { getLeaderElectionService } from "./LeaderElectionService";

class ClusterManager {
  private timer: NodeJS.Timeout | null = null;

  async heartbeat(status: "starting" | "running" | "draining" | "offline" = "running") {
    const leader = getLeaderElectionService().isLeader();
    await upsertClusterNode({
      nodeId: ENV.clusterNodeId,
      hostname: os.hostname(),
      pid: process.pid,
      role: ENV.clusterNodeRole,
      status,
      version: process.env.npm_package_version ?? null,
      isLeader: leader,
      payload: {
        rss: process.memoryUsage().rss,
        uptimeSec: Math.round(process.uptime()),
      },
    });
  }

  async start() {
    if (this.timer) return;
    await this.heartbeat("starting");
    await getLeaderElectionService().start();
    await this.heartbeat("running");
    this.timer = setInterval(() => {
      void this.heartbeat("running");
    }, ENV.clusterHeartbeatMs);
    await recordAuditEvent({
      engine: "ClusterManager",
      action: "started",
      payload: {
        nodeId: ENV.clusterNodeId,
        role: ENV.clusterNodeRole,
      },
    }).catch(() => null);
  }

  async markDraining() {
    await this.heartbeat("draining");
    await getInternalEventBus().publish({
      type: "cluster.node_draining",
      source: "ClusterManager",
      payload: {
        nodeId: ENV.clusterNodeId,
      },
    }).catch(() => null);
  }

  async listNodes() {
    return listClusterNodes(200);
  }
}

const globalClusterManager = new ClusterManager();

export function getClusterManager() {
  return globalClusterManager;
}
