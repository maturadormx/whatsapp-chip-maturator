import { Counter, Gauge, Histogram } from "prom-client";
import { registry } from "./PrometheusRegistry";

const workerJobsProcessedTotal = new Counter({
  name: "worker_jobs_processed_total",
  help: "Total de observations processadas pelo worker",
  registers: [registry],
});

const workerJobsFailedTotal = new Counter({
  name: "worker_jobs_failed_total",
  help: "Total de observations com falha no worker",
  registers: [registry],
});

const workerRunning = new Gauge({
  name: "worker_running",
  help: "Indica se o worker está em execução (1/0)",
  registers: [registry],
});

const workerBatchProcessingSeconds = new Histogram({
  name: "worker_batch_processing_seconds",
  help: "Latência de processamento de lote do worker em segundos",
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10, 30],
  registers: [registry],
});

workerRunning.set(0);

export function setWorkerRunning(running: boolean): void {
  workerRunning.set(running ? 1 : 0);
}

export function recordWorkerBatch(processed: number, failures: number, durationSeconds: number): void {
  if (processed > 0) {
    workerJobsProcessedTotal.inc(processed);
  }
  if (failures > 0) {
    workerJobsFailedTotal.inc(failures);
  }
  workerBatchProcessingSeconds.observe(durationSeconds);
}

