import { describe, expect, it, vi } from "vitest";
import { ObservationWorker } from "./ObservationWorker";

describe("ObservationWorker", () => {
  it("consome PROCESS_PENDING_BATCH e processa observations reclamadas", async () => {
    const queue = {
      subscribe: vi.fn(),
    };
    const repository = {
      claimPending: vi.fn().mockResolvedValue([
        { id: "obs-1", source: "test", eventType: "a", payload: {}, timestamp: "2026-07-20T10:00:00.000Z" },
      ]),
    };
    const pipeline = {
      process: vi.fn().mockResolvedValue(undefined),
    };
    const logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    const worker = new ObservationWorker(queue as any, repository as any, pipeline as any, logger as any);
    await worker.handle({
      id: "job-1",
      type: "PROCESS_PENDING_BATCH",
      payload: { batchSize: 10 },
      createdAt: "2026-07-20T10:00:00.000Z",
    });

    expect(repository.claimPending).toHaveBeenCalledTimes(1);
    expect(pipeline.process).toHaveBeenCalledTimes(1);
  });

  it("lança erro quando alguma observation falha", async () => {
    const queue = {
      subscribe: vi.fn(),
    };
    const repository = {
      claimPending: vi.fn().mockResolvedValue([
        { id: "obs-1", source: "test", eventType: "a", payload: {}, timestamp: "2026-07-20T10:00:00.000Z" },
      ]),
    };
    const pipeline = {
      process: vi.fn().mockRejectedValue(new Error("boom")),
    };
    const logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    const worker = new ObservationWorker(queue as any, repository as any, pipeline as any, logger as any);

    await expect(
      worker.handle({
        id: "job-1",
        type: "PROCESS_PENDING_BATCH",
        payload: { batchSize: 10 },
        createdAt: "2026-07-20T10:00:00.000Z",
      }),
    ).rejects.toThrow("worker_batch_failed:1");
  });
});

