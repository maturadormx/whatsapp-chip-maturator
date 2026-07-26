import type { ProcessPendingObservationsUseCase } from "../../application/observation/ProcessPendingObservationsUseCase";
import type { LoggerPort } from "../../ports/LoggerPort";
import type { SchedulerPort } from "../../ports/SchedulerPort";

export class IntervalScheduler implements SchedulerPort {
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly useCase: ProcessPendingObservationsUseCase,
    private readonly logger: LoggerPort,
    private readonly intervalMs = 5 * 60 * 1000,
  ) {}

  start(): void {
    if (this.timer) return;

    this.timer = setInterval(() => {
      this.logger.debug("scheduler.triggered", {});
      void this.useCase.execute();
    }, this.intervalMs);
  }

  stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  isRunning(): boolean {
    return this.timer !== null;
  }
}

