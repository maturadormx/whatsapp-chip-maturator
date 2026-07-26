import os from "os";
import { upsertWorkerHeartbeat } from "../db";

type WorkerHeartbeatStatus = "starting" | "running" | "degraded" | "stopped";

export class WorkerHeartbeat {
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly params: {
      workerId: string;
      runtime: string;
      queueName: string;
      intervalMs: number;
      metadata?: Record<string, unknown>;
    },
  ) {}

  async start() {
    await this.beat("starting");
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.beat("running");
    }, this.params.intervalMs);
  }

  async beat(status: WorkerHeartbeatStatus, metadata?: Record<string, unknown>) {
    await upsertWorkerHeartbeat({
      workerId: this.params.workerId,
      runtime: this.params.runtime,
      hostname: os.hostname(),
      pid: process.pid,
      queueName: this.params.queueName,
      status,
      metadata: {
        ...(this.params.metadata ?? {}),
        ...(metadata ?? {}),
      },
    });
  }

  async stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    await this.beat("stopped");
  }
}
