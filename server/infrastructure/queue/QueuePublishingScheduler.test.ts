import { afterEach, describe, expect, it, vi } from "vitest";
import { QueuePublishingScheduler } from "./QueuePublishingScheduler";

describe("QueuePublishingScheduler", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("publica PROCESS_PENDING_BATCH no intervalo", async () => {
    vi.useFakeTimers();
    const queue = { publish: vi.fn().mockResolvedValue(undefined) };
    const logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const scheduler = new QueuePublishingScheduler(queue as any, logger as any, 1000, 50);

    scheduler.start();
    await vi.advanceTimersByTimeAsync(1000);

    expect(queue.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "PROCESS_PENDING_BATCH",
        payload: { batchSize: 50 },
      }),
    );
  });
});

