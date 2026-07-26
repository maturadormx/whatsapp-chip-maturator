/**
 * Issue #21: budget 0/0 não pode gerar comportamento indefinido ou divisão inválida.
 */
import { describe, expect, test, vi } from "vitest";
import { evaluateBehaviorPolicy } from "../../../server/services/behavior/behaviorPolicyEngine";

describe("Regression: Issue #21 — Budget zero boundary", () => {
  test("budget 0/0 deve bloquear sem erro e sem Infinity", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const decision = evaluateBehaviorPolicy({
      chipId: 502,
      action: "message_sent",
      chipAgeDays: 40,
      trustScore: 95,
      riskScore: 0,
      stats: {
        inboundCount: 10,
        outboundCount: 5,
        todayActionCount: 12,
        todayActionTypes: [
          "message_sent",
          "message_sent",
          "message_sent",
          "message_sent",
          "message_sent",
          "message_sent",
          "message_sent",
          "message_sent",
          "message_sent",
          "message_sent",
          "message_sent",
          "message_sent",
        ],
      },
      now: new Date("2026-07-20T15:00:00.000Z"),
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).not.toContain("Infinity");
    expect(decision.executionTrace.find((check) => check.rule === "budget")?.status).toBe("FAIL");

    vi.restoreAllMocks();
  });
});
