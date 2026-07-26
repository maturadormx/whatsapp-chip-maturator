import os from "os";
import type { ObservationPipelinePort } from "../../ports/ObservationPipelinePort";
import type { ObservationRepositoryPort } from "../../ports/ObservationRepositoryPort";
import type { LoggerPort } from "../../ports/LoggerPort";
import type { MessageQueuePort, QueueJob } from "../../ports/MessageQueuePort";
import { recordWorkerBatch, setWorkerRunning } from "../../metrics";
import { telemetry } from "../../telemetry";

export type ObservationWorkerLifecycleEvent =
  | { type: "started"; workerId: string }
  | { type: "batch_completed"; workerId: string; processed: number; failures: number; durationMs: number; jobId: string }
  | { type: "batch_failed"; workerId: string; processed: number; failures: number; durationMs: number; jobId: string; error: string };

type ObservationWorkerOptions = {
  workerId?: string;
  onLifecycleEvent?: (event: ObservationWorkerLifecycleEvent) => Promise<void> | void;
};

export class ObservationWorker {
  private started = false;
  private readonly workerId: string;

  constructor(
    private readonly queue: MessageQueuePort,
    private readonly repository: ObservationRepositoryPort,
    private readonly pipeline: ObservationPipelinePort,
    private readonly logger: LoggerPort,
    private readonly options: ObservationWorkerOptions = {},
  ) {
    this.workerId = options.workerId ?? `${os.hostname()}:${process.pid}`;
  }

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    setWorkerRunning(true);
    this.logger.info("worker.started", { workerId: this.workerId });
    await this.options.onLifecycleEvent?.({
      type: "started",
      workerId: this.workerId,
    });
    await this.queue.subscribe(this.handle.bind(this));
  }

  getWorkerId(): string {
    return this.workerId;
  }

  async handle(job: QueueJob): Promise<void> {
    if (job.type !== "PROCESS_PENDING_BATCH") return;
    await telemetry.withSpan(
      "worker.processBatch",
      async (span) => {
        const batchSize =
          typeof (job.payload as { batchSize?: unknown })?.batchSize === "number"
            ? (job.payload as { batchSize: number }).batchSize
            : 25;

        const claimId = `${this.workerId}:${job.id}`;
        const observations = await this.repository.claimPending(batchSize, claimId);
        let processed = 0;
        let failures = 0;
        const startTime = Date.now();
        telemetry.addEvent(span, "claimed_observations", { count: observations.length });

        for (const observation of observations) {
          try {
            telemetry.addEvent(span, "processing_observation", { observationId: observation.id });
            await this.pipeline.process(observation);
            processed += 1;
            this.logger.debug("worker.processed", { observationId: observation.id });
          } catch (error) {
            failures += 1;
            this.logger.error("worker.failed", { observationId: observation.id }, error);
          }
        }

        this.logger.info("worker.batch.completed", {
          processed,
          failures,
          duration: Date.now() - startTime,
          workerId: this.workerId,
        });
        recordWorkerBatch(processed, failures, (Date.now() - startTime) / 1000);
        if (failures > 0) {
          await this.options.onLifecycleEvent?.({
            type: "batch_failed",
            workerId: this.workerId,
            processed,
            failures,
            durationMs: Date.now() - startTime,
            jobId: job.id,
            error: `worker_batch_failed:${failures}`,
          });
        } else {
          await this.options.onLifecycleEvent?.({
            type: "batch_completed",
            workerId: this.workerId,
            processed,
            failures,
            durationMs: Date.now() - startTime,
            jobId: job.id,
          });
        }

        telemetry.addEvent(span, "worker_batch_completed", {
          processed,
          failures,
        });

        if (failures > 0) {
          throw new Error(`worker_batch_failed:${failures}`);
        }
      },
      {
        attributes: {
          "queue.job_id": job.id,
          "queue.job_type": job.type,
        },
      },
    );
  }
}
