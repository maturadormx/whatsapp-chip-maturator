import { listClusterNodes, listDistributedChipSessions } from "../../db";
import { getInternalEventBus } from "../events/InternalEventBus";

export async function inspectFailoverCandidates() {
  const [nodes, sessions] = await Promise.all([
    listClusterNodes(200),
    listDistributedChipSessions({ limit: 500 }),
  ]);

  const unhealthyNodes = new Set(
    nodes
      .filter((node) => node.status === "offline" || node.status === "draining")
      .map((node) => node.nodeId),
  );

  return sessions.filter((session) => unhealthyNodes.has(session.ownerNodeId) || session.sessionStatus === "orphaned");
}

export async function runAutomaticFailover() {
  const candidates = await inspectFailoverCandidates();

  if (candidates.length > 0) {
    await getInternalEventBus().publish({
      type: "cluster.failover_requested",
      source: "AutomaticFailoverService",
      payload: {
        count: candidates.length,
        chipIds: candidates.map((item) => item.chipId),
      },
    }).catch(() => null);
  }

  return {
    candidates,
    reassigned: 0,
  };
}
