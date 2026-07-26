import os from "os";
import { ENV } from "../_core/env";
import type { ObservationWorkerLifecycleEvent } from "../infrastructure/queue/ObservationWorker";
import { recordAuditEvent } from "../services/audit/AuditEngine";
import { getSystemConfigValue } from "../services/config/SystemConfigService";
import { getInternalEventBus } from "../services/events/InternalEventBus";
import { WorkerHeartbeat } from "./WorkerHeartbeat";
import { type StartableWorker, WorkerPool } from "./WorkerPool";

export class WorkerManager {
  private pool: WorkerPool | null = null;
  private started = false;

  constructor(
    private readonly params: {
      enabled: boolean;
      queueName: string;
      runtimeName: string;
      createWorker: (input: {
        workerId: string;
        onLifecycleEvent: (event: ObservationWorkerLifecycleEvent) => Promise<void>;
      }) => StartableWorker;
    },
  ) {}

  async start() {
    if (!this.params.enabled || this.started) return;
    this.started = true;

    const desiredCount = Math.max(
      1,
      await getSystemConfigValue("runtime.observation.worker_count", ENV.observationWorkerCount),
    );
    const heartbeatMs = Math.max(
      5_000,
      await getSystemConfigValue("runtime.observation.worker_heartbeat_ms", ENV.observationWorkerHeartbeatMs),
    );

    const workers = Array.from({ length: desiredCount }, (_, index) => {
      const workerId = `${this.params.runtimeName}:${os.hostname()}:${process.pid}:${index + 1}`;
      const heartbeat = new WorkerHeartbeat({
        workerId,
        runtime: this.params.runtimeName,
        queueName: this.params.queueName,
        intervalMs: heartbeatMs,
      });

      const worker = this.params.createWorker({
        workerId,
        onLifecycleEvent: async (event) => {
          if (event.type === "started") {
            await heartbeat.beat("running");
            await recordAuditEvent({
              engine: "WorkerManager",
              action: "worker_started",
              entityType: "worker",
              entityId: event.workerId,
              workerId: event.workerId,
              payload: {
                runtime: this.params.runtimeName,
                queueName: this.params.queueName,
              },
            }).catch(() => null);
            await getInternalEventBus().publish({
              type: "worker.started",
              source: "WorkerManager",
              payload: {
                runtime: this.params.runtimeName,
                queueName: this.params.queueName,
                workerId: event.workerId,
              },
            }).catch(() => null);
            return;
          }

          await heartbeat.beat(event.type === "batch_failed" ? "degraded" : "running", {
            processed: event.processed,
            failures: event.failures,
            durationMs: event.durationMs,
            jobId: event.jobId,
          });
          await recordAuditEvent({
            engine: "ObservationWorker",
            action: event.type,
            entityType: "worker",
            entityId: event.workerId,
            result: event.type === "batch_failed" ? "failed" : "success",
            errorMessage: event.type === "batch_failed" ? event.error : null,
            durationMs: event.durationMs,
            workerId: event.workerId,
            payload: {
              processed: event.processed,
              failures: event.failures,
              jobId: event.jobId,
            },
          }).catch(() => null);
          await getInternalEventBus().publish({
            type: event.type === "batch_failed" ? "worker.batch_failed" : "worker.batch_completed",
            source: "WorkerManager",
            payload: {
              runtime: this.params.runtimeName,
              queueName: this.params.queueName,
              workerId: event.workerId,
              processed: event.processed,
              failures: event.failures,
              durationMs: event.durationMs,
              jobId: event.jobId,
              error: event.type === "batch_failed" ? event.error : null,
            },
          }).catch(() => null);
        },
      });

      return {
        ...worker,
        heartbeat,
      };
    });

    this.pool = new WorkerPool(
      workers.map((worker) => ({
        getWorkerId: () => worker.getWorkerId(),
        start: async () => {
          await worker.heartbeat.start();
          await worker.start();
        },
        stop: async () => {
          await worker.heartbeat.stop();
          await worker.stop();
          await recordAuditEvent({
            engine: "WorkerManager",
            action: "worker_stopped",
            entityType: "worker",
            entityId: worker.getWorkerId(),
            workerId: worker.getWorkerId(),
            payload: {
              runtime: this.params.runtimeName,
            },
          }).catch(() => null);
          await getInternalEventBus().publish({
            type: "worker.stopped",
            source: "WorkerManager",
            payload: {
              runtime: this.params.runtimeName,
              workerId: worker.getWorkerId(),
            },
          }).catch(() => null);
        },
      })),
    );

    await this.pool.startAll();
  }

  async stop() {
    if (!this.pool) return;
    await this.pool.stopAll();
    this.pool = null;
    this.started = false;
  }

  listWorkerIds() {
    return this.pool?.listWorkerIds() ?? [];
  }
}
