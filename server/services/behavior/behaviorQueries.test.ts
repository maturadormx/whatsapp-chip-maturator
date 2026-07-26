import { describe, expect, it } from "vitest";
import {
  buildAveragePhaseDuration,
  buildOperationalAlerts,
  buildPhaseDistribution,
  buildRecentPolicyVersions,
  buildStuckChips,
  buildTopBlockReasons,
  parsePolicyFingerprint,
} from "./behaviorQueries";

describe("behaviorQueries", () => {
  it("agrega top block reasons em ordem decrescente", () => {
    const result = buildTopBlockReasons([
      { reason: "Phase" },
      { reason: "Phase" },
      { reason: "Budget" },
    ] as any);

    expect(result[0]).toEqual({
      reason: "Phase",
      count: 2,
      percentage: 66.7,
    });
    expect(result[1].reason).toBe("Budget");
  });

  it("calcula distribuição de fases com percentual", () => {
    const result = buildPhaseDistribution([
      { phase: "birth" },
      { phase: "birth" },
      { phase: "mature" },
      { phase: "reactive" },
    ] as any);

    expect(result.find((row) => row.phase === "birth")?.count).toBe(2);
    expect(result.find((row) => row.phase === "birth")?.percentage).toBe(50);
  });

  it("detecta chips presos acima do limiar", () => {
    const now = new Date("2026-07-20T15:00:00.000Z");
    const result = buildStuckChips(
      [
        { chipId: 1, phase: "birth", updatedAt: new Date("2026-07-18T12:00:00.000Z"), lastReason: "Phase" },
        { chipId: 2, phase: "mature", updatedAt: new Date("2026-07-20T10:00:00.000Z"), lastReason: "approved" },
      ] as any,
      24,
      now,
    );

    expect(result).toHaveLength(1);
    expect(result[0].chipId).toBe(1);
    expect(result[0].hoursInPhase).toBeGreaterThan(24);
  });

  it("calcula duração média por fase", () => {
    const now = new Date("2026-07-20T15:00:00.000Z");
    const result = buildAveragePhaseDuration(
      [
        { phase: "birth", updatedAt: new Date("2026-07-20T05:00:00.000Z") },
        { phase: "birth", updatedAt: new Date("2026-07-20T10:00:00.000Z") },
        { phase: "mature", updatedAt: new Date("2026-07-19T15:00:00.000Z") },
      ] as any,
      now,
    );

    expect(result.find((row) => row.phase === "birth")?.averageHours).toBe(7.5);
    expect(result.find((row) => row.phase === "birth")?.chipCount).toBe(2);
  });

  it("agrega versões recentes de política por fingerprint", () => {
    const result = buildRecentPolicyVersions(
      [
        { policyFingerprint: "2.1.0:2026.07.20:abc12345", engineVersion: "2.1.0", createdAt: new Date("2026-07-20T15:00:00.000Z") },
        { policyFingerprint: "2.1.0:2026.07.20:abc12345", engineVersion: "2.1.0", createdAt: new Date("2026-07-20T14:00:00.000Z") },
        { policyFingerprint: "2.1.0:2026.07.19:def67890", engineVersion: "2.1.0", createdAt: new Date("2026-07-19T15:00:00.000Z") },
      ] as any,
      5,
    );

    expect(result[0].policyVersion).toBe("2026.07.20");
    expect(result[0].decisionCount).toBe(2);
    expect(result[0].rulesRevision).toBe("abc12345");
  });

  it("gera alertas operacionais a partir de stuck chips e bloqueios", () => {
    const alerts = buildOperationalAlerts({
      stuckChips: [
        { chipId: 1, phase: "birth", hoursInPhase: 60, lastDecisionAt: "2026-07-18T00:00:00.000Z", lastReason: "Phase" },
        { chipId: 2, phase: "reactive", hoursInPhase: 30, lastDecisionAt: "2026-07-19T00:00:00.000Z", lastReason: "cooldown ativo" },
      ],
      topBlockReasons: [
        { reason: "Phase", count: 10, percentage: 62.5 },
      ],
    });

    expect(alerts.some((alert) => alert.includes("birth"))).toBe(true);
    expect(alerts.some((alert) => alert.includes("cooldown"))).toBe(true);
    expect(alerts.some((alert) => alert.includes("62.5%"))).toBe(true);
  });

  it("faz parse do fingerprint persistido", () => {
    const parsed = parsePolicyFingerprint("2.1.0:2026.07.20:abc12345");
    expect(parsed.engineVersion).toBe("2.1.0");
    expect(parsed.policyVersion).toBe("2026.07.20");
    expect(parsed.rulesRevision).toBe("abc12345");
  });
});
