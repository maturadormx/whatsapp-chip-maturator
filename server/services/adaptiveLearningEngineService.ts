import type { BehaviorObservabilitySnapshot } from "./behaviorObservabilityService";
import type { BehaviorValidationSnapshot, BehaviorOutcomeRecord } from "./behaviorValidationService";
import type {
  BehaviorLongitudinalSnapshot,
  MaturationExperienceContext,
} from "./behaviorLongitudinalService";
import type { BehaviorCognitiveSnapshot } from "./behaviorCognitiveObservabilityService";

type HypothesisStatus = "draft" | "candidate" | "validated" | "knowledge" | "deprecated" | "archived";
type KnowledgeStatus = "candidate" | "active" | "decaying" | "retired" | "archived";
type LearningEventType = "observed" | "validated" | "promoted" | "revalidated" | "retired" | "contradicted";

export type AdaptiveExperienceMatch = {
  chapterId: string;
  similarity: number;
  desirability: number;
  riskBefore: number;
  credibilityBefore: number;
  strategyChosen: string;
  actionTaken: string;
  observedAt: string;
};

export type AdaptiveHypothesis = {
  hypothesisKey: string;
  title: string;
  status: HypothesisStatus;
  confidence: number;
  sampleSize: number;
  successRate: number;
  contradictionRate: number;
  temporalStability: number;
  segmentConsistency: number;
  support: string[];
  contradictions: string[];
  scope: {
    timeBucket?: string;
    mood?: string;
    relationshipStage?: string;
  };
  lastValidatedAt: string;
};

export type AdaptiveKnowledgeItem = {
  knowledgeKey: string;
  sourceHypothesisKey: string;
  title: string;
  status: KnowledgeStatus;
  confidence: number;
  usageCount: number;
  successRate: number;
  decayRate: number;
  expiresAt: string | null;
  lastValidatedAt: string;
};

export type RealCalibrationComponent = {
  component: "normalizer" | "catalog" | "episode" | "identity" | "planner";
  predictedProbability: number | null;
  actualProbability: number | null;
  calibrationGap: number | null;
  reliability: "unknown" | "weak" | "good" | "strong";
  sampleSize: number;
};

export type RealConfidenceCalibration = {
  components: RealCalibrationComponent[];
};

export type LearningBatchSummary = {
  hypothesesObserved: number;
  hypothesesPromoted: number;
  hypothesesRetired: number;
  activeKnowledge: number;
  decayingKnowledge: number;
  archivedKnowledge: number;
};

export type AdaptiveLearningEvent = {
  eventType: LearningEventType;
  referenceKey: string;
  rationale: string;
};

export type AdaptiveLearningSnapshot = {
  hypotheses: AdaptiveHypothesis[];
  knowledge: AdaptiveKnowledgeItem[];
  rankedExperiences: AdaptiveExperienceMatch[];
  calibration: RealConfidenceCalibration;
  batchSummary: LearningBatchSummary;
  learningEvents: AdaptiveLearningEvent[];
};

type ExistingHypothesisLike = {
  hypothesisKey: string;
  status: HypothesisStatus;
  confidence: number;
  sampleSize: number;
  successRate: number;
  contradictionRate: number;
  temporalStability: number;
  segmentConsistency: number;
  lastValidatedAt?: Date | string | null;
  payload?: Partial<AdaptiveHypothesis> | null;
};

type ExistingKnowledgeLike = {
  knowledgeKey: string;
  sourceHypothesisKey?: string | null;
  status: KnowledgeStatus;
  confidence: number;
  usageCount: number;
  successRate: number;
  decayRate: number;
  expiresAt?: Date | string | null;
  lastValidatedAt?: Date | string | null;
  payload?: Partial<AdaptiveKnowledgeItem> | null;
};

type JournalEntryLike = {
  chapterId: string;
  observedAt: Date | string;
  riskBefore: number;
  credibilityBefore: number;
  strategyChosen?: string | null;
  actionTaken?: string | null;
  payload?: {
    context?: Partial<MaturationExperienceContext> | null;
    tags?: string[] | null;
    resultObserved?: { after24h?: string | null; after72h?: string | null; after7d?: string | null } | null;
  } | null;
};

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function mean(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function toDate(value?: Date | string | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function favorableOutcome(outcome: BehaviorOutcomeRecord) {
  return !outcome.restrictionOccurred && !outcome.banOccurred && outcome.actualOutcome !== "warning";
}

function deriveHypothesisStatus(params: {
  confidence: number;
  sampleSize: number;
  contradictionRate: number;
  temporalStability: number;
}) : HypothesisStatus {
  if (params.sampleSize < 3) return "draft";
  if (params.confidence >= 80 && params.sampleSize >= 12 && params.contradictionRate <= 20 && params.temporalStability >= 60) {
    return "knowledge";
  }
  if (params.confidence >= 68 && params.sampleSize >= 6 && params.contradictionRate <= 30) {
    return "validated";
  }
  if (params.confidence >= 50) return "candidate";
  return "draft";
}

function hypothesisTemplate(params: {
  hypothesisKey: string;
  title: string;
  confidence: number;
  sampleSize: number;
  successRate: number;
  contradictionRate: number;
  temporalStability: number;
  segmentConsistency: number;
  support: string[];
  contradictions: string[];
  scope: AdaptiveHypothesis["scope"];
  now: Date;
}): AdaptiveHypothesis {
  return {
    hypothesisKey: params.hypothesisKey,
    title: params.title,
    status: deriveHypothesisStatus({
      confidence: params.confidence,
      sampleSize: params.sampleSize,
      contradictionRate: params.contradictionRate,
      temporalStability: params.temporalStability,
    }),
    confidence: params.confidence,
    sampleSize: params.sampleSize,
    successRate: params.successRate,
    contradictionRate: params.contradictionRate,
    temporalStability: params.temporalStability,
    segmentConsistency: params.segmentConsistency,
    support: params.support,
    contradictions: params.contradictions,
    scope: params.scope,
    lastValidatedAt: params.now.toISOString(),
  };
}

function formulateHypotheses(params: {
  validation: BehaviorValidationSnapshot;
  observability: BehaviorObservabilitySnapshot;
  longitudinal: BehaviorLongitudinalSnapshot;
  cognitive: BehaviorCognitiveSnapshot;
  outcomes: BehaviorOutcomeRecord[];
  now: Date;
}): AdaptiveHypothesis[] {
  const successRate = params.outcomes.length
    ? round((params.outcomes.filter(favorableOutcome).length / params.outcomes.length) * 100)
    : 50;
  const sampleBase = Math.max(
    params.outcomes.length,
    params.longitudinal.relationshipMemory.length,
    params.cognitive.silenceIntelligence.windows.length
  );

  const silenceBenefit = hypothesisTemplate({
    hypothesisKey: "silence_benefit_under_reciprocity",
    title: "silêncio tende a preservar credibilidade quando a relação mantém reciprocidade",
    confidence: clamp(45 + params.cognitive.silenceIntelligence.beneficialCount * 8 - params.cognitive.silenceIntelligence.riskyCount * 4, 0, 100),
    sampleSize: params.cognitive.silenceIntelligence.windows.length,
    successRate,
    contradictionRate: clamp(params.cognitive.silenceIntelligence.riskyCount * 12, 0, 100),
    temporalStability: clamp(params.longitudinal.trustAccumulationModel.growthRatePerWeek + 55, 0, 100),
    segmentConsistency: clamp(params.cognitive.reciprocityScore.overallScore, 0, 100),
    support: params.cognitive.silenceIntelligence.windows.filter((item) => item.classification === "beneficial").map((item) => item.reason).slice(0, 4),
    contradictions: params.cognitive.silenceIntelligence.windows.filter((item) => item.classification === "risky").map((item) => item.reason).slice(0, 4),
    scope: {
      timeBucket: params.cognitive.dailyContext.timeBucket,
      relationshipStage: "trust_or_recurring",
    },
    now: params.now,
  });

  const saturationRisk = hypothesisTemplate({
    hypothesisKey: "relationship_saturation_elevates_risk",
    title: "saturação relacional tende a anteceder aumento de risco",
    confidence: clamp(50 + params.cognitive.relationshipSaturation.filter((item) => item.status !== "healthy").length * 10, 0, 100),
    sampleSize: params.cognitive.relationshipSaturation.length,
    successRate: round(100 - params.validation.riskBudget.spent),
    contradictionRate: clamp(params.cognitive.relationshipSaturation.filter((item) => item.status === "healthy").length * 6, 0, 100),
    temporalStability: clamp(params.observability.behaviorVariance.score, 0, 100),
    segmentConsistency: clamp(params.cognitive.socialCircleEngine.length * 14, 0, 100),
    support: params.cognitive.relationshipSaturation.filter((item) => item.status !== "healthy").map((item) => item.reason).slice(0, 4),
    contradictions: params.cognitive.relationshipEvolution.filter((item) => item.evolution === "growing").map(() => "há relações crescendo sem saturação observada").slice(0, 3),
    scope: {
      mood: params.cognitive.moodEstimation.mood,
      relationshipStage: "known_to_recurring",
    },
    now: params.now,
  });

  const momentumPresence = hypothesisTemplate({
    hypothesisKey: "hot_momentum_favors_light_presence",
    title: "momentum quente favorece presença leve em vez de pressão direta",
    confidence: clamp(48 + params.cognitive.momentumDetector.score * 0.4, 0, 100),
    sampleSize: Math.max(1, params.cognitive.momentumDetector.hotRelationships.length),
    successRate: round((params.validation.credibilityBudget.remaining + successRate) / 2),
    contradictionRate: clamp(params.cognitive.opportunityAging.summary.immediate * 10, 0, 100),
    temporalStability: clamp(params.cognitive.routineDetector.dominantHours.length * 20, 0, 100),
    segmentConsistency: clamp(params.cognitive.reciprocityScore.overallScore, 0, 100),
    support: [
      `momentum ${params.cognitive.momentumDetector.overall}`,
      ...params.cognitive.momentumDetector.hotRelationships.slice(0, 3).map((item) => `relacao quente ${item}`),
    ],
    contradictions: params.cognitive.opportunityAging.entries.filter((item) => item.ttlClass === "immediate").map(() => "há oportunidades que envelhecem rápido demais").slice(0, 3),
    scope: {
      mood: params.cognitive.moodEstimation.mood,
      timeBucket: params.cognitive.dailyContext.timeBucket,
    },
    now: params.now,
  });

  const predictabilityRisk = hypothesisTemplate({
    hypothesisKey: "predictability_correlates_with_operational_risk",
    title: "alta previsibilidade comportamental tende a elevar risco operacional",
    confidence: clamp(55 + (100 - params.observability.behaviorVariance.score) * 0.3, 0, 100),
    sampleSize: sampleBase,
    successRate: round(100 - params.validation.riskBudget.spent),
    contradictionRate: clamp(params.observability.behaviorVariance.status === "stable" ? 35 : 15, 0, 100),
    temporalStability: clamp(params.cognitive.lifePhaseDetector.phase === "stabilizing" ? 65 : 48, 0, 100),
    segmentConsistency: clamp(params.validation.groundTruth.sampleSize * 12, 0, 100),
    support: [`behavior variance ${params.observability.behaviorVariance.score}`, `anti-pattern risk ${params.observability.antiPatterns.summary.overallRisk}`],
    contradictions: params.validation.antiPatternLearning.filter((item) => (item.falsePositiveRate ?? 0) > 50).map((item) => `padrao ${item.pattern} tem alto falso positivo`).slice(0, 3),
    scope: {
      mood: params.cognitive.moodEstimation.mood,
      timeBucket: params.cognitive.dailyContext.timeBucket,
    },
    now: params.now,
  });

  return [silenceBenefit, saturationRisk, momentumPresence, predictabilityRisk];
}

function mergeWithExistingHypotheses(params: {
  generated: AdaptiveHypothesis[];
  existing: ExistingHypothesisLike[];
}): AdaptiveHypothesis[] {
  const existingByKey = new Map(params.existing.map((item) => [item.hypothesisKey, item]));
  return params.generated.map((hypothesis) => {
    const previous = existingByKey.get(hypothesis.hypothesisKey);
    if (!previous) return hypothesis;
    return {
      ...hypothesis,
      confidence: round((hypothesis.confidence + previous.confidence) / 2),
      sampleSize: Math.max(hypothesis.sampleSize, previous.sampleSize),
      contradictionRate: round((hypothesis.contradictionRate + previous.contradictionRate) / 2),
      temporalStability: round((hypothesis.temporalStability + previous.temporalStability) / 2),
      segmentConsistency: round((hypothesis.segmentConsistency + previous.segmentConsistency) / 2),
      status: hypothesis.status === "knowledge" ? "knowledge" : previous.status === "knowledge" ? "knowledge" : hypothesis.status,
    };
  });
}

function buildKnowledgeItems(params: {
  hypotheses: AdaptiveHypothesis[];
  existingKnowledge: ExistingKnowledgeLike[];
  now: Date;
}): AdaptiveKnowledgeItem[] {
  const existingByKey = new Map(params.existingKnowledge.map((item) => [item.knowledgeKey, item]));
  const items = params.hypotheses
    .filter((item) => item.status === "validated" || item.status === "knowledge")
    .map((hypothesis) => {
      const knowledgeKey = `knowledge:${hypothesis.hypothesisKey}`;
      const existing = existingByKey.get(knowledgeKey);
      const daysSinceValidated = 0;
      const decayRate = clamp(
        round(100 - hypothesis.temporalStability + hypothesis.contradictionRate * 0.4 + daysSinceValidated),
        0,
        100
      );
      const status: KnowledgeStatus =
        hypothesis.status === "knowledge"
          ? decayRate >= 70
            ? "decaying"
            : "active"
          : "candidate";
      return {
        knowledgeKey,
        sourceHypothesisKey: hypothesis.hypothesisKey,
        title: hypothesis.title,
        status: existing?.status === "retired" && hypothesis.status !== "knowledge" ? "retired" : status,
        confidence: round(existing ? (existing.confidence + hypothesis.confidence) / 2 : hypothesis.confidence),
        usageCount: existing?.usageCount ?? 0,
        successRate: round(existing ? (existing.successRate + hypothesis.successRate) / 2 : hypothesis.successRate),
        decayRate,
        expiresAt:
          decayRate >= 80
            ? new Date(params.now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString()
            : null,
        lastValidatedAt: hypothesis.lastValidatedAt,
      } satisfies AdaptiveKnowledgeItem;
    });

  const retiredExisting = params.existingKnowledge
    .filter((item) => !items.some((generated) => generated.knowledgeKey === item.knowledgeKey))
    .map((item) => ({
      knowledgeKey: item.knowledgeKey,
      sourceHypothesisKey: item.sourceHypothesisKey ?? item.knowledgeKey.replace("knowledge:", ""),
      title: item.payload?.title ?? item.knowledgeKey,
      status: "retired" as const,
      confidence: item.confidence,
      usageCount: item.usageCount,
      successRate: item.successRate,
      decayRate: clamp(item.decayRate + 15, 0, 100),
      expiresAt: item.expiresAt ? toDate(item.expiresAt)?.toISOString() ?? null : new Date(params.now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      lastValidatedAt: toDate(item.lastValidatedAt)?.toISOString() ?? params.now.toISOString(),
    }));

  return [...items, ...retiredExisting];
}

function buildRealCalibration(outcomes: BehaviorOutcomeRecord[]): RealConfidenceCalibration {
  const successProbability = outcomes.length
    ? round((outcomes.filter(favorableOutcome).length / outcomes.length) * 100)
    : null;

  const components: RealCalibrationComponent[] = (["normalizer", "catalog", "episode", "identity", "planner"] as const).map((component) => {
    const values = outcomes
      .map((item) => item.payload?.componentConfidences?.[component])
      .filter((item): item is number => typeof item === "number");
    const predictedProbability = values.length ? round(mean(values) * 100) : null;
    const actualProbability = values.length ? successProbability : null;
    const calibrationGap =
      predictedProbability != null && actualProbability != null
        ? round(predictedProbability - actualProbability)
        : null;
    const reliability: RealCalibrationComponent["reliability"] =
      values.length < 3
        ? values.length === 0
          ? "unknown"
          : "weak"
        : calibrationGap == null
          ? "unknown"
          : Math.abs(calibrationGap) <= 8
            ? "strong"
            : Math.abs(calibrationGap) <= 18
              ? "good"
              : "weak";

    return {
      component,
      predictedProbability,
      actualProbability,
      calibrationGap,
      reliability,
      sampleSize: values.length,
    };
  });

  return { components };
}

function rankExperiences(params: {
  currentContext: MaturationExperienceContext;
  journalEntries: JournalEntryLike[];
}): AdaptiveExperienceMatch[] {
  return params.journalEntries
    .map((entry) => {
      const context = entry.payload?.context;
      if (!context) return null;
      const chipAgeDistance =
        context.chipAgeDays != null && params.currentContext.chipAgeDays != null
          ? Math.abs(context.chipAgeDays - params.currentContext.chipAgeDays) / 90
          : 0.5;
      const diversityDistance = Math.abs((context.diversity ?? 50) - params.currentContext.diversity) / 100;
      const exposureDistance = Math.abs((context.socialExposure ?? 50) - params.currentContext.socialExposure) / 100;
      const predictabilityDistance = Math.abs((context.predictability ?? 50) - params.currentContext.predictability) / 100;
      const timePenalty = context.timeBucket === params.currentContext.timeBucket ? 0 : 0.4;
      const distance = clamp(chipAgeDistance * 0.15 + diversityDistance * 0.2 + exposureDistance * 0.2 + predictabilityDistance * 0.2 + timePenalty * 0.25, 0, 1);
      const similarity = round((1 - distance) * 100);
      const successMarkers = [
        entry.payload?.resultObserved?.after24h,
        entry.payload?.resultObserved?.after72h,
        entry.payload?.resultObserved?.after7d,
      ].filter(Boolean).length;
      const desirability = clamp(round((successMarkers * 25) + (100 - entry.riskBefore) * 0.25 + entry.credibilityBefore * 0.35), 0, 100);

      return {
        chapterId: entry.chapterId,
        similarity,
        desirability,
        riskBefore: entry.riskBefore,
        credibilityBefore: entry.credibilityBefore,
        strategyChosen: entry.strategyChosen ?? "unknown",
        actionTaken: entry.actionTaken ?? "unknown",
        observedAt: toDate(entry.observedAt)?.toISOString() ?? new Date(entry.observedAt).toISOString(),
      };
    })
    .filter((item): item is AdaptiveExperienceMatch => Boolean(item))
    .sort((a, b) => (b.similarity === a.similarity ? b.desirability - a.desirability : b.similarity - a.similarity))
    .slice(0, 20);
}

function buildLearningEvents(params: {
  hypotheses: AdaptiveHypothesis[];
  previousHypotheses: ExistingHypothesisLike[];
  knowledge: AdaptiveKnowledgeItem[];
}): AdaptiveLearningEvent[] {
  const previousByKey = new Map(params.previousHypotheses.map((item) => [item.hypothesisKey, item]));
  const events: AdaptiveLearningEvent[] = [];

  for (const hypothesis of params.hypotheses) {
    const previous = previousByKey.get(hypothesis.hypothesisKey);
    if (!previous) {
      events.push({
        eventType: "observed",
        referenceKey: hypothesis.hypothesisKey,
        rationale: "hipótese observada pela primeira vez nesta janela",
      });
      continue;
    }
    if (previous.status !== hypothesis.status) {
      const eventType: LearningEventType =
        hypothesis.status === "knowledge"
          ? "promoted"
          : hypothesis.status === "validated"
            ? "validated"
            : hypothesis.status === "deprecated" || hypothesis.status === "archived"
              ? "retired"
              : "revalidated";
      events.push({
        eventType,
        referenceKey: hypothesis.hypothesisKey,
        rationale: `estado mudou de ${previous.status} para ${hypothesis.status}`,
      });
    } else {
      events.push({
        eventType: "revalidated",
        referenceKey: hypothesis.hypothesisKey,
        rationale: "hipótese reavaliada na nova janela",
      });
    }
  }

  for (const knowledge of params.knowledge.filter((item) => item.status === "retired")) {
    events.push({
      eventType: "retired",
      referenceKey: knowledge.knowledgeKey,
      rationale: "conhecimento perdeu sustentação ou ficou sem revalidação recente",
    });
  }

  return events.slice(0, 50);
}

function buildBatchSummary(params: {
  hypotheses: AdaptiveHypothesis[];
  knowledge: AdaptiveKnowledgeItem[];
  learningEvents: AdaptiveLearningEvent[];
}): LearningBatchSummary {
  return {
    hypothesesObserved: params.hypotheses.length,
    hypothesesPromoted: params.learningEvents.filter((item) => item.eventType === "promoted").length,
    hypothesesRetired: params.learningEvents.filter((item) => item.eventType === "retired").length,
    activeKnowledge: params.knowledge.filter((item) => item.status === "active").length,
    decayingKnowledge: params.knowledge.filter((item) => item.status === "decaying").length,
    archivedKnowledge: params.knowledge.filter((item) => item.status === "retired" || item.status === "archived").length,
  };
}

export function buildAdaptiveLearningSnapshot(params: {
  observability: BehaviorObservabilitySnapshot;
  validation: BehaviorValidationSnapshot;
  longitudinal: BehaviorLongitudinalSnapshot;
  cognitive: BehaviorCognitiveSnapshot;
  outcomes: BehaviorOutcomeRecord[];
  journalEntries: JournalEntryLike[];
  existingHypotheses?: ExistingHypothesisLike[];
  existingKnowledge?: ExistingKnowledgeLike[];
  now: Date;
}): AdaptiveLearningSnapshot {
  const generatedHypotheses = formulateHypotheses({
    validation: params.validation,
    observability: params.observability,
    longitudinal: params.longitudinal,
    cognitive: params.cognitive,
    outcomes: params.outcomes,
    now: params.now,
  });
  const hypotheses = mergeWithExistingHypotheses({
    generated: generatedHypotheses,
    existing: params.existingHypotheses ?? [],
  });
  const knowledge = buildKnowledgeItems({
    hypotheses,
    existingKnowledge: params.existingKnowledge ?? [],
    now: params.now,
  });
  const rankedExperiences = rankExperiences({
    currentContext: params.longitudinal.experienceJournalCandidate.context,
    journalEntries: params.journalEntries,
  });
  const calibration = buildRealCalibration(params.outcomes);
  const learningEvents = buildLearningEvents({
    hypotheses,
    previousHypotheses: params.existingHypotheses ?? [],
    knowledge,
  });
  const batchSummary = buildBatchSummary({
    hypotheses,
    knowledge,
    learningEvents,
  });

  return {
    hypotheses,
    knowledge,
    rankedExperiences,
    calibration,
    batchSummary,
    learningEvents,
  };
}
