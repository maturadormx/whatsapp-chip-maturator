import { describe, expect, it } from "vitest";
import { executeBehaviorAction, retryBehaviorActionExecution } from "./executionService";
import { runBehaviorRetryCycle } from "./retryService";
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
    delayMs: 60_000,
    sessionId: "session-phase1",
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

describe("phase1OperationalIntegration", () => {
  it("valida o núcleo operacional da Fase 1: Policy -> Execution -> Retry -> Budget -> Ledger", async () => {
    const executionStore = new Map<string, any>();
    const budgetReservationStore = new Map<string, any>();
    const executionEvents: any[] = [];
    const fixedNow = new Date("2026-07-21T14:00:00.000Z");
    const budgetUsage = {
      limit: 5,
      committed: 0,
    };
    let sendAttempt = 0;

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
      gateway: {
        send: async (message: any) => {
          sendAttempt += 1;
          if (sendAttempt === 1) {
            throw new Error("gateway down");
          }
          return {
            status: "ACKED",
            attempt: sendAttempt,
            occurredAt: new Date(),
            providerMessageId: `msg-${sendAttempt}-${message.content.length}`,
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

    await expect(
      executeBehaviorAction(
        {
          userId: 1,
          chipId: 10,
          targetType: "number",
          targetValue: "5511999999999",
          requestedAction: "message_sent",
          message: "oi fase 1",
          policyDecision: createPolicyDecision(),
        },
        deps,
      ),
    ).rejects.toThrow("gateway down");

    const firstExecution = [...executionStore.values()][0];
    expect(firstExecution.status).toBe("FAILED");
    expect(firstExecution.attempt).toBe(1);
    expect(firstExecution.budgetState).toBe("RELEASED");
    expect(firstExecution.nextRetryAt).toBeTruthy();

    const firstReservation = budgetReservationStore.get(keyOf(firstExecution.id, 1));
    expect(firstReservation.status).toBe("RELEASED");
    expect(budgetUsage.committed).toBe(0);

    const retryResult = await runBehaviorRetryCycle(
      { now: new Date("2026-07-21T15:00:00.000Z"), limit: 10 },
      {
        ledgerRepository: deps.ledgerRepository as any,
        retryExecution: (params) => retryBehaviorActionExecution(params, deps),
      },
    );

    expect(retryResult).toEqual({
      scanned: 1,
      retried: 1,
      skipped: 0,
      failed: 0,
      executionIds: [firstExecution.id],
    });

    const finalExecution = executionStore.get(firstExecution.id);
    expect(finalExecution.status).toBe("ACKED");
    expect(finalExecution.attempt).toBe(2);
    expect(finalExecution.budgetState).toBe("COMMITTED");
    expect(finalExecution.messageId).toContain("msg-2");

    const secondReservation = budgetReservationStore.get(keyOf(firstExecution.id, 2));
    expect(firstReservation.status).toBe("RELEASED");
    expect(secondReservation.status).toBe("COMMITTED");
    expect(budgetUsage.committed).toBe(1);

    expect(executionEvents.map((event) => event.status)).toEqual([
      "SENDING",
      "FAILED",
      "RETRYING",
      "SENDING",
      "ACKED",
    ]);

    expect({
      id: finalExecution.id,
      status: finalExecution.status,
      budgetState: finalExecution.budgetState,
      attempt: finalExecution.attempt,
      messageId: finalExecution.messageId,
    }).toEqual({
      id: firstExecution.id,
      status: "ACKED",
      budgetState: "COMMITTED",
      attempt: 2,
      messageId: finalExecution.messageId,
    });
  });
});
