import { Counter } from "prom-client";
import { registry } from "./PrometheusRegistry";

const schedulerRunsTotal = new Counter({
  name: "scheduler_runs_total",
  help: "Total de execuções do scheduler",
  registers: [registry],
});

const schedulerJobsPublishedTotal = new Counter({
  name: "scheduler_jobs_published_total",
  help: "Total de jobs publicados pelo scheduler",
  registers: [registry],
});

const schedulerPublishFailuresTotal = new Counter({
  name: "scheduler_publish_failures_total",
  help: "Total de falhas ao publicar jobs pelo scheduler",
  registers: [registry],
});

export function recordSchedulerRun(): void {
  schedulerRunsTotal.inc();
}

export function recordSchedulerJobPublished(): void {
  schedulerJobsPublishedTotal.inc();
}

export function recordSchedulerPublishFailure(): void {
  schedulerPublishFailuresTotal.inc();
}

