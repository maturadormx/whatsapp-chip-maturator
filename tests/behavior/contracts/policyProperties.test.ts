import { afterEach, describe, expect, test, vi } from "vitest";
import { evaluateBehaviorPolicy } from "../../../server/services/behavior/behaviorPolicyEngine";

const baseNow = new Date("2026-07-20T15:00:00.000Z");

function allowingScenario() {
  return {
    chipId: 401,
    action: "message_sent" as const,
    chipAgeDays: 40,
    trustScore: 90,
    riskScore: 10,
    stats: {
      inboundCount: 20,
      outboundCount: 10,
      todayActionCount: 1,
      todayActionTypes: ["view_status"],
    },
    now: baseNow,
  };
}

function blockingScenario() {
  return {
    chipId: 402,
    action: "initiate_dm" as const,
    chipAgeDays: 1,
    trustScore: 10,
    riskScore: 10,
    stats: {
      inboundCount: 0,
      outboundCount: 0,
      todayActionCount: 0,
      todayActionTypes: [],
    },
    now: baseNow,
  };
}

describe("Policy Properties", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("Every decision has exactly one boolean result", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const decision = evaluateBehaviorPolicy(allowingScenario());
    expect(typeof decision.allowed).toBe("boolean");
    expect(["act_now", "wait", "do_nothing"]).toContain(decision.decision);
  });

  test("No duplicate rules in execution trace", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const decision = evaluateBehaviorPolicy(allowingScenario());
    const rules = decision.executionTrace.map((check) => check.rule);
    expect(new Set(rules).size).toBe(rules.length);
  });

  test("Every FAIL has matching reason", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const decision = evaluateBehaviorPolicy(blockingScenario());
    const failedChecks = decision.executionTrace.filter((check) => check.status === "FAIL");
    expect(failedChecks.some((check) => check.detail === decision.reason)).toBe(true);
  });

  test("SKIPPED only appears after first FAIL", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const decision = evaluateBehaviorPolicy(blockingScenario());
    const failIndex = decision.executionTrace.findIndex((check) => check.status === "FAIL");
    const skippedBeforeFail = decision.executionTrace.slice(0, failIndex).some((check) => check.status === "SKIPPED");
    expect(skippedBeforeFail).toBe(false);
  });

  test("Exactly 6 checks per decision", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const decision = evaluateBehaviorPolicy(allowingScenario());
    expect(decision.executionTrace.length).toBe(6);
  });

  test("Decision latency stays under 10ms in deterministic scenario", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const start = performance.now();
    evaluateBehaviorPolicy(allowingScenario());
    expect(performance.now() - start).toBeLessThan(10);
  });

  test("Every ALLOW has future nextCheckAt", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const decision = evaluateBehaviorPolicy(allowingScenario());
    expect(decision.allowed).toBe(true);
    expect(decision.nextCheckAt).not.toBeNull();
    expect(decision.nextCheckAt!.getTime()).toBeGreaterThan(baseNow.getTime());
  });

  test("Every BLOCK has at least one FAIL check", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const decision = evaluateBehaviorPolicy(blockingScenario());
    expect(decision.allowed).toBe(false);
    expect(decision.executionTrace.some((check) => check.status === "FAIL")).toBe(true);
  });
});
