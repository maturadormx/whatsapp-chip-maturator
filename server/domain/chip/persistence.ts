import type { ChipEventRecord } from "./types";

export type AppendChipEventInput = Omit<ChipEventRecord, "sequence" | "recorded_at"> & {
  sequence?: never;
  recorded_at?: never;
};

export type ChipHistoryReadMode = "complete" | "partial";

export type ChipHistorySlice = {
  chip_id: string;
  mode: ChipHistoryReadMode;
  events: ChipEventRecord[];
};

export type PersistedChipEventFeedItem = {
  offset: number;
  event: ChipEventRecord;
};

export type PersistedChipEventBatch = {
  items: PersistedChipEventFeedItem[];
};

export type ChipEventStore = {
  append(event: AppendChipEventInput): Promise<ChipEventRecord>;
  getHistory(
    chipId: string,
    options?: {
      fromSequence?: number;
      toSequence?: number;
      limit?: number;
    }
  ): Promise<ChipHistorySlice>;
  listPersistedEvents(options?: { afterOffset?: number; limit?: number }): Promise<PersistedChipEventBatch>;
};

export type ChipStateProjection = {
  chip_id: string;
  current_state: string | null;
  previous_state: string | null;
  last_sequence: number | null;
  inconsistency_count: number;
  updated_at: string;
};

export type ChipWorkerCheckpoint = {
  worker_name: string;
  last_offset: number;
  updated_at: string;
};

export type ChipProjectionStore = {
  saveProjection(projection: ChipStateProjection): Promise<void>;
  getProjection(chipId: string): Promise<ChipStateProjection | null>;
  saveCheckpoint(checkpoint: ChipWorkerCheckpoint): Promise<void>;
  getCheckpoint(workerName: string): Promise<ChipWorkerCheckpoint | null>;
};

export function createRecordedEvent(
  event: AppendChipEventInput,
  sequence: number,
  recordedAt: string
): ChipEventRecord {
  return {
    ...event,
    sequence,
    recorded_at: recordedAt,
  };
}
