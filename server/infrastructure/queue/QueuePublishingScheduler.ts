import type { LoggerPort } from "../../ports/LoggerPort";
import type { MessageQueuePort } from "../../ports/MessageQueuePort";
import type { SchedulerPort } from "../../ports/SchedulerPort";
import { recordSchedulerJobPublished, recordSchedulerPublishFailure, recordSchedulerRun } from "../../metrics";
import { getInternalEventBus } from "../../services/events/InternalEventBus";
import { telemetry } from "../../telemetry";

export class QueuePublishingScheduler implements SchedulerPort {
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly queue: MessageQueuePort,
    private readonly logger: LoggerPort,
    private readonly intervalMs = 5 * 60 * 1000,
    private readonly batchSize = 25,
  ) {}

  start(): void {
    if (this.timer) return;

    this.timer = setInterval(() => {
      this.logger.debug("scheduler.triggered", { mode: "queue" });
      recordSchedulerRun();
      void telemetry.withSpan(
        "scheduler.run",
        async (span) => {
          telemetry.addEvent(span, "publishing_batch", { batchSize: this.batchSize });
          await this.queue.publish({
            id: `batch-${Date.now()}`,
            type: "PROCESS_PENDING_BATCH",
            payload: { batchSize: this.batchSize },
            metadata: {
              source: "scheduler",
              workerId: process.pid,
            },
            priority: 10,
            attempts: 3,
            backoffMs: 2000,
            lane: "priority",
            createdAt: new Date().toISOString(),
          });
          recordSchedulerJobPublished();
          telemetry.addEvent(span, "batch_published", { batchSize: this.batchSize });
          await getInternalEventBus().publish({
            type: "scheduler.batch_published",
            source: "QueuePublishingScheduler",
            payload: {
              batchSize: this.batchSize,
              pid: process.pid,
            },
          }).catch(() => null);
        },
        {
          attributes: {
            "scheduler.interval_ms": this.intervalMs,
            "scheduler.batch_size": this.batchSize,
          },
        },
      ).catch((error) => {
        recordSchedulerPublishFailure();
        this.logger.error("scheduler.publish.failed", { mode: "queue" }, error);
        void getInternalEventBus().publish({
          type: "scheduler.publish_failed",
          source: "QueuePublishingScheduler",
          payload: {
            error: error instanceof Error ? error.message : String(error),
            pid: process.pid,
          },
        }).catch(() => null);
      });
    }, this.intervalMs);
  }

  stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  isRunning(): boolean {
    return this.timer !== null;
  }
}
