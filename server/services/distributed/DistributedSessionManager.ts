import { ENV } from "../../_core/env";
import { getAllChips, listDistributedChipSessions, upsertDistributedChipSession } from "../../db";
import { getAllSessions, getChipHealth } from "../whatsappService";

class DistributedSessionManager {
  async syncLocalSessions() {
    const [chips, sessions] = await Promise.all([getAllChips(), Promise.resolve(getAllSessions())]);
    const sessionsMap = new Map(sessions.map((session) => [session.chipId, session]));

    for (const chip of chips) {
      const local = sessionsMap.get(chip.id);
      const health = await getChipHealth(chip.id, chip.userId, chip.phoneNumber);
      await upsertDistributedChipSession({
        userId: chip.userId,
        chipId: chip.id,
        ownerNodeId: ENV.clusterNodeId,
        phoneNumber: chip.phoneNumber ?? null,
        sessionStatus: health.connected
          ? "connected"
          : local
            ? "recovering"
            : "disconnected",
        connectionState: health.connectionState,
        healthScore: health.healthScore,
        payload: {
          socketState: health.socketState,
          pendingJobs: health.pendingJobs,
          socketInstanceId: health.socketInstanceId,
        },
      });
    }
  }

  async listSessions() {
    return listDistributedChipSessions({ limit: 500 });
  }
}

const globalDistributedSessionManager = new DistributedSessionManager();

export function getDistributedSessionManager() {
  return globalDistributedSessionManager;
}
