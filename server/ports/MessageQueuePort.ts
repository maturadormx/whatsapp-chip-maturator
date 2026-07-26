export interface QueueJob {
  id: string;
  type: string;
  payload: unknown;
  metadata?: Record<string, unknown>;
  createdAt: string;
  priority?: number;
  attempts?: number;
  backoffMs?: number;
  lane?: "action" | "priority" | "retry" | "dead_letter";
}

export interface QueueMetrics {
  pending: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  publishedTotal: number;
  consumedTotal: number;
  retryTotal: number;
  dlqTotal: number;
  oldestPendingSeconds: number;
}

export interface MessageQueuePort {
  publish(job: QueueJob): Promise<void>;
  subscribe(handler: (job: QueueJob) => Promise<void>): Promise<void>;
  getMetrics(): Promise<QueueMetrics>;
  close(): Promise<void>;
}
