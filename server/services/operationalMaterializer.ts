import {
  getChipBehaviorScore,
  getChipCertification,
  getChipHealthSnapshot,
  getUserChips,
  listCertifiedChips,
} from "../db";
import {
  calculateOperationalState,
  persistOperationalState,
  toOperationalStateResult,
} from "./maturatorOperational";

type MaterializeOptions = {
  windowHours?: number;
};

export async function materializeChip(chipId: number, userId: number, options?: MaterializeOptions) {
  const snapshot = await calculateOperationalState(chipId, userId, options);
  await persistOperationalState(snapshot);
  return toOperationalStateResult(snapshot);
}

export async function materializeFleet(userId: number, options?: MaterializeOptions) {
  const chips = await getUserChips(userId);
  return Promise.all(chips.map((chip) => materializeChip(chip.id, userId, options)));
}

export async function materializeAndGetCertifiedPool(userId: number) {
  await materializeFleet(userId, { windowHours: 48 });
  const rows = await listCertifiedChips(userId);

  return rows.map((row) => ({
    chipId: row.chipId,
    health: row.health ?? 0,
    human: row.human ?? 0,
    risk: row.risk ?? 100,
    usable: Boolean(row.usable),
    status: row.status,
    chipName: row.chipName,
    phoneNumber: row.phoneNumber,
  }));
}

export async function materializeAndGetChipOperationalSummary(
  userId: number,
  chipId: number,
  options?: MaterializeOptions
) {
  const operational = await materializeChip(chipId, userId, options);
  const [health, scores, certification] = await Promise.all([
    getChipHealthSnapshot(userId, chipId),
    getChipBehaviorScore(userId, chipId),
    getChipCertification(userId, chipId),
  ]);

  return {
    ...operational,
    persisted: {
      health,
      scores,
      certification,
    },
  };
}
