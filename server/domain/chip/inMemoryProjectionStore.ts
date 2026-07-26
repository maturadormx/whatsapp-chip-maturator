import type { ChipProjectionStore, ChipStateProjection, ChipWorkerCheckpoint } from "./persistence";

export class InMemoryChipProjectionStore implements ChipProjectionStore {
  private readonly projections = new Map<string, ChipStateProjection>();
  private readonly checkpoints = new Map<string, ChipWorkerCheckpoint>();

  async saveProjection(projection: ChipStateProjection): Promise<void> {
    this.projections.set(projection.chip_id, projection);
  }

  async getProjection(chipId: string): Promise<ChipStateProjection | null> {
    return this.projections.get(chipId) ?? null;
  }

  async saveCheckpoint(checkpoint: ChipWorkerCheckpoint): Promise<void> {
    this.checkpoints.set(checkpoint.worker_name, checkpoint);
  }

  async getCheckpoint(workerName: string): Promise<ChipWorkerCheckpoint | null> {
    return this.checkpoints.get(workerName) ?? null;
  }
}
