import {
  createRecordedEvent,
  type AppendChipEventInput,
  type ChipEventStore,
  type ChipHistorySlice,
  type PersistedChipEventBatch,
} from "./persistence";
import type { ChipEventRecord } from "./types";

export class InMemoryChipEventStore implements ChipEventStore {
  private readonly eventsByChip = new Map<string, ChipEventRecord[]>();
  private readonly eventsByEventId = new Map<string, ChipEventRecord>();
  private readonly persistedFeed: ChipEventRecord[] = [];

  async append(event: AppendChipEventInput): Promise<ChipEventRecord> {
    const existing = this.eventsByEventId.get(event.event_id);
    if (existing) {
      return existing;
    }

    const stream = this.eventsByChip.get(event.chip_id) ?? [];
    const persisted = createRecordedEvent(event, stream.length + 1, new Date().toISOString());

    stream.push(persisted);
    this.eventsByChip.set(event.chip_id, stream);
    this.eventsByEventId.set(event.event_id, persisted);
    this.persistedFeed.push(persisted);

    return persisted;
  }

  async getHistory(
    chipId: string,
    options?: {
      fromSequence?: number;
      toSequence?: number;
      limit?: number;
    }
  ): Promise<ChipHistorySlice> {
    const stream = [...(this.eventsByChip.get(chipId) ?? [])];
    const filtered = stream.filter((event) => {
      if (options?.fromSequence !== undefined && event.sequence < options.fromSequence) return false;
      if (options?.toSequence !== undefined && event.sequence > options.toSequence) return false;
      return true;
    });

    const limited = options?.limit ? filtered.slice(0, options.limit) : filtered;
    const mode =
      options?.fromSequence !== undefined || options?.toSequence !== undefined || options?.limit !== undefined ? "partial" : "complete";

    return {
      chip_id: chipId,
      mode,
      events: limited,
    };
  }

  async listPersistedEvents(options?: { afterOffset?: number; limit?: number }): Promise<PersistedChipEventBatch> {
    const afterOffset = options?.afterOffset ?? 0;
    const filtered = this.persistedFeed
      .map((event, index) => ({
        offset: index + 1,
        event,
      }))
      .filter((item) => item.offset > afterOffset);

    const limited = options?.limit ? filtered.slice(0, options.limit) : filtered;

    return {
      items: limited,
    };
  }
}
