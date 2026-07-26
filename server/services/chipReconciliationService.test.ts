import { describe, expect, it } from "vitest";
import { InMemoryChipEventStore, InMemoryChipProjectionStore } from "../domain/chip";
import { createChipCoreApiService } from "./chipCoreApiService";
import { buildLegacyOfficialChipId } from "./chipLegacyBridgeService";
import { createChipProjectionWorkerService } from "./chipProjectionWorkerService";
import { createChipReconciliationService } from "./chipReconciliationService";

describe("ChipReconciliationService", () => {
  it("marca como reconciliado quando legado, projeção e replay são compatíveis", async () => {
    const eventStore = new InMemoryChipEventStore();
    const projectionStore = new InMemoryChipProjectionStore();
    const apiService = createChipCoreApiService(eventStore);
    const worker = createChipProjectionWorkerService(eventStore, projectionStore, apiService);
    const officialChipId = buildLegacyOfficialChipId(1, 10);

    await apiService.createChip({ chipId: officialChipId, createdBy: "migration", sprint: 0 });
    await apiService.pairChip({ chipId: officialChipId, pairedWith: "+5511999999999" });
    await apiService.appendEvent({
      chip_id: officialChipId,
      event_type: "chip_state_changed",
      event_version: 1,
      payload: { from_state: "PAREADO", to_state: "NOVO", trigger: "legacy_migration" },
    });
    await apiService.appendEvent({
      chip_id: officialChipId,
      event_type: "chip_state_changed",
      event_version: 1,
      payload: { from_state: "NOVO", to_state: "EM_MATURACAO", trigger: "legacy_migration" },
    });
    await worker.processPersistedEvents();

    const reconciliation = createChipReconciliationService(eventStore, projectionStore, apiService, {
      async getAllChips() {
        return [
          {
            id: 10,
            userId: 1,
            chipName: "Chip A",
            phoneNumber: "+5511999999999",
            status: "maturando",
            maturationProfile: "normal",
            sessionData: null,
            qrCode: null,
            isPaused: 0,
            lastActivity: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ];
      },
      async getUserChips() {
        return [
          {
            id: 10,
            userId: 1,
            chipName: "Chip A",
            phoneNumber: "+5511999999999",
            status: "maturando",
            maturationProfile: "normal",
            sessionData: null,
            qrCode: null,
            isPaused: 0,
            lastActivity: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ];
      },
    });

    const report = await reconciliation.reconcileUser(1);

    expect(report.reconciled_chips).toBe(1);
    expect(report.divergences_found).toBe(0);
  });

  it("detecta chip sem stream oficial e projeção inconsistente com replay", async () => {
    const eventStore = new InMemoryChipEventStore();
    const projectionStore = new InMemoryChipProjectionStore();
    const apiService = createChipCoreApiService(eventStore);
    const officialChipId = buildLegacyOfficialChipId(2, 20);

    await apiService.createChip({ chipId: officialChipId, createdBy: "migration", sprint: 0 });
    await projectionStore.saveProjection({
      chip_id: officialChipId,
      current_state: "PAREADO",
      previous_state: "PAREADO",
      last_sequence: 999,
      inconsistency_count: 0,
      updated_at: new Date().toISOString(),
    });

    const reconciliation = createChipReconciliationService(eventStore, projectionStore, apiService, {
      async getAllChips() {
        return [
          {
            id: 20,
            userId: 2,
            chipName: "Chip B",
            phoneNumber: null,
            status: "conectado",
            maturationProfile: "normal",
            sessionData: null,
            qrCode: null,
            isPaused: 0,
            lastActivity: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 21,
            userId: 2,
            chipName: "Chip C",
            phoneNumber: null,
            status: "desconectado",
            maturationProfile: "suave",
            sessionData: null,
            qrCode: null,
            isPaused: 0,
            lastActivity: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ];
      },
      async getUserChips() {
        return [];
      },
    });

    const report = await reconciliation.reconcileFleet();

    expect(report.chips_without_official_stream).toHaveLength(1);
    expect(report.projections_inconsistent_with_replay).toHaveLength(1);
    expect(report.divergences_found).toBe(2);
  });

  it("considera compatível o legado desconectado com vínculo persistente quando o estado oficial é PAREADO", async () => {
    const eventStore = new InMemoryChipEventStore();
    const projectionStore = new InMemoryChipProjectionStore();
    const apiService = createChipCoreApiService(eventStore);
    const worker = createChipProjectionWorkerService(eventStore, projectionStore, apiService);
    const officialChipId = buildLegacyOfficialChipId(1, 40);

    await apiService.createChip({ chipId: officialChipId, createdBy: "migration", sprint: 0 });
    await apiService.pairChip({ chipId: officialChipId, pairedWith: "+5511999999999" });
    await worker.processPersistedEvents();

    const reconciliation = createChipReconciliationService(eventStore, projectionStore, apiService, {
      async getAllChips() {
        return [
          {
            id: 40,
            userId: 1,
            chipName: "Chip D",
            phoneNumber: "+5511999999999",
            status: "desconectado",
            maturationProfile: "normal",
            sessionData: null,
            qrCode: null,
            isPaused: 0,
            lastActivity: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ];
      },
      async getUserChips() {
        return [];
      },
    });

    const report = await reconciliation.reconcileFleet();

    expect(report.reconciled_chips).toBe(1);
    expect(report.legacy_official_divergences).toHaveLength(0);
    expect(report.divergences_found).toBe(0);
  });
});
