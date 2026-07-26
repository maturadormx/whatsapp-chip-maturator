import type { Express, Request, Response } from "express";
import { QueueMetricsCollector } from "./QueueMetricsCollector";
import type { MessageQueuePort } from "../ports/MessageQueuePort";

export function registerQueueMetricsRoute(app: Express, queue: MessageQueuePort | null) {
  app.get("/metrics/queue", async (_req: Request, res: Response) => {
    if (!queue) {
      return res.status(503).json({ error: "queue_disabled" });
    }

    try {
      const collector = new QueueMetricsCollector(queue);
      const metrics = await collector.collect();
      return res.json(metrics);
    } catch (error) {
      return res.status(503).json({
        error: "queue_metrics_unavailable",
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  });
}

