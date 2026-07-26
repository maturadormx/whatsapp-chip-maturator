import { getAllChips, getChipById, getUserChips } from "../db";
import { type ChipEventStore } from "../domain/chip";
import { createChipCoreApiService, getChipCoreApiService, type ChipCoreApiService } from "./chipCoreApiService";
import { getDefaultChipEventStore } from "./chipInfrastructure";

export type LegacyChipSnapshot = {
  id: number;
  userId: number;
  chipName: string;
  phoneNumber: string | null;
  status: "conectado" | "maturando" | "desconectado";
  maturationProfile: "suave" | "normal" | "ultra";
  isPaused: number;
  createdAt: Date;
  updatedAt: Date;
  lastActivity: Date | null;
};

type LegacyBridgeDependencies = {
  getAllChips: typeof getAllChips;
  getUserChips: typeof getUserChips;
  getChipById: typeof getChipById;
};

export type LegacyMigrationResult = {
  legacy_chip_id: number;
  official_chip_id: string;
  status: "migrated" | "already_migrated";
  persisted_events: number;
};

export function buildLegacyOfficialChipId(userId: number, legacyChipId: number) {
  return `legacy-user-${userId}-chip-${legacyChipId}`;
}

function normalizeLegacyChip(raw: Awaited<ReturnType<typeof getChipById>>): LegacyChipSnapshot | null {
  if (!raw) return null;

  return {
    id: raw.id,
    userId: raw.userId,
    chipName: raw.chipName,
    phoneNumber: raw.phoneNumber ?? null,
    status: raw.status,
    maturationProfile: raw.maturationProfile,
    isPaused: raw.isPaused,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    lastActivity: raw.lastActivity ?? null,
  };
}

export class ChipLegacyBridgeService {
  constructor(
    private readonly eventStore: ChipEventStore,
    private readonly apiService: ChipCoreApiService,
    private readonly deps: LegacyBridgeDependencies
  ) {}

  async migrateLegacyChipById(legacyChipId: number): Promise<LegacyMigrationResult> {
    const raw = await this.deps.getChipById(legacyChipId);
    const chip = normalizeLegacyChip(raw);
    if (!chip) {
      throw new Error("LEGACY_CHIP_NOT_FOUND");
    }

    return this.migrateLegacyChip(chip);
  }

  async migrateLegacyUserChips(userId: number) {
    const rows = await this.deps.getUserChips(userId);
    const results: LegacyMigrationResult[] = [];

    for (const row of rows) {
      const normalized: LegacyChipSnapshot = {
        id: row.id,
        userId: row.userId,
        chipName: row.chipName,
        phoneNumber: row.phoneNumber ?? null,
        status: row.status,
        maturationProfile: row.maturationProfile,
        isPaused: row.isPaused,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        lastActivity: row.lastActivity ?? null,
      };

      results.push(await this.migrateLegacyChip(normalized));
    }

    return {
      user_id: userId,
      migrated: results.filter((item) => item.status === "migrated").length,
      already_migrated: results.filter((item) => item.status === "already_migrated").length,
      results,
    };
  }

  async migrateLegacyFleet() {
    const rows = await this.deps.getAllChips();
    const results: LegacyMigrationResult[] = [];

    for (const row of rows) {
      const normalized: LegacyChipSnapshot = {
        id: row.id,
        userId: row.userId,
        chipName: row.chipName,
        phoneNumber: row.phoneNumber ?? null,
        status: row.status,
        maturationProfile: row.maturationProfile,
        isPaused: row.isPaused,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        lastActivity: row.lastActivity ?? null,
      };

      results.push(await this.migrateLegacyChip(normalized));
    }

    return {
      migrated: results.filter((item) => item.status === "migrated").length,
      already_migrated: results.filter((item) => item.status === "already_migrated").length,
      results,
    };
  }

  async migrateLegacyChip(chip: LegacyChipSnapshot): Promise<LegacyMigrationResult> {
    const officialChipId = buildLegacyOfficialChipId(chip.userId, chip.id);
    const existing = await this.eventStore.getHistory(officialChipId);

    if (existing.events.length > 0) {
      return {
        legacy_chip_id: chip.id,
        official_chip_id: officialChipId,
        status: "already_migrated",
        persisted_events: 0,
      };
    }

    let persistedEvents = 0;

    await this.apiService.createChip({
      chipId: officialChipId,
      createdBy: "legacy_migration",
      sprint: 0,
      occurredAt: chip.createdAt.toISOString(),
    });
    persistedEvents += 1;

    if (chip.phoneNumber) {
      await this.apiService.pairChip({
        chipId: officialChipId,
        pairedWith: chip.phoneNumber,
        deviceId: chip.chipName,
        occurredAt: (chip.lastActivity ?? chip.updatedAt).toISOString(),
      });
      persistedEvents += 1;
    }

    if (chip.status === "maturando" && chip.phoneNumber) {
      await this.apiService.appendEvent({
        chip_id: officialChipId,
        event_type: "chip_state_changed",
        event_version: 1,
        occurredAt: chip.updatedAt.toISOString(),
        metadata: {
          source: "legacy_bridge",
          legacy_chip_id: chip.id,
          legacy_status: chip.status,
          legacy_profile: chip.maturationProfile,
        },
        payload: {
          from_state: "PAREADO",
          to_state: "NOVO",
          trigger: "legacy_migration",
        },
      });
      persistedEvents += 1;

      await this.apiService.appendEvent({
        chip_id: officialChipId,
        event_type: "chip_state_changed",
        event_version: 1,
        occurredAt: chip.updatedAt.toISOString(),
        metadata: {
          source: "legacy_bridge",
          legacy_chip_id: chip.id,
          legacy_status: chip.status,
          legacy_profile: chip.maturationProfile,
        },
        payload: {
          from_state: "NOVO",
          to_state: "EM_MATURACAO",
          trigger: "legacy_migration",
        },
      });
      persistedEvents += 1;
    }

    return {
      legacy_chip_id: chip.id,
      official_chip_id: officialChipId,
      status: "migrated",
      persisted_events: persistedEvents,
    };
  }
}

let defaultChipLegacyBridgeService: ChipLegacyBridgeService | null = null;

export function createChipLegacyBridgeService(
  eventStore: ChipEventStore,
  apiService?: ChipCoreApiService,
  deps: LegacyBridgeDependencies = {
    getAllChips,
    getUserChips,
    getChipById,
  }
) {
  return new ChipLegacyBridgeService(eventStore, apiService ?? createChipCoreApiService(eventStore), deps);
}

export function getChipLegacyBridgeService() {
  if (!defaultChipLegacyBridgeService) {
    const eventStore = getDefaultChipEventStore();
    defaultChipLegacyBridgeService = createChipLegacyBridgeService(eventStore, getChipCoreApiService());
  }

  return defaultChipLegacyBridgeService;
}
