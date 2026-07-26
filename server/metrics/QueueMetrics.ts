import { Counter, Gauge, Histogram } from "prom-client";
import { registry } from "./PrometheusRegistry";

const queueJobsPublishedTotal = new Counter({
  name: "queue_jobs_published_total",
  help: "Total de jobs publicados na fila",
  registers: [registry],
});

const queueJobsConsumedTotal = new Counter({
  name: "queue_jobs_consumed_total",
  help: "Total de jobs consumidos da fila",
  registers: [registry],
});

const queuePendingObservations = new Gauge({
  name: "queue_pending_observations",
  help: "Quantidade atual de jobs pendentes na fila",
  registers: [registry],
});

const queueActiveJobs = new Gauge({
  name: "queue_active_jobs",
  help: "Quantidade atual de jobs ativos na fila",
  registers: [registry],
});

const queueFailedJobs = new Gauge({
  name: "queue_failed_jobs",
  help: "Quantidade atual de jobs falhos na fila",
  registers: [registry],
});

const queueDelayedJobs = new Gauge({
  name: "queue_delayed_jobs",
  help: "Quantidade atual de jobs atrasados na fila",
  registers: [registry],
});

const queueWaitSeconds = new Histogram({
  name: "queue_wait_seconds",
  help: "Tempo de espera do job na fila antes do consumo",
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 5, 10, 30, 60],
  registers: [registry],
});

export function recordQueuePublished(): void {
  queueJobsPublishedTotal.inc();
}

export function recordQueueConsumed(waitSeconds?: number): void {
  queueJobsConsumedTotal.inc();
  if (typeof waitSeconds === "number" && Number.isFinite(waitSeconds) && waitSeconds >= 0) {
    queueWaitSeconds.observe(waitSeconds);
  }
}

export function syncQueueGauges(snapshot: {
  pending: number;
  active: number;
  failed: number;
  delayed: number;
}): void {
  queuePendingObservations.set(snapshot.pending);
  queueActiveJobs.set(snapshot.active);
  queueFailedJobs.set(snapshot.failed);
  queueDelayedJobs.set(snapshot.delayed);
}

