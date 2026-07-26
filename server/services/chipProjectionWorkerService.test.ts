import { describe, expect, it } from "vitest";
import { InMemoryChipEventStore, InMemoryChipProjectionStore } from "../domain/chip";
import { createChipCoreApiService } from "./chipCoreApiService";
import { CHIP_STATE_PROJECTION_WORKER, createChipProjectionWorkerService } from "./chipProjectionWorkerService";

describe("ChipProjectionWorkerService", () => {
  it("projeta estado a partir de eventos oficialmente persistidos", async () => {
    const eventStore = new InMemoryChipEventStore();
    const projectionStore = new InMemoryChipProjectionStore();
    const apiService = createChipCoreApiService(eventStore);
    const worker = createChipProjectionWorkerService(eventStore, projectionStore, apiService);

    await apiService.createChip({
      chipId: "a2d0fb6a-c60e-41cb-9483-776e1532cf31",
      createdBy: "system",
      sprint: 0,
    });
    await apiService.pairChip({
      chipId: "a2d0fb6a-c60e-41cb-9483-776e1532cf31",
      pairedWith: "+5511999999999",
    });

    const result = await worker.processPersistedEvents();
    const projection = await worker.getProjection("a2d0fb6a-c60e-41cb-9483-776e1532cf31");

    expect(result.processed_offsets).toBe(2);
    expect(result.projected_chips).toBe(1);
    expect(projection?.current_state).toBe("PAREADO");
    expect(projection?.last_sequence).toBe(2);
    expect(projection?.inconsistency_count).toBe(0);
  });

  it("avança checkpoint e só reage a novos fatos persistidos", async () => {
    const eventStore = new InMemoryChipEventStore();
    const projectionStore = new InMemoryChipProjectionStore();
    const apiService = createChipCoreApiService(eventStore);
    const worker = createChipProjectionWorkerService(eventStore, projectionStore, apiService);
    const chipId = "56928218-b3df-4c8b-82fd-9d2a6a2eb5ef";

    await apiService.createChip({ chipId, createdBy: "system", sprint: 0 });
    const firstRun = await worker.processPersistedEvents();
    expect(firstRun.last_offset).toBe(1);

    const secondRun = await worker.processPersistedEvents();
    expect(secondRun.processed_offsets).toBe(0);
    expect(secondRun.last_offset).toBe(1);

    await apiService.pairChip({ chipId, pairedWith: "+5511999999999" });
    await apiService.appendEvent({
      chip_id: chipId,
      event_type: "chip_state_changed",
      event_version: 1,
      payload: {
        from_state: "PAREADO",
        to_state: "NOVO",
        trigger: "evolved",
      },
    });

    const thirdRun = await worker.processPersistedEvents();
    const checkpoint = await projectionStore.getCheckpoint(CHIP_STATE_PROJECTION_WORKER);
    const projection = await worker.getProjection(chipId);

    expect(thirdRun.processed_offsets).toBe(2);
    expect(checkpoint?.last_offset).toBe(3);
    expect(projection?.current_state).toBe("NOVO");
  });

  it("agrupa múltiplos eventos do mesmo chip em uma única atualização de projeção por rodada", async () => {
    const eventStore = new InMemoryChipEventStore();
    const projectionStore = new InMemoryChipProjectionStore();
    const apiService = createChipCoreApiService(eventStore);
    const worker = createChipProjectionWorkerService(eventStore, projectionStore, apiService);

    await apiService.createChip({
      chipId: "c6b4cc15-2cf2-4896-98ff-b6a57993db5f",
      createdBy: "system",
      sprint: 0,
    });
    await apiService.pairChip({
      chipId: "c6b4cc15-2cf2-4896-98ff-b6a57993db5f",
      pairedWith: "+5511999999999",
    });
    await apiService.appendEvent({
      chip_id: "c6b4cc15-2cf2-4896-98ff-b6a57993db5f",
      event_type: "chip_state_changed",
      event_version: 1,
      payload: {
        from_state: "PAREADO",
        to_state: "NOVO",
        trigger: "evolved",
      },
    });

    const result = await worker.processPersistedEvents({ limit: 10 });

    expect(result.processed_offsets).toBe(3);
    expect(result.projected_chips).toBe(1);
  });
});
