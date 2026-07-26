import type { BehaviorPhase, BehaviorPolicyAction, BehaviorPolicyConfig, BehaviorPolicyStats } from "./types";

export function calculateDailyBudget(params: {
  phase: BehaviorPhase;
  action: BehaviorPolicyAction;
  stats: BehaviorPolicyStats;
  config: BehaviorPolicyConfig;
}) {
  const { phase, action, stats, config } = params;
  const phaseLimit = config.trustScoreBands[phase].maxDailyBudget;
  const spent = stats.todayActionTypes.reduce((sum, actionType) => sum + (config.dailyBudgetCosts[actionType] ?? 1), 0);
  const nextCost = config.dailyBudgetCosts[action] ?? 1;
  const remaining = Math.max(0, phaseLimit - spent);

  return {
    spent,
    limit: phaseLimit,
    nextCost,
    remaining,
    allowed: spent + nextCost <= phaseLimit,
  };
}
