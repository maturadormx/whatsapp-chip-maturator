import { describe, expect, it } from "vitest";
import { buildBehaviorEpisodes } from "./episodeBuilderService";
import { catalogEvidenceBatch } from "./evidenceCatalogService";
import { normalizeBehaviorBatch, RawBehaviorEvent } from "./evidenceNormalizerService";
import {
  buildBehaviorObservabilitySnapshot,
  buildCredibilityTrend,
  buildIdentityDriftTimeline,
} from "./behaviorObservabilityService";
import { generateIdentitySnapshot } from "./identitySnapshotGeneratorService";

function buildPipeline(rawEvents: RawBehaviorEvent[]) {
  const normalized = normalizeBehaviorBatch(rawEvents);
  const cataloged = catalogEvidenceBatch(normalized);
  const episodes = buildBehaviorEpisodes(cataloged);
  const observability = buildBehaviorObservabilitySnapshot({ rawEvents, episodes });
  const identity = generateIdentitySnapshot({
    episodes,
    evidenceCoverage: {
      evidenceCoverage: 80,
      messages: 5,
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
    averageConfidence: 0.8,
    generatedAt: new Date("2026-07-17T12:00:00.000Z"),
  });

  return {
    observability,
    identity,
  };
}

describe("Behavior Observability Service", () => {
  it("detecta anti-patterns e produz scores observacionais", () => {
    const rawEvents: RawBehaviorEvent[] = [
      { eventType: "message_received", source: "messages.upsert", direction: "inbound", occurredAt: "2026-07-16T08:00:00.000Z", remoteJid: "551100000001@s.whatsapp.net", remoteType: "contact" },
      { eventType: "message_sent", source: "campaign_dispatch", direction: "outbound", occurredAt: "2026-07-16T08:05:00.000Z", remoteJid: "551100000001@s.whatsapp.net", remoteType: "contact", contentPreview: "https://example.com/1" },
      { eventType: "message_received", source: "messages.upsert", direction: "inbound", occurredAt: "2026-07-16T09:00:00.000Z", remoteJid: "551100000002@s.whatsapp.net", remoteType: "contact" },
      { eventType: "message_sent", source: "campaign_dispatch", direction: "outbound", occurredAt: "2026-07-16T09:05:00.000Z", remoteJid: "551100000002@s.whatsapp.net", remoteType: "contact", contentPreview: "https://example.com/2" },
      { eventType: "message_received", source: "messages.upsert", direction: "inbound", occurredAt: "2026-07-16T10:00:00.000Z", remoteJid: "551100000003@s.whatsapp.net", remoteType: "contact" },
      { eventType: "message_sent", source: "campaign_dispatch", direction: "outbound", occurredAt: "2026-07-16T10:05:00.000Z", remoteJid: "551100000003@s.whatsapp.net", remoteType: "contact", contentPreview: "https://example.com/3" },
      { eventType: "message_received", source: "messages.upsert", direction: "inbound", occurredAt: "2026-07-16T11:00:00.000Z", remoteJid: "551100000004@s.whatsapp.net", remoteType: "contact" },
      { eventType: "message_sent", source: "campaign_dispatch", direction: "outbound", occurredAt: "2026-07-16T11:05:00.000Z", remoteJid: "551100000004@s.whatsapp.net", remoteType: "contact", contentPreview: "https://example.com/4" }
    ];

    const result = buildPipeline(rawEvents).observability;

    expect(result.antiPatterns.summary.total).toBeGreaterThan(0);
    expect(result.behaviorVariance.score).toBeGreaterThanOrEqual(0);
    expect(result.behaviorVariance.score).toBeLessThanOrEqual(100);
    expect(result.personaDiversity.score).toBeGreaterThanOrEqual(0);
    expect(result.socialGraphHealth.activeContacts).toBe(4);
  });

  it("constrói tendência e timeline de drift a partir do histórico", () => {
    const first = buildPipeline([
      { eventType: "message_received", source: "messages.upsert", direction: "inbound", occurredAt: "2026-07-01T08:00:00.000Z", remoteJid: "551100000001@s.whatsapp.net", remoteType: "contact" },
      { eventType: "message_sent", source: "human_reply", direction: "outbound", occurredAt: "2026-07-01T08:20:00.000Z", remoteJid: "551100000001@s.whatsapp.net", remoteType: "contact" }
    ]);

    const second = buildPipeline([
      { eventType: "message_received", source: "messages.upsert", direction: "inbound", occurredAt: "2026-07-16T08:00:00.000Z", remoteJid: "551100000001@s.whatsapp.net", remoteType: "contact" },
      { eventType: "message_sent", source: "human_reply", direction: "outbound", occurredAt: "2026-07-16T08:03:00.000Z", remoteJid: "551100000001@s.whatsapp.net", remoteType: "contact" },
      { eventType: "status_viewed", source: "human_observation", direction: "system", occurredAt: "2026-07-16T12:00:00.000Z", remoteJid: "551100000002@s.whatsapp.net", remoteType: "contact" }
    ]);

    const history = [
      {
        windowEnd: "2026-07-01T12:00:00.000Z",
        payload: {
          averageConfidence: 0.68,
          pipelineHealth: { score: 60 },
          identitySnapshot: first.identity,
          evidenceCoverage: { evidenceCoverage: 55 },
          extra: { observability: first.observability },
        },
      },
      {
        windowEnd: "2026-07-16T12:00:00.000Z",
        payload: {
          averageConfidence: 0.84,
          pipelineHealth: { score: 78 },
          identitySnapshot: second.identity,
          evidenceCoverage: { evidenceCoverage: 80 },
          extra: { observability: second.observability },
        },
      },
    ];

    const trend = buildCredibilityTrend({ history, now: new Date("2026-07-17T12:00:00.000Z") });
    const timeline = buildIdentityDriftTimeline({ history });

    expect(trend).toHaveLength(4);
    expect(timeline.length).toBe(2);
    expect(timeline[0].observedAt).toContain("2026-07");
  });
});
