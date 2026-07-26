import os from "os";
import { context, trace } from "@opentelemetry/api";
import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import type { LoggerPort } from "../../ports/LoggerPort";
import type { MessageQueuePort, QueueJob, QueueMetrics } from "../../ports/MessageQueuePort";
import { recordDlqJobMoved, recordQueueConsumed, recordQueuePublished } from "../../metrics";
import { telemetry } from "../../telemetry";

type QueueLike = {
  add: (name: string, data: unknown, opts?: Record<string, unknown>) => Promise<unknown>;
  getJobCounts: () => Promise<Record<string, number>>;
  getJobs: (...args: any[]) => Promise<Array<{ timestamp?: number }>>;
  close?: () => Promise<void>;
};

type WorkerLike = {
  on: (...args: any[]) => unknown;
  close?: () => Promise<void>;
};

type BullMQAdapterDeps = {
  queue?: QueueLike | any;
  dlq?: QueueLike | any;
  createWorker?: ((processor: (job: Job) => Promise<void>) => WorkerLike) | any;
  attempts?: number;
  backoffMs?: number;
};

const TELEMETRY_CONTEXT_KEY = "__otelContext";

export class BullMQAdapter implements MessageQueuePort {
  private readonly queue: QueueLike;
  private readonly dlq: QueueLike;
  private readonly createWorker: (processor: (job: Job) => Promise<void>) => WorkerLike;
  private worker?: WorkerLike;
  private publishedTotal = 0;
  private consumedTotal = 0;
  private retryTotal = 0;
  private dlqTotal = 0;

  constructor(
    private readonly redisUrl: string,
    private readonly queueName: string,
    private readonly logger: LoggerPort,
    private readonly deps: BullMQAdapterDeps = {},
  ) {
    this.queue =
      deps.queue ??
      new Queue(queueName, {
        connection: new IORedis(redisUrl, { maxRetriesPerRequest: null }),
      });
    this.dlq =
      deps.dlq ??
      new Queue(`${queueName}-dlq`, {
        connection: new IORedis(redisUrl, { maxRetriesPerRequest: null }),
      });
    this.createWorker =
      deps.createWorker ??
      ((processor) =>
        new Worker(queueName, processor, {
          connection: new IORedis(redisUrl, { maxRetriesPerRequest: null }),
        }));
  }

  async publish(job: QueueJob): Promise<void> {
    await telemetry.withSpan(
      "queue.publish",
      async (span) => {
        const traceCarrier = telemetry.injectContext(trace.setSpan(context.active(), span));
        const enrichedJob: QueueJob = {
          ...job,
          metadata: {
            ...(job.metadata ?? {}),
            [TELEMETRY_CONTEXT_KEY]: traceCarrier,
          },
        };

        await this.queue.add(job.type, enrichedJob, {
          attempts: job.attempts ?? this.deps.attempts ?? 5,
          priority: job.priority,
          backoff: { type: "exponential", delay: job.backoffMs ?? this.deps.backoffMs ?? 2000 },
          removeOnComplete: 100,
          removeOnFail: 50,
        });
        this.publishedTotal += 1;
        recordQueuePublished();
        this.logger.debug("queue.job.published", { jobId: job.id, type: job.type });
        telemetry.addEvent(span, "job_published", { jobId: job.id });
      },
      {
        attributes: {
          "queue.job_id": job.id,
          "queue.job_type": job.type,
        },
      },
    );
  }

  async subscribe(handler: (job: QueueJob) => Promise<void>): Promise<void> {
    if (this.worker) return;

    const processJob = async (job: Job): Promise<void> => {
      const queueJob = job.data as QueueJob;
      const queueMetadata = queueJob.metadata as Record<string, unknown> | undefined;
      const parentCarrier = queueMetadata?.[TELEMETRY_CONTEXT_KEY] as Record<string, unknown> | undefined;
      const parentContext = telemetry.extractContext(parentCarrier);

      await telemetry.withSpan(
        "queue.consume",
        async (span) => {
          const waitSeconds = queueJob.createdAt ? Math.max(0, (Date.now() - Date.parse(queueJob.createdAt)) / 1000) : undefined;
          this.logger.debug("queue.job.processing", { jobId: queueJob.id, type: queueJob.type });
          telemetry.addEvent(span, "job_consumed", { jobId: queueJob.id });
          await handler(queueJob);
          this.consumedTotal += 1;
          recordQueueConsumed(waitSeconds);
          this.logger.debug("queue.job.completed", { jobId: queueJob.id });
        },
        {
          parentContext,
          attributes: {
            "queue.job_id": queueJob.id,
            "queue.job_type": queueJob.type,
          },
        },
      );
    };

    const onFailed = async (job: Job | undefined, err: Error): Promise<void> => {
      if (!job) return;

      const attempts = job.opts.attempts ?? (this.deps.attempts ?? 5);
      if (job.attemptsMade < attempts) {
        this.retryTotal += 1;
      }

      if (job.attemptsMade < attempts) return;

      const queueJob = job.data as QueueJob | undefined;
      const queueMetadata = queueJob?.metadata as Record<string, unknown> | undefined;
      const parentCarrier = queueMetadata?.[TELEMETRY_CONTEXT_KEY] as Record<string, unknown> | undefined;
      const parentContext = telemetry.extractContext(parentCarrier);

      await telemetry.withSpan(
        "queue.dlq",
        async (span) => {
          this.dlqTotal += 1;
          recordDlqJobMoved(this.dlqTotal);
          await this.dlq.add(job.name, {
            job: job.data,
            attempts: job.attemptsMade,
            error: err.message,
            stack: err.stack,
            worker: process.pid,
            hostname: os.hostname(),
            occurredAt: new Date().toISOString(),
          });
          this.logger.warn("queue.job.moved-to-dlq", {
            jobId: job.id,
            attempts: job.attemptsMade,
            hostname: os.hostname(),
          });
          telemetry.addEvent(span, "job_moved_to_dlq", {
            attempts: job.attemptsMade,
          });
        },
        {
          parentContext,
          attributes: {
            "queue.job_id": String(job.id ?? ""),
            "queue.job_type": job.name,
            "queue.attempts": job.attemptsMade,
          },
        },
      );
    };

    this.worker = this.createWorker(processJob);
    this.worker.on("failed", onFailed);
  }

  async getMetrics(): Promise<QueueMetrics> {
    const counts = await this.queue.getJobCounts();
    const oldestWaiting = await this.queue.getJobs(["waiting"], 0, 0, true);
    const oldestPendingSeconds =
      oldestWaiting[0]?.timestamp ? Math.max(0, Math.floor((Date.now() - oldestWaiting[0].timestamp) / 1000)) : 0;

    return {
      pending: counts.waiting ?? 0,
      active: counts.active ?? 0,
      completed: counts.completed ?? 0,
      failed: counts.failed ?? 0,
      delayed: counts.delayed ?? 0,
      publishedTotal: this.publishedTotal,
      consumedTotal: this.consumedTotal,
      retryTotal: this.retryTotal,
      dlqTotal: this.dlqTotal,
      oldestPendingSeconds,
    };
  }

  async close(): Promise<void> {
    await this.worker?.close?.();
    await this.queue.close?.();
    await this.dlq.close?.();
  }
}
