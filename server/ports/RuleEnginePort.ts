import type { ExecutionAction } from "../domain/executionPlan";
import type { Fact } from "../domain/fact";

export interface RuleEnginePort {
  evaluate(fact: Fact): Promise<ExecutionAction[]>;
}

