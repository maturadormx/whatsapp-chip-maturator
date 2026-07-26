import { describe, expect, it } from "vitest";
import { buildBehaviorEpisodes } from "./episodeBuilderService";
import { catalogEvidenceBatch } from "./evidenceCatalogService";
import { normalizeBehaviorBatch, RawBehaviorEvent } from "./evidenceNormalizerService";
import { buildBehaviorObservabilitySnapshot } from "./behaviorObservabilityService";
import { generateIdentitySnapshot } from "./identitySnapshotGeneratorService";
import { buildBehaviorValidationSnapshot } from "./behaviorValidationService";
import { buildBehaviorLongitudinalSnapshot } from "./behaviorLongitudinalService";

function makeScenario(rawEvents: RawBehaviorEvent[]) {
  const normalized = normalizeBehaviorBatch(rawEvents);
  const cataloged = catalogEvidenceBatch(normalized);
  const episodes = buildBehaviorEpisodes(cataloged);
  const observability = buildBehaviorObservabilitySnapshot({ rawEvents, episodes });
  const identitySnapshot = generateIdentitySnapshot({
    episodes,
    evidenceCoverage: {
      evidenceCoverage: 78,
      messages: 6,
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
    averageConfidence: 0.82,
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
        observedAt: "2026-07-16T12:00:00.000Z",
        reason: "aguardar resposta humana",
        riskAtDecision: 34,
        confidence: 61,
        expectedGain: 70,
        expectedRisk: 38,
        decision: "DO_NOTHING",
      },
    ],
    history: [],
    current: {
      windowStart: new Date("2026-07-16T08:00:00.000Z"),
      windowEnd: new Date("2026-07-17T12:00:00.000Z"),
      averageConfidence: 0.82,
      episodeConfidence: 0.82,
      evidenceCoverage: {
        evidenceCoverage: 78,
        messages: 6,
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
      credibilityScore: 64,
    },
  });

  return { episodes, observability, identitySnapshot, validation };
}

describe("Behavior Longitudinal Service", () => {
  it("constrói experiência, memória por relacionamento e timeline longitudinal", () => {
    const rawEvents: RawBehaviorEvent[] = [
      {
        eventType: "message_received",
        source: "messages.upsert",
        direction: "inbound",
        occurredAt: "2026-07-16T09:00:00.000Z",
        remoteJid: "5511999999999@s.whatsapp.net",
        remoteType: "contact",
      },
      {
        eventType: "message_sent",
        source: "human_reply",
        direction: "outbound",
        occurredAt: "2026-07-16T09:12:00.000Z",
        remoteJid: "5511999999999@s.whatsapp.net",
        remoteType: "contact",
      },
      {
        eventType: "status_viewed",
        source: "human_observation",
        direction: "system",
        occurredAt: "2026-07-16T12:00:00.000Z",
        remoteJid: "5511888888888@s.whatsapp.net",
        remoteType: "contact",
      },
      {
        eventType: "group_opened",
        source: "human_navigation",
        direction: "system",
        occurredAt: "2026-07-16T18:00:00.000Z",
        groupJid: "120363000000001@g.us",
        groupSubject: "Grupo Teste",
      },
    ];

    const scenario = makeScenario(rawEvents);
    const longitudinal = buildBehaviorLongitudinalSnapshot({
      rawEvents,
      episodes: scenario.episodes,
      observability: scenario.observability,
      validation: scenario.validation,
      identitySnapshot: scenario.identitySnapshot,
      history: [],
      journalEntries: [
        {
          chapterId: "exp-older",
          observedAt: "2026-07-10T12:00:00.000Z",
          riskBefore: 28,
          credibilityBefore: 42,
          strategyChosen: "maintain_natural_presence",
          actionTaken: "observe_only",
          payload: {
            context: {
              chipAgeDays: 12,
              diversity: 58,
              socialExposure: 47,
              predictability: 38,
              timeBucket: "tarde",
            },
          },
        },
      ],
      opportunityObservations: [
        {
          opportunityId: "opp-1",
          observedAt: "2026-07-16T12:00:00.000Z",
          reason: "esperar maturação do contato",
          riskAtDecision: 34,
          confidence: 61,
          expectedGain: 70,
          expectedRisk: 38,
          decision: "DO_NOTHING",
        },
      ],
      chipCreatedAt: "2026-07-01T12:00:00.000Z",
      credibilityScore: 64,
      now: new Date("2026-07-17T12:00:00.000Z"),
    });

    expect(longitudinal.experienceJournalCandidate.chapterId).toContain("exp-");
    expect(longitudinal.relationshipMemory.length).toBeGreaterThan(0);
    expect(longitudinal.digitalCredibilityTimeline.length).toBeGreaterThan(0);
    expect(longitudinal.trustAccumulationModel.currentTrust).toBeGreaterThanOrEqual(0);
    expect(longitudinal.similarExperiences.length).toBe(1);
    expect(longitudinal.socialExposureAnalyzer.exposureScore).toBeGreaterThanOrEqual(0);
    expect(longitudinal.cognitive.socialCircleEngine.length).toBeGreaterThan(0);
    expect(longitudinal.cognitive.counterfactualSimulator.scenarios).toHaveLength(4);
  });
});
