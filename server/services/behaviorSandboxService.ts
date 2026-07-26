import {
  BehaviorMemoryConfidenceAssessment,
  BehaviorMemoryDataRetentionPolicy,
  BehaviorMemoryEvidenceCoverage,
  BehaviorMemoryHealthScore,
  BehaviorMemoryPipelineCounters,
  BehaviorMemoryPipelineVersions,
  BehaviorMemorySnapshotExtra,
  IdentitySnapshot,
  IdentitySnapshotDimensionName,
  SNAPSHOT_SCHEMA_VERSION,
} from "./behaviorMemoryService";
import type { BehaviorEpisode } from "./episodeBuilderService";
import type { RawBehaviorEvent } from "./evidenceNormalizerService";
import {
  buildConfidenceAssessment,
  buildInspectionMetrics,
  buildPipelineHealthScore,
  buildPipelineVersions,
  buildShadowPipelineFromRawEvents,
  calculateConfidenceStats,
  calculateEvidenceStability,
  cloneRetentionPolicy,
  summarizeOrigins,
  summarizeOutcomes,
} from "./behaviorMemoryShadowService";
import { generateIdentitySnapshot } from "./identitySnapshotGeneratorService";
import {
  BehaviorObservabilitySnapshot,
  CredibilityTrendWindow,
  IdentityDriftTimelineEntry,
  buildBehaviorObservabilitySnapshot,
  buildCredibilityTrend,
  buildIdentityDriftTimeline,
} from "./behaviorObservabilityService";
import {
  BehaviorOutcomeRecord,
  BehaviorOpportunityObservationRecord,
  BehaviorValidationSnapshot,
  buildBehaviorValidationSnapshot,
} from "./behaviorValidationService";
import {
  BehaviorLongitudinalSnapshot,
  MaturationExperienceContext,
  buildBehaviorLongitudinalSnapshot,
} from "./behaviorLongitudinalService";
import {
  AdaptiveLearningSnapshot,
  buildAdaptiveLearningSnapshot,
} from "./adaptiveLearningEngineService";
import {
  FleetLearningProjection,
  FleetLearningSnapshot,
  buildFleetLearningProjection,
  buildFleetLearningSnapshot,
} from "./fleetLearningService";
import {
  BehaviorIntent,
  OpportunityHistoryEntry,
  OpportunitySignal,
  PlannerReference,
  PlannerRiskAssessment,
  simulateBehaviorPlan,
} from "./behaviorPlannerService";

type ReplayComparable =
  | string
  | number
  | boolean
  | null
  | ReplayComparable[]
  | { [key: string]: ReplayComparable };

type ReplayPreviousSnapshot = {
  windowEnd?: Date | string | null;
  createdAt?: Date | string | null;
  payload?: {
    averageConfidence?: number | null;
    pipelineHealth?: BehaviorMemoryHealthScore | null;
    identitySnapshot?: IdentitySnapshot | null;
    evidenceCoverage?: BehaviorMemoryEvidenceCoverage | null;
    extra?: BehaviorMemorySnapshotExtra | null;
  } | null;
} | null;

export type BehaviorReplayDataset = {
  datasetId: string;
  description?: string;
  rawEvents: RawBehaviorEvent[];
  replayedAt?: string | Date;
  dateFrom?: string | Date;
  dateTo?: string | Date;
  previousSnapshot?: ReplayPreviousSnapshot;
  outcomes?: BehaviorOutcomeRecord[];
  opportunityObservations?: BehaviorOpportunityObservationRecord[];
  journalEntries?: Array<{
    chapterId: string;
    observedAt: Date | string;
    riskBefore: number;
    credibilityBefore: number;
    strategyChosen?: string | null;
    actionTaken?: string | null;
    payload?: { context?: Partial<MaturationExperienceContext> | null } | null;
  }>;
  previousRelationshipMemory?: Array<{
    counterpartKey: string;
    counterpartType: "contact" | "group" | "unknown";
    stage: "unknown" | "known" | "trust" | "recurring" | "inactive";
    firstInteractionAt: string | null;
    lastInteractionAt: string | null;
    trustScore: number;
    relationshipRisk: number;
    idealContactFrequencyHours: number;
    inboundCount: number;
    outboundCount: number;
    recurringTopics: string[];
    signals: string[];
  }>;
  existingHypotheses?: Array<{
    hypothesisKey: string;
    status: "draft" | "candidate" | "validated" | "knowledge" | "deprecated" | "archived";
    confidence: number;
    sampleSize: number;
    successRate: number;
    contradictionRate: number;
    temporalStability: number;
    segmentConsistency: number;
    lastValidatedAt?: Date | string | null;
    payload?: Record<string, unknown> | null;
  }>;
  existingKnowledge?: Array<{
    knowledgeKey: string;
    sourceHypothesisKey?: string | null;
    status: "candidate" | "active" | "decaying" | "retired" | "archived";
    confidence: number;
    usageCount: number;
    successRate: number;
    decayRate: number;
    expiresAt?: Date | string | null;
    lastValidatedAt?: Date | string | null;
    payload?: Record<string, unknown> | null;
  }>;
  fleetProjections?: FleetLearningProjection[];
  chipCreatedAt?: Date | string | null;
  metadata?: Record<string, unknown>;
};

export type BehaviorReplaySnapshot = {
  snapshotSchemaVersion: number;
  pipelineVersions: BehaviorMemoryPipelineVersions;
  pipelineCounters: BehaviorMemoryPipelineCounters;
  averageConfidence: number;
  minimumConfidence: number;
  confidenceAssessment: BehaviorMemoryConfidenceAssessment;
  evidenceCoverage: BehaviorMemoryEvidenceCoverage;
  pipelineHealth: BehaviorMemoryHealthScore;
  identitySnapshot: IdentitySnapshot;
  dataRetentionPolicy: BehaviorMemoryDataRetentionPolicy;
  originBreakdown: Record<string, number>;
  outcomeBreakdown: Record<string, number>;
  normalizedEvidenceCount: number;
  catalogedEvidenceCount: number;
  episodeCount: number;
  observability: BehaviorObservabilitySnapshot;
  credibilityTrend: CredibilityTrendWindow[];
  identityDriftTimeline: IdentityDriftTimelineEntry[];
  validation: BehaviorValidationSnapshot;
  longitudinal: BehaviorLongitudinalSnapshot;
  adaptiveIntelligence: AdaptiveLearningSnapshot;
  fleetLearning: FleetLearningSnapshot;
  payload: BehaviorMemorySnapshotExtra;
};

export type BehaviorReplayResult = {
  datasetId?: string;
  replayedAt: Date;
  window: {
    dateFrom: Date;
    dateTo: Date;
    windowStart: Date;
    windowEnd: Date;
  };
  rawEvents: RawBehaviorEvent[];
  normalizedEvents: ReturnType<typeof buildShadowPipelineFromRawEvents>["normalizedEvents"];
  catalogedEvents: ReturnType<typeof buildShadowPipelineFromRawEvents>["catalogedEvents"];
  episodes: BehaviorEpisode[];
  snapshot: BehaviorReplaySnapshot;
};

export type BehaviorReplayDiff = {
  changed: boolean;
  confidence: { from: number; to: number; delta: number };
  episodes: {
    from: number;
    to: number;
    delta: number;
    addedTypes: string[];
    removedTypes: string[];
  };
  coverage: {
    from: number;
    to: number;
    delta: number;
    coveredSignalsAdded: string[];
    coveredSignalsRemoved: string[];
  };
  identity: {
    confidence: { from: number; to: number; delta: number };
    stability: { from: number; to: number; delta: number };
    maturity: { from: number; to: number; delta: number };
    drift: { from: number; to: number; delta: number };
    dimensions: Array<{
      name: IdentitySnapshotDimensionName;
      from: number;
      to: number;
      delta: number;
    }>;
  };
  observability: {
    antiPatternRisk: { from: number; to: number; delta: number };
    behaviorVariance: { from: number; to: number; delta: number };
    personaDiversity: { from: number; to: number; delta: number };
    socialGraphHealth: { from: number; to: number; delta: number };
  };
  pipelineHealth: {
    from: number;
    to: number;
    delta: number;
    fromStatus: BehaviorMemoryHealthScore["status"];
    toStatus: BehaviorMemoryHealthScore["status"];
  };
};

export type OpportunitySandboxExplanation = {
  appeared: boolean;
  decision: ReturnType<typeof simulateBehaviorPlan>["decision"];
  action: ReturnType<typeof simulateBehaviorPlan>["action"];
  whyAppeared: string[];
  whyNotAppeared: string[];
  plan: ReturnType<typeof simulateBehaviorPlan>;
};

function toDate(value?: string | Date | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function round(value: number, digits = 4) {
  return Number(value.toFixed(digits));
}

function fixedReplayMoment(params: {
  replayedAt?: string | Date;
  dateTo?: string | Date;
  fallback?: Date;
}) {
  return (
    toDate(params.replayedAt) ??
    toDate(params.dateTo) ??
    params.fallback ??
    new Date("2000-01-01T00:00:00.000Z")
  );
}

function toComparableValue(value: unknown): ReplayComparable {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => toComparableValue(item));
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
      left.localeCompare(right)
    );
    return Object.fromEntries(entries.map(([key, entryValue]) => [key, toComparableValue(entryValue)])) as {
      [key: string]: ReplayComparable;
    };
  }

  if (value === undefined) {
    return null;
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null) {
    return value as ReplayComparable;
  }

  return String(value);
}

function uniqueEpisodeTypes(episodes: BehaviorEpisode[]) {
  return Array.from(new Set(episodes.map((episode) => episode.episodeType))).sort();
}

export function runBehaviorReplay(params: BehaviorReplayDataset): BehaviorReplayResult {
  const basePipeline = buildShadowPipelineFromRawEvents({
    rawEvents: params.rawEvents,
    dateFrom: toDate(params.dateFrom) ?? undefined,
    dateTo: toDate(params.dateTo) ?? undefined,
  });

  const replayedAt = fixedReplayMoment({
    replayedAt: params.replayedAt,
    dateTo: params.dateTo,
    fallback: basePipeline.windowEnd,
  });

  const previousSnapshot = params.previousSnapshot ?? null;
  const confidence = calculateConfidenceStats(basePipeline.episodes);
  const confidenceAssessment = buildConfidenceAssessment(basePipeline.episodes, confidence.averageConfidence);
  const evidenceStability = calculateEvidenceStability(confidence.averageConfidence, previousSnapshot);
  const pipelineHealth = buildPipelineHealthScore({
    metrics: basePipeline.metrics,
    evidenceCoverage: basePipeline.evidenceCoverage.evidenceCoverage,
    averageConfidence: confidence.averageConfidence,
    minimumConfidence: confidence.minimumConfidence,
    evidenceStability,
  });
  const observability = buildBehaviorObservabilitySnapshot({
    rawEvents: basePipeline.rawEvents,
    episodes: basePipeline.episodes,
  });

  const identitySnapshot = generateIdentitySnapshot({
    episodes: basePipeline.episodes,
    evidenceCoverage: basePipeline.evidenceCoverage,
    pipelineVersions: basePipeline.pipelineVersions,
    averageConfidence: confidence.averageConfidence,
    previousIdentitySnapshot: previousSnapshot?.payload?.identitySnapshot ?? null,
    generatedAt: replayedAt,
  });
  const currentSnapshotProjection: ReplayPreviousSnapshot = {
    windowEnd: basePipeline.windowEnd,
    payload: {
      averageConfidence: confidence.averageConfidence,
      pipelineHealth,
      identitySnapshot,
      evidenceCoverage: basePipeline.evidenceCoverage,
      extra: {
        observability,
      },
    },
  };
  const replayHistory = [previousSnapshot, currentSnapshotProjection].filter(
    (item): item is NonNullable<ReplayPreviousSnapshot> => Boolean(item)
  );
  const credibilityTrend = buildCredibilityTrend({
    history: replayHistory,
    now: replayedAt,
  });
  const identityDriftTimeline = buildIdentityDriftTimeline({
    history: replayHistory,
    limit: 12,
  });
  const validation = buildBehaviorValidationSnapshot({
    rawEvents: basePipeline.rawEvents,
    episodes: basePipeline.episodes,
    observability,
    outcomes: params.outcomes ?? [],
    opportunityObservations: params.opportunityObservations ?? [],
    history: replayHistory,
    current: {
      windowStart: basePipeline.windowStart,
      windowEnd: basePipeline.windowEnd,
      averageConfidence: confidence.averageConfidence,
      episodeConfidence: confidenceAssessment.confidence,
      evidenceCoverage: basePipeline.evidenceCoverage,
      pipelineCounters: basePipeline.pipelineCounters,
      identitySnapshot,
      credibilityScore: credibilityTrend[0]?.credibility.current ?? 0,
    },
  });
  const longitudinal = buildBehaviorLongitudinalSnapshot({
    rawEvents: basePipeline.rawEvents,
    episodes: basePipeline.episodes,
    observability,
    validation,
    identitySnapshot,
    history: replayHistory,
    journalEntries: params.journalEntries ?? [],
    opportunityObservations: params.opportunityObservations ?? [],
    previousRelationshipMemory: params.previousRelationshipMemory ?? [],
    chipCreatedAt: params.chipCreatedAt ?? null,
    credibilityScore: credibilityTrend[0]?.credibility.current ?? 0,
    now: replayedAt,
  });
  const adaptiveIntelligence = buildAdaptiveLearningSnapshot({
    observability,
    validation,
    longitudinal,
    cognitive: longitudinal.cognitive,
    outcomes: params.outcomes ?? [],
    journalEntries: params.journalEntries ?? [],
    existingHypotheses: params.existingHypotheses ?? [],
    existingKnowledge: params.existingKnowledge ?? [],
    now: replayedAt,
  });
  const currentFleetProjection = buildFleetLearningProjection({
    chipId: 0,
    chipName: params.datasetId,
    chipStatus: "replay",
    chipCreatedAt: params.chipCreatedAt ?? null,
    observability,
    validation,
    longitudinal,
    adaptiveIntelligence,
  });
  const fleetLearning = buildFleetLearningSnapshot({
    currentChipId: currentFleetProjection.chipId,
    projections: [...(params.fleetProjections ?? []), currentFleetProjection],
    now: replayedAt,
  });

  return {
    datasetId: params.datasetId,
    replayedAt,
    window: {
      dateFrom: basePipeline.dateFrom,
      dateTo: basePipeline.dateTo,
      windowStart: basePipeline.windowStart,
      windowEnd: basePipeline.windowEnd,
    },
    rawEvents: basePipeline.rawEvents,
    normalizedEvents: basePipeline.normalizedEvents,
    catalogedEvents: basePipeline.catalogedEvents,
    episodes: basePipeline.episodes,
    snapshot: {
      snapshotSchemaVersion: SNAPSHOT_SCHEMA_VERSION,
      pipelineVersions: buildPipelineVersions(),
      pipelineCounters: basePipeline.pipelineCounters,
      averageConfidence: confidence.averageConfidence,
      minimumConfidence: confidence.minimumConfidence,
      confidenceAssessment,
      evidenceCoverage: basePipeline.evidenceCoverage,
      pipelineHealth,
      identitySnapshot,
      dataRetentionPolicy: cloneRetentionPolicy(),
      originBreakdown: summarizeOrigins(basePipeline.episodes),
      outcomeBreakdown: summarizeOutcomes(basePipeline.episodes),
      normalizedEvidenceCount: basePipeline.normalizedEvents.length,
      catalogedEvidenceCount: basePipeline.catalogedEvents.length,
      episodeCount: basePipeline.episodes.length,
      observability,
      credibilityTrend,
      identityDriftTimeline,
      validation,
      longitudinal,
      adaptiveIntelligence,
      fleetLearning,
      payload: {
        mode: "replay",
        datasetId: params.datasetId,
        metadata: params.metadata,
        metrics: basePipeline.metrics,
        observability,
        credibilityTrend,
        identityDriftTimeline,
        validation,
        longitudinal,
        adaptiveIntelligence,
        fleetLearning,
      },
    },
  };
}

export function serializeBehaviorReplayResult(result: BehaviorReplayResult) {
  return toComparableValue(result);
}

export function compareBehaviorReplayResults(
  previousResult: BehaviorReplayResult,
  nextResult: BehaviorReplayResult
): BehaviorReplayDiff {
  const previousTypes = uniqueEpisodeTypes(previousResult.episodes);
  const nextTypes = uniqueEpisodeTypes(nextResult.episodes);
  const dimensionNames = Object.keys(previousResult.snapshot.identitySnapshot.dimensions) as IdentitySnapshotDimensionName[];

  const diff: BehaviorReplayDiff = {
    changed:
      JSON.stringify(serializeBehaviorReplayResult(previousResult)) !==
      JSON.stringify(serializeBehaviorReplayResult(nextResult)),
    confidence: {
      from: previousResult.snapshot.averageConfidence,
      to: nextResult.snapshot.averageConfidence,
      delta: round(nextResult.snapshot.averageConfidence - previousResult.snapshot.averageConfidence),
    },
    episodes: {
      from: previousResult.snapshot.episodeCount,
      to: nextResult.snapshot.episodeCount,
      delta: nextResult.snapshot.episodeCount - previousResult.snapshot.episodeCount,
      addedTypes: nextTypes.filter((type) => !previousTypes.includes(type)),
      removedTypes: previousTypes.filter((type) => !nextTypes.includes(type)),
    },
    coverage: {
      from: previousResult.snapshot.evidenceCoverage.evidenceCoverage,
      to: nextResult.snapshot.evidenceCoverage.evidenceCoverage,
      delta: round(
        nextResult.snapshot.evidenceCoverage.evidenceCoverage -
          previousResult.snapshot.evidenceCoverage.evidenceCoverage
      ),
      coveredSignalsAdded: nextResult.snapshot.evidenceCoverage.coveredSignals.filter(
        (signal) => !previousResult.snapshot.evidenceCoverage.coveredSignals.includes(signal)
      ),
      coveredSignalsRemoved: previousResult.snapshot.evidenceCoverage.coveredSignals.filter(
        (signal) => !nextResult.snapshot.evidenceCoverage.coveredSignals.includes(signal)
      ),
    },
    identity: {
      confidence: {
        from: previousResult.snapshot.identitySnapshot.confidence,
        to: nextResult.snapshot.identitySnapshot.confidence,
        delta: round(
          nextResult.snapshot.identitySnapshot.confidence - previousResult.snapshot.identitySnapshot.confidence
        ),
      },
      stability: {
        from: previousResult.snapshot.identitySnapshot.stability,
        to: nextResult.snapshot.identitySnapshot.stability,
        delta: round(
          nextResult.snapshot.identitySnapshot.stability - previousResult.snapshot.identitySnapshot.stability
        ),
      },
      maturity: {
        from: previousResult.snapshot.identitySnapshot.maturity,
        to: nextResult.snapshot.identitySnapshot.maturity,
        delta: round(
          nextResult.snapshot.identitySnapshot.maturity - previousResult.snapshot.identitySnapshot.maturity
        ),
      },
      drift: {
        from: previousResult.snapshot.identitySnapshot.drift,
        to: nextResult.snapshot.identitySnapshot.drift,
        delta: round(nextResult.snapshot.identitySnapshot.drift - previousResult.snapshot.identitySnapshot.drift),
      },
      dimensions: dimensionNames.map((name) => ({
        name,
        from: previousResult.snapshot.identitySnapshot.dimensions[name].value,
        to: nextResult.snapshot.identitySnapshot.dimensions[name].value,
        delta: round(
          nextResult.snapshot.identitySnapshot.dimensions[name].value -
            previousResult.snapshot.identitySnapshot.dimensions[name].value
        ),
      })),
    },
    observability: {
      antiPatternRisk: {
        from: previousResult.snapshot.observability.antiPatterns.summary.overallRisk,
        to: nextResult.snapshot.observability.antiPatterns.summary.overallRisk,
        delta: round(
          nextResult.snapshot.observability.antiPatterns.summary.overallRisk -
            previousResult.snapshot.observability.antiPatterns.summary.overallRisk
        ),
      },
      behaviorVariance: {
        from: previousResult.snapshot.observability.behaviorVariance.score,
        to: nextResult.snapshot.observability.behaviorVariance.score,
        delta: round(
          nextResult.snapshot.observability.behaviorVariance.score -
            previousResult.snapshot.observability.behaviorVariance.score
        ),
      },
      personaDiversity: {
        from: previousResult.snapshot.observability.personaDiversity.score,
        to: nextResult.snapshot.observability.personaDiversity.score,
        delta: round(
          nextResult.snapshot.observability.personaDiversity.score -
            previousResult.snapshot.observability.personaDiversity.score
        ),
      },
      socialGraphHealth: {
        from: previousResult.snapshot.observability.socialGraphHealth.score,
        to: nextResult.snapshot.observability.socialGraphHealth.score,
        delta: round(
          nextResult.snapshot.observability.socialGraphHealth.score -
            previousResult.snapshot.observability.socialGraphHealth.score
        ),
      },
    },
    pipelineHealth: {
      from: previousResult.snapshot.pipelineHealth.score,
      to: nextResult.snapshot.pipelineHealth.score,
      delta: round(nextResult.snapshot.pipelineHealth.score - previousResult.snapshot.pipelineHealth.score),
      fromStatus: previousResult.snapshot.pipelineHealth.status,
      toStatus: nextResult.snapshot.pipelineHealth.status,
    },
  };

  return diff;
}

export function explainReplayEpisode(result: BehaviorReplayResult, episodeIndex: number) {
  const episode = result.episodes[episodeIndex];
  if (!episode) {
    throw new Error("Episódio não encontrado");
  }

  return {
    episodeIndex: episodeIndex + 1,
    episodeType: episode.episodeType,
    confidence: episode.confidence,
    whyExists: [
      `agrupado por janela temporal de até 15 minutos e pela mesma conversa`,
      `catálogos observados: ${episode.catalogs.join(", ") || "nenhum"}`,
      `trilha bruta: ${episode.rawEventTrail.map((item) => item.rawEventType).join(" -> ") || "vazia"}`,
    ],
    evidenceTrail: episode.rawEventTrail,
    result: episode.result,
    initiatedBy: episode.initiatedBy,
  };
}

export function explainIdentityDimension(
  result: BehaviorReplayResult,
  dimensionName: IdentitySnapshotDimensionName
) {
  const dimension = result.snapshot.identitySnapshot.dimensions[dimensionName];
  if (!dimension) {
    throw new Error("Dimensão de identidade não encontrada");
  }

  return {
    dimension: dimensionName,
    value: dimension.value,
    confidence: dimension.confidence,
    whyExists: dimension.supportingEpisodes.map((item) => item.rationale),
    whyNotHigher: dimension.contradictingEpisodes.map((item) => item.rationale),
    supportingEpisodes: dimension.supportingEpisodes,
    contradictingEpisodes: dimension.contradictingEpisodes,
  };
}

export function simulateOpportunityInSandbox(params: {
  intent: BehaviorIntent;
  opportunity: OpportunitySignal;
  history?: OpportunityHistoryEntry[];
  risk?: PlannerRiskAssessment | null;
  hypothesisReferences?: PlannerReference[];
  knowledgeReferences?: PlannerReference[];
  evidenceReferences?: string[];
  identitySummary?: string;
  now?: Date;
}): OpportunitySandboxExplanation {
  const plan = simulateBehaviorPlan({
    intent: params.intent,
    opportunity: params.opportunity,
    history: params.history,
    risk: params.risk,
    hypothesisReferences: params.hypothesisReferences,
    knowledgeReferences: params.knowledgeReferences,
    evidenceReferences: params.evidenceReferences,
    identitySummary: params.identitySummary,
    now: params.now,
  });

  return {
    appeared: plan.decision === "act_now",
    decision: plan.decision,
    action: plan.action,
    whyAppeared: plan.decision === "act_now" ? [plan.rationale, plan.explainability.why, ...plan.explainability.evidence] : [],
    whyNotAppeared:
      plan.decision === "act_now"
        ? []
        : [plan.rationale, ...plan.simulation.blockedBy, plan.explainability.risk].filter(Boolean),
    plan,
  };
}
