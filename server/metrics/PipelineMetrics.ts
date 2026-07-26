import { Counter, Histogram } from "prom-client";
import { registry } from "./PrometheusRegistry";

const pipelineStartedTotal = new Counter({
  name: "pipeline_started_total",
  help: "Total de execuções iniciadas da pipeline",
  registers: [registry],
});

const pipelineCompletedTotal = new Counter({
  name: "pipeline_completed_total",
  help: "Total de execuções concluídas com sucesso na pipeline",
  registers: [registry],
});

const pipelineFailedTotal = new Counter({
  name: "pipeline_failed_total",
  help: "Total de execuções com falha na pipeline",
  registers: [registry],
});

const pipelineProcessingSeconds = new Histogram({
  name: "pipeline_processing_seconds",
  help: "Latência da pipeline em segundos",
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10, 30],
  registers: [registry],
});

export function recordPipelineStarted(): void {
  pipelineStartedTotal.inc();
}

export function recordPipelineCompleted(durationSeconds: number): void {
  pipelineCompletedTotal.inc();
  pipelineProcessingSeconds.observe(durationSeconds);
}

export function recordPipelineFailed(durationSeconds: number): void {
  pipelineFailedTotal.inc();
  pipelineProcessingSeconds.observe(durationSeconds);
}

