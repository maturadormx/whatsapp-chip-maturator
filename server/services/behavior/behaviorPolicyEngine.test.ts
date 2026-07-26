import { afterEach, describe, expect, it, vi } from "vitest";
import { evaluateBehaviorPolicy } from "./behaviorPolicyEngine";

describe("behaviorPolicyEngine", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("bloqueia ação fora da fase e expõe checks detalhados", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const result = evaluateBehaviorPolicy({
      chipId: 18,
      action: "initiate_dm",
      chipAgeDays: 1,
      trustScore: 10,
      riskScore: 10,
      now: new Date("2026-07-20T15:00:00.000Z"),
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("não liberada na fase birth");
    expect(result.checks.phase.passed).toBe(false);
    expect(result.checks.phase.status).toBe("FAIL");
    expect(result.checks.risk.status).toBe("SKIPPED");
    expect(result.checks.cooldown.status).toBe("SKIPPED");
    expect(result.contributors.find((item) => item.rule === "phase")?.impact).toBe("block");
    expect(result.fingerprint.fingerprint).toBeTruthy();
  });

  it("bloqueia risco crítico exatamente no threshold 80", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const result = evaluateBehaviorPolicy({
      chipId: 19,
      action: "message_sent",
      chipAgeDays: 20,
      trustScore: 70,
      riskScore: 80,
      stats: {
        inboundCount: 20,
        outboundCount: 10,
        todayActionCount: 2,
        todayActionTypes: ["reply", "view_status"],
      },
      now: new Date("2026-07-20T15:00:00.000Z"),
    });

    expect(result.allowed).toBe(false);
    expect(result.riskLevel).toBe("high");
    expect(result.checks.risk.passed).toBe(false);
    expect(result.reason).toBe("risco elevado para execução automática");
  });

  it("bloqueia por cooldown e informa remainingMs", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const now = new Date("2026-07-20T15:00:00.000Z");
    const cooldownUntil = new Date("2026-07-20T15:15:00.000Z");

    const result = evaluateBehaviorPolicy({
      chipId: 20,
      action: "message_sent",
      chipAgeDays: 22,
      trustScore: 72,
      riskScore: 20,
      stats: {
        inboundCount: 30,
        outboundCount: 10,
        todayActionCount: 0,
        todayActionTypes: [],
      },
      cooldownUntil,
      now,
    });

    expect(result.allowed).toBe(false);
    expect(result.checks.cooldown.passed).toBe(false);
    expect(result.checks.cooldown.metadata?.remainingMs).toBe(15 * 60 * 1000);
    expect(result.nextCheckAt?.toISOString()).toBe(cooldownUntil.toISOString());
  });

  it("bloqueia quando o orçamento diário estoura na próxima ação", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const result = evaluateBehaviorPolicy({
      chipId: 21,
      action: "message_sent",
      chipAgeDays: 12,
      trustScore: 50,
      riskScore: 15,
      stats: {
        inboundCount: 20,
        outboundCount: 10,
        todayActionCount: 6,
        todayActionTypes: ["message_sent", "message_sent", "message_sent", "message_sent", "message_sent", "message_sent"],
      },
      now: new Date("2026-07-20T15:00:00.000Z"),
    });

    expect(result.allowed).toBe(false);
    expect(result.checks.budget.passed).toBe(false);
    expect(result.dailyBudget.spent).toBe(48);
    expect(result.dailyBudget.limit).toBe(48);
    expect(result.reason).toContain("orçamento diário esgotado");
  });

  it("bloqueia outbound quando a fase exige inbound primeiro", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const result = evaluateBehaviorPolicy({
      chipId: 22,
      action: "reply",
      chipAgeDays: 5,
      trustScore: 25,
      riskScore: 10,
      stats: {
        inboundCount: 0,
        outboundCount: 0,
        todayActionCount: 0,
        todayActionTypes: [],
      },
      now: new Date("2026-07-20T15:00:00.000Z"),
    });

    expect(result.allowed).toBe(false);
    expect(result.checks.reciprocity.passed).toBe(false);
    expect(result.reason).toContain("exige inbound");
  });

  it("permite ação e retorna delay/checks completos quando tudo está aprovado", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const result = evaluateBehaviorPolicy({
      chipId: 23,
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

    expect(result.allowed).toBe(true);
    expect(result.decision).toBe("act_now");
    expect(result.checks.phase.passed).toBe(true);
    expect(result.checks.risk.passed).toBe(true);
    expect(result.checks.cooldown.passed).toBe(true);
    expect(result.checks.budget.passed).toBe(true);
    expect(result.checks.reciprocity.passed).toBe(true);
    expect(result.checks.session.passed).toBe(true);
    expect(result.delayMs).toBeGreaterThan(0);
    expect(result.delayMinutes).toBeGreaterThan(0);
    expect(result.nextCheckAt).not.toBeNull();
    expect(result.executionTrace).toHaveLength(6);
  });

  it("mantém do_nothing aprovado com explain mode preenchido", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const result = evaluateBehaviorPolicy({
      chipId: 24,
      action: "do_nothing",
      chipAgeDays: 9,
      trustScore: 44,
      riskScore: 12,
      stats: {
        inboundCount: 4,
        outboundCount: 2,
        todayActionCount: 1,
        todayActionTypes: ["view_status"],
      },
      now: new Date("2026-07-20T15:00:00.000Z"),
    });

    expect(result.allowed).toBe(true);
    expect(result.decision).toBe("do_nothing");
    expect(result.reason).toContain("sem ação ativa");
    expect(Object.values(result.checks).every((check) => check.passed)).toBe(true);
    expect(result.nextCheckAt).not.toBeNull();
  });
});
