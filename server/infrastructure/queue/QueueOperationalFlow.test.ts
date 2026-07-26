import { afterEach, describe, expect, it, vi } from "vitest";
import { ObservationPipeline } from "../../application/observation/ObservationPipeline";
import { DefaultExecutionService } from "../../application/execution/DefaultExecutionService";
import { MemoryEventStore } from "../event-store/MemoryEventStore";
import { DevLogger } from "../logging/DevLogger";
import { QueuePublishingScheduler } from "./QueuePublishingScheduler";
import { ObservationWorker } from "./ObservationWorker";
import { MemoryObservationRepository } from "../../repositories/observation/MemoryObservationRepository";
import { DefaultRuleEngine } from "../../rules/DefaultRuleEngine";
import type { MessageQueuePort, QueueJob, QueueMetrics } from "../../ports/MessageQueuePort";

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
        this.metrics.dlqTotal += 1;
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

describe("QueueOperationalFlow", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("valida Scheduler -> Queue -> Worker -> claimPending -> Pipeline -> completeProcessing", async () => {
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

    const claimSpy = vi.spyOn(repository, "claimPending");
    const completeSpy = vi.spyOn(repository, "completeProcessing");
    const processSpy = vi.spyOn(pipeline, "process");

    await repository.save({
      id: "obs-queue-1",
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

    const metrics = await queue.getMetrics();
    const observationEvents = await eventStore.get("observation:obs-queue-1");

    expect(claimSpy).toHaveBeenCalledTimes(1);
    expect(processSpy).toHaveBeenCalledTimes(1);
    expect(completeSpy).toHaveBeenCalledWith("obs-queue-1", true);
    expect(metrics.publishedTotal).toBe(1);
    expect(metrics.consumedTotal).toBe(1);
    expect(metrics.completed).toBe(1);
    expect(metrics.dlqTotal).toBe(0);
    expect(observationEvents).toHaveLength(1);

    scheduler.stop();
  });
});

