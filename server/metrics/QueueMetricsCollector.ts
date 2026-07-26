import type { MessageQueuePort } from "../ports/MessageQueuePort";

export class QueueMetricsCollector {
  constructor(private readonly queue: MessageQueuePort) {}

  async collect(): Promise<Record<string, number>> {
    const metrics = await this.queue.getMetrics();
    return {
      queue_pending_total: metrics.pending,
      queue_active_total: metrics.active,
      queue_completed_total: metrics.completed,
      queue_failed_total: metrics.failed,
      queue_delayed_total: metrics.delayed,
      queue_published_total: metrics.publishedTotal,
      queue_consumed_total: metrics.consumedTotal,
      queue_retry_total: metrics.retryTotal,
      queue_dlq_total: metrics.dlqTotal,
      queue_oldest_pending_seconds: metrics.oldestPendingSeconds,
    };
  }
}

