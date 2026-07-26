import { describe, expect, it } from "vitest";
import type { TrpcContext } from "../_core/context";
import { InMemoryChipAuditEvidenceStore, InMemoryChipEventStore, InMemoryChipProjectionStore } from "../domain/chip";
import { buildRuntimeRouter } from "./runtime";
import { createChipAuditService } from "../services/chipAuditService";
import { createChipCoreApiService } from "../services/chipCoreApiService";
import { createChipProjectionWorkerService } from "../services/chipProjectionWorkerService";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-admin",
    email: "admin@example.com",
    name: "Admin",
    loginMethod: "test",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("runtimeRouter", () => {
  it("expõe trigger e leitura de projeção do chip", async () => {
    const eventStore = new InMemoryChipEventStore();
    const projectionStore = new InMemoryChipProjectionStore();
    const apiService = createChipCoreApiService(eventStore);
    const workerService = createChipProjectionWorkerService(eventStore, projectionStore, apiService);
    const auditService = createChipAuditService(apiService, new InMemoryChipAuditEvidenceStore());
    const chipId = "a5b2b1dd-8af1-421a-bad5-f06b283d5be9";

    await apiService.createChip({ chipId, createdBy: "system", sprint: 0 });
    await apiService.pairChip({ chipId, pairedWith: "+5511999999999" });

    const runtime = buildRuntimeRouter({
      triggerChipProjectionCycle: (input) => workerService.processPersistedEvents(input),
      getChipProjection: (targetChipId) => workerService.getProjection(targetChipId),
      runChipAudit: (targetChipId) => auditService.auditChip(targetChipId),
      getChipAuditEvidence: (targetChipId) => auditService.getAuditEvidence(targetChipId),
      migrateLegacyChip: async (legacyChipId) => ({
        legacy_chip_id: legacyChipId,
        official_chip_id: `legacy-user-1-chip-${legacyChipId}`,
        status: "migrated" as const,
        persisted_events: 2,
      }),
      migrateLegacyUserChips: async (userId) => ({
        user_id: userId,
        migrated: 1,
        already_migrated: 0,
        results: [
          {
            legacy_chip_id: 10,
            official_chip_id: "legacy-user-1-chip-10",
            status: "migrated" as const,
            persisted_events: 2,
          },
        ],
      }),
      migrateLegacyFleet: async () => ({
        migrated: 3,
        already_migrated: 0,
        results: [],
      }),
      reconcileLegacyUser: async (userId) => ({
        scope: "user" as const,
        user_id: userId,
        reconciled_chips: 1,
        divergences_found: 0,
        chips_without_official_stream: [],
        streams_without_projection: [],
        projections_inconsistent_with_replay: [],
        legacy_official_divergences: [],
        streams_checked: 1,
        projections_checked: 1,
      }),
      reconcileLegacyFleet: async () => ({
        scope: "fleet" as const,
        reconciled_chips: 2,
        divergences_found: 1,
        chips_without_official_stream: [{ code: "MISSING_OFFICIAL_STREAM" }],
        streams_without_projection: [],
        projections_inconsistent_with_replay: [],
        legacy_official_divergences: [],
        streams_checked: 2,
        projections_checked: 1,
      }),
    });

    const caller = runtime.createCaller(createAdminContext());
    const cycle = await caller.triggerChipProjectionCycle({ limit: 100 });
    const projection = await caller.getChipProjection({ chipId });

    expect(cycle).toMatchObject({
      processed_offsets: 2,
      projected_chips: 1,
    });
    expect(projection).toMatchObject({
      current_state: "PAREADO",
      last_sequence: 2,
    });
  });

  it("expõe execução e leitura de evidências de auditoria", async () => {
    const eventStore = new InMemoryChipEventStore();
    const projectionStore = new InMemoryChipProjectionStore();
    const apiService = createChipCoreApiService(eventStore);
    const workerService = createChipProjectionWorkerService(eventStore, projectionStore, apiService);
    const auditService = createChipAuditService(apiService, new InMemoryChipAuditEvidenceStore());
    const chipId = "79168753-f0cf-4e96-8048-27956b964850";

    await apiService.createChip({ chipId, createdBy: "system", sprint: 0 });
    await workerService.processPersistedEvents();

    const runtime = buildRuntimeRouter({
      triggerChipProjectionCycle: (input) => workerService.processPersistedEvents(input),
      getChipProjection: (targetChipId) => workerService.getProjection(targetChipId),
      runChipAudit: (targetChipId) => auditService.auditChip(targetChipId),
      getChipAuditEvidence: (targetChipId) => auditService.getAuditEvidence(targetChipId),
      migrateLegacyChip: async (legacyChipId) => ({
        legacy_chip_id: legacyChipId,
        official_chip_id: `legacy-user-1-chip-${legacyChipId}`,
        status: "migrated" as const,
        persisted_events: 1,
      }),
      migrateLegacyUserChips: async (userId) => ({
        user_id: userId,
        migrated: 1,
        already_migrated: 0,
        results: [],
      }),
      migrateLegacyFleet: async () => ({
        migrated: 1,
        already_migrated: 0,
        results: [],
      }),
      reconcileLegacyUser: async (userId) => ({
        scope: "user" as const,
        user_id: userId,
        reconciled_chips: 1,
        divergences_found: 0,
        chips_without_official_stream: [],
        streams_without_projection: [],
        projections_inconsistent_with_replay: [],
        legacy_official_divergences: [],
        streams_checked: 1,
        projections_checked: 1,
      }),
      reconcileLegacyFleet: async () => ({
        scope: "fleet" as const,
        reconciled_chips: 1,
        divergences_found: 0,
        chips_without_official_stream: [],
        streams_without_projection: [],
        projections_inconsistent_with_replay: [],
        legacy_official_divergences: [],
        streams_checked: 1,
        projections_checked: 1,
      }),
    });

    const caller = runtime.createCaller(createAdminContext());
    const auditResult = await caller.runChipAudit({ chipId });
    const evidences = await caller.getChipAuditEvidence({ chipId });

    expect(auditResult.evidence.evidence_type).toBe("REPLAY_VALIDATION");
    expect(evidences).toHaveLength(1);
  });

  it("expõe gatilhos administrativos da ponte de migração do legado", async () => {
    const runtime = buildRuntimeRouter({
      triggerChipProjectionCycle: async () => ({ processed_offsets: 0, projected_chips: 0, last_offset: 0 }),
      getChipProjection: async () => null,
      runChipAudit: async () => null,
      getChipAuditEvidence: async () => [],
      migrateLegacyChip: async (legacyChipId) => ({
        legacy_chip_id: legacyChipId,
        official_chip_id: `legacy-user-1-chip-${legacyChipId}`,
        status: "migrated" as const,
        persisted_events: 4,
      }),
      migrateLegacyUserChips: async (userId) => ({
        user_id: userId,
        migrated: 2,
        already_migrated: 1,
        results: [],
      }),
      migrateLegacyFleet: async () => ({
        migrated: 10,
        already_migrated: 0,
        results: [],
      }),
      reconcileLegacyUser: async (userId) => ({
        scope: "user" as const,
        user_id: userId,
        reconciled_chips: 1,
        divergences_found: 1,
        chips_without_official_stream: [{ code: "MISSING_OFFICIAL_STREAM" }],
        streams_without_projection: [],
        projections_inconsistent_with_replay: [],
        legacy_official_divergences: [],
        streams_checked: 1,
        projections_checked: 0,
      }),
      reconcileLegacyFleet: async () => ({
        scope: "fleet" as const,
        reconciled_chips: 3,
        divergences_found: 2,
        chips_without_official_stream: [],
        streams_without_projection: [{ code: "MISSING_PROJECTION" }],
        projections_inconsistent_with_replay: [],
        legacy_official_divergences: [{ code: "LEGACY_OFFICIAL_DIVERGENCE" }],
        streams_checked: 4,
        projections_checked: 3,
      }),
    });

    const caller = runtime.createCaller(createAdminContext());
    const single = await caller.migrateLegacyChipToOfficialStream({ legacyChipId: 10 });
    const fleet = await caller.migrateLegacyUserFleetToOfficialStream({ userId: 1 });
    const allFleet = await caller.migrateLegacyFleetToOfficialStream();

    expect(single).toMatchObject({
      legacy_chip_id: 10,
      official_chip_id: "legacy-user-1-chip-10",
      status: "migrated",
    });
    expect(fleet).toMatchObject({
      user_id: 1,
      migrated: 2,
      already_migrated: 1,
    });
    expect(allFleet).toMatchObject({
      migrated: 10,
      already_migrated: 0,
    });

    const userReconciliation = await caller.reconcileLegacyUserAgainstOfficialProjection({ userId: 1 });
    const fleetReconciliation = await caller.reconcileLegacyFleetAgainstOfficialProjection();

    expect(userReconciliation).toMatchObject({
      scope: "user",
      user_id: 1,
      divergences_found: 1,
    });
    expect(fleetReconciliation).toMatchObject({
      scope: "fleet",
      divergences_found: 2,
    });
  });
});
