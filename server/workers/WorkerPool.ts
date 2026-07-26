export interface StartableWorker {
  start(): Promise<void>;
  stop(): Promise<void>;
  getWorkerId(): string;
}

export class WorkerPool {
  constructor(private readonly workers: StartableWorker[]) {}

  async startAll() {
    for (const worker of this.workers) {
      await worker.start();
    }
  }

  async stopAll() {
    for (const worker of this.workers) {
      await worker.stop();
    }
  }

  listWorkerIds() {
    return this.workers.map((worker) => worker.getWorkerId());
  }

  size() {
    return this.workers.length;
  }
}
