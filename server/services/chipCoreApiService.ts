import { randomUUID } from "node:crypto";
import { replayChipHistory, type AppendChipEventInput, type ChipEventRecord, type ChipEventStore } from "../domain/chip";
import { getDefaultChipEventStore } from "./chipInfrastructure";

type ChipCoreApiErrorCode = "CONFLICT" | "BAD_REQUEST" | "NOT_FOUND" | "FAILED_PRECONDITION";

export class ChipCoreApiError extends Error {
  constructor(
    public readonly code: ChipCoreApiErrorCode,
    message: string
  ) {
    super(message);
    this.name = "ChipCoreApiError";
  }
}

export class ChipCoreApiService {
  constructor(private readonly store: ChipEventStore) {}

  async createChip(input: { chipId?: string; createdBy: string; sprint: number; occurredAt?: string }) {
    const chipId = input.chipId ?? randomUUID();
    const history = await this.store.getHistory(chipId);

    if (history.events.length > 0) {
      throw new ChipCoreApiError("CONFLICT", "chip já existe no histórico oficial");
    }

    return this.appendValidatedEvent({
      chip_id: chipId,
      event_type: "chip_created",
      event_version: 1,
      occurred_at: input.occurredAt ?? new Date().toISOString(),
      payload: {
        created_by: input.createdBy,
        sprint: input.sprint,
      },
    });
  }

  async pairChip(input: { chipId: string; pairedWith: string; deviceId?: string; occurredAt?: string }) {
    return this.appendValidatedEvent({
      chip_id: input.chipId,
      event_type: "chip_paired",
      event_version: 1,
      occurred_at: input.occurredAt ?? new Date().toISOString(),
      payload: {
        paired_with: input.pairedWith,
        ...(input.deviceId ? { device_id: input.deviceId } : {}),
      },
    });
  }

  async appendEvent(
    input: Omit<AppendChipEventInput, "event_id" | "occurred_at"> & {
      eventId?: string;
      occurredAt?: string;
    }
  ) {
    return this.appendValidatedEvent({
      ...input,
      event_id: input.eventId ?? randomUUID(),
      occurred_at: input.occurredAt ?? new Date().toISOString(),
    });
  }

  async closeChip(input: { chipId: string; reason: string; closedBy: string; finalState?: string; occurredAt?: string }) {
    return this.appendValidatedEvent({
      chip_id: input.chipId,
      event_type: "chip_closed",
      event_version: 1,
      occurred_at: input.occurredAt ?? new Date().toISOString(),
      payload: {
        reason: input.reason,
        closed_by: input.closedBy,
        ...(input.finalState ? { final_state: input.finalState } : {}),
      },
    });
  }

  async getChipHistory(input: {
    chipId: string;
    fromSequence?: number;
    toSequence?: number;
    limit?: number;
  }) {
    const history = await this.store.getHistory(input.chipId, {
      fromSequence: input.fromSequence,
      toSequence: input.toSequence,
      limit: input.limit,
    });

    if (history.mode === "complete" && history.events.length === 0) {
      throw new ChipCoreApiError("NOT_FOUND", "chip não encontrado no histórico oficial");
    }

    return history;
  }

  async getCurrentState(input: { chipId: string }) {
    const history = await this.getChipHistory({ chipId: input.chipId });
    const replay = replayChipHistory(history.events);

    return {
      chip_id: input.chipId,
      current_state: replay.current_state,
      previous_state: replay.previous_state,
      last_sequence: replay.last_sequence,
      inconsistencies: replay.inconsistencies,
    };
  }

  async replayHistory(input: {
    chipId: string;
    fromSequence?: number;
    toSequence?: number;
    limit?: number;
  }) {
    const history = await this.getChipHistory(input);
    return {
      history,
      replay: replayChipHistory(history.events),
    };
  }

  private async appendValidatedEvent(event: Omit<AppendChipEventInput, "event_id"> & { event_id?: string }) {
    const candidateEvent = this.buildCandidateEvent(event);
    const history = await this.store.getHistory(candidateEvent.chip_id);
    const currentReplay = replayChipHistory(history.events);

    if (currentReplay.inconsistencies.length > 0) {
      throw new ChipCoreApiError("FAILED_PRECONDITION", "histórico oficial contém inconsistências e não pode receber novos eventos");
    }

    const simulatedPersistedEvent: ChipEventRecord = {
      ...candidateEvent,
      sequence: history.events.length + 1,
      recorded_at: new Date().toISOString(),
    };

    const candidateReplay = replayChipHistory([...history.events, simulatedPersistedEvent]);
    const eventInconsistencies = candidateReplay.inconsistencies.filter((item) => item.event_id === simulatedPersistedEvent.event_id);

    if (eventInconsistencies.length > 0) {
      throw new ChipCoreApiError(
        "BAD_REQUEST",
        eventInconsistencies.map((item) => `${item.code}: ${item.message}`).join(" | ")
      );
    }

    const persisted = await this.store.append(candidateEvent);
    const persistedHistory = await this.store.getHistory(candidateEvent.chip_id);
    const replay = replayChipHistory(persistedHistory.events);

    return {
      event: persisted,
      history: persistedHistory,
      replay,
    };
  }

  private buildCandidateEvent(event: Omit<AppendChipEventInput, "event_id"> & { event_id?: string }): AppendChipEventInput {
    return {
      ...event,
      event_id: event.event_id ?? randomUUID(),
    };
  }
}

let defaultChipCoreApiService: ChipCoreApiService | null = null;

export function createChipCoreApiService(store: ChipEventStore) {
  return new ChipCoreApiService(store);
}

export function getChipCoreApiService() {
  if (!defaultChipCoreApiService) {
    defaultChipCoreApiService = new ChipCoreApiService(getDefaultChipEventStore());
  }

  return defaultChipCoreApiService;
}
