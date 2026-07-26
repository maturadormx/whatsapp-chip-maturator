import { Counter, Gauge } from "prom-client";
import { registry } from "./PrometheusRegistry";

const dlqJobsTotal = new Counter({
  name: "dlq_jobs_total",
  help: "Total de jobs movidos para a DLQ",
  registers: [registry],
});

const dlqCurrentSize = new Gauge({
  name: "dlq_current_size",
  help: "Quantidade atual estimada de jobs na DLQ",
  registers: [registry],
});

dlqCurrentSize.set(0);

export function recordDlqJobMoved(currentSize?: number): void {
  dlqJobsTotal.inc();
  if (typeof currentSize === "number" && Number.isFinite(currentSize) && currentSize >= 0) {
    dlqCurrentSize.set(currentSize);
  }
}

export function syncDlqCurrentSize(currentSize: number): void {
  dlqCurrentSize.set(currentSize);
}

