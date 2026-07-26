import type { BehaviorPhase, BehaviorPolicyConfig, BehaviorPolicyStats } from "./types";

export function evaluateReciprocity(params: {
  phase: BehaviorPhase;
  stats: BehaviorPolicyStats;
  config: BehaviorPolicyConfig;
}) {
  const { phase, stats, config } = params;
  const minRequired = config.trustScoreBands[phase].minReciprocityRatio;
  const outboundSafeBase = Math.max(stats.outboundCount, 1);
  const ratio = Number((stats.inboundCount / outboundSafeBase).toFixed(2));
  const requireInboundFirst = config.trustScoreBands[phase].requireInboundFirst;
  const allowed = (!requireInboundFirst || stats.inboundCount > 0) && ratio >= minRequired;

  return {
    allowed,
    minRequired,
    requireInboundFirst,
    ratio,
  };
}
