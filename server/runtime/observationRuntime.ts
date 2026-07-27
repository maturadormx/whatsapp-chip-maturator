import { ENV } from "../_core/env";
import { sql } from "drizzle-orm";
import { InboundService } from "../inbound/InboundService";
import { ProcessPendingObservationsUseCase } from "../application/observation/ProcessPendingObservationsUseCase";
import { ObservationPipeline } from "../application/observation/ObservationPipeline";
import { DefaultExecutionService } from "../application/execution/DefaultExecutionService";
import { MemoryEventStore } from "../infrastructure/event-store/MemoryEventStore";
import { DevLogger } from "../infrastructure/logging/DevLogger";
import { MysqlEventStore } from "../infrastructure/persistence/mysql/MysqlEventStore";
import { MysqlObservationRepository } from "../infrastructure/persistence/mysql/MysqlObservationRepository";
import { BullMQAdapter } from "../infrastructure/queue/BullMQAdapter";
import { ObservationWorker } from "../infrastructure/queue/ObservationWorker";
import { QueuePublishingScheduler } from "../infrastructure/queue/QueuePublishingScheduler";
import { IntervalScheduler } from "../infrastructure/scheduler/IntervalScheduler";
import type { SchedulerPort } from "../ports/SchedulerPort";
import { MemoryObservationRepository } from "../repositories/observation/MemoryObservationRepository";
import { DefaultRuleEngine } from "../rules/DefaultRuleEngine";
import { getDb } from "../db";
import { WorkerManager } from "../workers/WorkerManager";

function isMysqlDriverEnabled() {
  return ENV.observationRuntimeDriver === "mysql" && Boolean(ENV.databaseUrl);
}

function isQueueEnabled() {
  return ENV.observationQueueEnabled && ENV.redisEnabled;
}

export function createObservationRuntime() {
  const logger = new DevLogger();
  const driver = isMysqlDriverEnabled() ? "mysql" : "memory";
  const repository = driver === "mysql" ? new MysqlObservationRepository() : new MemoryObservationRepository();
  const eventStore = driver === "mysql" ? new MysqlEventStore() : new MemoryEventStore();
  const ruleEngine = new DefaultRuleEngine();
  const executionService = new DefaultExecutionService();
  const queueEnabled = isQueueEnabled();
  const createQueue = () =>
    new BullMQAdapter(ENV.redisUrl, ENV.observationQueueName, logger, {
      attempts: ENV.observationQueueAttempts,
      backoffMs: ENV.observationQueueBackoffMs,
    });
  const queue = queueEnabled
    ? createQueue()
    : null;

  const pipeline = new ObservationPipeline({
    repository,
    eventStore,
    logger,
    ruleEngine,
    executionService,
  });

  const inboundService = new InboundService(pipeline);
  const processPendingObservations = new ProcessPendingObservationsUseCase(
    repository,
    pipeline,
    logger,
    `scheduler-${process.pid}`,
    ENV.observationSchedulerBatchSize,
  );
  const scheduler: SchedulerPort = queue
    ? new QueuePublishingScheduler(
        queue,
        logger,
        ENV.observationSchedulerIntervalMs,
        ENV.observationSchedulerBatchSize,
      )
    : new IntervalScheduler(processPendingObservations, logger, ENV.observationSchedulerIntervalMs);
  const workerManager = queue
    ? new WorkerManager({
        enabled: queueEnabled,
        queueName: ENV.observationQueueName,
        runtimeName: "observation-runtime",
        createWorker: ({ workerId, onLifecycleEvent }) => {
          const workerQueue = createQueue();
          const worker = new ObservationWorker(workerQueue, repository, pipeline, logger, {
            workerId,
            onLifecycleEvent,
          });

          return {
            getWorkerId: () => worker.getWorkerId(),
            start: () => worker.start(),
            stop: () => workerQueue.close(),
          };
        },
      })
    : null;

  return {
    driver,
    queueEnabled,
    logger,
    repository,
    eventStore,
    ruleEngine,
    queue,
    workerManager,
    executionService,
    pipeline,
    inboundService,
    processPendingObservations,
    scheduler,
    async checkReady() {
      const baseStatus: Record<string, unknown> = {
        driver,
        queueEnabled,
      };

      if (driver === "memory") {
        if (!queueEnabled) {
          return { ok: true, ...baseStatus };
        }
      }

      if (queueEnabled && queue) {
        try {
          const queueMetrics = await queue.getMetrics();
          if (driver === "memory") {
            return { ok: true, ...baseStatus, queue: queueMetrics };
          }
          baseStatus.queue = queueMetrics;
        } catch (error) {
          return {
            ok: false,
            ...baseStatus,
            reason: error instanceof Error ? error.message : String(error),
          };
        }
      }

      try {
        const db = await getDb();
        if (!db) return { ok: false, ...baseStatus, reason: "mysql_not_available" };
        await (db as any).execute?.(sql`SELECT 1`);
        return { ok: true, ...baseStatus };
      } catch (error) {
        return {
          ok: false,
          ...baseStatus,
          reason: error instanceof Error ? error.message : String(error),
        };
      }
    },
    async close() {
      scheduler.stop();
      await workerManager?.stop();
      await queue?.close();
    },
  };
}
