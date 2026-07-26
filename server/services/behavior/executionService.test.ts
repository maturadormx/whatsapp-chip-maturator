import { describe, expect, it, vi } from "vitest";
import { executeBehaviorAction } from "./executionService";
import type { BehaviorPolicyEvaluation } from "./types";

function createPolicyDecision(overrides: Partial<BehaviorPolicyEvaluation> = {}): BehaviorPolicyEvaluation {
  return {
    allowed: true,
    phase: "active",
    decision: "act_now",
    action: "message_sent",
    confidence: 0.9,
    riskLevel: "low",
    delayMinutes: 1,
    delayMs: 60000,
    sessionId: "session-1",
    sessionActionBudget: 2,
    reason: "janela operacional aprovada",
    restrictions: [],
    trustScore: 70,
    chipAgeDays: 20,
    dailyBudget: {
      spent: 8,
      limit: 72,
      nextCost: 8,
      remaining: 64,
    },
    reciprocity: {
      inboundCount: 10,
      outboundCount: 4,
      ratio: 2.5,
      minRequired: 0.9,
    },
    nextCheckAt: new Date("2026-07-20T16:00:00.000Z"),
    checks: {} as any,
    executionTrace: [],
    contributors: [],
    fingerprint: {
      engineVersion: "2.1.0",
      policyVersion: "2026.07.20",
      policyHash: "abc12345",
      fingerprint: "2.1.0:2026.07.20:abc12345",
    },
    ...overrides,
  };
}

describe("executionService", () => {
  it("persiste PENDING -> RESERVED -> SENDING -> ACKED em caso de sucesso", async () => {
    const create = vi.fn().mockResolvedValue(null);
    const update = vi.fn().mockResolvedValue(null);
    const reserveBudget = vi.fn().mockResolvedValue({ id: "res-1", status: "RESERVED" });
    const commitBudget = vi.fn().mockResolvedValue({ id: "res-1", status: "COMMITTED" });
    const releaseBudget = vi.fn().mockResolvedValue({ id: "res-1", status: "RELEASED" });
    const gateway = {
      send: vi.fn().mockResolvedValue({
        status: "ACKED",
        attempt: 1,
        occurredAt: new Date("2026-07-20T15:00:00.000Z"),
        providerMessageId: "msg-123",
      }),
    };
    const ledgerRepository = {
      create,
      findById: vi.fn(),
      update,
      listRecoverable: vi.fn(),
    };
    const notify = vi.fn().mockResolvedValue(null);

    const result = await executeBehaviorAction(
      {
        userId: 1,
        chipId: 10,
        targetType: "number",
        targetValue: "5511999999999",
        requestedAction: "message_sent",
        message: "oi",
        policyDecision: createPolicyDecision(),
      },
      {
        ledgerRepository,
        reserveBudget,
        commitBudget,
        releaseBudget,
        gateway,
        notify,
      },
    );

    expect(create).toHaveBeenCalledTimes(1);
    expect(reserveBudget).toHaveBeenCalledTimes(1);
    expect(commitBudget).toHaveBeenCalledTimes(1);
    expect(releaseBudget).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledTimes(3);
    expect(update.mock.calls[0][1]).toMatchObject({ attempt: 1 });
    expect(update.mock.calls[1][1]).toMatchObject({ budgetState: "RESERVED", status: "SENDING", attempt: 1 });
    expect(update.mock.calls[2][1]).toMatchObject({ status: "ACKED", budgetState: "COMMITTED" });
    expect(result.status).toBe("ACKED");
    expect(result.messageId).toBe("msg-123");
    expect(gateway.send).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledTimes(2);
    expect(notify.mock.calls[0][0]).toMatchObject({ status: "SENDING", budgetState: "RESERVED" });
    expect(notify.mock.calls[1][0]).toMatchObject({ status: "ACKED", budgetState: "COMMITTED" });
  });

  it("persiste FAILED e RELEASED em caso de erro no executor", async () => {
    const create = vi.fn().mockResolvedValue(null);
    const update = vi.fn().mockResolvedValue(null);
    const reserveBudget = vi.fn().mockResolvedValue({ id: "res-1", status: "RESERVED" });
    const commitBudget = vi.fn().mockResolvedValue({ id: "res-1", status: "COMMITTED" });
    const releaseBudget = vi.fn().mockResolvedValue({ id: "res-1", status: "RELEASED" });
    const gateway = {
      send: vi.fn().mockRejectedValue(new Error("gateway down")),
    };
    const ledgerRepository = {
      create,
      findById: vi.fn(),
      update,
      listRecoverable: vi.fn(),
    };
    const notify = vi.fn().mockResolvedValue(null);

    await expect(
      executeBehaviorAction(
        {
          userId: 1,
          chipId: 10,
          targetType: "number",
          targetValue: "5511999999999",
          requestedAction: "message_sent",
          message: "oi",
          policyDecision: createPolicyDecision(),
        },
        {
          ledgerRepository,
          reserveBudget,
          commitBudget,
          releaseBudget,
          gateway,
          notify,
        },
      ),
    ).rejects.toThrow("gateway down");

    expect(reserveBudget).toHaveBeenCalledTimes(1);
    expect(commitBudget).not.toHaveBeenCalled();
    expect(releaseBudget).toHaveBeenCalledTimes(1);
    expect(gateway.send).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(3);
    expect(update.mock.calls[0][1]).toMatchObject({ attempt: 1 });
    expect(update.mock.calls[1][1]).toMatchObject({ budgetState: "RESERVED", status: "SENDING", attempt: 1 });
    expect(update.mock.calls[2][1]).toMatchObject({ status: "FAILED", budgetState: "RELEASED", recoverable: 1 });
    expect(notify).toHaveBeenCalledTimes(2);
    expect(notify).toHaveBeenCalledTimes(2);
    expect(notify.mock.calls[0][0]).toMatchObject({ status: "SENDING", budgetState: "RESERVED" });
    expect(notify.mock.calls[1][0]).toMatchObject({ status: "FAILED", budgetState: "RELEASED" });
  });
});
