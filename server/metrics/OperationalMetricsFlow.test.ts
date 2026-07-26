import { afterEach, describe, expect, it, vi } from "vitest";
import { registry } from "./PrometheusRegistry";
import { ObservationPipeline } from "../application/observation/ObservationPipeline";
import { DefaultExecutionService } from "../application/execution/DefaultExecutionService";
import { MemoryEventStore } from "../infrastructure/event-store/MemoryEventStore";
import { DevLogger } from "../infrastructure/logging/DevLogger";
import { QueuePublishingScheduler } from "../infrastructure/queue/QueuePublishingScheduler";
import { ObservationWorker } from "../infrastructure/queue/ObservationWorker";
import { MemoryObservationRepository } from "../repositories/observation/MemoryObservationRepository";
import { DefaultRuleEngine } from "../rules/DefaultRuleEngine";
import type { MessageQueuePort, QueueJob, QueueMetrics } from "../ports/MessageQueuePort";

class InMemoryOperationalQueue implements MessageQueuePort {
  private handler: ((job: QueueJob) => Promise<void>) | null = null;
  private metrics: QueueMetrics = {
    pending: 0,
    active: 0,
    completed: 0,
    failed: 0,
    delayed: 0,
    publishedTotal: 0,
    consumedTotal: 0,
    retryTotal: 0,
    dlqTotal: 0,
    oldestPendingSeconds: 0,
  };

  async publish(job: QueueJob): Promise<void> {
    this.metrics.pending += 1;
    this.metrics.publishedTotal += 1;

    queueMicrotask(async () => {
      if (!this.handler) return;
      this.metrics.pending -= 1;
      this.metrics.active += 1;

      try {
        await this.handler(job);
        this.metrics.completed += 1;
        this.metrics.consumedTotal += 1;
      } catch {
        this.metrics.failed += 1;
      } finally {
        this.metrics.active -= 1;
      }
    });
  }

  async subscribe(handler: (job: QueueJob) => Promise<void>): Promise<void> {
    this.handler = handler;
  }

  async getMetrics(): Promise<QueueMetrics> {
    return { ...this.metrics };
  }

  async close(): Promise<void> {}
}

describe("OperationalMetricsFlow", () => {
  afterEach(() => {
    vi.useRealTimers();
    registry.resetMetrics();
  });

  it("incrementa métricas de queue, pipeline, worker e scheduler no fluxo integrado", async () => {
    vi.useFakeTimers();

    const queue = new InMemoryOperationalQueue();
    const repository = new MemoryObservationRepository();
    const eventStore = new MemoryEventStore();
    const logger = new DevLogger();
    const executionService = new DefaultExecutionService();
    const pipeline = new ObservationPipeline({
      repository,
      eventStore,
      logger,
      ruleEngine: new DefaultRuleEngine(),
      executionService,
    });

    await repository.save({
      id: "obs-metrics-1",
      source: "test",
      eventType: "critical-alert",
      payload: { severity: "critical" },
      timestamp: "2026-07-21T19:00:00.000Z",
    });

    const worker = new ObservationWorker(queue, repository, pipeline, logger);
    await worker.start();

    const scheduler = new QueuePublishingScheduler(queue, logger, 1000, 1);
    scheduler.start();

    await vi.advanceTimersByTimeAsync(1000);
    await vi.runAllTicks();
    await vi.advanceTimersByTimeAsync(0);
    scheduler.stop();

    const metrics = await registry.metrics();
    expect(metrics).toContain("queue_jobs_published_total");
    expect(metrics).toContain("queue_jobs_consumed_total");
    expect(metrics).toContain("pipeline_started_total 1");
    expect(metrics).toContain("pipeline_completed_total 1");
    expect(metrics).toContain("worker_jobs_processed_total 1");
    expect(metrics).toContain("scheduler_runs_total 1");
    expect(metrics).toContain("scheduler_jobs_published_total 1");
  });
});
