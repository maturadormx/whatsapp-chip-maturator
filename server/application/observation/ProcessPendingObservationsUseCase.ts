import type { LoggerPort } from "../../ports/LoggerPort";
import type { ObservationPipelinePort } from "../../ports/ObservationPipelinePort";
import type { ObservationRepositoryPort } from "../../ports/ObservationRepositoryPort";

export class ProcessPendingObservationsUseCase {
  constructor(
    private readonly repository: ObservationRepositoryPort,
    private readonly pipeline: ObservationPipelinePort,
    private readonly logger: LoggerPort,
    private readonly workerId = `worker-${process.pid}`,
    private readonly batchSize = 25,
  ) {}

  async execute(): Promise<void> {
    this.logger.debug("scheduler.started", {});
    const pending = await this.repository.claimPending(this.batchSize, this.workerId);

    for (const observation of pending) {
      try {
        await this.pipeline.process(observation);
        this.logger.debug("scheduler.processed", { observationId: observation.id });
      } catch (error) {
        this.logger.error("scheduler.failed", { observationId: observation.id }, error);
      }
    }

    this.logger.debug("scheduler.completed", { processed: pending.length });
  }
}
