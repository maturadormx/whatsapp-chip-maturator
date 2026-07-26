import { describe, expect, it, vi } from "vitest";
import { ProcessPendingObservationsUseCase } from "./ProcessPendingObservationsUseCase";

describe("ProcessPendingObservationsUseCase", () => {
  it("processa todas as observations pendentes", async () => {
    const repository = {
      claimPending: vi.fn().mockResolvedValue([
        { id: "obs-1", source: "test", eventType: "a", payload: {}, timestamp: "2026-07-20T10:00:00.000Z" },
        { id: "obs-2", source: "test", eventType: "b", payload: {}, timestamp: "2026-07-20T10:01:00.000Z" },
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

    const useCase = new ProcessPendingObservationsUseCase(repository as any, pipeline as any, logger as any);
    await useCase.execute();

    expect(repository.claimPending).toHaveBeenCalledWith(25, expect.stringContaining("worker-"));
    expect(pipeline.process).toHaveBeenCalledTimes(2);
    expect(logger.debug).toHaveBeenCalledWith("scheduler.completed", { processed: 2 });
  });

  it("continua processamento mesmo se uma observation falhar", async () => {
    const repository = {
      claimPending: vi.fn().mockResolvedValue([
        { id: "obs-1", source: "test", eventType: "a", payload: {}, timestamp: "2026-07-20T10:00:00.000Z" },
        { id: "obs-2", source: "test", eventType: "b", payload: {}, timestamp: "2026-07-20T10:01:00.000Z" },
      ]),
    };
    const pipeline = {
      process: vi
        .fn()
        .mockRejectedValueOnce(new Error("boom"))
        .mockResolvedValueOnce(undefined),
    };
    const logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    const useCase = new ProcessPendingObservationsUseCase(repository as any, pipeline as any, logger as any);
    await useCase.execute();

    expect(pipeline.process).toHaveBeenCalledTimes(2);
    expect(logger.error).toHaveBeenCalledWith("scheduler.failed", { observationId: "obs-1" }, expect.any(Error));
  });
});
