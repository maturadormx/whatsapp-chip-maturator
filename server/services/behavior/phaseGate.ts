import type { BehaviorPhase, BehaviorPolicyAction, BehaviorPolicyConfig } from "./types";

export function resolveBehaviorPhase(params: {
  trustScore: number;
  chipAgeDays: number;
  config: BehaviorPolicyConfig;
}): { phase: BehaviorPhase; source: "trust" | "age" } {
  const { trustScore, chipAgeDays, config } = params;
  const phases = Object.entries(config.trustScoreBands) as Array<[BehaviorPhase, BehaviorPolicyConfig["trustScoreBands"][BehaviorPhase]]>;

  const trustMatch = phases.find(([, band]) => trustScore >= band.trustMin && trustScore <= band.trustMax);
  if (trustMatch) {
    return { phase: trustMatch[0], source: "trust" };
  }

  const ageMatch = phases.find(([, band]) => chipAgeDays >= band.fallbackAgeDaysStart && chipAgeDays <= band.fallbackAgeDaysEnd);
  return { phase: ageMatch?.[0] ?? "birth", source: "age" };
}

export function isActionAllowedInPhase(params: {
  phase: BehaviorPhase;
  action: BehaviorPolicyAction;
  config: BehaviorPolicyConfig;
}) {
  const { phase, action, config } = params;
  return config.trustScoreBands[phase].allowedActions.includes(action);
}
