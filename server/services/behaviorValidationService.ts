import type {
  BehaviorMemoryEvidenceCoverage,
  BehaviorMemoryHealthScore,
  BehaviorMemoryPipelineCounters,
  IdentitySnapshot,
} from "./behaviorMemoryService";
import type { BehaviorEpisode } from "./episodeBuilderService";
import type { RawBehaviorEvent } from "./evidenceNormalizerService";
import type { AntiPatternReport, BehaviorObservabilitySnapshot } from "./behaviorObservabilityService";

type OutcomeState = "unknown" | "healthy" | "warning" | "restriction" | "ban";
type HumanLikeOutcome = "unknown" | "human_like" | "not_human_like" | "uncertain";
type DecisionState = "ACT_NOW" | "WAIT" | "DO_NOTHING";
type CalibrationStatus = "unknown" | "insufficient_evidence" | "calibrated" | "optimistic" | "conservative";
type KnownState = "KNOWN" | "UNKNOWN";

export type BehaviorOutcomeRecord = {
  chipId: number;
  observationWindowStart: Date | string;
  observationWindowEnd: Date | string;
  predictedRisk: number;
  predictedCredibility: number;
  actualOutcome: OutcomeState;
  restrictionOccurred: boolean;
  warningOccurred: boolean;
  banOccurred: boolean;
  humanLikeOutcome: HumanLikeOutcome;
  validatedAt?: Date | string | null;
  payload?: {
    componentConfidences?: Partial<Record<"normalizer" | "catalog" | "episode" | "identity" | "planner", number>>;
    observedPatterns?: string[];
    [key: string]: unknown;
  } | null;
};

export type BehaviorOpportunityObservationRecord = {
  opportunityId: string;
  observedAt: Date | string;
  reason: string;
  riskAtDecision: number;
  confidence: number;
  expectedGain: number;
  expectedRisk: number;
  decision: DecisionState;
  observedResultAfter24h?: string | null;
  observedResultAfter72h?: string | null;
  observedResultAfter7d?: string | null;
  payload?: Record<string, unknown> | null;
};

export type BehaviorGroundTruthSummary = {
  sampleSize: number;
  restrictions: number;
  warnings: number;
  bans: number;
  healthyRate: number | null;
  humanLikeRate: number | null;
  lastValidatedAt: string | null;
};

export type BehaviorEvidenceGap = {
  coverage: number;
  reasons: string[];
  missingSignals: string[];
  summary: string;
  smallWindow: boolean;
};

export type ComponentCalibration = {
  component: "normalizer" | "catalog" | "episode" | "identity" | "planner";
  status: CalibrationStatus;
  sampleSize: number;
  predictedConfidenceAvg: number | null;
  actualSuccessRate: number | null;
  error: number | null;
};

export type BehaviorConfidenceCalibration = {
  components: ComponentCalibration[];
};

export type UnknownStateAssessment = {
  state: KnownState;
  confidence: number | null;
  threshold: number;
  reason: string;
};

export type AntiPatternLearningStats = {
  pattern: string;
  observedOccurrences: number;
  restrictionCorrelation: number | null;
  banCorrelation: number | null;
  falsePositiveRate: number | null;
};

export type PipelineDriftSnapshot = {
  changed: boolean;
  normalizerDelta: number;
  catalogDelta: number;
  episodeDelta: number;
  confidenceDelta: number;
  identityDelta: number;
  plannerWouldChange: KnownState;
  summary: string;
};

export type DecisionDebtSnapshot = {
  score: number;
  ignoredOpportunities: number;
  unresolvedWindows: number;
  highValueIgnored: number;
  status: "low" | "attention" | "high";
};

export type ObservationalBudget = {
  total: number;
  spent: number;
  remaining: number;
  status: "healthy" | "attention" | "depleted";
  rationale: string[];
};

export type BehaviorValidationSnapshot = {
  groundTruth: BehaviorGroundTruthSummary;
  evidenceGap: BehaviorEvidenceGap;
  unknownState: UnknownStateAssessment;
  confidenceCalibration: BehaviorConfidenceCalibration;
  antiPatternLearning: AntiPatternLearningStats[];
  pipelineDrift: PipelineDriftSnapshot;
  decisionDebt: DecisionDebtSnapshot;
  riskBudget: ObservationalBudget;
  credibilityBudget: ObservationalBudget;
};

type HistorySnapshotLike = {
  windowStart?: Date | string | null;
  windowEnd?: Date | string | null;
  payload?: {
    averageConfidence?: number | null;
    pipelineCounters?: BehaviorMemoryPipelineCounters | null;
    pipelineHealth?: BehaviorMemoryHealthScore | null;
    evidenceCoverage?: BehaviorMemoryEvidenceCoverage | null;
    identitySnapshot?: IdentitySnapshot | null;
    extra?: {
      observability?: BehaviorObservabilitySnapshot | null;
    } | null;
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

export function buildGroundTruthSummary(outcomes: BehaviorOutcomeRecord[]): BehaviorGroundTruthSummary {
  const validated = outcomes.filter((item) => item.validatedAt);
  const healthyCount = outcomes.filter((item) => item.actualOutcome === "healthy").length;
  const humanLikeCount = outcomes.filter((item) => item.humanLikeOutcome === "human_like").length;
  const lastValidatedAt = validated
    .map((item) => toDate(item.validatedAt))
    .filter((item): item is Date => Boolean(item))
    .sort((left, right) => right.getTime() - left.getTime())[0];

  return {
    sampleSize: outcomes.length,
    restrictions: outcomes.filter((item) => item.restrictionOccurred).length,
    warnings: outcomes.filter((item) => item.warningOccurred).length,
    bans: outcomes.filter((item) => item.banOccurred).length,
    healthyRate: outcomes.length ? round((healthyCount / outcomes.length) * 100) : null,
    humanLikeRate: outcomes.length ? round((humanLikeCount / outcomes.length) * 100) : null,
    lastValidatedAt: lastValidatedAt ? lastValidatedAt.toISOString() : null,
  };
}

export function buildEvidenceGap(params: {
  coverage: BehaviorMemoryEvidenceCoverage;
  rawEvents: RawBehaviorEvent[];
  episodes: BehaviorEpisode[];
  windowStart: Date;
  windowEnd: Date;
}): BehaviorEvidenceGap {
  const reasons: string[] = [];
  const durationHours = Math.max(0, (params.windowEnd.getTime() - params.windowStart.getTime()) / (1000 * 60 * 60));
  const distinctConversations = new Set(
    params.rawEvents.map((event) => event.remoteJid ?? event.groupJid).filter(Boolean)
  ).size;

  if (!params.rawEvents.some((event) => event.groupJid)) reasons.push("nunca entrou em grupo");
  if (!params.rawEvents.some((event) => event.eventType.toLowerCase().includes("status"))) reasons.push("nunca publicou ou consumiu status");
  if (distinctConversations < 2) reasons.push("poucas conversas");
  if (params.episodes.length < 3) reasons.push("histórico ainda curto");
  if (durationHours < 12) reasons.push("janela pequena");

  return {
    coverage: params.coverage.evidenceCoverage,
    reasons,
    missingSignals: params.coverage.missingSignals,
    summary:
      reasons.length > 0
        ? `faltam evidências porque ${reasons.join(", ")}`
        : "a cobertura atual não mostra lacuna evidente",
    smallWindow: durationHours < 12,
  };
}

export function buildUnknownState(params: {
  confidence: number | null;
  evidenceGap: BehaviorEvidenceGap;
  sampleSize: number;
  threshold?: number;
}): UnknownStateAssessment {
  const threshold = params.threshold ?? 0.5;
  if (params.confidence == null) {
    return { state: "UNKNOWN", confidence: null, threshold, reason: "não há confiança calculada" };
  }
  if (params.confidence < threshold) {
    return { state: "UNKNOWN", confidence: params.confidence, threshold, reason: "confiança abaixo do limiar mínimo" };
  }
  if (params.sampleSize < 3) {
    return { state: "UNKNOWN", confidence: params.confidence, threshold, reason: "amostra pequena demais" };
  }
  if (params.evidenceGap.reasons.length >= 2) {
    return { state: "UNKNOWN", confidence: params.confidence, threshold, reason: "há lacuna relevante de evidência" };
  }
  return { state: "KNOWN", confidence: params.confidence, threshold, reason: "há evidência mínima para leitura observacional" };
}

function calibrationStatus(error: number | null, sampleSize: number): CalibrationStatus {
  if (sampleSize === 0) return "unknown";
  if (sampleSize < 3) return "insufficient_evidence";
  if (error == null) return "unknown";
  if (Math.abs(error) <= 10) return "calibrated";
  return error > 10 ? "optimistic" : "conservative";
}

export function buildConfidenceCalibration(params: {
  outcomes: BehaviorOutcomeRecord[];
  current: {
    averageConfidence: number;
    identityConfidence: number;
    episodeConfidence: number;
  };
}): BehaviorConfidenceCalibration {
  const successRate = params.outcomes.length
    ? round((params.outcomes.filter(favorableOutcome).length / params.outcomes.length) * 100)
    : null;

  const buildComponent = (
    component: ComponentCalibration["component"],
    predictedConfidenceAvg: number | null,
    componentOutcomes?: number[]
  ): ComponentCalibration => {
    const sampleSize = componentOutcomes?.length ?? params.outcomes.length;
    const predicted = componentOutcomes?.length ? round(mean(componentOutcomes) * 100) : predictedConfidenceAvg;
    const error = predicted != null && successRate != null ? round(predicted - successRate) : null;
    return {
      component,
      status: calibrationStatus(error, sampleSize),
      sampleSize,
      predictedConfidenceAvg: predicted,
      actualSuccessRate: successRate,
      error,
    };
  };

  const valuesByComponent = {
    normalizer: params.outcomes
      .map((item) => item.payload?.componentConfidences?.normalizer)
      .filter((item): item is number => typeof item === "number"),
    catalog: params.outcomes
      .map((item) => item.payload?.componentConfidences?.catalog)
      .filter((item): item is number => typeof item === "number"),
    episode: params.outcomes
      .map((item) => item.payload?.componentConfidences?.episode)
      .filter((item): item is number => typeof item === "number"),
    identity: params.outcomes
      .map((item) => item.payload?.componentConfidences?.identity)
      .filter((item): item is number => typeof item === "number"),
    planner: params.outcomes
      .map((item) => item.payload?.componentConfidences?.planner)
      .filter((item): item is number => typeof item === "number"),
  };

  return {
    components: [
      buildComponent("normalizer", round(params.current.averageConfidence * 100), valuesByComponent.normalizer),
      buildComponent("catalog", round(params.current.averageConfidence * 100), valuesByComponent.catalog),
      buildComponent("episode", round(params.current.episodeConfidence * 100), valuesByComponent.episode),
      buildComponent("identity", round(params.current.identityConfidence * 100), valuesByComponent.identity),
      buildComponent("planner", null, valuesByComponent.planner),
    ],
  };
}

export function buildAntiPatternLearning(params: {
  report: AntiPatternReport;
  history: HistorySnapshotLike[];
  outcomes: BehaviorOutcomeRecord[];
}): AntiPatternLearningStats[] {
  return params.report.findings.map((finding) => {
    const observedOccurrences = params.history.filter((snapshot) =>
      snapshot.payload?.extra?.observability?.antiPatterns?.findings?.some((item) => item.pattern === finding.pattern)
    ).length;
    const taggedOutcomes = params.outcomes.filter((outcome) => outcome.payload?.observedPatterns?.includes(finding.pattern));
    const restrictionCorrelation = taggedOutcomes.length
      ? round((taggedOutcomes.filter((item) => item.restrictionOccurred).length / taggedOutcomes.length) * 100)
      : null;
    const banCorrelation = taggedOutcomes.length
      ? round((taggedOutcomes.filter((item) => item.banOccurred).length / taggedOutcomes.length) * 100)
      : null;
    const falsePositiveRate = taggedOutcomes.length
      ? round((taggedOutcomes.filter((item) => favorableOutcome(item)).length / taggedOutcomes.length) * 100)
      : null;

    return {
      pattern: finding.pattern,
      observedOccurrences,
      restrictionCorrelation,
      banCorrelation,
      falsePositiveRate,
    };
  });
}

export function buildPipelineDrift(params: {
  previousSnapshot?: HistorySnapshotLike | null;
  current: {
    averageConfidence: number;
    pipelineCounters: BehaviorMemoryPipelineCounters;
    identitySnapshot: IdentitySnapshot;
  };
}): PipelineDriftSnapshot {
  const previous = params.previousSnapshot?.payload;
  const previousCounters = previous?.pipelineCounters;
  const previousIdentity = previous?.identitySnapshot;
  const normalizerDelta = (params.current.pipelineCounters.normalizedEvents ?? 0) - (previousCounters?.normalizedEvents ?? 0);
  const catalogDelta = (params.current.pipelineCounters.catalogedEvents ?? 0) - (previousCounters?.catalogedEvents ?? 0);
  const episodeDelta = (params.current.pipelineCounters.episodes ?? 0) - (previousCounters?.episodes ?? 0);
  const confidenceDelta = round(params.current.averageConfidence - (previous?.averageConfidence ?? params.current.averageConfidence), 4);
  const identityDelta = round(
    params.current.identitySnapshot.confidence - (previousIdentity?.confidence ?? params.current.identitySnapshot.confidence),
    4
  );
  const changed = normalizerDelta !== 0 || catalogDelta !== 0 || episodeDelta !== 0 || confidenceDelta !== 0 || identityDelta !== 0;

  return {
    changed,
    normalizerDelta,
    catalogDelta,
    episodeDelta,
    confidenceDelta,
    identityDelta,
    plannerWouldChange: "UNKNOWN",
    summary: changed
      ? "o pipeline mudou de saída entre snapshots consecutivos"
      : "não houve drift observável na saída do pipeline",
  };
}

export function buildDecisionDebt(observations: BehaviorOpportunityObservationRecord[]): DecisionDebtSnapshot {
  const ignored = observations.filter((item) => item.decision === "DO_NOTHING");
  const unresolved = ignored.filter((item) => !item.observedResultAfter24h && !item.observedResultAfter72h && !item.observedResultAfter7d);
  const highValueIgnored = ignored.filter((item) => item.expectedGain >= 70).length;
  const score = clamp(
    round(ignored.length * 8 + unresolved.length * 10 + highValueIgnored * 12),
    0,
    100
  );

  return {
    score,
    ignoredOpportunities: ignored.length,
    unresolvedWindows: unresolved.length,
    highValueIgnored,
    status: score >= 70 ? "high" : score >= 40 ? "attention" : "low",
  };
}

export function buildRiskBudget(params: {
  observability: BehaviorObservabilitySnapshot;
  outgoingActions: number;
}): ObservationalBudget {
  const antiPatternSpend = params.observability.antiPatterns.summary.overallRisk * 45;
  const predictabilitySpend = (100 - params.observability.behaviorVariance.score) * 0.25;
  const actionSpend = Math.min(20, params.outgoingActions * 2);
  const spent = round(clamp(antiPatternSpend + predictabilitySpend + actionSpend, 0, 100));
  return {
    total: 100,
    spent,
    remaining: round(100 - spent),
    status: spent >= 85 ? "depleted" : spent >= 60 ? "attention" : "healthy",
    rationale: [
      `anti-pattern risk consumiu ${round(antiPatternSpend)}`,
      `previsibilidade consumiu ${round(predictabilitySpend)}`,
      `volume outbound consumiu ${round(actionSpend)}`,
    ],
  };
}

export function buildCredibilityBudget(params: {
  credibilityScore: number;
  observability: BehaviorObservabilitySnapshot;
  groundTruth: BehaviorGroundTruthSummary;
}): ObservationalBudget {
  const earned = params.credibilityScore * 0.5 + (params.groundTruth.healthyRate ?? 50) * 0.3 + params.observability.personaDiversity.score * 0.2;
  const remaining = round(clamp(earned, 0, 100));
  return {
    total: 100,
    spent: round(100 - remaining),
    remaining,
    status: remaining <= 20 ? "depleted" : remaining <= 45 ? "attention" : "healthy",
    rationale: [
      `credibilidade corrente contribuiu ${round(params.credibilityScore * 0.5)}`,
      `ground truth saudável contribuiu ${round((params.groundTruth.healthyRate ?? 50) * 0.3)}`,
      `diversidade contribuiu ${round(params.observability.personaDiversity.score * 0.2)}`,
    ],
  };
}

export function buildBehaviorValidationSnapshot(params: {
  rawEvents: RawBehaviorEvent[];
  episodes: BehaviorEpisode[];
  observability: BehaviorObservabilitySnapshot;
  outcomes: BehaviorOutcomeRecord[];
  opportunityObservations: BehaviorOpportunityObservationRecord[];
  history: HistorySnapshotLike[];
  current: {
    windowStart: Date;
    windowEnd: Date;
    averageConfidence: number;
    episodeConfidence: number;
    evidenceCoverage: BehaviorMemoryEvidenceCoverage;
    pipelineCounters: BehaviorMemoryPipelineCounters;
    identitySnapshot: IdentitySnapshot;
    credibilityScore: number;
  };
}): BehaviorValidationSnapshot {
  const groundTruth = buildGroundTruthSummary(params.outcomes);
  const evidenceGap = buildEvidenceGap({
    coverage: params.current.evidenceCoverage,
    rawEvents: params.rawEvents,
    episodes: params.episodes,
    windowStart: params.current.windowStart,
    windowEnd: params.current.windowEnd,
  });
  const unknownState = buildUnknownState({
    confidence: params.current.averageConfidence,
    evidenceGap,
    sampleSize: params.episodes.length,
  });
  const confidenceCalibration = buildConfidenceCalibration({
    outcomes: params.outcomes,
    current: {
      averageConfidence: params.current.averageConfidence,
      identityConfidence: params.current.identitySnapshot.confidence,
      episodeConfidence: params.current.episodeConfidence,
    },
  });
  const antiPatternLearning = buildAntiPatternLearning({
    report: params.observability.antiPatterns,
    history: params.history,
    outcomes: params.outcomes,
  });
  const previousSnapshot = params.history
    .filter((item) => toDate(item.windowEnd))
    .sort((left, right) => (toDate(right.windowEnd)?.getTime() ?? 0) - (toDate(left.windowEnd)?.getTime() ?? 0))[0];
  const pipelineDrift = buildPipelineDrift({
    previousSnapshot,
    current: {
      averageConfidence: params.current.averageConfidence,
      pipelineCounters: params.current.pipelineCounters,
      identitySnapshot: params.current.identitySnapshot,
    },
  });
  const decisionDebt = buildDecisionDebt(params.opportunityObservations);
  const outgoingActions = params.rawEvents.filter((item) => item.direction === "outbound").length;
  const riskBudget = buildRiskBudget({
    observability: params.observability,
    outgoingActions,
  });
  const credibilityBudget = buildCredibilityBudget({
    credibilityScore: params.current.credibilityScore,
    observability: params.observability,
    groundTruth,
  });

  return {
    groundTruth,
    evidenceGap,
    unknownState,
    confidenceCalibration,
    antiPatternLearning,
    pipelineDrift,
    decisionDebt,
    riskBudget,
    credibilityBudget,
  };
}
