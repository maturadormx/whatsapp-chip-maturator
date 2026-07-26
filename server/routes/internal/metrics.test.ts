import express from "express";
import { createServer, type Server } from "http";
import { afterEach, describe, expect, it } from "vitest";
import { createInternalMetricsRouter } from "./metrics";
import { getRegistry, registry } from "../../metrics";

describe("GET /internal/metrics", () => {
  let server: Server | null = null;

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server!.close((error) => (error ? reject(error) : resolve()));
      });
      server = null;
    }
  });

  it("deve retornar 200 e Content-Type Prometheus", async () => {
    const app = express();
    app.use(
      "/internal",
      createInternalMetricsRouter({
        getMetrics: async () => ({
          pending: 2,
          active: 1,
          completed: 0,
          failed: 3,
          delayed: 4,
          publishedTotal: 5,
          consumedTotal: 6,
          retryTotal: 7,
          dlqTotal: 8,
          oldestPendingSeconds: 9,
        }),
      } as any),
    );
    server = createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, resolve));

    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("server_address_unavailable");
    }

    const response = await fetch(`http://127.0.0.1:${address.port}/internal/metrics`);
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toMatch(/text\/plain/i);
    expect(body).toContain("# HELP");
    expect(body).toContain("# TYPE");
    expect(body).toContain("queue_jobs_published_total");
    expect(body).toContain("queue_jobs_consumed_total");
    expect(body).toContain("queue_pending_observations");
    expect(body).toContain("queue_active_jobs");
    expect(body).toContain("queue_failed_jobs");
    expect(body).toContain("queue_delayed_jobs");
    expect(body).toContain("queue_wait_seconds");
    expect(body).toContain("pipeline_started_total");
    expect(body).toContain("pipeline_completed_total");
    expect(body).toContain("pipeline_failed_total");
    expect(body).toContain("pipeline_processing_seconds");
    expect(body).toContain("worker_jobs_processed_total");
    expect(body).toContain("worker_jobs_failed_total");
    expect(body).toContain("worker_running");
    expect(body).toContain("worker_batch_processing_seconds");
    expect(body).toContain("scheduler_runs_total");
    expect(body).toContain("scheduler_jobs_published_total");
    expect(body).toContain("scheduler_publish_failures_total");
    expect(body).toContain("dlq_jobs_total");
    expect(body).toContain("dlq_current_size");
  });

  it("getRegistry deve retornar o mesmo singleton", () => {
    expect(getRegistry()).toBe(registry);
  });
});
