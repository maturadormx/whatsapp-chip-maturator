import { getAllChips, getUserChips } from "../db";
import { type ChipEventStore, type ChipProjectionStore, type ChipState } from "../domain/chip";
import { buildLegacyOfficialChipId } from "./chipLegacyBridgeService";
import { createChipCoreApiService, getChipCoreApiService, type ChipCoreApiService } from "./chipCoreApiService";
import { getDefaultChipEventStore, getDefaultChipProjectionStore } from "./chipInfrastructure";

type LegacyStatus = "conectado" | "maturando" | "desconectado";

type LegacyChipRow = Awaited<ReturnType<typeof getAllChips>>[number];

type ReconciliationDependencies = {
  getAllChips: typeof getAllChips;
  getUserChips: typeof getUserChips;
};

export type ChipReconciliationIssueCode =
  | "MISSING_OFFICIAL_STREAM"
  | "MISSING_PROJECTION"
  | "PROJECTION_REPLAY_MISMATCH"
  | "LEGACY_OFFICIAL_DIVERGENCE";

export type ChipReconciliationIssue = {
  code: ChipReconciliationIssueCode;
  message: string;
  legacy_chip_id?: number;
  official_chip_id?: string;
  legacy_status?: LegacyStatus;
  projection_state?: string | null;
  replay_state?: string | null;
};

export type ChipReconciliationReport = {
  scope: "user" | "fleet";
  user_id?: number;
  reconciled_chips: number;
  divergences_found: number;
  chips_without_official_stream: ChipReconciliationIssue[];
  streams_without_projection: ChipReconciliationIssue[];
  projections_inconsistent_with_replay: ChipReconciliationIssue[];
  legacy_official_divergences: ChipReconciliationIssue[];
  streams_checked: number;
  projections_checked: number;
};

function isLegacyStateCompatible(row: LegacyChipRow, state: string | null): boolean {
  if (!state) return false;

  const compatibility: Record<LegacyStatus, ChipState[]> = {
    conectado: ["PAREADO", "NOVO", "EM_MATURACAO", "MADURO"],
    maturando: ["NOVO", "EM_MATURACAO", "MADURO"],
    desconectado: ["INCIDENTE", "DIAGNOSTICO", "RECUPERACAO", "ISOLADO", "ENCERRADO", "CRIADO"],
  };

  if (compatibility[row.status].includes(state as ChipState)) {
    return true;
  }

  if (row.status === "desconectado" && Boolean(row.phoneNumber) && state === "PAREADO") {
    return true;
  }

  return false;
}

function createIssue(issue: ChipReconciliationIssue): ChipReconciliationIssue {
  return issue;
}

export class ChipReconciliationService {
  constructor(
    private readonly eventStore: ChipEventStore,
    private readonly projectionStore: ChipProjectionStore,
    private readonly apiService: ChipCoreApiService,
    private readonly deps: ReconciliationDependencies
  ) {}

  async reconcileFleet(): Promise<ChipReconciliationReport> {
    const chips = await this.deps.getAllChips();
    return this.reconcileRows(chips, "fleet");
  }

  async reconcileUser(userId: number): Promise<ChipReconciliationReport> {
    const chips = await this.deps.getUserChips(userId);
    return this.reconcileRows(chips, "user", userId);
  }

  private async reconcileRows(rows: LegacyChipRow[], scope: "fleet" | "user", userId?: number): Promise<ChipReconciliationReport> {
    const chipsWithoutOfficialStream: ChipReconciliationIssue[] = [];
    const streamsWithoutProjection: ChipReconciliationIssue[] = [];
    const projectionsInconsistentWithReplay: ChipReconciliationIssue[] = [];
    const legacyOfficialDivergences: ChipReconciliationIssue[] = [];
    let reconciledChips = 0;
    const legacyCheckedOfficialIds = new Set<string>();

    for (const row of rows) {
      const officialChipId = buildLegacyOfficialChipId(row.userId, row.id);
      legacyCheckedOfficialIds.add(officialChipId);

      const history = await this.eventStore.getHistory(officialChipId);
      if (history.events.length === 0) {
        chipsWithoutOfficialStream.push(
          createIssue({
            code: "MISSING_OFFICIAL_STREAM",
            message: "chip legado ainda não possui stream oficial materializado",
            legacy_chip_id: row.id,
            official_chip_id: officialChipId,
            legacy_status: row.status,
          })
        );
        continue;
      }

      const projection = await this.projectionStore.getProjection(officialChipId);
      if (!projection) {
        streamsWithoutProjection.push(
          createIssue({
            code: "MISSING_PROJECTION",
            message: "stream oficial existe, mas ainda não possui projeção derivada",
            legacy_chip_id: row.id,
            official_chip_id: officialChipId,
            legacy_status: row.status,
          })
        );
        continue;
      }

      const replay = await this.apiService.replayHistory({ chipId: officialChipId });

      if (
        projection.current_state !== replay.replay.current_state ||
        projection.last_sequence !== replay.replay.last_sequence ||
        projection.previous_state !== replay.replay.previous_state
      ) {
        projectionsInconsistentWithReplay.push(
          createIssue({
            code: "PROJECTION_REPLAY_MISMATCH",
            message: "projeção derivada diverge do replay atual do histórico oficial",
            legacy_chip_id: row.id,
            official_chip_id: officialChipId,
            legacy_status: row.status,
            projection_state: projection.current_state,
            replay_state: replay.replay.current_state,
          })
        );
        continue;
      }

      if (!isLegacyStateCompatible(row, replay.replay.current_state)) {
        legacyOfficialDivergences.push(
          createIssue({
            code: "LEGACY_OFFICIAL_DIVERGENCE",
            message: "estado legado não é compatível com o estado oficial derivado atual",
            legacy_chip_id: row.id,
            official_chip_id: officialChipId,
            legacy_status: row.status,
            projection_state: projection.current_state,
            replay_state: replay.replay.current_state,
          })
        );
        continue;
      }

      reconciledChips += 1;
    }

    const allStreamItems = await this.eventStore.listPersistedEvents();
    const allOfficialChipIds = Array.from(new Set(allStreamItems.items.map((item) => item.event.chip_id)));
    let streamsChecked = 0;
    let projectionsChecked = 0;

    for (const officialChipId of allOfficialChipIds) {
      if (legacyCheckedOfficialIds.has(officialChipId)) {
        continue;
      }

      streamsChecked += 1;
      const projection = await this.projectionStore.getProjection(officialChipId);
      if (!projection) {
        streamsWithoutProjection.push(
          createIssue({
            code: "MISSING_PROJECTION",
            message: "stream oficial existe sem projeção correspondente",
            official_chip_id: officialChipId,
          })
        );
        continue;
      }

      projectionsChecked += 1;
      const replay = await this.apiService.replayHistory({ chipId: officialChipId });
      if (
        projection.current_state !== replay.replay.current_state ||
        projection.last_sequence !== replay.replay.last_sequence ||
        projection.previous_state !== replay.replay.previous_state
      ) {
        projectionsInconsistentWithReplay.push(
          createIssue({
            code: "PROJECTION_REPLAY_MISMATCH",
            message: "projeção derivada diverge do replay atual do histórico oficial",
            official_chip_id: officialChipId,
            projection_state: projection.current_state,
            replay_state: replay.replay.current_state,
          })
        );
      }
    }

    return {
      scope,
      ...(userId !== undefined ? { user_id: userId } : {}),
      reconciled_chips: reconciledChips,
      divergences_found:
        chipsWithoutOfficialStream.length +
        streamsWithoutProjection.length +
        projectionsInconsistentWithReplay.length +
        legacyOfficialDivergences.length,
      chips_without_official_stream: chipsWithoutOfficialStream,
      streams_without_projection: streamsWithoutProjection,
      projections_inconsistent_with_replay: projectionsInconsistentWithReplay,
      legacy_official_divergences: legacyOfficialDivergences,
      streams_checked: streamsChecked,
      projections_checked: projectionsChecked,
    };
  }
}

let defaultChipReconciliationService: ChipReconciliationService | null = null;

export function createChipReconciliationService(
  eventStore: ChipEventStore,
  projectionStore: ChipProjectionStore,
  apiService?: ChipCoreApiService,
  deps: ReconciliationDependencies = {
    getAllChips,
    getUserChips,
  }
) {
  return new ChipReconciliationService(
    eventStore,
    projectionStore,
    apiService ?? createChipCoreApiService(eventStore),
    deps
  );
}

export function getChipReconciliationService() {
  if (!defaultChipReconciliationService) {
    defaultChipReconciliationService = createChipReconciliationService(
      getDefaultChipEventStore(),
      getDefaultChipProjectionStore(),
      getChipCoreApiService()
    );
  }

  return defaultChipReconciliationService;
}
