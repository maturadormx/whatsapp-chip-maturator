import { describe, expect, it } from "vitest";
import { InMemoryChipEventStore } from "../domain/chip";
import { createChipCoreApiService } from "./chipCoreApiService";
import { buildLegacyOfficialChipId, createChipLegacyBridgeService } from "./chipLegacyBridgeService";

describe("ChipLegacyBridgeService", () => {
  it("migra um chip legado para o stream oficial com id previsível", async () => {
    const eventStore = new InMemoryChipEventStore();
    const apiService = createChipCoreApiService(eventStore);
    const bridge = createChipLegacyBridgeService(eventStore, apiService, {
      async getUserChips() {
        return [];
      },
      async getChipById() {
        return {
          id: 7,
          userId: 3,
          chipName: "Chip Legado",
          phoneNumber: "+5511999999999",
          status: "maturando",
          maturationProfile: "normal",
          sessionData: null,
          qrCode: null,
          isPaused: 0,
          lastActivity: new Date("2026-07-18T12:00:00.000Z"),
          createdAt: new Date("2026-07-18T10:00:00.000Z"),
          updatedAt: new Date("2026-07-18T12:00:00.000Z"),
        };
      },
    });

    const result = await bridge.migrateLegacyChipById(7);
    const history = await eventStore.getHistory(buildLegacyOfficialChipId(3, 7));
    const replay = await apiService.replayHistory({ chipId: buildLegacyOfficialChipId(3, 7) });

    expect(result.status).toBe("migrated");
    expect(result.official_chip_id).toBe("legacy-user-3-chip-7");
    expect(history.events).toHaveLength(4);
    expect(replay.replay.current_state).toBe("EM_MATURACAO");
  });

  it("é idempotente quando o chip legado já foi migrado", async () => {
    const eventStore = new InMemoryChipEventStore();
    const apiService = createChipCoreApiService(eventStore);
    const bridge = createChipLegacyBridgeService(eventStore, apiService, {
      async getUserChips() {
        return [];
      },
      async getChipById() {
        return {
          id: 8,
          userId: 4,
          chipName: "Chip Legado 2",
          phoneNumber: "+5511888888888",
          status: "conectado",
          maturationProfile: "suave",
          sessionData: null,
          qrCode: null,
          isPaused: 0,
          lastActivity: new Date("2026-07-18T12:00:00.000Z"),
          createdAt: new Date("2026-07-18T10:00:00.000Z"),
          updatedAt: new Date("2026-07-18T12:00:00.000Z"),
        };
      },
    });

    const first = await bridge.migrateLegacyChipById(8);
    const second = await bridge.migrateLegacyChipById(8);

    expect(first.status).toBe("migrated");
    expect(second.status).toBe("already_migrated");
    expect(second.persisted_events).toBe(0);
  });

  it("migra a frota legada inteira de forma agregada", async () => {
    const eventStore = new InMemoryChipEventStore();
    const apiService = createChipCoreApiService(eventStore);
    const bridge = createChipLegacyBridgeService(eventStore, apiService, {
      async getAllChips() {
        return [
          {
            id: 1,
            userId: 1,
            chipName: "Chip 1",
            phoneNumber: "+551100000001",
            status: "conectado",
            maturationProfile: "suave",
            sessionData: null,
            qrCode: null,
            isPaused: 0,
            lastActivity: new Date("2026-07-18T12:00:00.000Z"),
            createdAt: new Date("2026-07-18T10:00:00.000Z"),
            updatedAt: new Date("2026-07-18T12:00:00.000Z"),
          },
          {
            id: 2,
            userId: 1,
            chipName: "Chip 2",
            phoneNumber: "+551100000002",
            status: "maturando",
            maturationProfile: "normal",
            sessionData: null,
            qrCode: null,
            isPaused: 0,
            lastActivity: new Date("2026-07-18T12:00:00.000Z"),
            createdAt: new Date("2026-07-18T10:00:00.000Z"),
            updatedAt: new Date("2026-07-18T12:00:00.000Z"),
          },
        ];
      },
      async getUserChips() {
        return [];
      },
      async getChipById() {
        return null;
      },
    });

    const result = await bridge.migrateLegacyFleet();

    expect(result.migrated).toBe(2);
    expect(result.already_migrated).toBe(0);
    expect(result.results).toHaveLength(2);
  });
});
