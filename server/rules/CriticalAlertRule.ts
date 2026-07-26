import type { ExecutionAction } from "../domain/executionPlan";
import type { Fact } from "../domain/fact";

export class CriticalAlertRule {
  evaluate(fact: Fact): ExecutionAction[] {
    const severity = fact.data["severity"];
    if (severity === "critical") {
      return [
        {
          type: "alert",
          payload: {
            severity: "critical",
            factId: fact.id,
          },
        },
      ];
    }

    return [];
  }
}

