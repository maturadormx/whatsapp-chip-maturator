/**
 * Issue #17: boundary exato da fase inicial não pode escorregar para a fase seguinte.
 * Regra atual do projeto: birth vai até trustScore 20.
 * Bug class: erro de threshold em limite exato.
 */
import { describe, expect, test, vi } from "vitest";
import { evaluateBehaviorPolicy } from "../../../server/services/behavior/behaviorPolicyEngine";

describe("Regression: Issue #17 — Birth threshold boundary", () => {
  test("trustScore = 20 deve permanecer na fase birth", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const decision = evaluateBehaviorPolicy({
      chipId: 501,
      action: "initiate_dm",
      chipAgeDays: 1,
      trustScore: 20,
      riskScore: 10,
      stats: {
        inboundCount: 0,
        outboundCount: 0,
        todayActionCount: 0,
        todayActionTypes: [],
      },
      now: new Date("2026-07-20T15:00:00.000Z"),
    });

    expect(decision.phase).toBe("birth");
    expect(decision.allowed).toBe(false);
    expect(decision.executionTrace.find((check) => check.rule === "phase")?.status).toBe("FAIL");

    vi.restoreAllMocks();
  });
});
