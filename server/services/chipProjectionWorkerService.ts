import {
  type ChipEventStore,
  type ChipProjectionStore,
  type ChipStateProjection,
} from "../domain/chip";
import { ChipCoreApiService, createChipCoreApiService, getChipCoreApiService } from "./chipCoreApiService";
import { getDefaultChipEventStore, getDefaultChipProjectionStore } from "./chipInfrastructure";

export const CHIP_STATE_PROJECTION_WORKER = "chip-state-projection";

export class ChipProjectionWorkerService {
  constructor(
    private readonly eventStore: ChipEventStore,
    private readonly projectionStore: ChipProjectionStore,
    private readonly apiService: ChipCoreApiService,
    private readonly workerName = CHIP_STATE_PROJECTION_WORKER
  ) {}

  async processPersistedEvents(options?: { limit?: number }) {
    const checkpoint = await this.projectionStore.getCheckpoint(this.workerName);
    const batch = await this.eventStore.listPersistedEvents({
      afterOffset: checkpoint?.last_offset ?? 0,
      limit: options?.limit ?? 100,
    });

    if (batch.items.length === 0) {
      return {
        worker: this.workerName,
        processed_offsets: 0,
        projected_chips: 0,
        last_offset: checkpoint?.last_offset ?? 0,
      };
    }

    const chipIds = Array.from(new Set(batch.items.map((item) => item.event.chip_id)));

    for (const chipId of chipIds) {
      const replay = await this.apiService.replayHistory({ chipId });
      const projection: ChipStateProjection = {
        chip_id: chipId,
        current_state: replay.replay.current_state,
        previous_state: replay.replay.previous_state,
        last_sequence: replay.replay.last_sequence,
        inconsistency_count: replay.replay.inconsistencies.length,
        updated_at: new Date().toISOString(),
      };

      await this.projectionStore.saveProjection(projection);
    }

    const lastOffset = batch.items[batch.items.length - 1]!.offset;
    await this.projectionStore.saveCheckpoint({
      worker_name: this.workerName,
      last_offset: lastOffset,
      updated_at: new Date().toISOString(),
    });

    return {
      worker: this.workerName,
      processed_offsets: batch.items.length,
      projected_chips: chipIds.length,
      last_offset: lastOffset,
    };
  }

  async getProjection(chipId: string) {
    return this.projectionStore.getProjection(chipId);
  }
}

export function createChipProjectionWorkerService(
  eventStore: ChipEventStore,
  projectionStore: ChipProjectionStore,
  apiService?: ChipCoreApiService
) {
  return new ChipProjectionWorkerService(eventStore, projectionStore, apiService ?? createChipCoreApiService(eventStore));
}

let defaultWorkerService: ChipProjectionWorkerService | null = null;

export function getChipProjectionWorkerService() {
  if (!defaultWorkerService) {
    defaultWorkerService = new ChipProjectionWorkerService(
      getDefaultChipEventStore(),
      getDefaultChipProjectionStore(),
      getChipCoreApiService()
    );
  }

  return defaultWorkerService;
}
