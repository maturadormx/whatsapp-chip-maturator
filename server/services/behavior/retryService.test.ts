import { describe, expect, it, vi } from "vitest";
import { runBehaviorRetryCycle } from "./retryService";
import { retryBehaviorActionExecution } from "./executionService";

describe("retryService", () => {
  it("reexecuta apenas execuções elegíveis e resume o ciclo", async () => {
    const ledgerRepository = {
      listRecoverable: vi.fn().mockResolvedValue([
        { id: "exec-1" },
        { id: "exec-2" },
      ]),
    };
    const retryExecution = vi
      .fn<typeof retryBehaviorActionExecution>()
      .mockResolvedValueOnce({
        executionId: "exec-1",
        decisionId: "dec-1",
        status: "ACKED",
        budgetState: "COMMITTED",
        messageId: "msg-1",
        sentAt: new Date(),
        ackAt: new Date(),
        error: null,
      })
      .mockResolvedValueOnce(null);

    const result = await runBehaviorRetryCycle(
      { limit: 10, now: new Date("2026-07-20T15:00:00.000Z") },
      {
        ledgerRepository: ledgerRepository as any,
        retryExecution,
      },
    );

    expect(result).toEqual({
      scanned: 2,
      retried: 1,
      skipped: 1,
      failed: 0,
      executionIds: ["exec-1", "exec-2"],
    });
  });

  it("marca falhas do retry sem interromper o ciclo", async () => {
    const ledgerRepository = {
      listRecoverable: vi.fn().mockResolvedValue([
        { id: "exec-1" },
        { id: "exec-2" },
      ]),
    };
    const retryExecution = vi
      .fn<typeof retryBehaviorActionExecution>()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({
        executionId: "exec-2",
        decisionId: "dec-2",
        status: "ACKED",
        budgetState: "COMMITTED",
        messageId: "msg-2",
        sentAt: new Date(),
        ackAt: new Date(),
        error: null,
      });

    const result = await runBehaviorRetryCycle(
      { limit: 10, now: new Date("2026-07-20T15:00:00.000Z") },
      {
        ledgerRepository: ledgerRepository as any,
        retryExecution,
      },
    );

    expect(result.scanned).toBe(2);
    expect(result.retried).toBe(1);
    expect(result.failed).toBe(1);
  });
});
