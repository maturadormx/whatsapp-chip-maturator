import type { ExecutionAction } from "../domain/executionPlan";
import type { Fact } from "../domain/fact";
import type { RuleEnginePort } from "../ports/RuleEnginePort";
import { CriticalAlertRule } from "./CriticalAlertRule";

type Rule = {
  evaluate(fact: Fact): ExecutionAction[];
};

type DefaultRuleEngineDeps = {
  rules?: Rule[];
};

export class DefaultRuleEngine implements RuleEnginePort {
  private readonly rules: Rule[];

  constructor(deps: DefaultRuleEngineDeps = {}) {
    this.rules = deps.rules ?? [new CriticalAlertRule()];
  }

  async evaluate(fact: Fact): Promise<ExecutionAction[]> {
    const actions: ExecutionAction[] = [];

    for (const rule of this.rules) {
      actions.push(...rule.evaluate(fact));
    }

    return actions;
  }
}

