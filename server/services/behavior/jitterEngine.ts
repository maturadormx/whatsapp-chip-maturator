import type { BehaviorPolicyConfig } from "./types";

function randomBetween(min: number, max: number) {
  if (max <= min) {
    return min;
  }
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function generateBehaviorDelayMs(params: {
  config: BehaviorPolicyConfig;
  multiplier?: number;
}) {
  const seconds = randomBetween(params.config.jitter.minReplyDelaySeconds, params.config.jitter.maxReplyDelaySeconds);
  const multiplier = params.multiplier ?? 1;
  return Math.max(5_000, Math.round(seconds * 1000 * multiplier));
}

export function generateInterActionDelaySeconds(config: BehaviorPolicyConfig) {
  return randomBetween(config.jitter.interActionDelayMinSeconds, config.jitter.interActionDelayMaxSeconds);
}
