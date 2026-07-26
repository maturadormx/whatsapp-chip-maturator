import type { BehaviorObservabilitySnapshot } from "./behaviorObservabilityService";
import type { BehaviorValidationSnapshot } from "./behaviorValidationService";
import type { BehaviorLongitudinalSnapshot } from "./behaviorLongitudinalService";
import type { AdaptiveLearningSnapshot } from "./adaptiveLearningEngineService";

type FleetCohortStatus = "emerging" | "stable" | "elite" | "critical";
type FleetPatternStatus = "candidate" | "promoted" | "active" | "retired";
type FleetPromotionAction = "observe" | "promote" | "revalidate" | "retire";
type AgeBucket = "primeiros_dias" | "aquecimento" | "maduro";
type ExposureMode = "exposicao_passiva" | "exposicao_ativa";
type RiskBucket = "baixo_risco" | "medio_risco" | "alto_risco";

export type FleetLearningProjection = {
  chipId: number;
  chipName: string;
  chipStatus: string;
  chipAgeDays: number | null;
  ageBucket: AgeBucket;
  exposureMode: ExposureMode;
  riskBucket: RiskBucket;
  relationshipCount: number;
  trustLevel: number;
  successRate: number;
  contradictionRate: number;
  credibilityScore: number;
  riskScore: number;
  activeKnowledge: number;
  decayingKnowledge: number;
  socialExposure: number;
  diversity: number;
  predictability: number;
  passiveShare: number;
  activeShare: number;
  dominantMood: string;
  timeBucket: string;
};

export type FleetLearningCohort = {
  cohortKey: string;
  title: string;
  status: FleetCohortStatus;
  chipIds: number[];
  chipCount: number;
  averageSuccessRate: number;
  averageRiskScore: number;
  averageCredibilityScore: number;
  averageTrustLevel: number;
  averageDiversity: number;
  ageBucket: AgeBucket;
  exposureMode: ExposureMode;
  riskBucket: RiskBucket;
};

export type FleetLearningPattern = {
  patternKey: string;
  cohortKey: string;
  title: string;
  status: FleetPatternStatus;
  confidence: number;
  sampleSize: number;
  successRate: number;
  riskScore: number;
  recommendationType: string;
  rationale: string;
  evidence: string[];
};

export type FleetLearningRecommendation = {
  patternKey: string;
  cohortKey: string;
  label: string;
  confidence: number;
  expectedSuccessRate: number;
  expectedRiskScore: number;
  rationale: string;
};

export type FleetKnowledgePromotion = {
  promotionKey: string;
  sourcePatternKey: string;
  targetKnowledgeKey: string;
  action: FleetPromotionAction;
  confidence: number;
  rationale: string;
};

export type FleetRiskAnalytics = {
  averageRiskScore: number;
  highRiskChips: number;
  criticalCohorts: number;
  failureRate: number;
};

export type FleetOpportunityAnalytics = {
  averageSuccessRate: number;
  passiveExposureAdvantage: number;
  bestCohorts: string[];
};

export type FleetBenchmarkDashboard = {
  totalChips: number;
  cohortCount: number;
  bestCohortKey: string | null;
  topSuccessRate: number;
  currentChipRank: number | null;
  currentChipPercentile: number | null;
};

export type FleetLearningSnapshot = {
  projections: FleetLearningProjection[];
  cohorts: FleetLearningCohort[];
  patterns: FleetLearningPattern[];
  recommendations: FleetLearningRecommendation[];
  promotions: FleetKnowledgePromotion[];
  riskAnalytics: FleetRiskAnalytics;
  opportunityAnalytics: FleetOpportunityAnalytics;
  benchmark: FleetBenchmarkDashboard;
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

function ageBucket(chipAgeDays: number | null): AgeBucket {
  if (chipAgeDays == null || chipAgeDays <= 7) return "primeiros_dias";
  if (chipAgeDays <= 21) return "aquecimento";
  return "maduro";
}

function exposureMode(passiveShare: number): ExposureMode {
  return passiveShare >= 50 ? "exposicao_passiva" : "exposicao_ativa";
}

function riskBucket(riskScore: number): RiskBucket {
  if (riskScore < 35) return "baixo_risco";
  if (riskScore < 65) return "medio_risco";
  return "alto_risco";
}

function cohortTitle(params: {
  ageBucket: AgeBucket;
  exposureMode: ExposureMode;
  riskBucket: RiskBucket;
}) {
  const age =
    params.ageBucket === "primeiros_dias"
      ? "chips nos primeiros dias"
      : params.ageBucket === "aquecimento"
        ? "chips em aquecimento"
        : "chips maduros";
  const exposure =
    params.exposureMode === "exposicao_passiva" ? "com exposição passiva dominante" : "com exposição ativa dominante";
  const risk =
    params.riskBucket === "baixo_risco"
      ? "e risco baixo"
      : params.riskBucket === "medio_risco"
        ? "e risco moderado"
        : "e risco alto";
  return `${age} ${exposure} ${risk}`;
}

export function buildFleetLearningProjection(params: {
  chipId: number;
  chipName?: string | null;
  chipStatus?: string | null;
  chipCreatedAt?: Date | string | null;
  observability: BehaviorObservabilitySnapshot;
  validation: BehaviorValidationSnapshot;
  longitudinal: BehaviorLongitudinalSnapshot;
  adaptiveIntelligence: AdaptiveLearningSnapshot;
}): FleetLearningProjection {
  const context = params.longitudinal.experienceJournalCandidate.context;
  const createdAt = params.chipCreatedAt ? new Date(params.chipCreatedAt) : null;
  const fallbackChipAgeDays =
    createdAt && !Number.isNaN(createdAt.getTime())
      ? Math.max(0, Math.round((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24)))
      : null;
  const chipAgeDays = context.chipAgeDays ?? fallbackChipAgeDays;
  const hypothesisSuccess = params.adaptiveIntelligence.hypotheses.map((item) => item.successRate);
  const knowledgeSuccess = params.adaptiveIntelligence.knowledge.map((item) => item.successRate);
  const successRate = round(
    mean([
      ...knowledgeSuccess,
      ...hypothesisSuccess,
      params.validation.groundTruth.healthyRate ?? 50,
    ])
  );
  const contradictionRate = round(
    mean(
      params.adaptiveIntelligence.hypotheses.length
        ? params.adaptiveIntelligence.hypotheses.map((item) => item.contradictionRate)
        : [100 - successRate]
    )
  );
  const riskScore = round(params.validation.riskBudget.spent);
  const credibilityScore = round(params.longitudinal.experienceJournalCandidate.credibilityAfter);
  const passiveShare = round(params.longitudinal.naturalActivityModel.passiveShare);
  const activeShare = round(params.longitudinal.naturalActivityModel.activeShare);

  return {
    chipId: params.chipId,
    chipName: params.chipName ?? `chip-${params.chipId}`,
    chipStatus: params.chipStatus ?? "unknown",
    chipAgeDays,
    ageBucket: ageBucket(chipAgeDays),
    exposureMode: exposureMode(passiveShare),
    riskBucket: riskBucket(riskScore),
    relationshipCount: params.longitudinal.relationshipMemory.length,
    trustLevel: round(context.trustLevel),
    successRate: clamp(successRate, 0, 100),
    contradictionRate: clamp(contradictionRate, 0, 100),
    credibilityScore: clamp(credibilityScore, 0, 100),
    riskScore: clamp(riskScore, 0, 100),
    activeKnowledge: params.adaptiveIntelligence.knowledge.filter((item) => item.status === "active").length,
    decayingKnowledge: params.adaptiveIntelligence.knowledge.filter((item) => item.status === "decaying").length,
    socialExposure: round(context.socialExposure),
    diversity: round(context.diversity),
    predictability: round(context.predictability),
    passiveShare,
    activeShare,
    dominantMood: params.longitudinal.cognitive.moodEstimation.mood,
    timeBucket: context.timeBucket,
  };
}

function buildCohorts(projections: FleetLearningProjection[]): FleetLearningCohort[] {
  const grouped = new Map<string, FleetLearningProjection[]>();
  for (const projection of projections) {
    const key = `${projection.ageBucket}:${projection.exposureMode}:${projection.riskBucket}`;
    grouped.set(key, [...(grouped.get(key) ?? []), projection]);
  }

  return Array.from(grouped.entries())
    .map(([cohortKey, members]) => {
      const [age, exposure, risk] = cohortKey.split(":") as [AgeBucket, ExposureMode, RiskBucket];
      const averageSuccessRate = round(mean(members.map((item) => item.successRate)));
      const averageRiskScore = round(mean(members.map((item) => item.riskScore)));
      const averageCredibilityScore = round(mean(members.map((item) => item.credibilityScore)));
      const averageTrustLevel = round(mean(members.map((item) => item.trustLevel)));
      const averageDiversity = round(mean(members.map((item) => item.diversity)));
      const status: FleetCohortStatus =
        averageSuccessRate >= 72 && averageRiskScore <= 35
          ? "elite"
          : averageRiskScore >= 68 || averageSuccessRate < 45
            ? "critical"
            : averageSuccessRate >= 58
              ? "stable"
              : "emerging";

      return {
        cohortKey,
        title: cohortTitle({
          ageBucket: age,
          exposureMode: exposure,
          riskBucket: risk,
        }),
        status,
        chipIds: members.map((item) => item.chipId),
        chipCount: members.length,
        averageSuccessRate,
        averageRiskScore,
        averageCredibilityScore,
        averageTrustLevel,
        averageDiversity,
        ageBucket: age,
        exposureMode: exposure,
        riskBucket: risk,
      };
    })
    .sort((a, b) => (b.averageSuccessRate === a.averageSuccessRate ? a.averageRiskScore - b.averageRiskScore : b.averageSuccessRate - a.averageSuccessRate));
}

function patternConfidence(cohort: FleetLearningCohort) {
  return clamp(
    round(cohort.averageSuccessRate * 0.45 + (100 - cohort.averageRiskScore) * 0.25 + Math.min(25, cohort.chipCount * 8) + cohort.averageTrustLevel * 0.1),
    0,
    100
  );
}

function buildPatterns(cohorts: FleetLearningCohort[]): FleetLearningPattern[] {
  const patterns: FleetLearningPattern[] = [];

  for (const cohort of cohorts) {
    const confidence = patternConfidence(cohort);
    const sampleSize = cohort.chipCount;

    if (cohort.ageBucket === "primeiros_dias" && cohort.exposureMode === "exposicao_passiva" && cohort.averageSuccessRate >= 60) {
      patterns.push({
        patternKey: `${cohort.cohortKey}:passive_early_maturation`,
        cohortKey: cohort.cohortKey,
        title: "contas nos primeiros dias amadurecem melhor com exposição passiva",
        status: confidence >= 80 && sampleSize >= 3 ? "active" : confidence >= 70 ? "promoted" : "candidate",
        confidence,
        sampleSize,
        successRate: cohort.averageSuccessRate,
        riskScore: cohort.averageRiskScore,
        recommendationType: "maintain_passive_exposure",
        rationale: "a frota mostra melhor taxa de maturação quando o começo privilegia presença leve em vez de pressão ativa",
        evidence: [
          `${sampleSize} chips sustentam este comportamento`,
          `sucesso médio ${cohort.averageSuccessRate}%`,
          `risco médio ${cohort.averageRiskScore}%`,
        ],
      });
    }

    if (cohort.averageRiskScore >= 55) {
      patterns.push({
        patternKey: `${cohort.cohortKey}:risk_pressure_penalty`,
        cohortKey: cohort.cohortKey,
        title: "coortes sob maior pressão operacional pedem redução de previsibilidade",
        status: confidence >= 78 && sampleSize >= 3 ? "active" : "candidate",
        confidence: clamp(confidence - 4, 0, 100),
        sampleSize,
        successRate: cohort.averageSuccessRate,
        riskScore: cohort.averageRiskScore,
        recommendationType: "reduce_predictability",
        rationale: "quando o risco agregado sobe, a previsibilidade excessiva tende a degradar a maturação da frota",
        evidence: [
          `coorte classificada como ${cohort.status}`,
          `risco médio ${cohort.averageRiskScore}%`,
          `credibilidade média ${cohort.averageCredibilityScore}%`,
        ],
      });
    }

    if (cohort.averageDiversity >= 60 && cohort.averageSuccessRate >= 65) {
      patterns.push({
        patternKey: `${cohort.cohortKey}:diversity_supports_growth`,
        cohortKey: cohort.cohortKey,
        title: "diversidade comportamental acompanha melhor crescimento de credibilidade",
        status: confidence >= 76 && sampleSize >= 3 ? "promoted" : "candidate",
        confidence: clamp(confidence - 2, 0, 100),
        sampleSize,
        successRate: cohort.averageSuccessRate,
        riskScore: cohort.averageRiskScore,
        recommendationType: "increase_signal_diversity",
        rationale: "coortes com sinais mais diversos sustentam crescimento sem elevar o risco na mesma proporção",
        evidence: [
          `diversidade média ${cohort.averageDiversity}%`,
          `sucesso médio ${cohort.averageSuccessRate}%`,
        ],
      });
    }
  }

  return patterns.sort((a, b) => (b.confidence === a.confidence ? b.successRate - a.successRate : b.confidence - a.confidence));
}

function buildRecommendations(params: {
  current: FleetLearningProjection | null;
  cohorts: FleetLearningCohort[];
  patterns: FleetLearningPattern[];
}): FleetLearningRecommendation[] {
  if (!params.current) return [];
  const current = params.current;

  const exactCohortKey = `${current.ageBucket}:${current.exposureMode}:${current.riskBucket}`;
  const sameCohortPatterns = params.patterns.filter((item) => item.cohortKey === exactCohortKey);
  const fallbackPatterns =
    sameCohortPatterns.length > 0
      ? sameCohortPatterns
      : params.patterns.filter((item) => item.cohortKey.startsWith(`${current.ageBucket}:`));

  return fallbackPatterns.slice(0, 3).map((pattern) => ({
    patternKey: pattern.patternKey,
    cohortKey: pattern.cohortKey,
    label:
      pattern.recommendationType === "maintain_passive_exposure"
        ? "manter exposição passiva inicial"
        : pattern.recommendationType === "reduce_predictability"
          ? "reduzir previsibilidade operacional"
          : pattern.recommendationType === "increase_signal_diversity"
            ? "aumentar diversidade de sinais"
            : pattern.title,
    confidence: pattern.confidence,
    expectedSuccessRate: pattern.successRate,
    expectedRiskScore: pattern.riskScore,
    rationale: pattern.rationale,
  }));
}

function buildPromotions(patterns: FleetLearningPattern[]): FleetKnowledgePromotion[] {
  return patterns
    .filter((pattern) => pattern.status === "promoted" || pattern.status === "active")
    .map((pattern) => ({
      promotionKey: `promotion:${pattern.patternKey}`,
      sourcePatternKey: pattern.patternKey,
      targetKnowledgeKey: `fleet:${pattern.patternKey}`,
      action: pattern.status === "active" ? "promote" : "revalidate",
      confidence: pattern.confidence,
      rationale: `${pattern.title} atingiu confiança ${pattern.confidence}% com amostra ${pattern.sampleSize}`,
    }));
}

function buildRiskAnalytics(projections: FleetLearningProjection[], cohorts: FleetLearningCohort[]): FleetRiskAnalytics {
  return {
    averageRiskScore: round(mean(projections.map((item) => item.riskScore))),
    highRiskChips: projections.filter((item) => item.riskBucket === "alto_risco").length,
    criticalCohorts: cohorts.filter((item) => item.status === "critical").length,
    failureRate: round(mean(projections.map((item) => item.contradictionRate))),
  };
}

function buildOpportunityAnalytics(cohorts: FleetLearningCohort[]): FleetOpportunityAnalytics {
  const passiveCohorts = cohorts.filter((item) => item.exposureMode === "exposicao_passiva");
  const activeCohorts = cohorts.filter((item) => item.exposureMode === "exposicao_ativa");
  return {
    averageSuccessRate: round(mean(cohorts.map((item) => item.averageSuccessRate))),
    passiveExposureAdvantage: round(mean(passiveCohorts.map((item) => item.averageSuccessRate)) - mean(activeCohorts.map((item) => item.averageSuccessRate))),
    bestCohorts: cohorts.slice(0, 3).map((item) => item.cohortKey),
  };
}

function buildBenchmark(params: {
  currentChipId: number;
  projections: FleetLearningProjection[];
  cohorts: FleetLearningCohort[];
}): FleetBenchmarkDashboard {
  const ranking = [...params.projections].sort((a, b) => {
    const leftScore = a.successRate - a.riskScore * 0.35 + a.credibilityScore * 0.2;
    const rightScore = b.successRate - b.riskScore * 0.35 + b.credibilityScore * 0.2;
    return rightScore - leftScore;
  });
  const currentIndex = ranking.findIndex((item) => item.chipId === params.currentChipId);
  const bestCohort = params.cohorts[0] ?? null;

  return {
    totalChips: params.projections.length,
    cohortCount: params.cohorts.length,
    bestCohortKey: bestCohort?.cohortKey ?? null,
    topSuccessRate: bestCohort?.averageSuccessRate ?? 0,
    currentChipRank: currentIndex >= 0 ? currentIndex + 1 : null,
    currentChipPercentile:
      currentIndex >= 0 && ranking.length > 0
        ? round(((ranking.length - currentIndex) / ranking.length) * 100)
        : null,
  };
}

export function buildFleetLearningSnapshot(params: {
  currentChipId: number;
  projections: FleetLearningProjection[];
  now: Date;
}): FleetLearningSnapshot {
  const uniqueByChip = new Map<number, FleetLearningProjection>();
  for (const projection of params.projections) {
    uniqueByChip.set(projection.chipId, projection);
  }
  const projections = Array.from(uniqueByChip.values());
  const cohorts = buildCohorts(projections);
  const patterns = buildPatterns(cohorts);
  const current = projections.find((item) => item.chipId === params.currentChipId) ?? null;
  const recommendations = buildRecommendations({
    current,
    cohorts,
    patterns,
  });
  const promotions = buildPromotions(patterns);

  return {
    projections,
    cohorts,
    patterns,
    recommendations,
    promotions,
    riskAnalytics: buildRiskAnalytics(projections, cohorts),
    opportunityAnalytics: buildOpportunityAnalytics(cohorts),
    benchmark: buildBenchmark({
      currentChipId: params.currentChipId,
      projections,
      cohorts,
    }),
  };
}
