import { ENV } from "../_core/env";
import {
  getAdminAuditLogs,
  getAllChips,
  getAllSubscriptionPlans,
  getAllUsers,
  getBehaviorSnapshot,
  getChipActivityLogs,
  getLatestBehaviorDecisionLog,
  listBehaviorActionExecutionsByChip,
  listBehaviorDecisionLogs,
} from "../db";
import { type ChipProjectionStore } from "../domain/chip";
import { buildLegacyOfficialChipId } from "./chipLegacyBridgeService";
import {
  getAveragePhaseDuration,
  getOperationalAlerts,
  getPhaseDistribution,
  getRecentPolicyVersions,
  getStuckChips,
  getTopBlockReasons,
} from "./behavior/behaviorQueries";
import { type ChipCoreApiService, getChipCoreApiService } from "./chipCoreApiService";
import { type ChipAuditService, getChipAuditService } from "./chipAuditService";
import { type ChipReconciliationService, getChipReconciliationService } from "./chipReconciliationService";
import { getDefaultChipProjectionStore } from "./chipInfrastructure";
import { buildRuntimeSupervisorOverview } from "./runtimeSupervisorService";

type LegacyChipRow = Awaited<ReturnType<typeof getAllChips>>[number];

export type ControlCenterFleetRow = {
  legacyChipId: number;
  userId: number;
  chipName: string;
  legacyStatus: string;
  phoneNumber: string | null;
  officialChipId: string;
  hasOfficialStream: boolean;
  officialEventCount: number;
  currentState: string | null;
  previousState: string | null;
  lastSequence: number | null;
  projectionState: string | null;
  projectionUpdatedAt: string | null;
  inconsistencyCount: number;
  auditEvidenceCount: number;
  reconciliationStatus: "reconciled" | "divergent" | "missing_stream" | "missing_projection";
  reconciliationIssues: string[];
};

export type ControlCenterOverview = {
  generatedAt: string;
  stats: {
    totalUsers: number;
    activeUsers: number;
    adminUsers: number;
    totalPlans: number;
    totalLegacyChips: number;
  };
  company: Awaited<ReturnType<typeof getAllChips>> extends Array<any>
    ? {
        totalChips: number;
        connected: number;
        maturing: number;
        disconnected: number;
        paused: number;
      }
    : never;
  reconciliation: Awaited<ReturnType<ChipReconciliationService["reconcileFleet"]>>;
  runtime: Awaited<ReturnType<typeof buildRuntimeSupervisorOverview>>;
  audit: {
    recentLogs: Awaited<ReturnType<typeof getAdminAuditLogs>>;
  };
  behavior: {
    topBlockReasons: Awaited<ReturnType<typeof getTopBlockReasons>>;
    phaseDistribution: Awaited<ReturnType<typeof getPhaseDistribution>>;
    stuckChips: Awaited<ReturnType<typeof getStuckChips>>;
    averagePhaseDuration: Awaited<ReturnType<typeof getAveragePhaseDuration>>;
    recentPolicyVersions: Awaited<ReturnType<typeof getRecentPolicyVersions>>;
    alerts: Awaited<ReturnType<typeof getOperationalAlerts>>;
  };
};

export type ControlCenterChipDetail = {
  generatedAt: string;
  legacy: LegacyChipRow;
  officialChipId: string;
  history: Awaited<ReturnType<ChipCoreApiService["getChipHistory"]>>;
  replay: Awaited<ReturnType<ChipCoreApiService["replayHistory"]>>;
  projection: Awaited<ReturnType<ChipProjectionStore["getProjection"]>>;
  auditEvidences: Awaited<ReturnType<ChipAuditService["getAuditEvidence"]>>;
  activityLogs: Awaited<ReturnType<typeof getChipActivityLogs>>;
  latestBehaviorDecision: Awaited<ReturnType<typeof getLatestBehaviorDecisionLog>>;
  behaviorSnapshot: Awaited<ReturnType<typeof getBehaviorSnapshot>>;
  recentBehaviorDecisions: Awaited<ReturnType<typeof listBehaviorDecisionLogs>>;
  recentActionExecutions: Awaited<ReturnType<typeof listBehaviorActionExecutionsByChip>>;
};

function mapReconciliationIndex(report: Awaited<ReturnType<ChipReconciliationService["reconcileFleet"]>>) {
  const missingStream = new Map(report.chips_without_official_stream.map((item) => [item.official_chip_id ?? "", item]));
  const missingProjection = new Map(report.streams_without_projection.map((item) => [item.official_chip_id ?? "", item]));
  const projectionMismatch = new Map(report.projections_inconsistent_with_replay.map((item) => [item.official_chip_id ?? "", item]));
  const legacyDivergence = new Map(report.legacy_official_divergences.map((item) => [item.official_chip_id ?? "", item]));

  return { missingStream, missingProjection, projectionMismatch, legacyDivergence };
}

export class ControlCenterService {
  constructor(
    private readonly apiService: ChipCoreApiService,
    private readonly projectionStore: ChipProjectionStore,
    private readonly auditService: ChipAuditService,
    private readonly reconciliationService: ChipReconciliationService
  ) {}

  async getOverview(adminUserId: number): Promise<ControlCenterOverview> {
    const [users, plans, chips, recentLogs, runtime, reconciliation, topBlockReasons, phaseDistribution, stuckChips, averagePhaseDuration, recentPolicyVersions, behaviorAlerts] = await Promise.all([
      getAllUsers(),
      getAllSubscriptionPlans(),
      getAllChips(),
      getAdminAuditLogs(50),
      buildRuntimeSupervisorOverview(adminUserId),
      this.reconciliationService.reconcileFleet(),
      getTopBlockReasons(7),
      getPhaseDistribution(),
      getStuckChips(24),
      getAveragePhaseDuration(),
      getRecentPolicyVersions(5),
      getOperationalAlerts(),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      stats: {
        totalUsers: users.length,
        activeUsers: users.filter((item) => item.isActive === 1).length,
        adminUsers: users.filter((item) => item.role === "admin").length,
        totalPlans: plans.length,
        totalLegacyChips: chips.length,
      },
      company: {
        totalChips: chips.length,
        connected: chips.filter((chip) => chip.status === "conectado").length,
        maturing: chips.filter((chip) => chip.status === "maturando").length,
        disconnected: chips.filter((chip) => chip.status === "desconectado").length,
        paused: chips.filter((chip) => Boolean(chip.isPaused)).length,
      },
      reconciliation,
      runtime,
      audit: {
        recentLogs,
      },
      behavior: {
        topBlockReasons,
        phaseDistribution,
        stuckChips,
        averagePhaseDuration,
        recentPolicyVersions,
        alerts: behaviorAlerts,
      },
    };
  }

  async getFleetCatalog(): Promise<ControlCenterFleetRow[]> {
    const [legacyChips, reconciliation] = await Promise.all([getAllChips(), this.reconciliationService.reconcileFleet()]);
    const index = mapReconciliationIndex(reconciliation);

    const rows = await Promise.all(
      legacyChips.map(async (chip) => {
        const officialChipId = buildLegacyOfficialChipId(chip.userId, chip.id);
        const [history, replay, projection, evidences] = await Promise.all([
          this.apiService.getChipHistory({ chipId: officialChipId }).catch(() => ({ chip_id: officialChipId, mode: "complete" as const, events: [] })),
          this.apiService.replayHistory({ chipId: officialChipId }).catch(() => null),
          this.projectionStore.getProjection(officialChipId),
          this.auditService.getAuditEvidence(officialChipId),
        ]);

        const issues = [
          index.missingStream.get(officialChipId)?.message,
          index.missingProjection.get(officialChipId)?.message,
          index.projectionMismatch.get(officialChipId)?.message,
          index.legacyDivergence.get(officialChipId)?.message,
        ].filter((value): value is string => Boolean(value));

        let reconciliationStatus: ControlCenterFleetRow["reconciliationStatus"] = "reconciled";
        if (index.missingStream.has(officialChipId)) reconciliationStatus = "missing_stream";
        else if (index.missingProjection.has(officialChipId)) reconciliationStatus = "missing_projection";
        else if (index.projectionMismatch.has(officialChipId) || index.legacyDivergence.has(officialChipId)) reconciliationStatus = "divergent";

        return {
          legacyChipId: chip.id,
          userId: chip.userId,
          chipName: chip.chipName,
          legacyStatus: chip.status,
          phoneNumber: chip.phoneNumber ?? null,
          officialChipId,
          hasOfficialStream: history.events.length > 0,
          officialEventCount: history.events.length,
          currentState: replay?.replay.current_state ?? null,
          previousState: replay?.replay.previous_state ?? null,
          lastSequence: replay?.replay.last_sequence ?? null,
          projectionState: projection?.current_state ?? null,
          projectionUpdatedAt: projection?.updated_at ?? null,
          inconsistencyCount: replay?.replay.inconsistencies.length ?? 0,
          auditEvidenceCount: evidences.length,
          reconciliationStatus,
          reconciliationIssues: issues,
        };
      })
    );

    return rows.sort((a, b) => a.legacyChipId - b.legacyChipId);
  }

  async getChipDetail(legacyChipId: number): Promise<ControlCenterChipDetail> {
    const chips = await getAllChips();
    const legacy = chips.find((item) => item.id === legacyChipId);
    if (!legacy) {
      throw new Error("LEGACY_CHIP_NOT_FOUND");
    }

    const officialChipId = buildLegacyOfficialChipId(legacy.userId, legacy.id);
    const [history, replay, projection, auditEvidences, activityLogs, latestBehaviorDecision, behaviorSnapshot, recentBehaviorDecisions, recentActionExecutions] = await Promise.all([
      this.apiService.getChipHistory({ chipId: officialChipId }),
      this.apiService.replayHistory({ chipId: officialChipId }),
      this.projectionStore.getProjection(officialChipId),
      this.auditService.getAuditEvidence(officialChipId),
      getChipActivityLogs(legacy.id, 100),
      getLatestBehaviorDecisionLog(legacy.id),
      getBehaviorSnapshot(legacy.id),
      listBehaviorDecisionLogs(legacy.id, 20),
      listBehaviorActionExecutionsByChip(legacy.id, 20),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      legacy,
      officialChipId,
      history,
      replay,
      projection,
      auditEvidences,
      activityLogs,
      latestBehaviorDecision,
      behaviorSnapshot,
      recentBehaviorDecisions,
      recentActionExecutions,
    };
  }

  async getSecurityOverview() {
    const [users, logs] = await Promise.all([getAllUsers(), getAdminAuditLogs(100)]);
    return {
      generatedAt: new Date().toISOString(),
      auth: {
        localEnabled: ENV.localAuthEnabled,
        localName: ENV.localAuthName,
      },
      users: {
        total: users.length,
        active: users.filter((item) => item.isActive === 1).length,
        admins: users.filter((item) => item.role === "admin").length,
      },
      recentAdminAuditLogs: logs,
    };
  }
}

let defaultControlCenterService: ControlCenterService | null = null;

export function getControlCenterService() {
  if (!defaultControlCenterService) {
    defaultControlCenterService = new ControlCenterService(
      getChipCoreApiService(),
      getDefaultChipProjectionStore(),
      getChipAuditService(),
      getChipReconciliationService()
    );
  }

  return defaultControlCenterService;
}
