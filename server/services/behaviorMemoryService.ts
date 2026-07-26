import { NormalizedBehaviorEvidence } from "./evidenceNormalizerService";
import { BehaviorEpisode } from "./episodeBuilderService";
import type {
  BehaviorObservabilitySnapshot,
  CredibilityTrendWindow,
  IdentityDriftTimelineEntry,
} from "./behaviorObservabilityService";
import type { BehaviorValidationSnapshot } from "./behaviorValidationService";
import type { BehaviorLongitudinalSnapshot } from "./behaviorLongitudinalService";
import type { AdaptiveLearningSnapshot } from "./adaptiveLearningEngineService";
import type { FleetLearningSnapshot } from "./fleetLearningService";
import {
  createBehaviorMemorySnapshot,
  getLatestBehaviorMemorySnapshot,
  listBehaviorMemorySnapshots,
} from "../db";

export const SNAPSHOT_SCHEMA_VERSION = 1;

export type BehaviorMemoryPipelineVersions = {
  normalizerVersion: number;
  catalogVersion: number;
  episodeBuilderVersion: number;
  memoryVersion: number;
};

export type BehaviorMemoryConfidenceAssessment = {
  confidence: number;
  support: number;
  contradictions: number;
  sampleSize: number;
};

export type BehaviorMemoryEvidenceCoverage = {
  evidenceCoverage: number;
  messages: number;
  status: number;
  groups: number;
  profile: number;
  passivity: number;
  presence: number;
  coveredSignals: string[];
  missingSignals: string[];
};

export type BehaviorMemoryPipelineCounters = {
  rawEvents: number;
  normalizedEvents: number;
  catalogedEvents: number;
  episodes: number;
};

export type BehaviorMemoryHealthStatus = "healthy" | "attention" | "critical";

export type BehaviorMemoryHealthScore = {
  score: number;
  status: BehaviorMemoryHealthStatus;
  components: {
    evidenceCoverage: number;
    averageConfidence: number;
    minimumConfidence: number;
    duplicationRate: number;
    compressionRatio: number;
    orphanRate: number;
    evidenceStability: number | null;
  };
};

export type BehaviorMemoryDataRetentionPolicy = {
  rawEventsDays: number;
  normalizedEvidenceDays: number;
  episodesDays: number;
  identitySnapshotsDays: number;
  knowledgeDays: number | null;
};

export const DEFAULT_BEHAVIOR_MEMORY_RETENTION_POLICY: BehaviorMemoryDataRetentionPolicy = {
  rawEventsDays: 30,
  normalizedEvidenceDays: 60,
  episodesDays: 180,
  identitySnapshotsDays: 365,
  knowledgeDays: null,
};

export type IdentitySnapshotDimensionName =
  | "communicationStyle"
  | "activityRhythm"
  | "socialExposure"
  | "initiativeProfile"
  | "responsiveness"
  | "diversity"
  | "predictability";

export type IdentitySnapshotEpisodeReference = {
  episodeIndex: number;
  episodeType: string;
  confidence: number;
  startedAt: Date | null;
  endedAt: Date | null;
  rationale: string;
};

export type IdentitySnapshotDimension = {
  value: number;
  confidence: number;
  supportingEpisodes: IdentitySnapshotEpisodeReference[];
  contradictingEpisodes: IdentitySnapshotEpisodeReference[];
};

export type IdentitySnapshot = {
  generatedAt: Date;
  confidence: number;
  stability: number;
  evidenceCoverage: number;
  maturity: number;
  drift: number;
  readOnly: true;
  dimensions: Record<IdentitySnapshotDimensionName, IdentitySnapshotDimension>;
  supportingEpisodes: IdentitySnapshotEpisodeReference[];
  contradictingEpisodes: IdentitySnapshotEpisodeReference[];
  pipelineVersions: BehaviorMemoryPipelineVersions | null;
  gating: {
    coverageReady: boolean;
    confidenceReady: boolean;
    stabilityReady: boolean;
    maturityReady: boolean;
    driftReady: boolean;
    readyForStrategy: boolean;
  };
};

export type BehaviorMemorySnapshotInput = {
  userId: number;
  chipId: number;
  windowStart: Date;
  windowEnd: Date;
  sampleDays?: number;
  firstActionAt?: Date | null;
  lastActionAt?: Date | null;
  totalActions?: number;
  distinctActionTypes?: number;
  repetitionScore?: number;
  variationScore?: number;
  actionSequence?: unknown;
  normalizedEvidence?: NormalizedBehaviorEvidence[];
  episodeCount?: number;
  episodeSummaries?: BehaviorEpisode[];
  originBreakdown?: Record<string, number>;
  outcomeBreakdown?: Record<string, number>;
  pipelineVersions?: BehaviorMemoryPipelineVersions | null;
  evidenceCoverage?: BehaviorMemoryEvidenceCoverage | null;
  pipelineCounters?: BehaviorMemoryPipelineCounters | null;
  averageConfidence?: number | null;
  minimumConfidence?: number | null;
  confidenceAssessment?: BehaviorMemoryConfidenceAssessment | null;
  pipelineHealth?: BehaviorMemoryHealthScore | null;
  identitySnapshot?: IdentitySnapshot | null;
  snapshotSchemaVersion?: number;
  dataRetentionPolicy?: BehaviorMemoryDataRetentionPolicy | null;
  activeHourBuckets?: unknown;
  responseDelayBuckets?: unknown;
  idleWindows?: unknown;
  patternSignature?: string | null;
  payload?: BehaviorMemorySnapshotExtra | null;
};

export type BehaviorMemorySnapshotExtra = {
  mode?: "shadow" | "replay" | string;
  metrics?: unknown;
  observability?: BehaviorObservabilitySnapshot | null;
  credibilityTrend?: CredibilityTrendWindow[] | null;
  identityDriftTimeline?: IdentityDriftTimelineEntry[] | null;
  validation?: BehaviorValidationSnapshot | null;
  longitudinal?: BehaviorLongitudinalSnapshot | null;
  adaptiveIntelligence?: AdaptiveLearningSnapshot | null;
  fleetLearning?: FleetLearningSnapshot | null;
  [key: string]: unknown;
};

export type BehaviorMemorySnapshotPayload = {
  snapshotSchemaVersion: number;
  normalizedEvidence: NormalizedBehaviorEvidence[];
  episodeCount: number;
  episodeSummaries: BehaviorEpisode[];
  originBreakdown: Record<string, number>;
  outcomeBreakdown: Record<string, number>;
  pipelineVersions: BehaviorMemoryPipelineVersions | null;
  evidenceCoverage: BehaviorMemoryEvidenceCoverage | null;
  pipelineCounters: BehaviorMemoryPipelineCounters | null;
  averageConfidence: number | null;
  minimumConfidence: number | null;
  confidenceAssessment: BehaviorMemoryConfidenceAssessment | null;
  pipelineHealth: BehaviorMemoryHealthScore | null;
  identitySnapshot: IdentitySnapshot | null;
  dataRetentionPolicy: BehaviorMemoryDataRetentionPolicy | null;
  extra: BehaviorMemorySnapshotExtra | null;
};

export async function storeBehaviorMemorySnapshot(input: BehaviorMemorySnapshotInput) {
  const payload: BehaviorMemorySnapshotPayload = {
    snapshotSchemaVersion: input.snapshotSchemaVersion ?? SNAPSHOT_SCHEMA_VERSION,
    normalizedEvidence: input.normalizedEvidence ?? [],
    episodeCount: input.episodeCount ?? input.episodeSummaries?.length ?? 0,
    episodeSummaries: input.episodeSummaries ?? [],
    originBreakdown: input.originBreakdown ?? {},
    outcomeBreakdown: input.outcomeBreakdown ?? {},
    pipelineVersions: input.pipelineVersions ?? null,
    evidenceCoverage: input.evidenceCoverage ?? null,
    pipelineCounters: input.pipelineCounters ?? null,
    averageConfidence: input.averageConfidence ?? null,
    minimumConfidence: input.minimumConfidence ?? null,
    confidenceAssessment: input.confidenceAssessment ?? null,
    pipelineHealth: input.pipelineHealth ?? null,
    identitySnapshot: input.identitySnapshot ?? null,
    dataRetentionPolicy: input.dataRetentionPolicy ?? DEFAULT_BEHAVIOR_MEMORY_RETENTION_POLICY,
    extra: input.payload ?? null,
  };

  return createBehaviorMemorySnapshot({
    ...input,
    payload,
  });
}

export async function getBehaviorMemoryHistory(userId: number, chipId: number, limit = 30) {
  return listBehaviorMemorySnapshots({
    userId,
    chipId,
    limit,
  });
}

export async function getBehaviorMemoryContext(userId: number, chipId: number) {
  const latest = await getLatestBehaviorMemorySnapshot(userId, chipId);

  if (!latest) {
    return {
      repetitionScore: 0,
      variationScore: 0,
      totalActions: 0,
      distinctActionTypes: 0,
      episodeCount: 0,
      episodeSummaries: [],
      originBreakdown: {},
      outcomeBreakdown: {},
      snapshotSchemaVersion: SNAPSHOT_SCHEMA_VERSION,
      pipelineVersions: null,
      evidenceCoverage: null,
      pipelineCounters: null,
      averageConfidence: null,
      minimumConfidence: null,
      confidenceAssessment: null,
      pipelineHealth: null,
      identitySnapshot: null,
      dataRetentionPolicy: DEFAULT_BEHAVIOR_MEMORY_RETENTION_POLICY,
      actionSequence: [],
      activeHourBuckets: [],
      responseDelayBuckets: [],
      idleWindows: [],
      patternSignature: null,
      observability: null,
      credibilityTrend: [],
      identityDriftTimeline: [],
      validation: null,
      longitudinal: null,
      adaptiveIntelligence: null,
      fleetLearning: null,
      source: "empty",
    };
  }

  return {
    repetitionScore: latest.repetitionScore ?? 0,
    variationScore: latest.variationScore ?? 0,
    totalActions: latest.totalActions ?? 0,
    distinctActionTypes: latest.distinctActionTypes ?? 0,
    snapshotSchemaVersion: latest.payload?.snapshotSchemaVersion ?? SNAPSHOT_SCHEMA_VERSION,
    episodeCount: latest.payload?.episodeCount ?? 0,
    episodeSummaries: latest.payload?.episodeSummaries ?? [],
    originBreakdown: latest.payload?.originBreakdown ?? {},
    outcomeBreakdown: latest.payload?.outcomeBreakdown ?? {},
    pipelineVersions: latest.payload?.pipelineVersions ?? null,
    evidenceCoverage: latest.payload?.evidenceCoverage ?? null,
    pipelineCounters: latest.payload?.pipelineCounters ?? null,
    averageConfidence: latest.payload?.averageConfidence ?? null,
    minimumConfidence: latest.payload?.minimumConfidence ?? null,
    confidenceAssessment: latest.payload?.confidenceAssessment ?? null,
    pipelineHealth: latest.payload?.pipelineHealth ?? null,
    identitySnapshot: latest.payload?.identitySnapshot ?? null,
    dataRetentionPolicy: latest.payload?.dataRetentionPolicy ?? DEFAULT_BEHAVIOR_MEMORY_RETENTION_POLICY,
    actionSequence: latest.actionSequence ?? [],
    activeHourBuckets: latest.activeHourBuckets ?? [],
    responseDelayBuckets: latest.responseDelayBuckets ?? [],
    idleWindows: latest.idleWindows ?? [],
    patternSignature: latest.patternSignature ?? null,
    observability: latest.payload?.extra?.observability ?? null,
    credibilityTrend: latest.payload?.extra?.credibilityTrend ?? [],
    identityDriftTimeline: latest.payload?.extra?.identityDriftTimeline ?? [],
    validation: latest.payload?.extra?.validation ?? null,
    longitudinal: latest.payload?.extra?.longitudinal ?? null,
    adaptiveIntelligence: latest.payload?.extra?.adaptiveIntelligence ?? null,
    fleetLearning: latest.payload?.extra?.fleetLearning ?? null,
    source: "snapshot",
    windowStart: latest.windowStart,
    windowEnd: latest.windowEnd,
  };
}
