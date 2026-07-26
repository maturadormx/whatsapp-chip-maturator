import { beforeEach, describe, expect, it } from "vitest";
import { FakeClock } from "../../server/clock/FakeClock";
import { executeBehaviorAction, retryBehaviorActionExecution } from "../../server/services/behavior/executionService";
import type { BehaviorPolicyEvaluation } from "../../server/services/behavior/types";
import { MockMessageGateway } from "../../server/gateways/mock/MockMessageGateway";

function createPolicyDecision(overrides: Partial<BehaviorPolicyEvaluation> = {}): BehaviorPolicyEvaluation {
  return {
    allowed: true,
    phase: "active",
    decision: "act_now",
    action: "message_sent",
    confidence: 0.9,
    riskLevel: "low",
    delayMinutes: 1,
    delayMs: 60_000,
    sessionId: "session-gateway",
    sessionActionBudget: 2,
    reason: "janela operacional aprovada",
    restrictions: [],
    trustScore: 72,
    chipAgeDays: 30,
    dailyBudget: {
      spent: 8,
      limit: 72,
      nextCost: 8,
      remaining: 64,
    },
    reciprocity: {
      inboundCount: 12,
      outboundCount: 4,
      ratio: 3,
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

function createExecutionHarness(
  gateway = new MockMessageGateway({ defaultDelayMs: 0 }),
  clock = new FakeClock(new Date("2026-07-20T10:00:00.000Z")),
) {
  const executionStore = new Map<string, any>();
  const budgetReservationStore = new Map<string, any>();
  const executionEvents: any[] = [];
  const budgetUsage = {
    limit: 5,
    committed: 0,
  };

  const keyOf = (executionId: string, attempt: number) => `${executionId}:${attempt}`;

  const deps = {
    ledgerRepository: {
      create: async (record: any) => {
        executionStore.set(record.id, {
          ...record,
          status: "PENDING",
          budgetState: "NOT_RESERVED",
          messageId: null,
          error: null,
        });
        return null;
      },
      findById: async (executionId: string) => executionStore.get(executionId) ?? null,
      update: async (executionId: string, data: any) => {
        executionStore.set(executionId, {
          ...executionStore.get(executionId),
          ...data,
        });
        return null;
      },
      listRecoverable: async (now = new Date(), limit = 25) =>
        [...executionStore.values()]
          .filter(
            (entry) =>
              entry.status === "FAILED" &&
              Number(entry.recoverable) === 1 &&
              (!entry.nextRetryAt || new Date(entry.nextRetryAt).getTime() <= now.getTime()),
          )
          .slice(0, limit),
    },
    reserveBudget: async ({ executionId, attempt, userId, amount }: any) => {
      const key = keyOf(executionId, attempt);
      if (budgetReservationStore.has(key)) {
        return budgetReservationStore.get(key);
      }
      const reserved = [...budgetReservationStore.values()]
        .filter((entry) => entry.status === "RESERVED")
        .reduce((sum, entry) => sum + entry.amount, 0);
      const available = budgetUsage.limit - budgetUsage.committed - reserved;
      if (available < amount) {
        throw new Error("INSUFFICIENT_BUDGET");
      }
      const reservation = {
        id: `res-${key}`,
        executionId,
        attempt,
        userId,
        amount,
        status: "RESERVED",
        reason: null,
      };
      budgetReservationStore.set(key, reservation);
      return reservation;
    },
    commitBudget: async ({ executionId, attempt }: any) => {
      const key = keyOf(executionId, attempt);
      const reservation = budgetReservationStore.get(key);
      if (!reservation) throw new Error("BUDGET_RESERVATION_NOT_FOUND");
      if (reservation.status !== "COMMITTED") {
        reservation.status = "COMMITTED";
        reservation.committedAt = new Date();
        budgetUsage.committed += reservation.amount;
      }
      budgetReservationStore.set(key, reservation);
      return reservation;
    },
    releaseBudget: async ({ executionId, attempt, reason }: any) => {
      const key = keyOf(executionId, attempt);
      const reservation = budgetReservationStore.get(key);
      if (!reservation) throw new Error("BUDGET_RESERVATION_NOT_FOUND");
      reservation.status = "RELEASED";
      reservation.reason = reason ?? reservation.reason ?? null;
      reservation.releasedAt = new Date();
      budgetReservationStore.set(key, reservation);
      return reservation;
    },
    clock,
    gateway,
    notify: async (event: any) => {
      executionEvents.push(event);
    },
  };

  return {
    gateway,
    deps,
    executionStore,
    budgetReservationStore,
    executionEvents,
    budgetUsage,
    keyOf,
    clock,
  };
}

describe("Integração: ExecutionService → MessageGateway", () => {
  let gateway: MockMessageGateway;

  beforeEach(() => {
    gateway = new MockMessageGateway({ defaultDelayMs: 0 });
  });

  it("deve delegar envio ao gateway", async () => {
    const harness = createExecutionHarness(gateway);

    const result = await executeBehaviorAction(
      {
        userId: 1,
        chipId: 10,
        targetType: "number",
        targetValue: "5511999999999",
        requestedAction: "message_sent",
        message: "gateway",
        policyDecision: createPolicyDecision(),
      },
      harness.deps,
    );

    expect(gateway.wasSent(result.executionId)).toBe(true);
    expect(gateway.getSentMessages()[0]).toMatchObject({
      executionId: result.executionId,
      recipient: "5511999999999",
      content: "gateway",
    });
  });

  it("deve transitar para COMMITTED quando gateway retorna ACKED", async () => {
    const harness = createExecutionHarness(gateway);

    const result = await executeBehaviorAction(
      {
        userId: 1,
        chipId: 10,
        targetType: "number",
        targetValue: "5511999999999",
        requestedAction: "message_sent",
        message: "acked",
        policyDecision: createPolicyDecision(),
      },
      harness.deps,
    );

    const execution = harness.executionStore.get(result.executionId);
    const reservation = harness.budgetReservationStore.get(harness.keyOf(result.executionId, 1));

    expect(execution.status).toBe("ACKED");
    expect(execution.budgetState).toBe("COMMITTED");
    expect(reservation.status).toBe("COMMITTED");
    expect(harness.budgetUsage.committed).toBe(1);
  });

  it("deve transitar para FAILED quando gateway retorna FAILED", async () => {
    gateway = new MockMessageGateway({
      defaultDelayMs: 0,
      initialResults: [
        {
          status: "FAILED",
          attempt: 1,
          occurredAt: new Date("2026-07-20T10:00:00.000Z"),
        },
      ],
    });
    const harness = createExecutionHarness(gateway);

    await expect(
      executeBehaviorAction(
        {
          userId: 1,
          chipId: 10,
          targetType: "number",
          targetValue: "5511999999999",
          requestedAction: "message_sent",
          message: "failed",
          policyDecision: createPolicyDecision(),
          retryPolicy: { recoverable: false },
        },
        harness.deps,
      ),
    ).rejects.toThrow("GATEWAY_FAILED");

    const execution = [...harness.executionStore.values()][0];
    const reservation = harness.budgetReservationStore.get(harness.keyOf(execution.id, 1));

    expect(execution.status).toBe("FAILED");
    expect(execution.budgetState).toBe("RELEASED");
    expect(reservation.status).toBe("RELEASED");
  });

  it("deve transitar para FAILED quando gateway retorna TIMEOUT", async () => {
    gateway = new MockMessageGateway({
      defaultDelayMs: 0,
      initialResults: [
        {
          status: "TIMEOUT",
          attempt: 1,
          occurredAt: new Date("2026-07-20T10:00:00.000Z"),
        },
      ],
    });
    const harness = createExecutionHarness(gateway);

    await expect(
      executeBehaviorAction(
        {
          userId: 1,
          chipId: 10,
          targetType: "number",
          targetValue: "5511999999999",
          requestedAction: "message_sent",
          message: "timeout",
          policyDecision: createPolicyDecision(),
          retryPolicy: { recoverable: false },
        },
        harness.deps,
      ),
    ).rejects.toThrow("GATEWAY_TIMEOUT");

    const execution = [...harness.executionStore.values()][0];
    expect(execution.status).toBe("FAILED");
    expect(execution.budgetState).toBe("RELEASED");
  });

  it("deve preservar idempotência com gateway fake", async () => {
    const harness = createExecutionHarness(gateway);

    const result = await executeBehaviorAction(
      {
        userId: 1,
        chipId: 10,
        targetType: "number",
        targetValue: "5511999999999",
        requestedAction: "message_sent",
        message: "idempotência",
        policyDecision: createPolicyDecision(),
      },
      harness.deps,
    );

    const retry = await retryBehaviorActionExecution({ executionId: result.executionId }, harness.deps);

    expect(retry).toBeNull();
    expect(gateway.sendCount(result.executionId)).toBe(1);
  });

  it("deve usar Clock injetado para calcular nextRetryAt", async () => {
    gateway = new MockMessageGateway({
      defaultDelayMs: 0,
      initialResults: [
        {
          status: "FAILED",
          attempt: 1,
          occurredAt: new Date("2026-07-20T10:00:00.000Z"),
        },
      ],
    });
    const clock = new FakeClock(new Date("2026-07-20T10:00:00.000Z"));
    const harness = createExecutionHarness(gateway, clock);

    await expect(
      executeBehaviorAction(
        {
          userId: 1,
          chipId: 10,
          targetType: "number",
          targetValue: "5511999999999",
          requestedAction: "message_sent",
          message: "retry-at",
          policyDecision: createPolicyDecision(),
        },
        harness.deps,
      ),
    ).rejects.toThrow("GATEWAY_FAILED");

    const execution = [...harness.executionStore.values()][0];
    expect(execution.nextRetryAt?.toISOString()).toBe("2026-07-20T10:00:30.000Z");
  });
});
