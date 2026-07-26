import { describe, expect, it, vi } from "vitest";
import { BullMQAdapter } from "./BullMQAdapter";

describe("BullMQAdapter", () => {
  it("publica jobs com retry e backoff configurados", async () => {
    const queue = {
      add: vi.fn().mockResolvedValue(undefined),
      getJobCounts: vi.fn().mockResolvedValue({}),
      getJobs: vi.fn().mockResolvedValue([]),
      close: vi.fn(),
    };
    const dlq = {
      add: vi.fn().mockResolvedValue(undefined),
      getJobCounts: vi.fn().mockResolvedValue({}),
      getJobs: vi.fn().mockResolvedValue([]),
      close: vi.fn(),
    };
    const logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const adapter = new BullMQAdapter("redis://localhost:6379", "observation", logger as any, {
      queue: queue as any,
      dlq: dlq as any,
      createWorker: () => ({ on: vi.fn(), close: vi.fn() }),
      attempts: 5,
      backoffMs: 2000,
    });

    await adapter.publish({
      id: "job-1",
      type: "PROCESS_PENDING_BATCH",
      payload: { batchSize: 10 },
      createdAt: "2026-07-20T10:00:00.000Z",
    });

    expect(queue.add).toHaveBeenCalledWith(
      "PROCESS_PENDING_BATCH",
      expect.objectContaining({ id: "job-1" }),
      expect.objectContaining({
        attempts: 5,
        backoff: { type: "exponential", delay: 2000 },
      }),
    );
  });

  it("expõe métricas agregadas da fila", async () => {
    const queue = {
      add: vi.fn().mockResolvedValue(undefined),
      getJobCounts: vi.fn().mockResolvedValue({
        waiting: 2,
        active: 1,
        completed: 5,
        failed: 1,
        delayed: 0,
      }),
      getJobs: vi.fn().mockResolvedValue([{ timestamp: Date.now() - 5000 }]),
      close: vi.fn(),
    };
    const dlq = {
      add: vi.fn().mockResolvedValue(undefined),
      getJobCounts: vi.fn().mockResolvedValue({}),
      getJobs: vi.fn().mockResolvedValue([]),
      close: vi.fn(),
    };
    const logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const adapter = new BullMQAdapter("redis://localhost:6379", "observation", logger as any, {
      queue: queue as any,
      dlq: dlq as any,
      createWorker: () => ({ on: vi.fn(), close: vi.fn() }),
    });

    const metrics = await adapter.getMetrics();
    expect(metrics.pending).toBe(2);
    expect(metrics.oldestPendingSeconds).toBeGreaterThanOrEqual(5);
  });

  it("envia job enriquecido para a DLQ quando a falha esgota as tentativas", async () => {
    const queue = {
      add: vi.fn().mockResolvedValue(undefined),
      getJobCounts: vi.fn().mockResolvedValue({}),
      getJobs: vi.fn().mockResolvedValue([]),
      close: vi.fn(),
    };
    const dlq = {
      add: vi.fn().mockResolvedValue(undefined),
      getJobCounts: vi.fn().mockResolvedValue({}),
      getJobs: vi.fn().mockResolvedValue([]),
      close: vi.fn(),
    };
    const listeners: Record<string, (...args: any[]) => unknown> = {};
    const logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    const adapter = new BullMQAdapter("redis://localhost:6379", "observation", logger as any, {
      queue: queue as any,
      dlq: dlq as any,
      createWorker: () => ({
        on: vi.fn((event: string, handler: (...args: any[]) => void) => {
          listeners[event] = handler;
        }),
        close: vi.fn(),
      }),
      attempts: 5,
    });

    await adapter.subscribe(async () => {
      throw new Error("boom");
    });

    await listeners.failed?.(
      {
        id: "bull-job-1",
        name: "PROCESS_PENDING_BATCH",
        data: { id: "job-1", type: "PROCESS_PENDING_BATCH" },
        attemptsMade: 5,
        opts: { attempts: 5 },
      },
      new Error("boom"),
    );

    expect(dlq.add).toHaveBeenCalledWith(
      "PROCESS_PENDING_BATCH",
      expect.objectContaining({
        job: { id: "job-1", type: "PROCESS_PENDING_BATCH" },
        attempts: 5,
        error: "boom",
        hostname: expect.any(String),
        stack: expect.any(String),
        occurredAt: expect.any(String),
      }),
    );
    expect(logger.warn).toHaveBeenCalled();
  });
});
