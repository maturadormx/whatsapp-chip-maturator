import { describe, expect, it } from "vitest";
import { executeBehaviorAction, retryBehaviorActionExecution } from "../../server/services/behavior/executionService";
import { runBehaviorRetryCycle } from "../../server/services/behavior/retryService";
import type { BehaviorPolicyEvaluation } from "../../server/services/behavior/types";

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
    sessionId: "session-e2e",
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

function createHarness(options?: {
  budgetLimit?: number;
  sendPlan?: Array<"success" | "failure">;
}) {
  const executionStore = new Map<string, any>();
  const budgetReservationStore = new Map<string, any>();
  const executionEvents: any[] = [];
  const sendHistory: Array<{ executionId: string; attempt: number; messageId: string | null }> = [];
  const fixedNow = new Date("2026-07-21T14:00:00.000Z");
  const budgetUsage = {
    limit: options?.budgetLimit ?? 5,
    committed: 0,
  };
  const sendPlan = [...(options?.sendPlan ?? ["success"])];

  const keyOf = (executionId: string, attempt: number) => `${executionId}:${attempt}`;

  const currentExecution = () => {
    const values = [...executionStore.values()];
    return values[values.length - 1];
  };

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
    gateway: {
      send: async (message: any) => {
        const plan = sendPlan.shift() ?? "success";
        const execution = currentExecution();
        if (plan === "failure") {
          throw new Error("gateway down");
        }
        const messageId = `msg-${execution.id}-${execution.attempt}-${message.content.length}`;
        sendHistory.push({
          executionId: execution.id,
          attempt: execution.attempt,
          messageId,
        });
        return {
          status: "ACKED",
          attempt: execution.attempt,
          occurredAt: new Date(),
          providerMessageId: messageId,
        };
      },
    },
    notify: async (event: any) => {
      executionEvents.push(event);
    },
    clock: {
      now: () => new Date(fixedNow),
    },
  };

  return {
    deps,
    executionStore,
    budgetReservationStore,
    executionEvents,
    sendHistory,
    budgetUsage,
    keyOf,
  };
}

function assertNoOrphanReservations(reservations: Map<string, any>) {
  const orphan = [...reservations.values()].filter((entry) => !["RESERVED", "COMMITTED", "RELEASED"].includes(entry.status));
  expect(orphan).toHaveLength(0);
}

function assertLedgerConsistent(execution: any) {
  expect(execution.id).toBeTruthy();
  expect(["PENDING", "SENDING", "ACKED", "FAILED", "RETRYING"].includes(execution.status)).toBe(true);
  expect(["NOT_RESERVED", "RESERVED", "COMMITTED", "RELEASED"].includes(execution.budgetState)).toBe(true);
}

function assertUniqueExecutionId(execution: any, sendHistory: Array<{ executionId: string }>) {
  expect(execution.id).toBeTruthy();
  expect(new Set(sendHistory.map((item) => item.executionId)).size).toBeLessThanOrEqual(1);
}

function assertAttemptMonotonic(execution: any, minimum = 1) {
  expect(execution.attempt).toBeGreaterThanOrEqual(minimum);
}

function assertBudgetCorrect(params: {
  budgetUsage: { limit: number; committed: number };
  reservations: Map<string, any>;
}) {
  const reserved = [...params.reservations.values()]
    .filter((entry) => entry.status === "RESERVED")
    .reduce((sum, entry) => sum + entry.amount, 0);
  expect(params.budgetUsage.committed + reserved).toBeLessThanOrEqual(params.budgetUsage.limit);
}

function assertNoDuplicateSend(sendHistory: Array<{ executionId: string; attempt: number }>) {
  const tokens = sendHistory.map((item) => `${item.executionId}:${item.attempt}`);
  expect(new Set(tokens).size).toBe(tokens.length);
}

describe("m2-fase1-e2e", () => {
  it("cenário 1: envio com sucesso", async () => {
    const harness = createHarness({ sendPlan: ["success"] });

    const result = await executeBehaviorAction(
      {
        userId: 1,
        chipId: 10,
        targetType: "number",
        targetValue: "5511999999999",
        requestedAction: "message_sent",
        message: "oi sucesso",
        policyDecision: createPolicyDecision(),
      },
      harness.deps,
    );

    const execution = harness.executionStore.get(result.executionId);
    const reservation = harness.budgetReservationStore.get(harness.keyOf(result.executionId, 1));

    expect(result.status).toBe("ACKED");
    expect(execution.status).toBe("ACKED");
    expect(execution.budgetState).toBe("COMMITTED");
    expect(reservation.status).toBe("COMMITTED");
    expect(harness.budgetUsage.committed).toBe(1);

    assertNoOrphanReservations(harness.budgetReservationStore);
    assertLedgerConsistent(execution);
    assertUniqueExecutionId(execution, harness.sendHistory);
    assertAttemptMonotonic(execution, 1);
    assertBudgetCorrect({ budgetUsage: harness.budgetUsage, reservations: harness.budgetReservationStore });
    assertNoDuplicateSend(harness.sendHistory);
  });

  it("cenário 2: falha + release", async () => {
    const harness = createHarness({ sendPlan: ["failure"] });

    await expect(
      executeBehaviorAction(
        {
          userId: 1,
          chipId: 10,
          targetType: "number",
          targetValue: "5511999999999",
          requestedAction: "message_sent",
          message: "oi falha",
          policyDecision: createPolicyDecision(),
        },
        harness.deps,
      ),
    ).rejects.toThrow("gateway down");

    const execution = [...harness.executionStore.values()][0];
    const reservation = harness.budgetReservationStore.get(harness.keyOf(execution.id, 1));

    expect(execution.status).toBe("FAILED");
    expect(execution.budgetState).toBe("RELEASED");
    expect(reservation.status).toBe("RELEASED");
    expect(harness.budgetUsage.committed).toBe(0);
    expect(harness.sendHistory).toHaveLength(0);

    assertNoOrphanReservations(harness.budgetReservationStore);
    assertLedgerConsistent(execution);
    assertAttemptMonotonic(execution, 1);
    assertBudgetCorrect({ budgetUsage: harness.budgetUsage, reservations: harness.budgetReservationStore });
  });

  it("cenário 3: retry com novo attempt", async () => {
    const harness = createHarness({ sendPlan: ["failure", "success"] });

    await expect(
      executeBehaviorAction(
        {
          userId: 1,
          chipId: 10,
          targetType: "number",
          targetValue: "5511999999999",
          requestedAction: "message_sent",
          message: "oi retry",
          policyDecision: createPolicyDecision(),
        },
        harness.deps,
      ),
    ).rejects.toThrow("gateway down");

    const firstExecution = [...harness.executionStore.values()][0];

    const retryResult = await runBehaviorRetryCycle(
      { now: new Date("2026-07-21T15:00:00.000Z"), limit: 10 },
      {
        ledgerRepository: harness.deps.ledgerRepository as any,
        retryExecution: (params) => retryBehaviorActionExecution(params, harness.deps),
      },
    );

    const finalExecution = harness.executionStore.get(firstExecution.id);
    const firstReservation = harness.budgetReservationStore.get(harness.keyOf(firstExecution.id, 1));
    const secondReservation = harness.budgetReservationStore.get(harness.keyOf(firstExecution.id, 2));

    expect(retryResult.retried).toBe(1);
    expect(finalExecution.status).toBe("ACKED");
    expect(finalExecution.attempt).toBe(2);
    expect(firstReservation.status).toBe("RELEASED");
    expect(secondReservation.status).toBe("COMMITTED");
    expect(harness.budgetUsage.committed).toBe(1);

    assertNoOrphanReservations(harness.budgetReservationStore);
    assertLedgerConsistent(finalExecution);
    assertUniqueExecutionId(finalExecution, harness.sendHistory);
    assertAttemptMonotonic(finalExecution, 2);
    assertBudgetCorrect({ budgetUsage: harness.budgetUsage, reservations: harness.budgetReservationStore });
    assertNoDuplicateSend(harness.sendHistory);
  });

  it("cenário 4: budget insuficiente", async () => {
    const harness = createHarness({ budgetLimit: 0, sendPlan: ["success"] });

    await expect(
      executeBehaviorAction(
        {
          userId: 1,
          chipId: 10,
          targetType: "number",
          targetValue: "5511999999999",
          requestedAction: "message_sent",
          message: "oi sem budget",
          policyDecision: createPolicyDecision(),
        },
        harness.deps,
      ),
    ).rejects.toThrow("INSUFFICIENT_BUDGET");

    const execution = [...harness.executionStore.values()][0];

    expect(execution.status).toBe("FAILED");
    expect(execution.budgetState).toBe("NOT_RESERVED");
    expect(harness.budgetReservationStore.size).toBe(0);
    expect(harness.sendHistory).toHaveLength(0);

    assertLedgerConsistent(execution);
    assertBudgetCorrect({ budgetUsage: harness.budgetUsage, reservations: harness.budgetReservationStore });
  });

  it("cenário 5: idempotência", async () => {
    const harness = createHarness({ sendPlan: ["failure", "success"] });

    await expect(
      executeBehaviorAction(
        {
          userId: 1,
          chipId: 10,
          targetType: "number",
          targetValue: "5511999999999",
          requestedAction: "message_sent",
          message: "oi idempotência",
          policyDecision: createPolicyDecision(),
        },
        harness.deps,
      ),
    ).rejects.toThrow("gateway down");

    const firstExecution = [...harness.executionStore.values()][0];

    await runBehaviorRetryCycle(
      { now: new Date("2026-07-21T15:00:00.000Z"), limit: 10 },
      {
        ledgerRepository: harness.deps.ledgerRepository as any,
        retryExecution: (params) => retryBehaviorActionExecution(params, harness.deps),
      },
    );

    const sendCountAfterRetry = harness.sendHistory.length;
    const secondRetry = await retryBehaviorActionExecution({ executionId: firstExecution.id }, harness.deps);

    expect(secondRetry).toBeNull();
    expect(harness.sendHistory).toHaveLength(sendCountAfterRetry);
    expect(harness.budgetReservationStore.size).toBe(2);

    const finalExecution = harness.executionStore.get(firstExecution.id);
    assertLedgerConsistent(finalExecution);
    assertUniqueExecutionId(finalExecution, harness.sendHistory);
    assertAttemptMonotonic(finalExecution, 2);
    assertBudgetCorrect({ budgetUsage: harness.budgetUsage, reservations: harness.budgetReservationStore });
    assertNoDuplicateSend(harness.sendHistory);
  });
});
