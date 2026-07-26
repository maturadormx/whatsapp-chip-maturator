export const PipelineEvents = {
  Started: "pipeline.started",
  Completed: "pipeline.completed",
} as const;

export const ObservationEvents = {
  Saved: "observation.saved",
} as const;

export const FactEvents = {
  Generated: "fact.generated",
} as const;

export const RuleEvents = {
  Evaluated: "rule.evaluated",
} as const;

export const PlanEvents = {
  Created: "plan.created",
  Executed: "plan.executed",
} as const;

