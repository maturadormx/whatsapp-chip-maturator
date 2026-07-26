import type { ExecutionPlan } from "../../domain/executionPlan";
import type { ExecutionServicePort } from "../../ports/ExecutionServicePort";

type DefaultExecutionServiceDeps = {
  onPlanCreated?: (plan: ExecutionPlan) => void;
};

export class DefaultExecutionService implements ExecutionServicePort {
  private readonly onPlanCreated: (plan: ExecutionPlan) => void;

  constructor(deps: DefaultExecutionServiceDeps = {}) {
    this.onPlanCreated = deps.onPlanCreated ?? (() => {});
  }

  async execute(plan: ExecutionPlan): Promise<ExecutionPlan> {
    this.onPlanCreated(plan);
    return plan;
  }
}
