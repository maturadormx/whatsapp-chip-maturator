import { describe, expect, it } from "vitest";
import { InMemoryChipAuditEvidenceStore, InMemoryChipEventStore } from "../domain/chip";
import { createChipAuditService } from "./chipAuditService";
import { createChipCoreApiService } from "./chipCoreApiService";

describe("ChipAuditService", () => {
  it("gera evidência de replay para histórico consistente", async () => {
    const eventStore = new InMemoryChipEventStore();
    const apiService = createChipCoreApiService(eventStore);
    const auditService = createChipAuditService(apiService, new InMemoryChipAuditEvidenceStore());
    const chipId = "f53c2b7b-ffbd-4426-a3bd-b4a760143b70";

    await apiService.createChip({ chipId, createdBy: "system", sprint: 0 });
    await apiService.pairChip({ chipId, pairedWith: "+5511999999999" });

    const audited = await auditService.auditChip(chipId);
    const evidences = await auditService.getAuditEvidence(chipId);

    expect(audited.evidence.evidence_type).toBe("REPLAY_VALIDATION");
    expect(audited.evidence.payload.reproducible).toBe(true);
    expect(audited.replay.current_state).toBe("PAREADO");
    expect(evidences).toHaveLength(1);
  });

  it("mantém evidências append-only entre execuções sucessivas", async () => {
    const eventStore = new InMemoryChipEventStore();
    const apiService = createChipCoreApiService(eventStore);
    const auditService = createChipAuditService(apiService, new InMemoryChipAuditEvidenceStore());
    const chipId = "18b14d52-cfe0-4a36-a78b-16ee328f809d";

    await apiService.createChip({ chipId, createdBy: "system", sprint: 0 });

    const firstAudit = await auditService.auditChip(chipId);
    const secondAudit = await auditService.auditChip(chipId);
    const evidences = await auditService.getAuditEvidence(chipId);

    expect(firstAudit.evidence.evidence_id).not.toBe(secondAudit.evidence.evidence_id);
    expect(evidences).toHaveLength(2);
  });

  it("registra evidência de inconsistência quando o replay encontra histórico corrompido", async () => {
    const eventStore = new InMemoryChipEventStore();
    const apiService = createChipCoreApiService(eventStore);
    const auditService = createChipAuditService(apiService, new InMemoryChipAuditEvidenceStore());
    const chipId = "3ff8c92c-a41c-42b6-a934-9a9ea3c08c33";

    await eventStore.append({
      event_id: "evt-1",
      chip_id: chipId,
      event_type: "chip_created",
      event_version: 1,
      occurred_at: "2026-07-18T10:00:00.000Z",
      payload: { created_by: "system", sprint: 0 },
    });

    await eventStore.append({
      event_id: "evt-2",
      chip_id: chipId,
      event_type: "evento_inexistente",
      event_version: 1,
      occurred_at: "2026-07-18T10:01:00.000Z",
      payload: {},
    });

    const audited = await auditService.auditChip(chipId);

    expect(audited.evidence.evidence_type).toBe("INCONSISTENCY_DETECTION");
    expect(audited.replay.inconsistencies).toHaveLength(1);
    expect(audited.evidence.payload.reproducible).toBe(false);
  });

  it("registra evidência explícita de migração", async () => {
    const eventStore = new InMemoryChipEventStore();
    const apiService = createChipCoreApiService(eventStore);
    const auditService = createChipAuditService(apiService, new InMemoryChipAuditEvidenceStore());
    const chipId = "c0cc6d52-6f1f-4fbc-b5a6-20d85ff2f3a0";

    const evidence = await auditService.recordMigrationEvidence({
      chipId,
      legacyChipId: 77,
      status: "migrated",
      persistedEvents: 4,
      details: {
        source: "pilot",
      },
    });

    const evidences = await auditService.getAuditEvidence(chipId);

    expect(evidence.evidence_type).toBe("CONFORMITY_VERIFICATION");
    expect(evidence.payload.type).toBe("legacy_migration");
    expect(evidences).toHaveLength(1);
  });
});
