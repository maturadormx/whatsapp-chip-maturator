import { describe, expect, it, vi } from "vitest";
import { RetryExecutionServiceDecorator } from "./RetryExecutionServiceDecorator";

describe("RetryExecutionServiceDecorator", () => {
  it("retenta e tem sucesso em tentativa posterior", async () => {
    const delegate = {
      execute: vi
        .fn()
        .mockRejectedValueOnce(new Error("temporary"))
        .mockResolvedValueOnce({
          id: "plan-1",
          factId: "fact-1",
          actions: [],
          metadata: {},
          createdAt: "2026-07-20T10:00:00.000Z",
        }),
    };
    const logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const delayFn = vi.fn().mockResolvedValue(undefined);

    const decorator = new RetryExecutionServiceDecorator(delegate as any, logger as any, {
      maxAttempts: 3,
      baseDelayMs: 10,
      delayFn,
    });

    const result = await decorator.execute({
      id: "plan-1",
      factId: "fact-1",
      actions: [],
      metadata: {},
      createdAt: "2026-07-20T10:00:00.000Z",
    });

    expect(delegate.execute).toHaveBeenCalledTimes(2);
    expect(delayFn).toHaveBeenCalledWith(10);
    expect(logger.info).toHaveBeenCalledWith("execution.retry.success", { planId: "plan-1", attempt: 2 });
    expect(result.id).toBe("plan-1");
  });

  it("falha após esgotar tentativas", async () => {
    const delegate = {
      execute: vi.fn().mockRejectedValue(new Error("down")),
    };
    const logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const delayFn = vi.fn().mockResolvedValue(undefined);

    const decorator = new RetryExecutionServiceDecorator(delegate as any, logger as any, {
      maxAttempts: 3,
      baseDelayMs: 10,
      delayFn,
    });

    await expect(
      decorator.execute({
        id: "plan-1",
        factId: "fact-1",
        actions: [],
        metadata: {},
        createdAt: "2026-07-20T10:00:00.000Z",
      }),
    ).rejects.toThrow("down");

    expect(delegate.execute).toHaveBeenCalledTimes(3);
    expect(logger.warn).toHaveBeenCalledTimes(3);
    expect(delayFn).toHaveBeenCalledTimes(2);
  });
});
