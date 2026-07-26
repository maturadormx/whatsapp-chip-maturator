import {
  getRuntimeControlState,
  updateRuntimeFeatureFlags,
  type RuntimeFeatureFlags,
} from "../../utils/runtimeControl";
import { getConfigurationCenter } from "../config/ConfigurationCenter";
import { getInternalEventBus } from "../events/InternalEventBus";

const FEATURE_FLAGS_KEY = "runtime.feature_flags";

export async function getResolvedFeatureFlags(): Promise<RuntimeFeatureFlags> {
  const fallback = getRuntimeControlState().featureFlags;
  const fromConfig = await getConfigurationCenter().get<Partial<RuntimeFeatureFlags> | null>(
    FEATURE_FLAGS_KEY,
    null,
  );

  return {
    ...fallback,
    ...(fromConfig ?? {}),
  };
}

export async function isFeatureEnabled(flag: keyof RuntimeFeatureFlags) {
  const flags = await getResolvedFeatureFlags();
  return Boolean(flags[flag]);
}

export async function updateFeatureFlagsInConfig(nextFlags: Partial<RuntimeFeatureFlags>) {
  const current = await getResolvedFeatureFlags();
  const merged = {
    ...current,
    ...nextFlags,
  };

  updateRuntimeFeatureFlags(nextFlags);
  await getConfigurationCenter().set({
    key: FEATURE_FLAGS_KEY,
    value: merged,
    description: "Flags operacionais de runtime persistidas em banco.",
  });

  await getInternalEventBus().publish({
    type: "feature_flags.updated",
    source: "FeatureFlagService",
    payload: merged,
  });

  return merged;
}
