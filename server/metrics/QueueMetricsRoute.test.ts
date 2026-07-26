import express from "express";
import { afterEach, describe, expect, it } from "vitest";
import { createServer, type Server } from "http";
import { registerQueueMetricsRoute } from "./QueueMetricsRoute";

describe("QueueMetricsRoute", () => {
  let server: Server | null = null;

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server!.close((error) => (error ? reject(error) : resolve()));
      });
      server = null;
    }
  });

  it("expõe métricas da fila em /metrics/queue", async () => {
    const app = express();
    const queue = {
      getMetrics: async () => ({
        pending: 1,
        active: 2,
        completed: 3,
        failed: 4,
        delayed: 5,
        publishedTotal: 6,
        consumedTotal: 7,
        retryTotal: 8,
        dlqTotal: 9,
        oldestPendingSeconds: 10,
      }),
    };

    registerQueueMetricsRoute(app, queue as any);
    server = createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, resolve));

    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("server_address_unavailable");
    }

    const response = await fetch(`http://127.0.0.1:${address.port}/metrics/queue`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.queue_pending_total).toBe(1);
    expect(body.queue_dlq_total).toBe(9);
  });
});

