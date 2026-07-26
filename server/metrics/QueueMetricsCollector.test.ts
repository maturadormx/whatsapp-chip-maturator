import { describe, expect, it, vi } from "vitest";
import { QueueMetricsCollector } from "./QueueMetricsCollector";

describe("QueueMetricsCollector", () => {
  it("mapeia métricas da fila para chaves operacionais", async () => {
    const queue = {
      getMetrics: vi.fn().mockResolvedValue({
        pending: 1,
        active: 2,
        completed: 3,
        failed: 4,
        delayed: 5,
        publishedTotal: 6,
        consumedTotal: 7,
        retryTotal: 8,
        dlqTotal: 9,
        oldestPendingSeconds: 10,
      }),
    };

    const collector = new QueueMetricsCollector(queue as any);
    await expect(collector.collect()).resolves.toEqual({
      queue_pending_total: 1,
      queue_active_total: 2,
      queue_completed_total: 3,
      queue_failed_total: 4,
      queue_delayed_total: 5,
      queue_published_total: 6,
      queue_consumed_total: 7,
      queue_retry_total: 8,
      queue_dlq_total: 9,
      queue_oldest_pending_seconds: 10,
    });
  });
});

