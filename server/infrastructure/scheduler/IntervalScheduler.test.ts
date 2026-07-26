import { afterEach, describe, expect, it, vi } from "vitest";
import { IntervalScheduler } from "./IntervalScheduler";

describe("IntervalScheduler", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("dispara o caso de uso em intervalo fixo", async () => {
    vi.useFakeTimers();
    const useCase = {
      execute: vi.fn().mockResolvedValue(undefined),
    };
    const logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    const scheduler = new IntervalScheduler(useCase as any, logger as any, 1000);
    scheduler.start();

    await vi.advanceTimersByTimeAsync(1000);
    expect(useCase.execute).toHaveBeenCalledTimes(1);
    expect(logger.debug).toHaveBeenCalledWith("scheduler.triggered", {});
  });

  it("stop interrompe novos disparos", async () => {
    vi.useFakeTimers();
    const useCase = {
      execute: vi.fn().mockResolvedValue(undefined),
    };
    const logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    const scheduler = new IntervalScheduler(useCase as any, logger as any, 1000);
    scheduler.start();
    scheduler.stop();

    await vi.advanceTimersByTimeAsync(3000);
    expect(useCase.execute).not.toHaveBeenCalled();
    expect(scheduler.isRunning()).toBe(false);
  });
});
