import { createHash } from "node:crypto";
import type { IdentitySnapshot } from "./behaviorMemoryService";
import type { BehaviorEpisode } from "./episodeBuilderService";
import type { RawBehaviorEvent } from "./evidenceNormalizerService";
import type { BehaviorObservabilitySnapshot } from "./behaviorObservabilityService";
import type {
  BehaviorOpportunityObservationRecord,
  BehaviorValidationSnapshot,
} from "./behaviorValidationService";
import type { BehaviorCognitiveSnapshot } from "./behaviorCognitiveObservabilityService";
import { buildBehaviorCognitiveSnapshot } from "./behaviorCognitiveObservabilityService";

type RelationshipStage = "unknown" | "known" | "trust" | "recurring" | "inactive";
type ChapterType = "snapshot" | "opportunity" | "recovery" | "silence";

export type MaturationExperienceContext = {
  chipAgeDays: number | null;
  activeHourEntropy: number;
  contactDensity: number;
  socialExposure: number;
  diversity: number;
  predictability: number;
  trustLevel: number;
  timeBucket: string;
};

export type MaturationExperienceChapter = {
  chapterId: string;
  chapterType: ChapterType;
  observedAt: string;
  contextHash: string;
  context: MaturationExperienceContext;
  opportunitiesAvailable: Array<{
    opportunityId: string;
    status: "detected" | "ignored" | "executed" | "expired" | "cancelled";
    reason: string;
    expectedGain: number;
    expectedRisk: number;
  }>;
  strategyChosen: string;
  actionTaken: string;
  riskBefore: number;
  riskAfter: number;
  credibilityBefore: number;
  credibilityAfter: number;
  resultObserved: {
    after24h: string | null;
    after72h: string | null;
    after7d: string | null;
  };
  tags: string[];
};

export type OpportunityOutcomeTracker = {
  summary: {
    detected: number;
    ignored: number;
    executed: number;
    expired: number;
    cancelled: number;
  };
  entries: Array<{
    opportunityId: string;
    status: "detected" | "ignored" | "executed" | "expired" | "cancelled";
    reason: string;
    impactRisk: number;
    impactCredibility: number;
    impactStability: number;
  }>;
};

export type RelationshipMemorySnapshot = {
  counterpartKey: string;
  counterpartType: "contact" | "group" | "unknown";
  stage: RelationshipStage;
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

export type DigitalCredibilityTimelinePoint = {
  observedAt: string;
  credibility: number;
  trustLevel: number;
  socialExposure: number;
  diversity: number;
  predictability: number;
};

export type TrustAccumulationModel = {
  currentTrust: number;
  growthRatePerWeek: number;
  daysToCurrentLevel: number | null;
  summary: string;
};

export type HumanTimingModel = {
  averageReplyMinutes: number | null;
  medianReplyMinutes: number | null;
  weekdayVsWeekendDelta: number | null;
  interruptionRate: number;
  variability: number;
};

export type NaturalActivityModel = {
  passiveShare: number;
  activeShare: number;
  observationalBehaviors: string[];
  summary: string;
};

export type ConversationLifecycleEntry = {
  counterpartKey: string;
  phases: Array<"birth" | "growth" | "cooldown" | "reactivation" | "closure">;
  durationHours: number;
  restarted: boolean;
};

export type SocialExposureSnapshot = {
  dmShare: number;
  groupShare: number;
  statusShare: number;
  recurringContactShare: number;
  newContactShare: number;
  exposureScore: number;
};

export type BehavioralSeasonality = {
  byWeekday: Record<string, number>;
  byHourBucket: Record<string, number>;
  dominantWeekday: string | null;
  dominantHourBucket: string | null;
};

export type IdentityEvolutionPoint = {
  observedAt: string;
  communicationStyle: number | null;
  socialExposure: number | null;
  responsiveness: number | null;
  diversity: number | null;
  predictability: number | null;
};

export type SimilarExperienceMatch = {
  chapterId: string;
  similarity: number;
  riskBefore: number;
  credibilityBefore: number;
  strategyChosen: string;
  actionTaken: string;
  observedAt: string;
};

export type BehaviorLongitudinalSnapshot = {
  experienceJournalCandidate: MaturationExperienceChapter;
  opportunityOutcomeTracker: OpportunityOutcomeTracker;
  relationshipMemory: RelationshipMemorySnapshot[];
  digitalCredibilityTimeline: DigitalCredibilityTimelinePoint[];
  trustAccumulationModel: TrustAccumulationModel;
  humanTimingModel: HumanTimingModel;
  naturalActivityModel: NaturalActivityModel;
  conversationLifecycle: ConversationLifecycleEntry[];
  socialExposureAnalyzer: SocialExposureSnapshot;
  behavioralSeasonality: BehavioralSeasonality;
  identityEvolutionTimeline: IdentityEvolutionPoint[];
  similarExperiences: SimilarExperienceMatch[];
  cognitive: BehaviorCognitiveSnapshot;
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

function normalizedEntropy(values: number[]) {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total <= 0 || values.filter((value) => value > 0).length <= 1) return 0;
  const probabilities = values.filter((value) => value > 0).map((value) => value / total);
  const entropy = -probabilities.reduce((sum, probability) => sum + probability * Math.log2(probability), 0);
  const maxEntropy = Math.log2(probabilities.length);
  return maxEntropy === 0 ? 0 : round((entropy / maxEntropy) * 100);
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

function hashObject(value: unknown) {
  return createHash("sha1").update(JSON.stringify(value)).digest("hex");
}

function buildReplyDelays(rawEvents: RawBehaviorEvent[]) {
  const ordered = [...rawEvents]
    .filter((event) => event.occurredAt)
    .sort((a, b) => new Date(a.occurredAt!).getTime() - new Date(b.occurredAt!).getTime());
  const inboundByConversation = new Map<string, Date>();
  const delays: number[] = [];

  for (const event of ordered) {
    const occurredAt = toDate(event.occurredAt);
    if (!occurredAt) continue;
    const key = String(event.remoteJid ?? event.groupJid ?? "__none__");
    if (event.direction === "inbound") {
      inboundByConversation.set(key, occurredAt);
      continue;
    }
    if (event.direction === "outbound") {
      const previousInbound = inboundByConversation.get(key);
      if (previousInbound) {
        const delay = Math.max(0, (occurredAt.getTime() - previousInbound.getTime()) / 60000);
        if (delay <= 24 * 60) delays.push(delay);
      }
    }
  }

  return delays;
}

function buildExperienceContext(params: {
  rawEvents: RawBehaviorEvent[];
  observability: BehaviorObservabilitySnapshot;
  identitySnapshot: IdentitySnapshot;
  chipCreatedAt?: Date | string | null;
  now: Date;
}): MaturationExperienceContext {
  const chipCreatedAt = toDate(params.chipCreatedAt);
  const activeHours = new Array(24).fill(0);
  const contacts = new Set<string>();

  for (const event of params.rawEvents) {
    const date = toDate(event.occurredAt);
    if (!date) continue;
    activeHours[date.getHours()] += 1;
    if (event.remoteJid) contacts.add(String(event.remoteJid));
  }

  return {
    chipAgeDays: chipCreatedAt ? Math.max(0, Math.round((params.now.getTime() - chipCreatedAt.getTime()) / (1000 * 60 * 60 * 24))) : null,
    activeHourEntropy: normalizedEntropy(activeHours),
    contactDensity: round(contacts.size / Math.max(1, params.rawEvents.length) * 100),
    socialExposure: round(params.observability.socialGraphHealth.score),
    diversity: round(params.observability.personaDiversity.score),
    predictability: round(100 - params.observability.behaviorVariance.score),
    trustLevel: round(params.identitySnapshot.maturity * 100),
    timeBucket: hourBucket(params.now),
  };
}

export function buildOpportunityOutcomeTracker(
  observations: BehaviorOpportunityObservationRecord[]
): OpportunityOutcomeTracker {
  const entries = observations.map((item) => {
    const status: "detected" | "ignored" | "executed" | "expired" | "cancelled" =
      item.payload?.cancelled === true
        ? "cancelled"
        : item.decision === "ACT_NOW"
          ? "executed"
          : item.observedResultAfter7d
            ? "ignored"
            : item.observedResultAfter24h || item.observedResultAfter72h
              ? "detected"
              : "expired";
    return {
      opportunityId: item.opportunityId,
      status,
      reason: item.reason,
      impactRisk: round((item.expectedRisk - item.riskAtDecision) / 100),
      impactCredibility: round((item.expectedGain - item.expectedRisk) / 100),
      impactStability: round((item.confidence - item.riskAtDecision) / 100),
    } as const;
  });

  return {
    summary: {
      detected: entries.filter((item) => item.status === "detected").length,
      ignored: entries.filter((item) => item.status === "ignored").length,
      executed: entries.filter((item) => item.status === "executed").length,
      expired: entries.filter((item) => item.status === "expired").length,
      cancelled: entries.filter((item) => item.status === "cancelled").length,
    },
    entries,
  };
}

export function buildRelationshipMemory(rawEvents: RawBehaviorEvent[]): RelationshipMemorySnapshot[] {
  const grouped = new Map<string, RawBehaviorEvent[]>();

  for (const event of rawEvents) {
    const counterpartKey = String(event.remoteJid ?? event.groupJid ?? "__unknown__");
    const current = grouped.get(counterpartKey) ?? [];
    current.push(event);
    grouped.set(counterpartKey, current);
  }

  return Array.from(grouped.entries())
    .filter(([key]) => key !== "__unknown__")
    .map(([counterpartKey, events]) => {
      const ordered = [...events]
        .filter((event) => event.occurredAt)
        .sort((a, b) => new Date(a.occurredAt!).getTime() - new Date(b.occurredAt!).getTime());
      const first = toDate(ordered[0]?.occurredAt);
      const last = toDate(ordered[ordered.length - 1]?.occurredAt);
      const inboundCount = events.filter((item) => item.direction === "inbound").length;
      const outboundCount = events.filter((item) => item.direction === "outbound").length;
      const daysSpan = first && last ? Math.max(1, (last.getTime() - first.getTime()) / (1000 * 60 * 60 * 24)) : 1;
      const trustScore = clamp(round((Math.min(10, events.length) * 6 + Math.min(inboundCount, outboundCount) * 8)), 0, 100);
      const relationshipRisk = clamp(round((outboundCount > inboundCount ? 40 : 15) + (events.length <= 1 ? 20 : 0)), 0, 100);
      const recurringTopics = Array.from(
        new Set(events.map((item) => item.eventType).filter((item) => item.includes("message") || item.includes("status")))
      ).slice(0, 5);
      const signals = Array.from(new Set(events.map((item) => item.eventType))).slice(0, 8);

      let stage: RelationshipStage = "unknown";
      if (events.length >= 2) stage = "known";
      if (trustScore >= 55) stage = "trust";
      if (events.length >= 5 && daysSpan >= 3) stage = "recurring";
      if (last && Date.now() - last.getTime() > 14 * 24 * 60 * 60 * 1000) stage = "inactive";

      const counterpartType: RelationshipMemorySnapshot["counterpartType"] = counterpartKey.endsWith("@g.us")
        ? "group"
        : counterpartKey === "__unknown__"
          ? "unknown"
          : "contact";

      return {
        counterpartKey,
        counterpartType,
        stage,
        firstInteractionAt: first?.toISOString() ?? null,
        lastInteractionAt: last?.toISOString() ?? null,
        trustScore,
        relationshipRisk,
        idealContactFrequencyHours: clamp(round((daysSpan * 24) / Math.max(1, events.length)), 2, 168),
        inboundCount,
        outboundCount,
        recurringTopics,
        signals,
      };
    })
    .sort((a, b) => b.trustScore - a.trustScore);
}

export function buildDigitalCredibilityTimeline(params: {
  history: Array<{
    windowEnd?: Date | string | null;
    payload?: {
      extra?: {
        credibilityTrend?: Array<{ credibility?: { current?: number | null } | null }> | null;
        observability?: BehaviorObservabilitySnapshot | null;
      } | null;
      identitySnapshot?: IdentitySnapshot | null;
    } | null;
  }>;
  current: {
    observedAt: Date;
    credibility: number;
    observability: BehaviorObservabilitySnapshot;
    identitySnapshot: IdentitySnapshot;
  };
}): DigitalCredibilityTimelinePoint[] {
  const fromHistory = params.history
    .map((item) => {
      const observedAt = toDate(item.windowEnd);
      if (!observedAt) return null;
      const observability = item.payload?.extra?.observability;
      const identity = item.payload?.identitySnapshot;
      const credibility = item.payload?.extra?.credibilityTrend?.[0]?.credibility?.current ?? null;
      if (credibility == null || !observability || !identity) return null;
      return {
        observedAt: observedAt.toISOString(),
        credibility,
        trustLevel: round(identity.maturity * 100),
        socialExposure: round(observability.socialGraphHealth.score),
        diversity: round(observability.personaDiversity.score),
        predictability: round(100 - observability.behaviorVariance.score),
      };
    })
    .filter((item): item is DigitalCredibilityTimelinePoint => Boolean(item));

  return [
    ...fromHistory,
    {
      observedAt: params.current.observedAt.toISOString(),
      credibility: params.current.credibility,
      trustLevel: round(params.current.identitySnapshot.maturity * 100),
      socialExposure: round(params.current.observability.socialGraphHealth.score),
      diversity: round(params.current.observability.personaDiversity.score),
      predictability: round(100 - params.current.observability.behaviorVariance.score),
    },
  ].slice(-90);
}

export function buildTrustAccumulationModel(timeline: DigitalCredibilityTimelinePoint[]): TrustAccumulationModel {
  if (timeline.length === 0) {
    return {
      currentTrust: 0,
      growthRatePerWeek: 0,
      daysToCurrentLevel: null,
      summary: "sem histórico suficiente para estimar acúmulo de confiança",
    };
  }
  const first = timeline[0];
  const last = timeline[timeline.length - 1];
  const firstDate = toDate(first.observedAt)!;
  const lastDate = toDate(last.observedAt)!;
  const days = Math.max(1, (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
  const growth = last.trustLevel - first.trustLevel;
  return {
    currentTrust: last.trustLevel,
    growthRatePerWeek: round((growth / days) * 7),
    daysToCurrentLevel: round(days),
    summary:
      growth > 0
        ? `a confiança observada cresceu ${round(growth)} pontos em ${round(days)} dias`
        : growth < 0
          ? `a confiança observada caiu ${round(Math.abs(growth))} pontos em ${round(days)} dias`
          : "a confiança observada permaneceu estável na janela disponível",
  };
}

export function buildHumanTimingModel(rawEvents: RawBehaviorEvent[]): HumanTimingModel {
  const delays = buildReplyDelays(rawEvents);
  const weekdayDelays = delays.filter((_, index) => index % 2 === 0);
  const weekendDelays = delays.filter((_, index) => index % 2 === 1);
  const interruptionRate = rawEvents.length
    ? round((rawEvents.filter((item) => item.eventType.includes("status") || item.eventType.includes("chat_list")).length / rawEvents.length) * 100)
    : 0;

  return {
    averageReplyMinutes: delays.length ? round(mean(delays)) : null,
    medianReplyMinutes: delays.length ? round(median(delays) ?? 0) : null,
    weekdayVsWeekendDelta:
      weekdayDelays.length && weekendDelays.length ? round(mean(weekdayDelays) - mean(weekendDelays)) : null,
    interruptionRate,
    variability: round(normalizedEntropy(delays.map((value) => Math.round(Math.min(12, value / 10))))),
  };
}

export function buildNaturalActivityModel(rawEvents: RawBehaviorEvent[]): NaturalActivityModel {
  const passive = rawEvents.filter((item) =>
    item.eventType.includes("status") ||
    item.eventType.includes("read") ||
    item.eventType.includes("chat_list") ||
    item.eventType.includes("group_opened")
  );
  const active = rawEvents.filter((item) => item.direction === "outbound");
  const total = Math.max(1, rawEvents.length);
  const observationalBehaviors = Array.from(new Set(passive.map((item) => item.eventType))).slice(0, 8);
  return {
    passiveShare: round((passive.length / total) * 100),
    activeShare: round((active.length / total) * 100),
    observationalBehaviors,
    summary:
      passive.length >= active.length
        ? "o chip exibiu rotina de observação compatível com vida digital passiva"
        : "a atividade ativa ainda domina a janela observada",
  };
}

export function buildConversationLifecycle(episodes: BehaviorEpisode[]): ConversationLifecycleEntry[] {
  const byConversation = new Map<string, BehaviorEpisode[]>();
  for (const episode of episodes) {
    const key = String(episode.rawEventTrail[0]?.conversationKey ?? "__unknown__");
    const current = byConversation.get(key) ?? [];
    current.push(episode);
    byConversation.set(key, current);
  }

  return Array.from(byConversation.entries())
    .filter(([key]) => key !== "__unknown__")
    .map(([counterpartKey, list]) => {
      const ordered = [...list].sort(
        (a, b) => (toDate(a.startedAt)?.getTime() ?? 0) - (toDate(b.startedAt)?.getTime() ?? 0)
      );
      const first = toDate(ordered[0]?.startedAt);
      const last = toDate(ordered[ordered.length - 1]?.endedAt ?? ordered[ordered.length - 1]?.startedAt);
      const phases: ConversationLifecycleEntry["phases"] = ["birth"];
      if (ordered.length >= 2) phases.push("growth");
      if (ordered.length >= 3) phases.push("cooldown");
      const restarted =
        ordered.length >= 2 &&
        ordered.some((episode, index) => {
          if (index === 0) return false;
          const previous = toDate(ordered[index - 1].endedAt ?? ordered[index - 1].startedAt);
          const current = toDate(episode.startedAt);
          return previous && current ? current.getTime() - previous.getTime() > 24 * 60 * 60 * 1000 : false;
        });
      if (restarted) phases.push("reactivation");
      if (ordered[ordered.length - 1]?.result === "stopped") phases.push("closure");
      return {
        counterpartKey,
        phases,
        durationHours: first && last ? round((last.getTime() - first.getTime()) / (1000 * 60 * 60)) : 0,
        restarted,
      };
    });
}

export function buildSocialExposureAnalyzer(
  rawEvents: RawBehaviorEvent[],
  relationshipMemory: RelationshipMemorySnapshot[]
): SocialExposureSnapshot {
  const total = Math.max(1, rawEvents.length);
  const dmCount = rawEvents.filter((item) => item.remoteJid && !item.groupJid).length;
  const groupCount = rawEvents.filter((item) => item.groupJid).length;
  const statusCount = rawEvents.filter((item) => item.eventType.includes("status")).length;
  const recurring = relationshipMemory.filter((item) => item.stage === "recurring" || item.stage === "trust").length;
  const newContacts = relationshipMemory.filter((item) => item.stage === "unknown" || item.stage === "known").length;
  const exposureScore = round(
    (dmCount / total) * 30 +
      (groupCount / total) * 25 +
      (statusCount / total) * 15 +
      Math.min(20, recurring * 5) +
      Math.min(10, newContacts * 2)
  );

  return {
    dmShare: round((dmCount / total) * 100),
    groupShare: round((groupCount / total) * 100),
    statusShare: round((statusCount / total) * 100),
    recurringContactShare: relationshipMemory.length ? round((recurring / relationshipMemory.length) * 100) : 0,
    newContactShare: relationshipMemory.length ? round((newContacts / relationshipMemory.length) * 100) : 0,
    exposureScore: clamp(exposureScore, 0, 100),
  };
}

export function buildBehavioralSeasonality(rawEvents: RawBehaviorEvent[]): BehavioralSeasonality {
  const byWeekday: Record<string, number> = {};
  const byHourBucket: Record<string, number> = {};
  for (const event of rawEvents) {
    const date = toDate(event.occurredAt);
    if (!date) continue;
    const weekday = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"][date.getDay()];
    const bucket = hourBucket(date);
    byWeekday[weekday] = (byWeekday[weekday] ?? 0) + 1;
    byHourBucket[bucket] = (byHourBucket[bucket] ?? 0) + 1;
  }

  const dominantWeekday = Object.entries(byWeekday).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const dominantHourBucket = Object.entries(byHourBucket).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return { byWeekday, byHourBucket, dominantWeekday, dominantHourBucket };
}

export function buildIdentityEvolutionTimeline(params: {
  history: Array<{
    windowEnd?: Date | string | null;
    payload?: { identitySnapshot?: IdentitySnapshot | null } | null;
  }>;
  current: { observedAt: Date; identitySnapshot: IdentitySnapshot };
}): IdentityEvolutionPoint[] {
  const rawPoints: Array<IdentityEvolutionPoint | null> = params.history
    .map((item) => {
      const observedAt = toDate(item.windowEnd);
      const identity = item.payload?.identitySnapshot;
      if (!observedAt || !identity) return null;
      return {
        observedAt: observedAt.toISOString(),
        communicationStyle: identity.dimensions.communicationStyle?.value ?? null,
        socialExposure: identity.dimensions.socialExposure?.value ?? null,
        responsiveness: identity.dimensions.responsiveness?.value ?? null,
        diversity: identity.dimensions.diversity?.value ?? null,
        predictability: identity.dimensions.predictability?.value ?? null,
      };
    });
  const points = rawPoints.filter((item): item is IdentityEvolutionPoint => item !== null);

  return [
    ...points,
    {
      observedAt: params.current.observedAt.toISOString(),
      communicationStyle: params.current.identitySnapshot.dimensions.communicationStyle?.value ?? null,
      socialExposure: params.current.identitySnapshot.dimensions.socialExposure?.value ?? null,
      responsiveness: params.current.identitySnapshot.dimensions.responsiveness?.value ?? null,
      diversity: params.current.identitySnapshot.dimensions.diversity?.value ?? null,
      predictability: params.current.identitySnapshot.dimensions.predictability?.value ?? null,
    },
  ].slice(-90);
}

export function retrieveSimilarExperiences(params: {
  currentContext: MaturationExperienceContext;
  journalEntries: Array<{
    chapterId: string;
    observedAt: Date | string;
    riskBefore: number;
    credibilityBefore: number;
    strategyChosen?: string | null;
    actionTaken?: string | null;
    payload?: {
      context?: Partial<MaturationExperienceContext> | null;
    } | null;
  }>;
}): SimilarExperienceMatch[] {
  return params.journalEntries
    .map((entry) => {
      const context = entry.payload?.context;
      if (!context) return null;
      const chipAgeScore =
        context.chipAgeDays != null && params.currentContext.chipAgeDays != null
          ? 1 - Math.min(1, Math.abs(context.chipAgeDays - params.currentContext.chipAgeDays) / 60)
          : 0.5;
      const diversityScore = 1 - Math.min(1, Math.abs((context.diversity ?? 50) - params.currentContext.diversity) / 100);
      const exposureScore = 1 - Math.min(1, Math.abs((context.socialExposure ?? 50) - params.currentContext.socialExposure) / 100);
      const predictabilityScore =
        1 - Math.min(1, Math.abs((context.predictability ?? 50) - params.currentContext.predictability) / 100);
      const timeBucketScore = context.timeBucket === params.currentContext.timeBucket ? 1 : 0.4;
      const similarity = round(
        (chipAgeScore * 0.15 + diversityScore * 0.2 + exposureScore * 0.2 + predictabilityScore * 0.2 + timeBucketScore * 0.25) * 100
      );
      return {
        chapterId: entry.chapterId,
        similarity,
        riskBefore: entry.riskBefore,
        credibilityBefore: entry.credibilityBefore,
        strategyChosen: entry.strategyChosen ?? "unknown",
        actionTaken: entry.actionTaken ?? "unknown",
        observedAt: toDate(entry.observedAt)?.toISOString() ?? new Date(entry.observedAt).toISOString(),
      };
    })
    .filter((item): item is SimilarExperienceMatch => Boolean(item))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 10);
}

export function buildMaturationExperienceChapter(params: {
  observedAt: Date;
  context: MaturationExperienceContext;
  validation: BehaviorValidationSnapshot;
  opportunities: OpportunityOutcomeTracker;
  credibilityBefore: number;
  credibilityAfter: number;
}): MaturationExperienceChapter {
  const chapterType: ChapterType =
    params.opportunities.summary.detected === 0 && params.opportunities.summary.ignored > 0
      ? "silence"
      : params.validation.pipelineDrift.changed
        ? "recovery"
        : "snapshot";
  const actionTaken = params.opportunities.summary.executed > 0 ? "executed_opportunity" : "observe_only";
  const strategyChosen =
    params.validation.riskBudget.status === "attention" || params.validation.riskBudget.status === "depleted"
      ? "preserve_credibility"
      : "maintain_natural_presence";
  const chapterId = `exp-${params.observedAt.toISOString().replace(/[:.]/g, "-")}`;
  return {
    chapterId,
    chapterType,
    observedAt: params.observedAt.toISOString(),
    contextHash: hashObject(params.context),
    context: params.context,
    opportunitiesAvailable: params.opportunities.entries.map((entry) => ({
      opportunityId: entry.opportunityId,
      status: entry.status,
      reason: entry.reason,
      expectedGain: round(entry.impactCredibility * 100),
      expectedRisk: round(entry.impactRisk * 100),
    })),
    strategyChosen,
    actionTaken,
    riskBefore: params.validation.riskBudget.spent,
    riskAfter: params.validation.riskBudget.total - params.validation.riskBudget.remaining,
    credibilityBefore: params.credibilityBefore,
    credibilityAfter: params.credibilityAfter,
    resultObserved: {
      after24h: null,
      after72h: null,
      after7d: null,
    },
    tags: [
      params.validation.unknownState.state,
      params.validation.decisionDebt.status,
      params.validation.riskBudget.status,
      params.validation.credibilityBudget.status,
    ],
  };
}

export function buildBehaviorLongitudinalSnapshot(params: {
  rawEvents: RawBehaviorEvent[];
  episodes: BehaviorEpisode[];
  observability: BehaviorObservabilitySnapshot;
  validation: BehaviorValidationSnapshot;
  identitySnapshot: IdentitySnapshot;
  history: Array<{
    windowEnd?: Date | string | null;
    payload?: {
      identitySnapshot?: IdentitySnapshot | null;
      extra?: {
        observability?: BehaviorObservabilitySnapshot | null;
        credibilityTrend?: Array<{ credibility?: { current?: number | null } | null }> | null;
      } | null;
    } | null;
  }>;
  journalEntries: Array<{
    chapterId: string;
    observedAt: Date | string;
    riskBefore: number;
    credibilityBefore: number;
    strategyChosen?: string | null;
    actionTaken?: string | null;
    payload?: { context?: Partial<MaturationExperienceContext> | null } | null;
  }>;
  opportunityObservations: BehaviorOpportunityObservationRecord[];
  previousRelationshipMemory?: RelationshipMemorySnapshot[];
  chipCreatedAt?: Date | string | null;
  credibilityScore: number;
  now: Date;
}): BehaviorLongitudinalSnapshot {
  const context = buildExperienceContext({
    rawEvents: params.rawEvents,
    observability: params.observability,
    identitySnapshot: params.identitySnapshot,
    chipCreatedAt: params.chipCreatedAt,
    now: params.now,
  });
  const opportunityOutcomeTracker = buildOpportunityOutcomeTracker(params.opportunityObservations);
  const relationshipMemory = buildRelationshipMemory(params.rawEvents);
  const socialExposureAnalyzer = buildSocialExposureAnalyzer(params.rawEvents, relationshipMemory);
  const digitalCredibilityTimeline = buildDigitalCredibilityTimeline({
    history: params.history,
    current: {
      observedAt: params.now,
      credibility: params.credibilityScore,
      observability: params.observability,
      identitySnapshot: params.identitySnapshot,
    },
  });
  const trustAccumulationModel = buildTrustAccumulationModel(digitalCredibilityTimeline);
  const humanTimingModel = buildHumanTimingModel(params.rawEvents);
  const naturalActivityModel = buildNaturalActivityModel(params.rawEvents);
  const conversationLifecycle = buildConversationLifecycle(params.episodes);
  const behavioralSeasonality = buildBehavioralSeasonality(params.rawEvents);
  const identityEvolutionTimeline = buildIdentityEvolutionTimeline({
    history: params.history,
    current: {
      observedAt: params.now,
      identitySnapshot: params.identitySnapshot,
    },
  });
  const similarExperiences = retrieveSimilarExperiences({
    currentContext: context,
    journalEntries: params.journalEntries,
  });
  const cognitive = buildBehaviorCognitiveSnapshot({
    rawEvents: params.rawEvents,
    episodes: params.episodes,
    observability: params.observability,
    validation: params.validation,
    identitySnapshot: params.identitySnapshot,
    opportunityObservations: params.opportunityObservations,
    relationshipMemory,
    previousRelationshipMemory: params.previousRelationshipMemory,
    history: params.history,
    journalEntries: params.journalEntries,
    credibilityScore: params.credibilityScore,
    now: params.now,
  });
  const experienceJournalCandidate = buildMaturationExperienceChapter({
    observedAt: params.now,
    context,
    validation: params.validation,
    opportunities: opportunityOutcomeTracker,
    credibilityBefore:
      digitalCredibilityTimeline.length > 1 ? digitalCredibilityTimeline[digitalCredibilityTimeline.length - 2].credibility : params.credibilityScore,
    credibilityAfter: params.credibilityScore,
  });

  return {
    experienceJournalCandidate,
    opportunityOutcomeTracker,
    relationshipMemory,
    digitalCredibilityTimeline,
    trustAccumulationModel,
    humanTimingModel,
    naturalActivityModel,
    conversationLifecycle,
    socialExposureAnalyzer,
    behavioralSeasonality,
    identityEvolutionTimeline,
    similarExperiences,
    cognitive,
  };
}
