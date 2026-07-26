import { describe, expect, test, vi } from "vitest";
import { evaluateBehaviorPolicy } from "../../../server/services/behavior/behaviorPolicyEngine";

function withFixedRandom() {
  vi.spyOn(Math, "random").mockReturnValue(0);
}

function allBirthScenarios() {
  const now = new Date("2026-07-20T15:00:00.000Z");
  return [
    { trustScore: 0, chipAgeDays: 0 },
    { trustScore: 10, chipAgeDays: 1 },
    { trustScore: 20, chipAgeDays: 2 },
  ].map((scenario, index) => ({
    chipId: 100 + index,
    action: "initiate_dm" as const,
    riskScore: 0,
    stats: {
      inboundCount: 0,
      outboundCount: 0,
      todayActionCount: 0,
      todayActionTypes: [],
    },
    now,
    ...scenario,
  }));
}

function allCriticalRiskScenarios() {
  const now = new Date("2026-07-20T15:00:00.000Z");
  return [
    { chipId: 201, trustScore: 10, chipAgeDays: 1, action: "view_status" as const },
    { chipId: 202, trustScore: 50, chipAgeDays: 12, action: "message_sent" as const, stats: { inboundCount: 20, outboundCount: 10, todayActionCount: 1, todayActionTypes: ["reply"] } },
    { chipId: 203, trustScore: 90, chipAgeDays: 40, action: "initiate_dm" as const, stats: { inboundCount: 20, outboundCount: 10, todayActionCount: 1, todayActionTypes: ["view_status"] } },
  ].map((scenario) => ({
    riskScore: 100,
    now,
    ...scenario,
  }));
}

describe("Policy Contracts", () => {
  test("Birth never initiates outbound", () => {
    withFixedRandom();

    for (const scenario of allBirthScenarios()) {
      const decision = evaluateBehaviorPolicy(scenario);
      expect(decision.allowed).toBe(false);
      expect(decision.checks.phase.status).toBe("FAIL");
    }

    vi.restoreAllMocks();
  });

  test("Critical risk never approves execution", () => {
    withFixedRandom();

    for (const scenario of allCriticalRiskScenarios()) {
      const decision = evaluateBehaviorPolicy(scenario);
      expect(decision.allowed).toBe(false);
      expect(decision.checks.risk.status).toBe("FAIL");
    }

    vi.restoreAllMocks();
  });

  test("Budget exhausted never returns ALLOW", () => {
    withFixedRandom();

    const decision = evaluateBehaviorPolicy({
      chipId: 301,
      action: "message_sent",
      chipAgeDays: 12,
      trustScore: 50,
      riskScore: 10,
      stats: {
        inboundCount: 20,
        outboundCount: 10,
        todayActionCount: 6,
        todayActionTypes: ["message_sent", "message_sent", "message_sent", "message_sent", "message_sent", "message_sent"],
      },
      now: new Date("2026-07-20T15:00:00.000Z"),
    });

    expect(decision.allowed).toBe(false);
    expect(decision.checks.budget.status).toBe("FAIL");

    vi.restoreAllMocks();
  });

  test("Every decision contains fingerprint", () => {
    withFixedRandom();

    const decision = evaluateBehaviorPolicy({
      chipId: 302,
      action: "view_status",
      chipAgeDays: 10,
      trustScore: 45,
      riskScore: 10,
      now: new Date("2026-07-20T15:00:00.000Z"),
    });

    expect(decision.fingerprint.engineVersion).toBeTruthy();
    expect(decision.fingerprint.policyVersion).toBeTruthy();
    expect(decision.fingerprint.policyHash).toHaveLength(8);
    expect(decision.fingerprint.fingerprint).toContain(decision.fingerprint.policyHash);

    vi.restoreAllMocks();
  });

  test("Every BLOCK has reason and at least one FAIL check", () => {
    withFixedRandom();

    const decision = evaluateBehaviorPolicy({
      chipId: 303,
      action: "initiate_dm",
      chipAgeDays: 1,
      trustScore: 10,
      riskScore: 10,
      now: new Date("2026-07-20T15:00:00.000Z"),
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBeTruthy();
    expect(decision.executionTrace.some((check) => check.status === "FAIL")).toBe(true);

    vi.restoreAllMocks();
  });

  test("Every ALLOW has nextCheckAt in the future", () => {
    withFixedRandom();

    const decision = evaluateBehaviorPolicy({
      chipId: 304,
      action: "message_sent",
      chipAgeDays: 26,
      trustScore: 75,
      riskScore: 55,
      stats: {
        inboundCount: 30,
        outboundCount: 20,
        todayActionCount: 2,
        todayActionTypes: ["reply", "view_status"],
      },
      now: new Date("2026-07-20T15:00:00.000Z"),
    });

    expect(decision.allowed).toBe(true);
    expect(decision.nextCheckAt).not.toBeNull();
    expect(decision.nextCheckAt!.getTime()).toBeGreaterThan(new Date("2026-07-20T15:00:00.000Z").getTime());

    vi.restoreAllMocks();
  });

  test("SKIPPED only appears after first FAIL", () => {
    withFixedRandom();

    const decision = evaluateBehaviorPolicy({
      chipId: 305,
      action: "initiate_dm",
      chipAgeDays: 1,
      trustScore: 10,
      riskScore: 10,
      now: new Date("2026-07-20T15:00:00.000Z"),
    });

    const failIndex = decision.executionTrace.findIndex((check) => check.status === "FAIL");
    const skippedBeforeFail = decision.executionTrace.slice(0, failIndex).some((check) => check.status === "SKIPPED");
    expect(skippedBeforeFail).toBe(false);

    vi.restoreAllMocks();
  });

  test("Execution trace is complete: every rule appears exactly once", () => {
    withFixedRandom();

    const decision = evaluateBehaviorPolicy({
      chipId: 306,
      action: "message_sent",
      chipAgeDays: 26,
      trustScore: 75,
      riskScore: 55,
      stats: {
        inboundCount: 30,
        outboundCount: 20,
        todayActionCount: 2,
        todayActionTypes: ["reply", "view_status"],
      },
      now: new Date("2026-07-20T15:00:00.000Z"),
    });

    const rules = decision.executionTrace.map((check) => check.rule);
    expect(new Set(rules).size).toBe(rules.length);
    expect(rules).toEqual(["phase", "risk", "cooldown", "budget", "reciprocity", "session"]);

    vi.restoreAllMocks();
  });
});
