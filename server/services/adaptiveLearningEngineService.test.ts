import { describe, expect, it } from "vitest";
import { buildBehaviorEpisodes } from "./episodeBuilderService";
import { catalogEvidenceBatch } from "./evidenceCatalogService";
import { normalizeBehaviorBatch, RawBehaviorEvent } from "./evidenceNormalizerService";
import { buildBehaviorObservabilitySnapshot } from "./behaviorObservabilityService";
import { generateIdentitySnapshot } from "./identitySnapshotGeneratorService";
import { buildBehaviorValidationSnapshot } from "./behaviorValidationService";
import { buildBehaviorLongitudinalSnapshot } from "./behaviorLongitudinalService";
import { buildAdaptiveLearningSnapshot } from "./adaptiveLearningEngineService";

describe("Adaptive Learning Engine Service", () => {
  it("gera hipóteses, ranking de experiências, calibração e conhecimento vivo", () => {
    const rawEvents: RawBehaviorEvent[] = [
      {
        eventType: "message_received",
        source: "messages.upsert",
        direction: "inbound",
        occurredAt: "2026-07-14T09:00:00.000Z",
        remoteJid: "551100000001@s.whatsapp.net",
        remoteType: "contact",
      },
      {
        eventType: "message_sent",
        source: "human_reply",
        direction: "outbound",
        occurredAt: "2026-07-14T09:08:00.000Z",
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
        occurredAt: "2026-07-16T21:10:00.000Z",
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
    ];

    const normalized = normalizeBehaviorBatch(rawEvents);
    const cataloged = catalogEvidenceBatch(normalized);
    const episodes = buildBehaviorEpisodes(cataloged);
    const observability = buildBehaviorObservabilitySnapshot({ rawEvents, episodes });
    const identitySnapshot = generateIdentitySnapshot({
      episodes,
      evidenceCoverage: {
        evidenceCoverage: 74,
        messages: 4,
        status: 1,
        groups: 0,
        profile: 0,
        passivity: 1,
        presence: 1,
        coveredSignals: ["messages", "status", "passivity", "presence"],
        missingSignals: ["groups", "profile"],
      },
      pipelineVersions: {
        normalizerVersion: 1,
        catalogVersion: 1,
        episodeBuilderVersion: 1,
        memoryVersion: 1,
      },
      averageConfidence: 0.81,
      generatedAt: new Date("2026-07-17T12:00:00.000Z"),
    });
    const validation = buildBehaviorValidationSnapshot({
      rawEvents,
      episodes,
      observability,
      outcomes: [
        {
          chipId: 1,
          observationWindowStart: "2026-07-10T00:00:00.000Z",
          observationWindowEnd: "2026-07-11T00:00:00.000Z",
          predictedRisk: 30,
          predictedCredibility: 68,
          actualOutcome: "healthy",
          restrictionOccurred: false,
          warningOccurred: false,
          banOccurred: false,
          humanLikeOutcome: "human_like",
          payload: {
            componentConfidences: {
              normalizer: 0.8,
              catalog: 0.78,
              episode: 0.76,
              identity: 0.74,
            },
          },
        },
        {
          chipId: 1,
          observationWindowStart: "2026-07-12T00:00:00.000Z",
          observationWindowEnd: "2026-07-13T00:00:00.000Z",
          predictedRisk: 55,
          predictedCredibility: 52,
          actualOutcome: "warning",
          restrictionOccurred: false,
          warningOccurred: true,
          banOccurred: false,
          humanLikeOutcome: "uncertain",
          payload: {
            componentConfidences: {
              normalizer: 0.62,
              catalog: 0.6,
              episode: 0.57,
              identity: 0.55,
            },
          },
        },
      ],
      opportunityObservations: [
        {
          opportunityId: "opp-1",
          observedAt: "2026-07-17T09:00:00.000Z",
          reason: "esperar resposta humana",
          riskAtDecision: 28,
          confidence: 64,
          expectedGain: 70,
          expectedRisk: 34,
          decision: "DO_NOTHING",
        },
      ],
      history: [],
      current: {
        windowStart: new Date("2026-07-14T09:00:00.000Z"),
        windowEnd: new Date("2026-07-17T12:00:00.000Z"),
        averageConfidence: 0.81,
        episodeConfidence: 0.81,
        evidenceCoverage: {
          evidenceCoverage: 74,
          messages: 4,
          status: 1,
          groups: 0,
          profile: 0,
          passivity: 1,
          presence: 1,
          coveredSignals: ["messages", "status", "passivity", "presence"],
          missingSignals: ["groups", "profile"],
        },
        pipelineCounters: {
          rawEvents: rawEvents.length,
          normalizedEvents: normalized.length,
          catalogedEvents: cataloged.length,
          episodes: episodes.length,
        },
        identitySnapshot,
        credibilityScore: 63,
      },
    });
    const longitudinal = buildBehaviorLongitudinalSnapshot({
      rawEvents,
      episodes,
      observability,
      validation,
      identitySnapshot,
      history: [],
      journalEntries: [
        {
          chapterId: "exp-older",
          observedAt: "2026-07-10T12:00:00.000Z",
          riskBefore: 24,
          credibilityBefore: 48,
          strategyChosen: "maintain_natural_presence",
          actionTaken: "observe_only",
          payload: {
            context: {
              chipAgeDays: 10,
              diversity: 56,
              socialExposure: 44,
              predictability: 35,
              timeBucket: "tarde",
            },
            resultObserved: {
              after24h: "sem restricao",
            },
          },
        },
      ],
      opportunityObservations: [
        {
          opportunityId: "opp-1",
          observedAt: "2026-07-17T09:00:00.000Z",
          reason: "esperar resposta humana",
          riskAtDecision: 28,
          confidence: 64,
          expectedGain: 70,
          expectedRisk: 34,
          decision: "DO_NOTHING",
        },
      ],
      previousRelationshipMemory: [],
      chipCreatedAt: "2026-07-01T12:00:00.000Z",
      credibilityScore: 63,
      now: new Date("2026-07-17T12:00:00.000Z"),
    });

    const adaptive = buildAdaptiveLearningSnapshot({
      observability,
      validation,
      longitudinal,
      cognitive: longitudinal.cognitive,
      outcomes: [
        {
          chipId: 1,
          observationWindowStart: "2026-07-10T00:00:00.000Z",
          observationWindowEnd: "2026-07-11T00:00:00.000Z",
          predictedRisk: 30,
          predictedCredibility: 68,
          actualOutcome: "healthy",
          restrictionOccurred: false,
          warningOccurred: false,
          banOccurred: false,
          humanLikeOutcome: "human_like",
          payload: {
            componentConfidences: {
              normalizer: 0.8,
              catalog: 0.78,
              episode: 0.76,
              identity: 0.74,
            },
          },
        },
      ],
      journalEntries: [
        {
          chapterId: "exp-older",
          observedAt: "2026-07-10T12:00:00.000Z",
          riskBefore: 24,
          credibilityBefore: 48,
          strategyChosen: "maintain_natural_presence",
          actionTaken: "observe_only",
          payload: {
            context: {
              chipAgeDays: 10,
              diversity: 56,
              socialExposure: 44,
              predictability: 35,
              timeBucket: "tarde",
            },
            resultObserved: {
              after24h: "sem restricao",
            },
          },
        },
      ],
      existingHypotheses: [],
      existingKnowledge: [],
      now: new Date("2026-07-17T12:00:00.000Z"),
    });

    expect(adaptive.hypotheses.length).toBeGreaterThan(0);
    expect(adaptive.rankedExperiences.length).toBe(1);
    expect(adaptive.calibration.components.length).toBe(5);
    expect(adaptive.learningEvents.length).toBeGreaterThan(0);
    expect(adaptive.batchSummary.hypothesesObserved).toBe(adaptive.hypotheses.length);
  });
});
