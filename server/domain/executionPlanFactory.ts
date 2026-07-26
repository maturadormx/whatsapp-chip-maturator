import { randomUUID } from "crypto";
import type { ExecutionAction, ExecutionPlan } from "./executionPlan";
import type { Fact } from "./fact";

export class ExecutionPlanFactory {
  static create(fact: Fact): ExecutionPlan {
    return this.fromFact(fact, []);
  }

  static fromFact(fact: Fact, actions: ExecutionAction[]): ExecutionPlan {
    return {
      id: randomUUID(),
      factId: fact.id,
      actions,
      metadata: {
        factType: fact.type,
      },
      createdAt: fact.timestamp,
    };
  }
}
