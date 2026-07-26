import { describe, expect, it } from "vitest";
import { buildBehaviorEpisodes } from "./episodeBuilderService";
import { catalogEvidenceBatch } from "./evidenceCatalogService";
import { normalizeBehaviorBatch, RawBehaviorEvent } from "./evidenceNormalizerService";
import { buildBehaviorObservabilitySnapshot } from "./behaviorObservabilityService";
import { generateIdentitySnapshot } from "./identitySnapshotGeneratorService";
import { buildBehaviorValidationSnapshot } from "./behaviorValidationService";
import { buildBehaviorCognitiveSnapshot } from "./behaviorCognitiveObservabilityService";

describe("Behavior Cognitive Observability Service", () => {
  it("constrói sinais de vida social, silêncio e contexto humano", () => {
    const rawEvents: RawBehaviorEvent[] = [
      {
        eventType: "message_received",
        source: "messages.upsert",
        direction: "inbound",
        occurredAt: "2026-07-14T08:00:00.000Z",
        remoteJid: "551100000001@s.whatsapp.net",
        remoteType: "contact",
      },
      {
        eventType: "message_sent",
        source: "human_reply",
        direction: "outbound",
        occurredAt: "2026-07-14T08:10:00.000Z",
        remoteJid: "551100000001@s.whatsapp.net",
        remoteType: "contact",
      },
      {
        eventType: "message_received",
        source: "messages.upsert",
        direction: "inbound",
        occurredAt: "2026-07-16T21:00:00.000Z",
        remoteJid: "551100000001@s.whatsapp.net",
        remoteType: "contact",
      },
      {
        eventType: "message_sent",
        source: "human_reply",
        direction: "outbound",
        occurredAt: "2026-07-16T21:07:00.000Z",
        remoteJid: "551100000001@s.whatsapp.net",
        remoteType: "contact",
      },
      {
        eventType: "status_viewed",
        source: "human_observation",
        direction: "system",
        occurredAt: "2026-07-17T10:00:00.000Z",
        remoteJid: "551100000002@s.whatsapp.net",
        remoteType: "contact",
      },
      {
        eventType: "group_opened",
        source: "human_navigation",
        direction: "system",
        occurredAt: "2026-07-17T10:30:00.000Z",
        groupJid: "120363000000100@g.us",
        groupSubject: "Grupo Teste",
      },
    ];

    const normalized = normalizeBehaviorBatch(rawEvents);
    const cataloged = catalogEvidenceBatch(normalized);
    const episodes = buildBehaviorEpisodes(cataloged);
    const observability = buildBehaviorObservabilitySnapshot({ rawEvents, episodes });
    const identitySnapshot = generateIdentitySnapshot({
      episodes,
      evidenceCoverage: {
        evidenceCoverage: 80,
        messages: 4,
        status: 1,
        groups: 1,
        profile: 0,
        passivity: 1,
        presence: 2,
        coveredSignals: ["messages", "status", "groups", "passivity", "presence"],
        missingSignals: ["profile"],
      },
      pipelineVersions: {
        normalizerVersion: 1,
        catalogVersion: 1,
        episodeBuilderVersion: 1,
        memoryVersion: 1,
      },
      averageConfidence: 0.84,
      generatedAt: new Date("2026-07-17T12:00:00.000Z"),
    });
    const validation = buildBehaviorValidationSnapshot({
      rawEvents,
      episodes,
      observability,
      outcomes: [],
      opportunityObservations: [
        {
          opportunityId: "opp-1",
          observedAt: "2026-07-17T09:00:00.000Z",
          reason: "esperar momento melhor",
          riskAtDecision: 28,
          confidence: 64,
          expectedGain: 70,
          expectedRisk: 34,
          decision: "DO_NOTHING",
        },
      ],
      history: [],
      current: {
        windowStart: new Date("2026-07-14T08:00:00.000Z"),
        windowEnd: new Date("2026-07-17T12:00:00.000Z"),
        averageConfidence: 0.84,
        episodeConfidence: 0.84,
        evidenceCoverage: {
          evidenceCoverage: 80,
          messages: 4,
          status: 1,
          groups: 1,
          profile: 0,
          passivity: 1,
          presence: 2,
          coveredSignals: ["messages", "status", "groups", "passivity", "presence"],
          missingSignals: ["profile"],
        },
        pipelineCounters: {
          rawEvents: rawEvents.length,
          normalizedEvents: normalized.length,
          catalogedEvents: cataloged.length,
          episodes: episodes.length,
        },
        identitySnapshot,
        credibilityScore: 66,
      },
    });

    const relationshipMemory = [
      {
        counterpartKey: "551100000001@s.whatsapp.net",
        counterpartType: "contact" as const,
        stage: "trust" as const,
        firstInteractionAt: "2026-07-14T08:00:00.000Z",
        lastInteractionAt: "2026-07-16T21:07:00.000Z",
        trustScore: 72,
        relationshipRisk: 18,
        idealContactFrequencyHours: 36,
        inboundCount: 2,
        outboundCount: 2,
        recurringTopics: ["message_received", "message_sent"],
        signals: ["message_received", "message_sent"],
      },
      {
        counterpartKey: "120363000000100@g.us",
        counterpartType: "group" as const,
        stage: "known" as const,
        firstInteractionAt: "2026-07-17T10:30:00.000Z",
        lastInteractionAt: "2026-07-17T10:30:00.000Z",
        trustScore: 20,
        relationshipRisk: 28,
        idealContactFrequencyHours: 72,
        inboundCount: 0,
        outboundCount: 0,
        recurringTopics: ["group_opened"],
        signals: ["group_opened"],
      },
    ];

    const cognitive = buildBehaviorCognitiveSnapshot({
      rawEvents,
      episodes,
      observability,
      validation,
      identitySnapshot,
      opportunityObservations: [
        {
          opportunityId: "opp-1",
          observedAt: "2026-07-17T09:00:00.000Z",
          reason: "esperar momento melhor",
          riskAtDecision: 28,
          confidence: 64,
          expectedGain: 70,
          expectedRisk: 34,
          decision: "DO_NOTHING",
        },
      ],
      relationshipMemory,
      previousRelationshipMemory: [
        {
          ...relationshipMemory[0],
          trustScore: 58,
          relationshipRisk: 24,
          stage: "known",
        },
      ],
      history: [],
      journalEntries: [],
      credibilityScore: 66,
      now: new Date("2026-07-17T12:00:00.000Z"),
    });

    expect(cognitive.socialCircleEngine.length).toBeGreaterThan(0);
    expect(cognitive.relationshipEvolution[0]?.evolution).toBe("growing");
    expect(cognitive.reciprocityScore.overallScore).toBeGreaterThanOrEqual(0);
    expect(cognitive.silenceIntelligence.windows.length).toBeGreaterThan(0);
    expect(cognitive.dailyContext.weekday.length).toBeGreaterThan(0);
    expect(cognitive.counterfactualSimulator.scenarios).toHaveLength(4);
  });
});
