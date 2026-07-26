import type { IdentitySnapshot } from "./behaviorMemoryService";
import type { BehaviorEpisode } from "./episodeBuilderService";
import type { RawBehaviorEvent } from "./evidenceNormalizerService";
import type { BehaviorObservabilitySnapshot } from "./behaviorObservabilityService";
import type {
  BehaviorOpportunityObservationRecord,
  BehaviorValidationSnapshot,
} from "./behaviorValidationService";

type RelationshipMemoryLike = {
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
};

export type SocialCircleClassification = {
  label: "familia" | "amigos" | "trabalho" | "grupos" | "fornecedores" | "clientes" | "desconhecidos";
  confidence: number;
  members: string[];
};

export type RelationshipEvolutionSignal = {
  counterpartKey: string;
  evolution: "growing" | "cooling" | "reappeared" | "frequent" | "stable" | "unknown";
  trustDelta: number | null;
  riskDelta: number | null;
  stageBefore: string | null;
  stageAfter: string;
};

export type RelationshipSaturationSignal = {
  counterpartKey: string;
  saturationScore: number;
  status: "healthy" | "attention" | "overexposed";
  reason: string;
};

export type ReciprocitySnapshot = {
  overallScore: number;
  relationships: Array<{
    counterpartKey: string;
    reciprocityScore: number;
    initiatorBalance: number;
  }>;
};

export type AffinityGraphSnapshot = {
  nodes: Array<{
    id: string;
    type: "contact" | "group";
    weight: number;
  }>;
  edges: Array<{
    source: string;
    target: string;
    weight: number;
    reason: string;
  }>;
};

export type SilenceWindowInsight = {
  startAt: string;
  endAt: string;
  durationHours: number;
  classification: "beneficial" | "neutral" | "risky" | "unknown";
  reason: string;
};

export type SilenceIntelligenceSnapshot = {
  windows: SilenceWindowInsight[];
  beneficialCount: number;
  riskyCount: number;
  unknownCount: number;
  summary: string;
};

export type PatienceModelSnapshot = {
  globalRecommendedWaitHours: number | null;
  byRelationship: Array<{
    counterpartKey: string;
    recommendedWaitHours: number | null;
  }>;
};

export type OpportunityAgingSnapshot = {
  entries: Array<{
    opportunityId: string;
    ttlClass: "immediate" | "short" | "medium" | "long" | "unknown";
    observedWindow: "24h" | "72h" | "7d" | "unknown";
  }>;
  summary: {
    immediate: number;
    short: number;
    medium: number;
    long: number;
    unknown: number;
  };
};

export type MomentumSnapshot = {
  overall: "cold" | "warm" | "hot";
  hotRelationships: string[];
  score: number;
};

export type DailyContextSnapshot = {
  weekday: string;
  isWeekend: boolean;
  isBusinessHours: boolean;
  timeBucket: string;
  holidayState: "unknown";
};

export type RoutineDetectorSnapshot = {
  dominantHours: number[];
  byRelationship: Array<{
    counterpartKey: string;
    dominantHours: number[];
    regularityScore: number;
  }>;
};

export type MoodEstimationSnapshot = {
  mood: "active" | "passive" | "busy" | "silent" | "recovering";
  confidence: number;
  reason: string;
};

export type LifePhaseSnapshot = {
  phase: "reactivated" | "stabilizing" | "expanding" | "cooling" | "dormant" | "unknown";
  confidence: number;
  reason: string;
};

export type ExperienceReplaySnapshot = {
  analogousExperiences: number;
  waitBias: "wait_better" | "act_better" | "unknown";
  summary: string;
};

export type CounterfactualScenario = {
  label: "wait_24h" | "wait_72h" | "act_now" | "maintain_presence";
  expectedRiskDelta: number;
  expectedCredibilityDelta: number;
  confidence: number;
  reason: string;
};

export type CounterfactualSimulatorSnapshot = {
  scenarios: CounterfactualScenario[];
};

export type BehaviorCognitiveSnapshot = {
  socialCircleEngine: SocialCircleClassification[];
  relationshipEvolution: RelationshipEvolutionSignal[];
  relationshipSaturation: RelationshipSaturationSignal[];
  reciprocityScore: ReciprocitySnapshot;
  affinityGraph: AffinityGraphSnapshot;
  silenceIntelligence: SilenceIntelligenceSnapshot;
  patienceModel: PatienceModelSnapshot;
  opportunityAging: OpportunityAgingSnapshot;
  momentumDetector: MomentumSnapshot;
  dailyContext: DailyContextSnapshot;
  routineDetector: RoutineDetectorSnapshot;
  moodEstimation: MoodEstimationSnapshot;
  lifePhaseDetector: LifePhaseSnapshot;
  experienceReplay: ExperienceReplaySnapshot;
  counterfactualSimulator: CounterfactualSimulatorSnapshot;
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

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function toDate(value?: Date | string | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function hourBucket(date: Date) {
  const hour = date.getHours();
  if (hour < 6) return "madrugada";
  if (hour < 12) return "manha";
  if (hour < 18) return "tarde";
  return "noite";
}

function buildContactEventMap(rawEvents: RawBehaviorEvent[]) {
  const map = new Map<string, RawBehaviorEvent[]>();
  for (const event of rawEvents) {
    const key = String(event.remoteJid ?? event.groupJid ?? "__unknown__");
    const current = map.get(key) ?? [];
    current.push(event);
    map.set(key, current);
  }
  return map;
}

function classifySocialCircle(params: {
  relationship: RelationshipMemoryLike;
  events: RawBehaviorEvent[];
}): SocialCircleClassification["label"] {
  if (params.relationship.counterpartType === "group") return "grupos";
  const businessHourEvents = params.events.filter((event) => {
    const date = toDate(event.occurredAt);
    if (!date) return false;
    const hour = date.getHours();
    const weekday = date.getDay();
    return weekday >= 1 && weekday <= 5 && hour >= 8 && hour <= 18;
  }).length;
  const offHourEvents = params.events.length - businessHourEvents;
  const reciprocity = Math.min(params.relationship.inboundCount, params.relationship.outboundCount) / Math.max(1, Math.max(params.relationship.inboundCount, params.relationship.outboundCount));

  if (params.relationship.trustScore >= 75 && params.relationship.idealContactFrequencyHours <= 48 && offHourEvents >= businessHourEvents) {
    return "familia";
  }
  if (params.relationship.trustScore >= 55 && reciprocity >= 0.6 && offHourEvents >= businessHourEvents) {
    return "amigos";
  }
  if (businessHourEvents > offHourEvents && reciprocity >= 0.5) {
    return "trabalho";
  }
  if (businessHourEvents > offHourEvents && params.relationship.outboundCount > params.relationship.inboundCount) {
    return "clientes";
  }
  if (businessHourEvents > offHourEvents && params.relationship.inboundCount > params.relationship.outboundCount) {
    return "fornecedores";
  }
  return "desconhecidos";
}

function buildSocialCircleEngine(params: {
  relationshipMemory: RelationshipMemoryLike[];
  rawEvents: RawBehaviorEvent[];
}): SocialCircleClassification[] {
  const eventsByCounterpart = buildContactEventMap(params.rawEvents);
  const grouped = new Map<SocialCircleClassification["label"], string[]>();
  const confidenceByLabel = new Map<SocialCircleClassification["label"], number[]>();

  for (const relationship of params.relationshipMemory) {
    const events = eventsByCounterpart.get(relationship.counterpartKey) ?? [];
    const label = classifySocialCircle({ relationship, events });
    grouped.set(label, [...(grouped.get(label) ?? []), relationship.counterpartKey]);
    const confidence = label === "grupos"
      ? 0.95
      : label === "desconhecidos"
        ? 0.45
        : clamp((relationship.trustScore / 100) * 0.7 + (events.length > 0 ? 0.2 : 0), 0.3, 0.95);
    confidenceByLabel.set(label, [...(confidenceByLabel.get(label) ?? []), confidence]);
  }

  return Array.from(grouped.entries()).map(([label, members]) => ({
    label,
    members,
    confidence: round(mean(confidenceByLabel.get(label) ?? [0]), 2),
  }));
}

function buildRelationshipEvolution(params: {
  current: RelationshipMemoryLike[];
  previous?: RelationshipMemoryLike[];
}): RelationshipEvolutionSignal[] {
  const previousByKey = new Map((params.previous ?? []).map((item) => [item.counterpartKey, item]));

  return params.current.map((current) => {
    const previous = previousByKey.get(current.counterpartKey);
    if (!previous) {
      return {
        counterpartKey: current.counterpartKey,
        evolution: "unknown",
        trustDelta: null,
        riskDelta: null,
        stageBefore: null,
        stageAfter: current.stage,
      };
    }

    const trustDelta = current.trustScore - previous.trustScore;
    const riskDelta = current.relationshipRisk - previous.relationshipRisk;
    let evolution: RelationshipEvolutionSignal["evolution"] = "stable";
    if (previous.stage === "inactive" && current.stage !== "inactive") evolution = "reappeared";
    else if (current.stage === "recurring" && previous.stage !== "recurring") evolution = "frequent";
    else if (trustDelta >= 10) evolution = "growing";
    else if (trustDelta <= -10 || current.stage === "inactive") evolution = "cooling";

    return {
      counterpartKey: current.counterpartKey,
      evolution,
      trustDelta,
      riskDelta,
      stageBefore: previous.stage,
      stageAfter: current.stage,
    };
  });
}

function buildRelationshipSaturation(params: {
  relationshipMemory: RelationshipMemoryLike[];
  rawEvents: RawBehaviorEvent[];
}): RelationshipSaturationSignal[] {
  const eventsByCounterpart = buildContactEventMap(params.rawEvents);
  return params.relationshipMemory.map((relationship) => {
    const events = eventsByCounterpart.get(relationship.counterpartKey) ?? [];
    const first = toDate(relationship.firstInteractionAt);
    const last = toDate(relationship.lastInteractionAt);
    const daysSpan = first && last ? Math.max(1, (last.getTime() - first.getTime()) / (1000 * 60 * 60 * 24)) : 1;
    const appearanceRate = events.length / daysSpan;
    const imbalance = relationship.outboundCount / Math.max(1, relationship.inboundCount + 1);
    const score = clamp(round(appearanceRate * 18 + imbalance * 15 + (relationship.idealContactFrequencyHours < 18 ? 12 : 0)), 0, 100);
    const status = score >= 70 ? "overexposed" : score >= 40 ? "attention" : "healthy";
    return {
      counterpartKey: relationship.counterpartKey,
      saturationScore: score,
      status,
      reason:
        status === "overexposed"
          ? "a frequência e a assimetria da relação sugerem presença excessiva"
          : status === "attention"
            ? "há sinais de aparição acima do ideal para esta relação"
            : "a exposição por relação parece saudável",
    };
  });
}

function buildReciprocityScore(relationshipMemory: RelationshipMemoryLike[]): ReciprocitySnapshot {
  const relationships = relationshipMemory.map((item) => {
    const reciprocityScore = round((Math.min(item.inboundCount, item.outboundCount) / Math.max(1, Math.max(item.inboundCount, item.outboundCount))) * 100);
    const initiatorBalance = round(((item.inboundCount - item.outboundCount) / Math.max(1, item.inboundCount + item.outboundCount)) * 100);
    return {
      counterpartKey: item.counterpartKey,
      reciprocityScore,
      initiatorBalance,
    };
  });

  return {
    overallScore: round(mean(relationships.map((item) => item.reciprocityScore))),
    relationships,
  };
}

function dominantHour(events: RawBehaviorEvent[]) {
  const buckets = new Map<number, number>();
  for (const event of events) {
    const date = toDate(event.occurredAt);
    if (!date) continue;
    buckets.set(date.getHours(), (buckets.get(date.getHours()) ?? 0) + 1);
  }
  return Array.from(buckets.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function buildAffinityGraph(params: {
  relationshipMemory: RelationshipMemoryLike[];
  rawEvents: RawBehaviorEvent[];
}): AffinityGraphSnapshot {
  const eventsByCounterpart = buildContactEventMap(params.rawEvents);
  const nodes: AffinityGraphSnapshot["nodes"] = params.relationshipMemory.slice(0, 20).map((item) => ({
    id: item.counterpartKey,
    type: (item.counterpartType === "group" ? "group" : "contact") as "group" | "contact",
    weight: item.trustScore,
  }));

  const edges: AffinityGraphSnapshot["edges"] = [];
  for (let index = 0; index < nodes.length; index++) {
    for (let inner = index + 1; inner < nodes.length; inner++) {
      const left = nodes[index];
      const right = nodes[inner];
      const leftEvents = eventsByCounterpart.get(left.id) ?? [];
      const rightEvents = eventsByCounterpart.get(right.id) ?? [];
      const leftHour = dominantHour(leftEvents);
      const rightHour = dominantHour(rightEvents);
      const sameBucket = leftHour != null && rightHour != null && Math.abs(leftHour - rightHour) <= 1;
      const sharedDays = new Set(
        leftEvents.map((item) => toDate(item.occurredAt)?.toISOString().slice(0, 10)).filter(Boolean)
      );
      const coOccurrence = rightEvents.filter((item) => sharedDays.has(toDate(item.occurredAt)?.toISOString().slice(0, 10) ?? "")).length;
      const weight = clamp((sameBucket ? 35 : 0) + Math.min(65, coOccurrence * 10), 0, 100);
      if (weight >= 35) {
        edges.push({
          source: left.id,
          target: right.id,
          weight,
          reason: sameBucket ? "compartilham janela horária e coocorrência" : "coocorrência temporal",
        });
      }
    }
  }

  return { nodes, edges };
}

function buildSilenceWindows(rawEvents: RawBehaviorEvent[], validation: BehaviorValidationSnapshot): SilenceWindowInsight[] {
  const ordered = [...rawEvents]
    .filter((event) => event.occurredAt)
    .sort((a, b) => new Date(a.occurredAt!).getTime() - new Date(b.occurredAt!).getTime());
  const windows: SilenceWindowInsight[] = [];

  for (let index = 1; index < ordered.length; index++) {
    const previous = toDate(ordered[index - 1].occurredAt);
    const current = toDate(ordered[index].occurredAt);
    if (!previous || !current) continue;
    const durationHours = (current.getTime() - previous.getTime()) / (1000 * 60 * 60);
    if (durationHours < 6) continue;
    let classification: SilenceWindowInsight["classification"] = "neutral";
    let reason = "pausa normal entre eventos";
    if (durationHours >= 72) {
      classification = validation.evidenceGap.reasons.length > 1 ? "risky" : "unknown";
      reason = classification === "risky" ? "pausa longa em contexto com lacuna de evidência" : "pausa longa sem ground truth suficiente";
    } else if (ordered[index].direction === "inbound") {
      classification = "beneficial";
      reason = "o silêncio foi seguido por iniciativa externa";
    } else if (ordered[index - 1].direction === "outbound" && ordered[index].direction === "outbound") {
      classification = "risky";
      reason = "o silêncio não trouxe reciprocidade antes de nova ação";
    }
    windows.push({
      startAt: previous.toISOString(),
      endAt: current.toISOString(),
      durationHours: round(durationHours),
      classification,
      reason,
    });
  }

  return windows.slice(-20);
}

function buildSilenceIntelligence(rawEvents: RawBehaviorEvent[], validation: BehaviorValidationSnapshot): SilenceIntelligenceSnapshot {
  const windows = buildSilenceWindows(rawEvents, validation);
  const beneficialCount = windows.filter((item) => item.classification === "beneficial").length;
  const riskyCount = windows.filter((item) => item.classification === "risky").length;
  const unknownCount = windows.filter((item) => item.classification === "unknown").length;
  return {
    windows,
    beneficialCount,
    riskyCount,
    unknownCount,
    summary:
      beneficialCount > riskyCount
        ? "há sinais de que esperar pode preservar reciprocidade em parte dos casos"
        : riskyCount > beneficialCount
          ? "as pausas recentes parecem estar custando oportunidade ou continuidade"
          : "a inteligência de silêncio ainda precisa de mais histórico para separar benefício de custo",
  };
}

function buildPatienceModel(params: {
  rawEvents: RawBehaviorEvent[];
  relationshipMemory: RelationshipMemoryLike[];
  silenceIntelligence: SilenceIntelligenceSnapshot;
}): PatienceModelSnapshot {
  const delays = params.rawEvents
    .filter((item) => item.direction === "outbound" && item.occurredAt)
    .map((item) => {
      const date = toDate(item.occurredAt);
      return date ? date.getHours() : null;
    })
    .filter((item): item is number => item != null);
  const beneficialSilenceHours = params.silenceIntelligence.windows
    .filter((item) => item.classification === "beneficial")
    .map((item) => item.durationHours);
  const globalRecommendedWaitHours = beneficialSilenceHours.length
    ? round(median(beneficialSilenceHours) ?? 24)
    : params.relationshipMemory.length
      ? round(mean(params.relationshipMemory.map((item) => item.idealContactFrequencyHours)))
      : delays.length
        ? 24
        : null;

  return {
    globalRecommendedWaitHours,
    byRelationship: params.relationshipMemory.map((item) => ({
      counterpartKey: item.counterpartKey,
      recommendedWaitHours: round(clamp(item.idealContactFrequencyHours || (globalRecommendedWaitHours ?? 24), 2, 168)),
    })),
  };
}

function buildOpportunityAging(observations: BehaviorOpportunityObservationRecord[]): OpportunityAgingSnapshot {
  const entries: OpportunityAgingSnapshot["entries"] = observations.map((item) => {
    const observedWindow: "24h" | "72h" | "7d" | "unknown" = item.observedResultAfter24h
      ? "24h"
      : item.observedResultAfter72h
        ? "72h"
        : item.observedResultAfter7d
          ? "7d"
          : "unknown";
    const ttlClass: "immediate" | "short" | "medium" | "long" | "unknown" =
      observedWindow === "24h"
        ? "immediate"
        : observedWindow === "72h"
          ? "short"
          : observedWindow === "7d"
            ? "medium"
            : "unknown";
    return {
      opportunityId: item.opportunityId,
      ttlClass,
      observedWindow,
    };
  });

  return {
    entries,
    summary: {
      immediate: entries.filter((item) => item.ttlClass === "immediate").length,
      short: entries.filter((item) => item.ttlClass === "short").length,
      medium: entries.filter((item) => item.ttlClass === "medium").length,
      long: entries.filter((item) => item.ttlClass === "long").length,
      unknown: entries.filter((item) => item.ttlClass === "unknown").length,
    },
  };
}

function buildMomentumDetector(params: {
  rawEvents: RawBehaviorEvent[];
  relationshipMemory: RelationshipMemoryLike[];
  now: Date;
}): MomentumSnapshot {
  const hotRelationships: string[] = [];

  for (const relationship of params.relationshipMemory) {
    const recentEvents = params.rawEvents.filter((item) => {
      const occurredAt = toDate(item.occurredAt);
      return (item.remoteJid ?? item.groupJid) === relationship.counterpartKey &&
        occurredAt != null &&
        params.now.getTime() - occurredAt.getTime() <= 72 * 60 * 60 * 1000;
    });
    const reciprocalRecent =
      recentEvents.some((item) => item.direction === "inbound") &&
      recentEvents.some((item) => item.direction === "outbound");
    if (recentEvents.length >= 2 && reciprocalRecent) hotRelationships.push(relationship.counterpartKey);
  }

  const score = clamp(round(hotRelationships.length * 22 + params.relationshipMemory.filter((item) => item.stage === "recurring").length * 8), 0, 100);
  return {
    overall: score >= 65 ? "hot" : score >= 35 ? "warm" : "cold",
    hotRelationships,
    score,
  };
}

function buildDailyContext(now: Date): DailyContextSnapshot {
  const weekday = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"][now.getDay()];
  const isWeekend = now.getDay() === 0 || now.getDay() === 6;
  const hour = now.getHours();
  return {
    weekday,
    isWeekend,
    isBusinessHours: !isWeekend && hour >= 8 && hour <= 18,
    timeBucket: hourBucket(now),
    holidayState: "unknown",
  };
}

function buildRoutineDetector(params: {
  rawEvents: RawBehaviorEvent[];
  relationshipMemory: RelationshipMemoryLike[];
}): RoutineDetectorSnapshot {
  const hourCounts = new Map<number, number>();
  for (const event of params.rawEvents) {
    const date = toDate(event.occurredAt);
    if (!date) continue;
    hourCounts.set(date.getHours(), (hourCounts.get(date.getHours()) ?? 0) + 1);
  }
  const dominantHours = Array.from(hourCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([hour]) => hour);
  const eventsByCounterpart = buildContactEventMap(params.rawEvents);

  return {
    dominantHours,
    byRelationship: params.relationshipMemory.map((item) => {
      const events = eventsByCounterpart.get(item.counterpartKey) ?? [];
      const localHourCounts = new Map<number, number>();
      for (const event of events) {
        const date = toDate(event.occurredAt);
        if (!date) continue;
        localHourCounts.set(date.getHours(), (localHourCounts.get(date.getHours()) ?? 0) + 1);
      }
      const localHours = Array.from(localHourCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([hour]) => hour);
      const regularityScore = localHours.length ? round((localHours.length / Math.max(1, events.length)) * 100) : 0;
      return {
        counterpartKey: item.counterpartKey,
        dominantHours: localHours,
        regularityScore,
      };
    }),
  };
}

function buildMoodEstimation(params: {
  rawEvents: RawBehaviorEvent[];
  observability: BehaviorObservabilitySnapshot;
  momentum: MomentumSnapshot;
}): MoodEstimationSnapshot {
  const total = Math.max(1, params.rawEvents.length);
  const passiveShare = params.rawEvents.filter((item) => item.direction === "system").length / total;
  const activeShare = params.rawEvents.filter((item) => item.direction === "outbound").length / total;

  if (params.momentum.overall === "hot" && activeShare >= 0.25) {
    return { mood: "active", confidence: 0.72, reason: "há reciprocidade recente e atividade ativa suficiente" };
  }
  if (passiveShare >= 0.45) {
    return { mood: "passive", confidence: 0.68, reason: "a janela recente foi dominada por observação e sinais passivos" };
  }
  if (params.observability.behaviorVariance.status === "predictable") {
    return { mood: "busy", confidence: 0.52, reason: "há pouca variação e a janela parece comprimida por rotina fixa" };
  }
  if (params.rawEvents.length <= 2) {
    return { mood: "silent", confidence: 0.61, reason: "há atividade insuficiente para inferência mais rica" };
  }
  return { mood: "recovering", confidence: 0.49, reason: "o padrão recente sugere retorno gradual de presença" };
}

function buildLifePhaseDetector(params: {
  history: Array<{
    payload?: {
      extra?: {
        observability?: BehaviorObservabilitySnapshot | null;
        credibilityTrend?: Array<{ credibility?: { current?: number | null } | null }> | null;
      } | null;
    } | null;
  }>;
  current: {
    observability: BehaviorObservabilitySnapshot;
    credibilityScore: number;
    rawEventsCount: number;
  };
}): LifePhaseSnapshot {
  const previous = params.history[params.history.length - 1];
  const previousCredibility = previous?.payload?.extra?.credibilityTrend?.[0]?.credibility?.current ?? null;
  const previousExposure = previous?.payload?.extra?.observability?.socialGraphHealth?.score ?? null;
  const credibilityDelta = previousCredibility == null ? null : params.current.credibilityScore - previousCredibility;
  const exposureDelta = previousExposure == null ? null : params.current.observability.socialGraphHealth.score - previousExposure;

  if (params.current.rawEventsCount <= 2) {
    return { phase: "dormant", confidence: 0.7, reason: "atividade muito baixa na janela atual" };
  }
  if ((credibilityDelta ?? 0) >= 8 && (exposureDelta ?? 0) >= 5) {
    return { phase: "expanding", confidence: 0.71, reason: "credibilidade e exposição estão crescendo juntas" };
  }
  if ((credibilityDelta ?? 0) >= 5) {
    return { phase: "stabilizing", confidence: 0.66, reason: "a credibilidade está melhorando de forma progressiva" };
  }
  if ((credibilityDelta ?? 0) <= -5) {
    return { phase: "cooling", confidence: 0.63, reason: "há perda observável de tração longitudinal" };
  }
  if ((exposureDelta ?? 0) >= 10 && params.current.observability.personaDiversity.score >= 60) {
    return { phase: "reactivated", confidence: 0.58, reason: "há retomada de presença social com maior diversidade" };
  }
  return { phase: "unknown", confidence: 0.35, reason: "a história ainda é insuficiente para fase de vida confiável" };
}

function buildExperienceReplay(params: {
  journalEntries: Array<{
    payload?: {
      resultObserved?: { after24h?: string | null; after72h?: string | null; after7d?: string | null } | null;
      strategyChosen?: string | null;
      actionTaken?: string | null;
    } | null;
  }>;
  opportunityAging: OpportunityAgingSnapshot;
}): ExperienceReplaySnapshot {
  const analogousExperiences = params.journalEntries.length;
  const waitSignals = params.journalEntries.filter((item) => item.payload?.actionTaken === "observe_only").length;
  const actSignals = params.journalEntries.filter((item) => item.payload?.actionTaken === "executed_opportunity").length;
  const waitBias =
    params.opportunityAging.summary.unknown > 0
      ? "unknown"
      : waitSignals > actSignals
        ? "wait_better"
        : actSignals > waitSignals
          ? "act_better"
          : "unknown";

  return {
    analogousExperiences,
    waitBias,
    summary:
      waitBias === "wait_better"
        ? "as experiências disponíveis favorecem prudência e espera"
        : waitBias === "act_better"
          ? "as experiências disponíveis favorecem ação mais rápida"
          : "a base histórica ainda é insuficiente para replay comparável",
  };
}

function buildCounterfactualSimulator(params: {
  validation: BehaviorValidationSnapshot;
  momentum: MomentumSnapshot;
  patience: PatienceModelSnapshot;
}): CounterfactualSimulatorSnapshot {
  const wait24h: CounterfactualScenario = {
    label: "wait_24h",
    expectedRiskDelta: params.validation.riskBudget.status === "healthy" ? -4 : -8,
    expectedCredibilityDelta: params.momentum.overall === "hot" ? -2 : 3,
    confidence: 0.46,
    reason: "esperar 24h tende a reduzir risco imediato, mas pode perder momentum quente",
  };
  const wait72h: CounterfactualScenario = {
    label: "wait_72h",
    expectedRiskDelta: -10,
    expectedCredibilityDelta: params.validation.evidenceGap.reasons.length > 1 ? -4 : 2,
    confidence: 0.38,
    reason: "espera longa preserva exposição, mas pode esfriar contexto frágil",
  };
  const actNow: CounterfactualScenario = {
    label: "act_now",
    expectedRiskDelta: params.validation.riskBudget.status === "depleted" ? 12 : 5,
    expectedCredibilityDelta: params.momentum.overall === "hot" ? 5 : -3,
    confidence: 0.41,
    reason: "agir agora favorece contextos quentes, mas penaliza cenários com orçamento de risco baixo",
  };
  const maintainPresence: CounterfactualScenario = {
    label: "maintain_presence",
    expectedRiskDelta: -2,
    expectedCredibilityDelta: params.patience.globalRecommendedWaitHours != null ? 4 : 1,
    confidence: 0.43,
    reason: "manter presença leve tende a preservar naturalidade sem exigir contato direto imediato",
  };

  return {
    scenarios: [wait24h, wait72h, actNow, maintainPresence],
  };
}

export function buildBehaviorCognitiveSnapshot(params: {
  rawEvents: RawBehaviorEvent[];
  episodes: BehaviorEpisode[];
  observability: BehaviorObservabilitySnapshot;
  validation: BehaviorValidationSnapshot;
  identitySnapshot: IdentitySnapshot;
  opportunityObservations: BehaviorOpportunityObservationRecord[];
  relationshipMemory: RelationshipMemoryLike[];
  previousRelationshipMemory?: RelationshipMemoryLike[];
  history: Array<{
    payload?: {
      extra?: {
        observability?: BehaviorObservabilitySnapshot | null;
        credibilityTrend?: Array<{ credibility?: { current?: number | null } | null }> | null;
      } | null;
    } | null;
  }>;
  journalEntries: Array<{
    payload?: {
      actionTaken?: string | null;
      resultObserved?: { after24h?: string | null; after72h?: string | null; after7d?: string | null } | null;
      [key: string]: unknown;
    } | null;
  }>;
  credibilityScore: number;
  now: Date;
}): BehaviorCognitiveSnapshot {
  const socialCircleEngine = buildSocialCircleEngine({
    relationshipMemory: params.relationshipMemory,
    rawEvents: params.rawEvents,
  });
  const relationshipEvolution = buildRelationshipEvolution({
    current: params.relationshipMemory,
    previous: params.previousRelationshipMemory,
  });
  const relationshipSaturation = buildRelationshipSaturation({
    relationshipMemory: params.relationshipMemory,
    rawEvents: params.rawEvents,
  });
  const reciprocityScore = buildReciprocityScore(params.relationshipMemory);
  const affinityGraph = buildAffinityGraph({
    relationshipMemory: params.relationshipMemory,
    rawEvents: params.rawEvents,
  });
  const silenceIntelligence = buildSilenceIntelligence(params.rawEvents, params.validation);
  const patienceModel = buildPatienceModel({
    rawEvents: params.rawEvents,
    relationshipMemory: params.relationshipMemory,
    silenceIntelligence,
  });
  const opportunityAging = buildOpportunityAging(params.opportunityObservations);
  const momentumDetector = buildMomentumDetector({
    rawEvents: params.rawEvents,
    relationshipMemory: params.relationshipMemory,
    now: params.now,
  });
  const dailyContext = buildDailyContext(params.now);
  const routineDetector = buildRoutineDetector({
    rawEvents: params.rawEvents,
    relationshipMemory: params.relationshipMemory,
  });
  const moodEstimation = buildMoodEstimation({
    rawEvents: params.rawEvents,
    observability: params.observability,
    momentum: momentumDetector,
  });
  const lifePhaseDetector = buildLifePhaseDetector({
    history: params.history,
    current: {
      observability: params.observability,
      credibilityScore: params.credibilityScore,
      rawEventsCount: params.rawEvents.length,
    },
  });
  const experienceReplay = buildExperienceReplay({
    journalEntries: params.journalEntries,
    opportunityAging,
  });
  const counterfactualSimulator = buildCounterfactualSimulator({
    validation: params.validation,
    momentum: momentumDetector,
    patience: patienceModel,
  });

  return {
    socialCircleEngine,
    relationshipEvolution,
    relationshipSaturation,
    reciprocityScore,
    affinityGraph,
    silenceIntelligence,
    patienceModel,
    opportunityAging,
    momentumDetector,
    dailyContext,
    routineDetector,
    moodEstimation,
    lifePhaseDetector,
    experienceReplay,
    counterfactualSimulator,
  };
}
