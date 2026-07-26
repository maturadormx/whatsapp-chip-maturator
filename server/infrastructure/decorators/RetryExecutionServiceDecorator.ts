import type { ExecutionPlan } from "../../domain/executionPlan";
import type { ExecutionServicePort } from "../../ports/ExecutionServicePort";
import type { LoggerPort } from "../../ports/LoggerPort";

type RetryExecutionServiceDecoratorDeps = {
  maxAttempts?: number;
  baseDelayMs?: number;
  delayFn?: (ms: number) => Promise<void>;
};

function defaultDelay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class RetryExecutionServiceDecorator implements ExecutionServicePort {
  private readonly maxAttempts: number;
  private readonly baseDelayMs: number;
  private readonly delayFn: (ms: number) => Promise<void>;

  constructor(
    private readonly delegate: ExecutionServicePort,
    private readonly logger: LoggerPort,
    deps: RetryExecutionServiceDecoratorDeps = {},
  ) {
    this.maxAttempts = deps.maxAttempts ?? 3;
    this.baseDelayMs = deps.baseDelayMs ?? 100;
    this.delayFn = deps.delayFn ?? defaultDelay;
  }

  async execute(plan: ExecutionPlan): Promise<ExecutionPlan> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      try {
        const result = await this.delegate.execute(plan);
        if (attempt > 1) {
          this.logger.info("execution.retry.success", { planId: plan.id, attempt });
        }
        return result;
      } catch (error) {
        lastError = error;
        this.logger.warn("execution.retry.failed", { planId: plan.id, attempt });
        if (attempt < this.maxAttempts) {
          const delay = this.baseDelayMs * Math.pow(2, attempt - 1);
          await this.delayFn(delay);
        }
      }
    }

    throw lastError;
  }
}

