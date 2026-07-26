import { randomUUID } from "node:crypto";
import { type ChipAuditEvidenceStore } from "../domain/chip";
import { getChipCoreApiService, type ChipCoreApiService } from "./chipCoreApiService";
import { getDefaultChipAuditEvidenceStore } from "./chipInfrastructure";

export class ChipAuditService {
  constructor(
    private readonly apiService: ChipCoreApiService,
    private readonly evidenceStore: ChipAuditEvidenceStore
  ) {}

  async auditChip(chipId: string) {
    const { history, replay } = await this.apiService.replayHistory({ chipId });

    const evidenceType =
      replay.inconsistencies.length > 0 ? "INCONSISTENCY_DETECTION" : "REPLAY_VALIDATION";

    const evidence = await this.evidenceStore.appendEvidence({
      evidence_id: randomUUID(),
      chip_id: chipId,
      evidence_type: evidenceType,
      payload: {
        happened: history.events.length > 0,
        occurred_in_order: replay.last_sequence,
        current_state: replay.current_state,
        previous_state: replay.previous_state,
        last_sequence: replay.last_sequence,
        processed_events: replay.processed_events,
        transitions_applied: replay.transitions_applied,
        inconsistency_count: replay.inconsistencies.length,
        inconsistencies: replay.inconsistencies,
        reproducible: replay.inconsistencies.length === 0,
        uses_primary_evidence_only: true,
      },
    });

    return {
      chip_id: chipId,
      evidence,
      replay,
      history,
    };
  }

  async getAuditEvidence(chipId: string) {
    return this.evidenceStore.getEvidenceByChip(chipId);
  }

  async recordMigrationEvidence(input: {
    chipId: string;
    legacyChipId: number;
    status: "migrated" | "already_migrated";
    persistedEvents: number;
    details?: Record<string, unknown>;
  }) {
    return this.evidenceStore.appendEvidence({
      evidence_id: randomUUID(),
      chip_id: input.chipId,
      evidence_type: "CONFORMITY_VERIFICATION",
      payload: {
        type: "legacy_migration",
        legacy_chip_id: input.legacyChipId,
        status: input.status,
        persisted_events: input.persistedEvents,
        recorded_by: "ChipAuditService",
        ...(input.details ? { details: input.details } : {}),
      },
    });
  }
}

let defaultAuditService: ChipAuditService | null = null;

export function createChipAuditService(apiService: ChipCoreApiService, evidenceStore: ChipAuditEvidenceStore) {
  return new ChipAuditService(apiService, evidenceStore);
}

export function getChipAuditService() {
  if (!defaultAuditService) {
    defaultAuditService = new ChipAuditService(getChipCoreApiService(), getDefaultChipAuditEvidenceStore());
  }

  return defaultAuditService;
}
