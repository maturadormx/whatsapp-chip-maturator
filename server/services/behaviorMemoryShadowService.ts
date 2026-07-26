import {
  createFleetKnowledgePromotion,
  createLearningEngineEvent,
  createMaturationExperienceJournalEntry,
  getAllChips,
  getChipById,
  getLatestBehaviorMemorySnapshot,
  listBehaviorOutcomes,
  listBehaviorOpportunityObservations,
  listKnowledgeBaseItems,
  listLearningHypotheses,
  listMaturationExperienceJournal,
  listRelationshipMemories,
  listBehaviorTimelineEvents,
  upsertFleetLearningCohort,
  upsertFleetLearningPattern,
  upsertKnowledgeBaseItem,
  upsertLearningHypothesis,
  upsertRelationshipMemory,
} from "../db";
import {
  BehaviorMemoryConfidenceAssessment,
  BehaviorMemoryDataRetentionPolicy,
  BehaviorMemoryHealthScore,
  BehaviorMemoryPipelineCounters,
  BehaviorMemoryPipelineVersions,
  DEFAULT_BEHAVIOR_MEMORY_RETENTION_POLICY,
  getBehaviorMemoryContext,
  getBehaviorMemoryHistory,
  SNAPSHOT_SCHEMA_VERSION,
  storeBehaviorMemorySnapshot,
} from "./behaviorMemoryService";
import {
  buildBehaviorObservabilitySnapshot,
  buildCredibilityTrend,
  buildIdentityDriftTimeline,
} from "./behaviorObservabilityService";
import { buildBehaviorValidationSnapshot } from "./behaviorValidationService";
import { buildBehaviorLongitudinalSnapshot } from "./behaviorLongitudinalService";
import { buildAdaptiveLearningSnapshot } from "./adaptiveLearningEngineService";
import {
  FleetLearningSnapshot,
  buildFleetLearningProjection,
  buildFleetLearningSnapshot,
} from "./fleetLearningService";
import { generateIdentitySnapshot } from "./identitySnapshotGeneratorService";
import { EVIDENCE_CATALOG_VERSION, catalogEvidenceBatch } from "./evidenceCatalogService";
import {
  EVIDENCE_NORMALIZER_VERSION,
  RawBehaviorEvent,
  normalizeBehaviorBatch,
} from "./evidenceNormalizerService";
import { BehaviorEpisode, EPISODE_BUILDER_VERSION, buildBehaviorEpisodes } from "./episodeBuilderService";
import { computeEvidenceCoverage } from "./maturatorOperational";

export const BEHAVIOR_MEMORY_VERSION = 1;

type ConfidenceBucket = {
  count: number;
  percentage: number;
};

type ShadowGateAlert = {
  gate: "duplicationRate" | "compressionRatio" | "orphanRate" | "episodeConfidence" | "minimumConfidence";
  status: "ok" | "warn" | "critical";
  message: string;
  value: number;
};

type ShadowInspectionMetrics = {
  duplicationRate: number;
  compressionRatio: number;
  orphanRate: number;
  episodeConfidence: {
    gt09: ConfidenceBucket;
    gte07Lt09: ConfidenceBucket;
    lt07: ConfidenceBucket;
  };
  alerts: ShadowGateAlert[];
  health: "healthy" | "attention" | "critical";
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

async function buildFleetLearningForChip(params: {
  userId: number;
  chipId: number;
  chipName?: string | null;
  chipStatus?: string | null;
  chipCreatedAt?: Date | string | null;
  observability: ReturnType<typeof buildBehaviorObservabilitySnapshot>;
  validation: ReturnType<typeof buildBehaviorValidationSnapshot>;
  longitudinal: ReturnType<typeof buildBehaviorLongitudinalSnapshot>;
  adaptiveIntelligence: ReturnType<typeof buildAdaptiveLearningSnapshot>;
  now: Date;
}): Promise<FleetLearningSnapshot> {
  const currentProjection = buildFleetLearningProjection({
    chipId: params.chipId,
    chipName: params.chipName,
    chipStatus: params.chipStatus,
    chipCreatedAt: params.chipCreatedAt ?? null,
    observability: params.observability,
    validation: params.validation,
    longitudinal: params.longitudinal,
    adaptiveIntelligence: params.adaptiveIntelligence,
  });

  const chips = await getAllChips();
  const fleetProjections = await Promise.all(
    chips
      .filter((chip) => chip.userId === params.userId && chip.id !== params.chipId && chip.isPaused === 0)
      .map(async (chip) => {
        const context = await getBehaviorMemoryContext(params.userId, chip.id);
        if (!context.observability || !context.validation || !context.longitudinal || !context.adaptiveIntelligence) {
          return null;
        }
        return buildFleetLearningProjection({
          chipId: chip.id,
          chipName: chip.chipName,
          chipStatus: chip.status,
          chipCreatedAt: chip.createdAt ?? null,
          observability: context.observability,
          validation: context.validation,
          longitudinal: context.longitudinal,
          adaptiveIntelligence: context.adaptiveIntelligence,
        });
      })
  );

  const projections = fleetProjections.filter(
    (item): item is NonNullable<(typeof fleetProjections)[number]> => Boolean(item)
  );

  return buildFleetLearningSnapshot({
    currentChipId: params.chipId,
    projections: [...projections, currentProjection],
    now: params.now,
  });
}

export function toRawBehaviorEvent(event: any): RawBehaviorEvent {
  return {
    eventType: event.eventType,
    provider: event.provider ?? null,
    sourceType: event.sourceType ?? null,
    source: event.source ?? null,
    direction: event.direction ?? null,
    occurredAt: event.occurredAt ?? null,
    remoteJid: event.remoteJid ?? null,
    remoteType: event.remoteType ?? null,
    remoteLabel: event.remoteLabel ?? null,
    groupJid: event.groupJid ?? null,
    groupSubject: event.groupSubject ?? null,
    contentPreview: event.contentPreview ?? null,
    payload: event.payload ?? null,
  };
}

function uniqueNormalizedKeys(events: RawBehaviorEvent[]) {
  const keys = new Set<string>();
  for (const event of events) {
    keys.add(
      JSON.stringify([
        event.eventType,
        event.source ?? null,
        event.direction ?? null,
        event.occurredAt ? new Date(event.occurredAt).toISOString() : null,
        event.remoteJid ?? event.groupJid ?? null,
      ])
    );
  }
  return keys;
}

export function calculateConfidenceStats(episodes: BehaviorEpisode[]) {
  if (!episodes.length) {
    return {
      averageConfidence: 0,
      minimumConfidence: 0,
    };
  }

  const values = episodes.map((episode) => episode.confidence);
  const total = values.reduce((sum, value) => sum + value, 0);

  return {
    averageConfidence: Number((total / values.length).toFixed(2)),
    minimumConfidence: Number(Math.min(...values).toFixed(2)),
  };
}

export function buildConfidenceAssessment(
  episodes: BehaviorEpisode[],
  averageConfidence: number
): BehaviorMemoryConfidenceAssessment {
  const support = episodes.filter((episode) => episode.confidence >= 0.7).length;
  const contradictions = episodes.filter((episode) => episode.confidence < 0.5).length;
  return {
    confidence: round(averageConfidence, 2),
    support,
    contradictions,
    sampleSize: episodes.length,
  };
}

export function calculateEvidenceStability(
  averageConfidence: number,
  previousSnapshot?: { payload?: { averageConfidence?: number | null } | null } | null
) {
  const previousConfidence = previousSnapshot?.payload?.averageConfidence;
  if (typeof previousConfidence !== "number") {
    return null;
  }
  return round(1 - Math.min(1, Math.abs(averageConfidence - previousConfidence)), 2);
}

function compressionRatioToScore(compressionRatio: number) {
  if (compressionRatio >= 0.15 && compressionRatio <= 0.85) {
    return 100;
  }
  const distance =
    compressionRatio < 0.15 ? (0.15 - compressionRatio) / 0.15 : (compressionRatio - 0.85) / 0.15;
  return round(clamp(100 - distance * 100, 0, 100), 2);
}

export function buildPipelineHealthScore(params: {
  metrics: ShadowInspectionMetrics;
  evidenceCoverage: number;
  averageConfidence: number;
  minimumConfidence: number;
  evidenceStability: number | null;
}): BehaviorMemoryHealthScore {
  const evidenceStabilityScore = params.evidenceStability == null ? 50 : round(params.evidenceStability * 100, 2);
  const score = round(
    params.evidenceCoverage * 0.2 +
      params.averageConfidence * 100 * 0.2 +
      params.minimumConfidence * 100 * 0.15 +
      Math.max(0, 100 - params.metrics.duplicationRate * 3) * 0.15 +
      compressionRatioToScore(params.metrics.compressionRatio) * 0.1 +
      Math.max(0, 100 - params.metrics.orphanRate * 3) * 0.1 +
      evidenceStabilityScore * 0.1,
    2
  );

  const status =
    params.metrics.health === "critical" || score < 55
      ? "critical"
      : params.metrics.health === "attention" || score < 75
        ? "attention"
        : "healthy";

  return {
    score,
    status,
    components: {
      evidenceCoverage: round(params.evidenceCoverage, 2),
      averageConfidence: round(params.averageConfidence, 2),
      minimumConfidence: round(params.minimumConfidence, 2),
      duplicationRate: round(params.metrics.duplicationRate, 2),
      compressionRatio: round(params.metrics.compressionRatio, 4),
      orphanRate: round(params.metrics.orphanRate, 2),
      evidenceStability: params.evidenceStability,
    },
  };
}

export function cloneRetentionPolicy(): BehaviorMemoryDataRetentionPolicy {
  return { ...DEFAULT_BEHAVIOR_MEMORY_RETENTION_POLICY };
}

export function buildPipelineCounters(rawEvents: RawBehaviorEvent[], normalizedEvents: any[], catalogedEvents: any[], episodes: BehaviorEpisode[]): BehaviorMemoryPipelineCounters {
  return {
    rawEvents: rawEvents.length,
    normalizedEvents: normalizedEvents.length,
    catalogedEvents: catalogedEvents.length,
    episodes: episodes.length,
  };
}

export function buildInspectionMetrics(rawEvents: RawBehaviorEvent[], normalizedEvents: any[], episodes: BehaviorEpisode[]): ShadowInspectionMetrics {
  const uniqueKeys = uniqueNormalizedKeys(rawEvents);
  const duplicationRate =
    rawEvents.length === 0 ? 0 : Number((((rawEvents.length - uniqueKeys.size) / rawEvents.length) * 100).toFixed(2));
  const compressionRatio =
    rawEvents.length === 0 ? 0 : Number((episodes.length / rawEvents.length).toFixed(4));
  const episodeEventCount = episodes.reduce((sum, episode) => sum + episode.events.length, 0);
  const orphanRate =
    normalizedEvents.length === 0
      ? 0
      : Number((((normalizedEvents.length - episodeEventCount) / normalizedEvents.length) * 100).toFixed(2));
  const totalEpisodes = Math.max(episodes.length, 1);
  const gt09Count = episodes.filter((episode) => episode.confidence > 0.9).length;
  const gte07Lt09Count = episodes.filter((episode) => episode.confidence >= 0.7 && episode.confidence <= 0.9).length;
  const lt07Count = episodes.filter((episode) => episode.confidence < 0.7).length;
  const alerts: ShadowGateAlert[] = [];

  if (duplicationRate > 20) {
    alerts.push({
      gate: "duplicationRate",
      status: "critical",
      message: "Duplicação alta demais entre eventos brutos e sinais normalizados.",
      value: duplicationRate,
    });
  } else if (duplicationRate > 5) {
    alerts.push({
      gate: "duplicationRate",
      status: "warn",
      message: "Duplicação acima do esperado; vale inspecionar o normalizador.",
      value: duplicationRate,
    });
  }

  if (compressionRatio > 0.85 || compressionRatio < 0.15) {
    alerts.push({
      gate: "compressionRatio",
      status: compressionRatio > 0.95 || compressionRatio < 0.08 ? "critical" : "warn",
      message: "Compressão fora da faixa esperada entre eventos brutos e episódios.",
      value: compressionRatio,
    });
  }

  if (orphanRate > 20) {
    alerts.push({
      gate: "orphanRate",
      status: "critical",
      message: "Muitos eventos normalizados ficaram fora de episódios.",
      value: orphanRate,
    });
  } else if (orphanRate > 5) {
    alerts.push({
      gate: "orphanRate",
      status: "warn",
      message: "Há eventos órfãos acima do limite confortável.",
      value: orphanRate,
    });
  }

  const lowConfidencePercentage = Number(((lt07Count / totalEpisodes) * 100).toFixed(2));
  if (lowConfidencePercentage > 10) {
    alerts.push({
      gate: "episodeConfidence",
      status: lowConfidencePercentage > 25 ? "critical" : "warn",
      message: "Distribuição de confiança dos episódios indica baixa confiabilidade.",
      value: lowConfidencePercentage,
    });
  }

  const minimumEpisodeConfidence =
    episodes.length === 0 ? 0 : Number(Math.min(...episodes.map((episode) => episode.confidence)).toFixed(2));
  if (minimumEpisodeConfidence < 0.5) {
    alerts.push({
      gate: "minimumConfidence",
      status: minimumEpisodeConfidence < 0.35 ? "critical" : "warn",
      message: "Existe episódio com confiança mínima abaixo do limite saudável.",
      value: minimumEpisodeConfidence,
    });
  }

  const health = alerts.some((alert) => alert.status === "critical")
    ? "critical"
    : alerts.some((alert) => alert.status === "warn")
      ? "attention"
      : "healthy";

  return {
    duplicationRate,
    compressionRatio,
    orphanRate,
    episodeConfidence: {
      gt09: {
        count: gt09Count,
        percentage: Number(((gt09Count / totalEpisodes) * 100).toFixed(2)),
      },
      gte07Lt09: {
        count: gte07Lt09Count,
        percentage: Number(((gte07Lt09Count / totalEpisodes) * 100).toFixed(2)),
      },
      lt07: {
        count: lt07Count,
        percentage: lowConfidencePercentage,
      },
    },
    alerts,
    health,
  };
}

export function buildPipelineVersions(): BehaviorMemoryPipelineVersions {
  return {
    normalizerVersion: EVIDENCE_NORMALIZER_VERSION,
    catalogVersion: EVIDENCE_CATALOG_VERSION,
    episodeBuilderVersion: EPISODE_BUILDER_VERSION,
    memoryVersion: BEHAVIOR_MEMORY_VERSION,
  };
}

export function summarizeOrigins(episodes: BehaviorEpisode[]) {
  return episodes.reduce<Record<string, number>>((acc, episode) => {
    for (const origin of episode.origins) {
      acc[origin] = (acc[origin] ?? 0) + 1;
    }
    return acc;
  }, {});
}

export function summarizeOutcomes(episodes: BehaviorEpisode[]) {
  return episodes.reduce<Record<string, number>>((acc, episode) => {
    acc[episode.result] = (acc[episode.result] ?? 0) + 1;
    return acc;
  }, {});
}

export function buildShadowPipelineFromRawEvents(params: {
  rawEvents: RawBehaviorEvent[];
  dateFrom?: Date;
  dateTo?: Date;
}) {
  const rawEvents = [...params.rawEvents];
  const normalizedEvents = normalizeBehaviorBatch(rawEvents);
  const catalogedEvents = catalogEvidenceBatch(normalizedEvents);
  const episodes = buildBehaviorEpisodes(catalogedEvents);

  const occurredAtValues = normalizedEvents
    .map((event) => event.occurredAt)
    .filter((value): value is Date => value instanceof Date);

  const dateFrom = params.dateFrom ?? occurredAtValues[0] ?? new Date();
  const dateTo = params.dateTo ?? occurredAtValues[occurredAtValues.length - 1] ?? dateFrom;
  const windowStart = occurredAtValues[0] ?? dateFrom;
  const windowEnd = occurredAtValues[occurredAtValues.length - 1] ?? dateTo;

  const counters = buildPipelineCounters(rawEvents, normalizedEvents, catalogedEvents, episodes);
  const confidence = calculateConfidenceStats(episodes);
  const metrics = buildInspectionMetrics(rawEvents, normalizedEvents, episodes);
  const coverage = computeEvidenceCoverage({
    totalEvents: rawEvents.length,
    sessionConnectedCount: rawEvents.filter((event) => event.eventType === "session_connected").length,
    contactsSyncedCount: rawEvents.filter((event) => event.eventType === "contacts_synced").length,
    profileUpdatedCount: rawEvents.filter((event) => ["profile_name_updated", "profile_photo_updated", "about_updated"].includes(event.eventType)).length,
    statusViewedCount: rawEvents.filter((event) => event.eventType === "status_viewed").length,
    chatListOpenedCount: rawEvents.filter((event) => event.eventType === "chat_list_opened").length,
    sentCount: rawEvents.filter((event) => event.eventType === "message_sent").length,
    acknowledgedCount: rawEvents.filter((event) => event.eventType === "message_acknowledged").length,
    receivedCount: rawEvents.filter((event) => event.eventType === "message_received").length,
    groupJoinCount: rawEvents.filter((event) => event.eventType === "group_joined").length,
    groupOpenCount: rawEvents.filter((event) => event.eventType === "group_opened").length,
    participantsLoadedCount: rawEvents.filter((event) => event.eventType === "participants_loaded").length,
    readCount: rawEvents.filter((event) => event.eventType === "messages_read").length,
    distinctConversations: new Set(rawEvents.map((event) => event.remoteJid ?? event.groupJid).filter(Boolean)).size,
    distinctGroupsVisited: new Set(rawEvents.map((event) => event.groupJid).filter(Boolean)).size,
    activeMinutes: 0,
    idleMinutes: 0,
    lastEventAt: occurredAtValues[occurredAtValues.length - 1]?.toISOString() ?? null,
    lastEventType: rawEvents[rawEvents.length - 1]?.eventType ?? null,
  });

  return {
    dateFrom,
    dateTo,
    rawEvents,
    normalizedEvents,
    catalogedEvents,
    episodes,
    pipelineVersions: buildPipelineVersions(),
    pipelineCounters: counters,
    averageConfidence: confidence.averageConfidence,
    minimumConfidence: confidence.minimumConfidence,
    evidenceCoverage: coverage,
    metrics,
    windowStart,
    windowEnd,
  };
}

async function buildShadowPipeline(userId: number, chipId: number, windowHours: number) {
  const dateTo = new Date();
  const dateFrom = new Date(dateTo.getTime() - windowHours * 60 * 60 * 1000);

  const timelineEvents = await listBehaviorTimelineEvents({
    userId,
    chipId,
    dateFrom,
    dateTo,
    limit: 5000,
  });

  return buildShadowPipelineFromRawEvents({
    rawEvents: timelineEvents.map(toRawBehaviorEvent),
    dateFrom,
    dateTo,
  });
}

export async function generateBehaviorMemoryShadowSnapshot(params: {
  userId: number;
  chipId: number;
  windowHours?: number;
}) {
  const chip = await getChipById(params.chipId);
  if (!chip || chip.userId !== params.userId) {
    throw new Error("Chip não encontrado");
  }

  const pipeline = await buildShadowPipeline(params.userId, params.chipId, params.windowHours ?? 48);
  const previousSnapshot = await getLatestBehaviorMemorySnapshot(params.userId, params.chipId);
  const identitySnapshot = generateIdentitySnapshot({
    episodes: pipeline.episodes,
    evidenceCoverage: pipeline.evidenceCoverage,
    pipelineVersions: pipeline.pipelineVersions,
    averageConfidence: pipeline.averageConfidence,
    previousIdentitySnapshot: previousSnapshot?.payload?.identitySnapshot ?? null,
  });
  const confidenceAssessment = buildConfidenceAssessment(pipeline.episodes, pipeline.averageConfidence);
  const evidenceStability = calculateEvidenceStability(pipeline.averageConfidence, previousSnapshot);
  const pipelineHealth = buildPipelineHealthScore({
    metrics: pipeline.metrics,
    evidenceCoverage: pipeline.evidenceCoverage.evidenceCoverage,
    averageConfidence: pipeline.averageConfidence,
    minimumConfidence: pipeline.minimumConfidence,
    evidenceStability,
  });
  const observability = buildBehaviorObservabilitySnapshot({
    rawEvents: pipeline.rawEvents,
    episodes: pipeline.episodes,
  });
  const history = await getBehaviorMemoryHistory(params.userId, params.chipId, 90);
  const currentSnapshotProjection = {
    windowEnd: pipeline.windowEnd,
    payload: {
      averageConfidence: pipeline.averageConfidence,
      pipelineHealth,
      identitySnapshot,
      evidenceCoverage: pipeline.evidenceCoverage,
      extra: {
        observability,
      },
    },
  };
  const credibilityTrend = buildCredibilityTrend({
    history: [...history, currentSnapshotProjection],
    now: pipeline.windowEnd,
  });
  const identityDriftTimeline = buildIdentityDriftTimeline({
    history: [...history, currentSnapshotProjection],
    limit: 12,
  });
  const outcomes = await listBehaviorOutcomes({
    userId: params.userId,
    chipId: params.chipId,
    limit: 200,
  });
  const opportunityObservations = await listBehaviorOpportunityObservations({
    userId: params.userId,
    chipId: params.chipId,
    limit: 200,
  });
  const validation = buildBehaviorValidationSnapshot({
    rawEvents: pipeline.rawEvents,
    episodes: pipeline.episodes,
    observability,
    outcomes,
    opportunityObservations,
    history,
    current: {
      windowStart: pipeline.windowStart,
      windowEnd: pipeline.windowEnd,
      averageConfidence: pipeline.averageConfidence,
      episodeConfidence: confidenceAssessment.confidence,
      evidenceCoverage: pipeline.evidenceCoverage,
      pipelineCounters: pipeline.pipelineCounters,
      identitySnapshot,
      credibilityScore: credibilityTrend[0]?.credibility.current ?? 0,
    },
  });
  const journalEntries = await listMaturationExperienceJournal({
    userId: params.userId,
    chipId: params.chipId,
    limit: 200,
  });
  const previousRelationshipMemory = await listRelationshipMemories({
    userId: params.userId,
    chipId: params.chipId,
    limit: 500,
  });
  const longitudinal = buildBehaviorLongitudinalSnapshot({
    rawEvents: pipeline.rawEvents,
    episodes: pipeline.episodes,
    observability,
    validation,
    identitySnapshot,
    history,
    journalEntries,
    opportunityObservations,
    previousRelationshipMemory: previousRelationshipMemory.map((item) => item.payload ?? item).filter(Boolean),
    chipCreatedAt: chip.createdAt ?? null,
    credibilityScore: credibilityTrend[0]?.credibility.current ?? 0,
    now: pipeline.windowEnd,
  });
  const existingHypotheses = await listLearningHypotheses({
    userId: params.userId,
    limit: 200,
  });
  const existingKnowledge = await listKnowledgeBaseItems({
    userId: params.userId,
    limit: 200,
  });
  const adaptiveIntelligence = buildAdaptiveLearningSnapshot({
    observability,
    validation,
    longitudinal,
    cognitive: longitudinal.cognitive,
    outcomes,
    journalEntries,
    existingHypotheses,
    existingKnowledge,
    now: pipeline.windowEnd,
  });
  const fleetLearning = await buildFleetLearningForChip({
    userId: params.userId,
    chipId: params.chipId,
    chipName: chip.chipName,
    chipStatus: chip.status,
    chipCreatedAt: chip.createdAt ?? null,
    observability,
    validation,
    longitudinal,
    adaptiveIntelligence,
    now: pipeline.windowEnd,
  });

  for (const relationship of longitudinal.relationshipMemory) {
    await upsertRelationshipMemory({
      userId: params.userId,
      chipId: params.chipId,
      counterpartKey: relationship.counterpartKey,
      counterpartType: relationship.counterpartType,
      stage: relationship.stage,
      firstInteractionAt: relationship.firstInteractionAt ? new Date(relationship.firstInteractionAt) : null,
      lastInteractionAt: relationship.lastInteractionAt ? new Date(relationship.lastInteractionAt) : null,
      trustScore: relationship.trustScore,
      relationshipRisk: relationship.relationshipRisk,
      idealContactFrequencyHours: relationship.idealContactFrequencyHours,
      payload: relationship,
    });
  }

  for (const hypothesis of adaptiveIntelligence.hypotheses) {
    await upsertLearningHypothesis({
      userId: params.userId,
      hypothesisKey: hypothesis.hypothesisKey,
      status: hypothesis.status,
      title: hypothesis.title,
      confidence: hypothesis.confidence,
      sampleSize: hypothesis.sampleSize,
      successRate: hypothesis.successRate,
      contradictionRate: hypothesis.contradictionRate,
      temporalStability: hypothesis.temporalStability,
      segmentConsistency: hypothesis.segmentConsistency,
      lastValidatedAt: new Date(hypothesis.lastValidatedAt),
      payload: hypothesis,
    });
  }

  for (const knowledge of adaptiveIntelligence.knowledge) {
    await upsertKnowledgeBaseItem({
      userId: params.userId,
      knowledgeKey: knowledge.knowledgeKey,
      sourceHypothesisKey: knowledge.sourceHypothesisKey,
      status: knowledge.status,
      title: knowledge.title,
      confidence: knowledge.confidence,
      usageCount: knowledge.usageCount,
      successRate: knowledge.successRate,
      decayRate: knowledge.decayRate,
      expiresAt: knowledge.expiresAt ? new Date(knowledge.expiresAt) : null,
      lastValidatedAt: new Date(knowledge.lastValidatedAt),
      payload: knowledge,
    });
  }

  for (const event of adaptiveIntelligence.learningEvents) {
    await createLearningEngineEvent({
      userId: params.userId,
      chipId: params.chipId,
      eventType: event.eventType,
      referenceKey: event.referenceKey,
      observedAt: pipeline.windowEnd,
      payload: event,
    });
  }

  for (const cohort of fleetLearning.cohorts) {
    await upsertFleetLearningCohort({
      userId: params.userId,
      cohortKey: cohort.cohortKey,
      status: cohort.status,
      title: cohort.title,
      chipCount: cohort.chipCount,
      averageSuccessRate: cohort.averageSuccessRate,
      averageRiskScore: cohort.averageRiskScore,
      averageCredibilityScore: cohort.averageCredibilityScore,
      lastComputedAt: pipeline.windowEnd,
      payload: cohort,
    });
  }

  for (const pattern of fleetLearning.patterns) {
    await upsertFleetLearningPattern({
      userId: params.userId,
      patternKey: pattern.patternKey,
      cohortKey: pattern.cohortKey,
      status: pattern.status,
      title: pattern.title,
      confidence: pattern.confidence,
      sampleSize: pattern.sampleSize,
      successRate: pattern.successRate,
      riskScore: pattern.riskScore,
      recommendationType: pattern.recommendationType,
      lastValidatedAt: pipeline.windowEnd,
      payload: pattern,
    });
  }

  for (const promotion of fleetLearning.promotions) {
    const sourcePattern = fleetLearning.patterns.find((item) => item.patternKey === promotion.sourcePatternKey);
    await createFleetKnowledgePromotion({
      userId: params.userId,
      sourcePatternKey: promotion.sourcePatternKey,
      targetKnowledgeKey: promotion.targetKnowledgeKey,
      action: promotion.action,
      observedAt: pipeline.windowEnd,
      payload: promotion,
    });
    await upsertKnowledgeBaseItem({
      userId: params.userId,
      knowledgeKey: promotion.targetKnowledgeKey,
      sourceHypothesisKey: promotion.sourcePatternKey,
      status: promotion.action === "retire" ? "retired" : "active",
      title: sourcePattern?.title ?? promotion.targetKnowledgeKey,
      confidence: promotion.confidence,
      usageCount: 0,
      successRate: sourcePattern?.successRate ?? 0,
      decayRate: sourcePattern?.status === "active" ? 18 : 30,
      expiresAt: null,
      lastValidatedAt: pipeline.windowEnd,
      payload: {
        source: "fleet-learning",
        promotion,
        pattern: sourcePattern ?? null,
      },
    });
  }

  await createMaturationExperienceJournalEntry({
    userId: params.userId,
    chipId: params.chipId,
    chapterId: longitudinal.experienceJournalCandidate.chapterId,
    chapterType: longitudinal.experienceJournalCandidate.chapterType,
    observedAt: new Date(longitudinal.experienceJournalCandidate.observedAt),
    contextHash: longitudinal.experienceJournalCandidate.contextHash,
    strategyChosen: longitudinal.experienceJournalCandidate.strategyChosen,
    actionTaken: longitudinal.experienceJournalCandidate.actionTaken,
    riskBefore: longitudinal.experienceJournalCandidate.riskBefore,
    riskAfter: longitudinal.experienceJournalCandidate.riskAfter,
    credibilityBefore: longitudinal.experienceJournalCandidate.credibilityBefore,
    credibilityAfter: longitudinal.experienceJournalCandidate.credibilityAfter,
    outcome24h: longitudinal.experienceJournalCandidate.resultObserved.after24h,
    outcome72h: longitudinal.experienceJournalCandidate.resultObserved.after72h,
    outcome7d: longitudinal.experienceJournalCandidate.resultObserved.after7d,
    payload: longitudinal.experienceJournalCandidate,
  });

  await storeBehaviorMemorySnapshot({
    userId: params.userId,
    chipId: params.chipId,
    windowStart: pipeline.windowStart,
    windowEnd: pipeline.windowEnd,
    sampleDays: Math.max(1, Math.ceil((pipeline.dateTo.getTime() - pipeline.dateFrom.getTime()) / (24 * 60 * 60 * 1000))),
    firstActionAt: pipeline.windowStart,
    lastActionAt: pipeline.windowEnd,
    totalActions: pipeline.pipelineCounters.catalogedEvents,
    distinctActionTypes: new Set(pipeline.catalogedEvents.map((event) => event.catalog)).size,
    repetitionScore: 0,
    variationScore: 0,
    normalizedEvidence: pipeline.normalizedEvents,
    episodeCount: pipeline.pipelineCounters.episodes,
    episodeSummaries: pipeline.episodes,
    originBreakdown: summarizeOrigins(pipeline.episodes),
    outcomeBreakdown: summarizeOutcomes(pipeline.episodes),
    pipelineVersions: pipeline.pipelineVersions,
    evidenceCoverage: pipeline.evidenceCoverage,
    pipelineCounters: pipeline.pipelineCounters,
    averageConfidence: pipeline.averageConfidence,
    minimumConfidence: pipeline.minimumConfidence,
    confidenceAssessment,
    pipelineHealth,
    identitySnapshot,
    snapshotSchemaVersion: SNAPSHOT_SCHEMA_VERSION,
    dataRetentionPolicy: cloneRetentionPolicy(),
    payload: {
      mode: "shadow",
      metrics: pipeline.metrics,
      observability,
      credibilityTrend,
      identityDriftTimeline,
      validation,
      longitudinal,
      adaptiveIntelligence,
      fleetLearning,
    },
  });

  return {
    chipId: params.chipId,
    pipelineCounters: pipeline.pipelineCounters,
    averageConfidence: pipeline.averageConfidence,
    minimumConfidence: pipeline.minimumConfidence,
    confidenceAssessment,
    evidenceCoverage: pipeline.evidenceCoverage.evidenceCoverage,
    pipelineVersions: pipeline.pipelineVersions,
    snapshotSchemaVersion: SNAPSHOT_SCHEMA_VERSION,
    pipelineHealth,
    identitySnapshot,
    observability,
    credibilityTrend,
    identityDriftTimeline,
    validation,
    longitudinal,
    adaptiveIntelligence,
    fleetLearning,
  };
}

export async function inspectBehaviorMemoryShadow(params: {
  userId: number;
  chipId: number;
  windowHours?: number;
}) {
  const chip = await getChipById(params.chipId);
  if (!chip || chip.userId !== params.userId) {
    throw new Error("Chip não encontrado");
  }

  const pipeline = await buildShadowPipeline(params.userId, params.chipId, params.windowHours ?? 48);
  const latestSnapshot = await getLatestBehaviorMemorySnapshot(params.userId, params.chipId);
  const identitySnapshot = generateIdentitySnapshot({
    episodes: pipeline.episodes,
    evidenceCoverage: pipeline.evidenceCoverage,
    pipelineVersions: pipeline.pipelineVersions,
    averageConfidence: pipeline.averageConfidence,
    previousIdentitySnapshot: latestSnapshot?.payload?.identitySnapshot ?? null,
  });
  const confidenceAssessment = buildConfidenceAssessment(pipeline.episodes, pipeline.averageConfidence);
  const evidenceStability = calculateEvidenceStability(pipeline.averageConfidence, latestSnapshot);
  const pipelineHealth = buildPipelineHealthScore({
    metrics: pipeline.metrics,
    evidenceCoverage: pipeline.evidenceCoverage.evidenceCoverage,
    averageConfidence: pipeline.averageConfidence,
    minimumConfidence: pipeline.minimumConfidence,
    evidenceStability,
  });
  const observability = buildBehaviorObservabilitySnapshot({
    rawEvents: pipeline.rawEvents,
    episodes: pipeline.episodes,
  });
  const history = await getBehaviorMemoryHistory(params.userId, params.chipId, 90);
  const currentSnapshotProjection = {
    windowEnd: pipeline.windowEnd,
    payload: {
      averageConfidence: pipeline.averageConfidence,
      pipelineHealth,
      identitySnapshot,
      evidenceCoverage: pipeline.evidenceCoverage,
      extra: {
        observability,
      },
    },
  };
  const credibilityTrend = buildCredibilityTrend({
    history: [...history, currentSnapshotProjection],
    now: pipeline.windowEnd,
  });
  const identityDriftTimeline = buildIdentityDriftTimeline({
    history: [...history, currentSnapshotProjection],
    limit: 12,
  });
  const outcomes = await listBehaviorOutcomes({
    userId: params.userId,
    chipId: params.chipId,
    limit: 200,
  });
  const opportunityObservations = await listBehaviorOpportunityObservations({
    userId: params.userId,
    chipId: params.chipId,
    limit: 200,
  });
  const validation = buildBehaviorValidationSnapshot({
    rawEvents: pipeline.rawEvents,
    episodes: pipeline.episodes,
    observability,
    outcomes,
    opportunityObservations,
    history,
    current: {
      windowStart: pipeline.windowStart,
      windowEnd: pipeline.windowEnd,
      averageConfidence: pipeline.averageConfidence,
      episodeConfidence: confidenceAssessment.confidence,
      evidenceCoverage: pipeline.evidenceCoverage,
      pipelineCounters: pipeline.pipelineCounters,
      identitySnapshot,
      credibilityScore: credibilityTrend[0]?.credibility.current ?? 0,
    },
  });
  const journalEntries = await listMaturationExperienceJournal({
    userId: params.userId,
    chipId: params.chipId,
    limit: 200,
  });
  const previousRelationshipMemory = await listRelationshipMemories({
    userId: params.userId,
    chipId: params.chipId,
    limit: 500,
  });
  const longitudinal = buildBehaviorLongitudinalSnapshot({
    rawEvents: pipeline.rawEvents,
    episodes: pipeline.episodes,
    observability,
    validation,
    identitySnapshot,
    history,
    journalEntries,
    opportunityObservations,
    previousRelationshipMemory: previousRelationshipMemory.map((item) => item.payload ?? item).filter(Boolean),
    chipCreatedAt: chip.createdAt ?? null,
    credibilityScore: credibilityTrend[0]?.credibility.current ?? 0,
    now: pipeline.windowEnd,
  });
  const existingHypotheses = await listLearningHypotheses({
    userId: params.userId,
    limit: 200,
  });
  const existingKnowledge = await listKnowledgeBaseItems({
    userId: params.userId,
    limit: 200,
  });
  const adaptiveIntelligence = buildAdaptiveLearningSnapshot({
    observability,
    validation,
    longitudinal,
    cognitive: longitudinal.cognitive,
    outcomes,
    journalEntries,
    existingHypotheses,
    existingKnowledge,
    now: pipeline.windowEnd,
  });
  const fleetLearning = await buildFleetLearningForChip({
    userId: params.userId,
    chipId: params.chipId,
    chipName: chip.chipName,
    chipStatus: chip.status,
    chipCreatedAt: chip.createdAt ?? null,
    observability,
    validation,
    longitudinal,
    adaptiveIntelligence,
    now: pipeline.windowEnd,
  });

  return {
    chip: {
      chipId: chip.id,
      chipName: chip.chipName,
      phoneNumber: chip.phoneNumber,
      status: chip.status,
    },
    window: {
      dateFrom: pipeline.dateFrom,
      dateTo: pipeline.dateTo,
    },
    pipeline: {
      summary: {
        flow: `${pipeline.pipelineCounters.rawEvents} raw -> ${pipeline.pipelineCounters.normalizedEvents} normalized -> ${pipeline.pipelineCounters.catalogedEvents} cataloged -> ${pipeline.pipelineCounters.episodes} episodes`,
        health: pipeline.metrics.health,
      },
      versions: pipeline.pipelineVersions,
      counters: pipeline.pipelineCounters,
      averageConfidence: pipeline.averageConfidence,
      minimumConfidence: pipeline.minimumConfidence,
      confidenceAssessment,
      evidenceCoverage: pipeline.evidenceCoverage,
      pipelineHealth,
      snapshotSchemaVersion: SNAPSHOT_SCHEMA_VERSION,
      dataRetentionPolicy: cloneRetentionPolicy(),
      identitySnapshot,
      metrics: pipeline.metrics,
      observability,
      credibilityTrend,
      identityDriftTimeline,
      validation,
      longitudinal,
      adaptiveIntelligence,
      fleetLearning,
    },
    episodeInspector: pipeline.episodes.map((episode, index) => ({
      episodeIndex: index + 1,
      episodeType: episode.episodeType,
      confidence: episode.confidence,
      catalogs: episode.catalogs,
      pipelineVersions: {
        normalizerVersion: episode.normalizerVersion,
        catalogVersion: episode.catalogVersion,
        episodeBuilderVersion: episode.episodeBuilderVersion,
      },
      rawTrail: episode.rawEventTrail,
      startedAt: episode.startedAt,
      endedAt: episode.endedAt,
      actionsCount: episode.actionsCount,
      result: episode.result,
    })),
    rawEvents: pipeline.rawEvents,
    normalized: pipeline.normalizedEvents,
    catalog: pipeline.catalogedEvents,
    episodes: pipeline.episodes,
    identitySnapshot,
    observability,
    credibilityTrend,
    identityDriftTimeline,
    validation,
    longitudinal,
    adaptiveIntelligence,
    fleetLearning,
    snapshot: latestSnapshot,
  };
}

export async function runBehaviorMemoryShadowForConnectedChips(windowHours = 48) {
  const chips = await getAllChips();
  const activeChips = chips.filter((chip) => chip.status === "conectado" && chip.isPaused === 0);
  const results = [];

  for (const chip of activeChips) {
    try {
      const snapshot = await generateBehaviorMemoryShadowSnapshot({
        userId: chip.userId,
        chipId: chip.id,
        windowHours,
      });
      results.push({
        chipId: chip.id,
        chipName: chip.chipName,
        success: true,
        snapshot,
      });
    } catch (error) {
      results.push({
        chipId: chip.id,
        chipName: chip.chipName,
        success: false,
        error: String(error),
      });
    }
  }

  return {
    processedChips: activeChips.length,
    successCount: results.filter((item) => item.success).length,
    failureCount: results.filter((item) => !item.success).length,
    results,
  };
}
