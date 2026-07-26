import { describe, expect, it } from "vitest";
import { buildBehaviorEpisodes } from "./episodeBuilderService";
import { catalogEvidenceBatch } from "./evidenceCatalogService";
import { normalizeBehaviorBatch, RawBehaviorEvent } from "./evidenceNormalizerService";
import { buildBehaviorObservabilitySnapshot } from "./behaviorObservabilityService";
import { generateIdentitySnapshot } from "./identitySnapshotGeneratorService";
import { buildBehaviorValidationSnapshot } from "./behaviorValidationService";

function makePipeline(rawEvents: RawBehaviorEvent[]) {
  const normalized = normalizeBehaviorBatch(rawEvents);
  const cataloged = catalogEvidenceBatch(normalized);
  const episodes = buildBehaviorEpisodes(cataloged);
  const observability = buildBehaviorObservabilitySnapshot({ rawEvents, episodes });
  const identitySnapshot = generateIdentitySnapshot({
    episodes,
    evidenceCoverage: {
      evidenceCoverage: 62,
      messages: 3,
      status: 0,
      groups: 0,
      profile: 0,
      passivity: 1,
      presence: 1,
      coveredSignals: ["messages", "passivity", "presence"],
      missingSignals: ["status", "groups", "profile"],
    },
    pipelineVersions: {
      normalizerVersion: 1,
      catalogVersion: 1,
      episodeBuilderVersion: 1,
      memoryVersion: 1,
    },
    averageConfidence: 0.42,
    generatedAt: new Date("2026-07-17T12:00:00.000Z"),
  });

  return { episodes, observability, identitySnapshot };
}

describe("Behavior Validation Service", () => {
  it("produz UNKNOWN e evidencia gap quando a base observacional é fraca", () => {
    const rawEvents: RawBehaviorEvent[] = [
      {
        eventType: "message_received",
        source: "messages.upsert",
        direction: "inbound",
        occurredAt: "2026-07-17T10:00:00.000Z",
        remoteJid: "5511999999999@s.whatsapp.net",
        remoteType: "contact",
      },
      {
        eventType: "message_sent",
        source: "human_reply",
        direction: "outbound",
        occurredAt: "2026-07-17T10:04:00.000Z",
        remoteJid: "5511999999999@s.whatsapp.net",
        remoteType: "contact",
      },
    ];

    const pipeline = makePipeline(rawEvents);
    const validation = buildBehaviorValidationSnapshot({
      rawEvents,
      episodes: pipeline.episodes,
      observability: pipeline.observability,
      outcomes: [],
      opportunityObservations: [],
      history: [],
      current: {
        windowStart: new Date("2026-07-17T09:00:00.000Z"),
        windowEnd: new Date("2026-07-17T12:00:00.000Z"),
        averageConfidence: 0.42,
        episodeConfidence: 0.42,
        evidenceCoverage: {
          evidenceCoverage: 62,
          messages: 3,
          status: 0,
          groups: 0,
          profile: 0,
          passivity: 1,
          presence: 1,
          coveredSignals: ["messages", "passivity", "presence"],
          missingSignals: ["status", "groups", "profile"],
        },
        pipelineCounters: {
          rawEvents: 2,
          normalizedEvents: 2,
          catalogedEvents: 2,
          episodes: pipeline.episodes.length,
        },
        identitySnapshot: pipeline.identitySnapshot,
        credibilityScore: 38,
      },
    });

    expect(validation.unknownState.state).toBe("UNKNOWN");
    expect(validation.evidenceGap.reasons.length).toBeGreaterThan(0);
    expect(validation.confidenceCalibration.components.find((item) => item.component === "planner")?.status).toBe("unknown");
  });

  it("usa ground truth e oportunidades para montar calibração, dívida e budgets", () => {
    const rawEvents: RawBehaviorEvent[] = [
      {
        eventType: "message_received",
        source: "messages.upsert",
        direction: "inbound",
        occurredAt: "2026-07-16T08:00:00.000Z",
        remoteJid: "5511888888888@s.whatsapp.net",
        remoteType: "contact",
      },
      {
        eventType: "message_sent",
        source: "campaign_dispatch",
        direction: "outbound",
        occurredAt: "2026-07-16T08:05:00.000Z",
        remoteJid: "5511888888888@s.whatsapp.net",
        remoteType: "contact",
        contentPreview: "https://example.com/a",
      },
      {
        eventType: "message_received",
        source: "messages.upsert",
        direction: "inbound",
        occurredAt: "2026-07-16T09:00:00.000Z",
        remoteJid: "5511777777777@s.whatsapp.net",
        remoteType: "contact",
      },
      {
        eventType: "message_sent",
        source: "campaign_dispatch",
        direction: "outbound",
        occurredAt: "2026-07-16T09:05:00.000Z",
        remoteJid: "5511777777777@s.whatsapp.net",
        remoteType: "contact",
        contentPreview: "https://example.com/b",
      },
    ];

    const pipeline = makePipeline(rawEvents);
    const validation = buildBehaviorValidationSnapshot({
      rawEvents,
      episodes: pipeline.episodes,
      observability: pipeline.observability,
      outcomes: [
        {
          chipId: 1,
          observationWindowStart: "2026-07-10T00:00:00.000Z",
          observationWindowEnd: "2026-07-11T00:00:00.000Z",
          predictedRisk: 70,
          predictedCredibility: 55,
          actualOutcome: "restriction",
          restrictionOccurred: true,
          warningOccurred: false,
          banOccurred: false,
          humanLikeOutcome: "not_human_like",
          validatedAt: "2026-07-12T00:00:00.000Z",
          payload: {
            componentConfidences: {
              normalizer: 0.81,
              catalog: 0.8,
              episode: 0.76,
              identity: 0.7,
            },
            observedPatterns: ["excess_links"],
          },
        },
        {
          chipId: 1,
          observationWindowStart: "2026-07-12T00:00:00.000Z",
          observationWindowEnd: "2026-07-13T00:00:00.000Z",
          predictedRisk: 35,
          predictedCredibility: 74,
          actualOutcome: "healthy",
          restrictionOccurred: false,
          warningOccurred: false,
          banOccurred: false,
          humanLikeOutcome: "human_like",
          validatedAt: "2026-07-14T00:00:00.000Z",
          payload: {
            componentConfidences: {
              normalizer: 0.74,
              catalog: 0.71,
              episode: 0.69,
              identity: 0.72,
            },
            observedPatterns: ["excess_links"],
          },
        },
      ],
      opportunityObservations: [
        {
          opportunityId: "opp-1",
          observedAt: "2026-07-15T10:00:00.000Z",
          reason: "horário ruim",
          riskAtDecision: 65,
          confidence: 52,
          expectedGain: 82,
          expectedRisk: 70,
          decision: "DO_NOTHING",
        },
      ],
      history: [],
      current: {
        windowStart: new Date("2026-07-16T07:00:00.000Z"),
        windowEnd: new Date("2026-07-16T12:00:00.000Z"),
        averageConfidence: 0.76,
        episodeConfidence: 0.76,
        evidenceCoverage: {
          evidenceCoverage: 70,
          messages: 4,
          status: 0,
          groups: 0,
          profile: 0,
          passivity: 1,
          presence: 1,
          coveredSignals: ["messages", "passivity", "presence"],
          missingSignals: ["status", "groups", "profile"],
        },
        pipelineCounters: {
          rawEvents: 4,
          normalizedEvents: 4,
          catalogedEvents: 4,
          episodes: pipeline.episodes.length,
        },
        identitySnapshot: pipeline.identitySnapshot,
        credibilityScore: 61,
      },
    });

    expect(validation.groundTruth.sampleSize).toBe(2);
    expect(validation.confidenceCalibration.components.find((item) => item.component === "identity")?.sampleSize).toBe(2);
    expect(validation.decisionDebt.ignoredOpportunities).toBe(1);
    expect(validation.riskBudget.remaining).toBeGreaterThanOrEqual(0);
    expect(validation.credibilityBudget.remaining).toBeGreaterThanOrEqual(0);
    expect(validation.antiPatternLearning.length).toBeGreaterThanOrEqual(0);
  });
});
