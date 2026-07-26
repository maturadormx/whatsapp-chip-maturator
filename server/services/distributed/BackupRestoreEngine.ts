import {
  createClusterBackupSnapshot,
  listClusterBackupSnapshots,
  listClusterNodes,
  listDistributedChipSessions,
  listWorkerHeartbeats,
  markClusterBackupRestored,
} from "../../db";

export async function createOperationalSnapshot(scope = "cluster") {
  const payload = {
    createdAt: new Date().toISOString(),
    clusterNodes: await listClusterNodes(500),
    workers: await listWorkerHeartbeats({ limit: 500 }),
    distributedSessions: await listDistributedChipSessions({ limit: 1000 }),
  };

  const snapshotKey = `${scope}:${Date.now()}`;
  await createClusterBackupSnapshot({
    snapshotKey,
    scope,
    payload,
  });

  return {
    snapshotKey,
    payload,
  };
}

export async function restoreOperationalSnapshot(snapshotKey: string) {
  const snapshots = await listClusterBackupSnapshots(200);
  const match = snapshots.find((snapshot) => snapshot.snapshotKey === snapshotKey);
  if (!match) {
    throw new Error("snapshot_not_found");
  }

  await markClusterBackupRestored(snapshotKey, "restored");
  return match;
}
