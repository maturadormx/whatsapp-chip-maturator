import { describe, expect, it } from "vitest";
import {
  FleetLearningProjection,
  buildFleetLearningSnapshot,
} from "./fleetLearningService";

describe("Fleet Learning Service", () => {
  it("agrupa a frota em coortes, descobre padrões e gera promoções de conhecimento", () => {
    const projections: FleetLearningProjection[] = [
      {
        chipId: 1,
        chipName: "chip-a",
        chipStatus: "conectado",
        chipAgeDays: 3,
        ageBucket: "primeiros_dias",
        exposureMode: "exposicao_passiva",
        riskBucket: "baixo_risco",
        relationshipCount: 4,
        trustLevel: 48,
        successRate: 74,
        contradictionRate: 18,
        credibilityScore: 68,
        riskScore: 22,
        activeKnowledge: 2,
        decayingKnowledge: 0,
        socialExposure: 42,
        diversity: 63,
        predictability: 37,
        passiveShare: 72,
        activeShare: 28,
        dominantMood: "active",
        timeBucket: "manha",
      },
      {
        chipId: 2,
        chipName: "chip-b",
        chipStatus: "conectado",
        chipAgeDays: 5,
        ageBucket: "primeiros_dias",
        exposureMode: "exposicao_passiva",
        riskBucket: "baixo_risco",
        relationshipCount: 5,
        trustLevel: 52,
        successRate: 78,
        contradictionRate: 16,
        credibilityScore: 71,
        riskScore: 25,
        activeKnowledge: 3,
        decayingKnowledge: 1,
        socialExposure: 45,
        diversity: 66,
        predictability: 35,
        passiveShare: 69,
        activeShare: 31,
        dominantMood: "active",
        timeBucket: "tarde",
      },
      {
        chipId: 3,
        chipName: "chip-c",
        chipStatus: "conectado",
        chipAgeDays: 18,
        ageBucket: "aquecimento",
        exposureMode: "exposicao_ativa",
        riskBucket: "medio_risco",
        relationshipCount: 9,
        trustLevel: 61,
        successRate: 57,
        contradictionRate: 42,
        credibilityScore: 54,
        riskScore: 58,
        activeKnowledge: 1,
        decayingKnowledge: 2,
        socialExposure: 58,
        diversity: 49,
        predictability: 71,
        passiveShare: 32,
        activeShare: 68,
        dominantMood: "busy",
        timeBucket: "noite",
      },
    ];

    const fleet = buildFleetLearningSnapshot({
      currentChipId: 1,
      projections,
      now: new Date("2026-07-17T15:00:00.000Z"),
    });

    expect(fleet.cohorts.length).toBeGreaterThan(0);
    expect(fleet.patterns.some((item) => item.patternKey.includes("passive_early_maturation"))).toBe(true);
    expect(fleet.promotions.length).toBeGreaterThan(0);
    expect(fleet.recommendations.length).toBeGreaterThan(0);
    expect(fleet.benchmark.totalChips).toBe(3);
    expect(fleet.opportunityAnalytics.bestCohorts.length).toBeGreaterThan(0);
  });
});
