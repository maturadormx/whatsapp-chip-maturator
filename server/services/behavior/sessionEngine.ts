import type { BehaviorPhase, BehaviorPolicyConfig } from "./types";

function randomBetween(min: number, max: number) {
  if (max <= min) {
    return min;
  }
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function createBehaviorSession(params: {
  chipId: number;
  phase: BehaviorPhase;
  config: BehaviorPolicyConfig;
  now?: Date;
}) {
  const now = params.now ?? new Date();
  const phaseConfig = params.config.trustScoreBands[params.phase];
  const variance = params.config.jitter.sessionTimeVarianceHours;
  const shiftedHour = (now.getHours() + randomBetween(-variance, variance) + 24) % 24;
  const withinSleepWindow =
    shiftedHour >= params.config.jitter.sleepWindowStartHour && shiftedHour < params.config.jitter.sleepWindowEndHour;
  const actionBudget = randomBetween(phaseConfig.sessionCountRange[0], phaseConfig.sessionCountRange[1]);

  return {
    sessionId: `phase-${params.phase}-chip-${params.chipId}-${now.getTime()}`,
    actionBudget,
    withinSleepWindow,
  };
}
