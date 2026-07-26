import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { BehaviorPolicyConfig } from "./types";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RULES_PATH = path.resolve(__dirname, "../../operational-rules.json");
const DEFAULT_POLICY_VERSION = "2026.07.20";

const DEFAULT_CONFIG: BehaviorPolicyConfig = {
  trustScoreBands: {
    birth: {
      trustMin: 0,
      trustMax: 20,
      fallbackAgeDaysStart: 0,
      fallbackAgeDaysEnd: 3,
      maxDailyBudget: 18,
      minReciprocityRatio: 2,
      requireInboundFirst: true,
      sessionCountRange: [1, 1],
      allowedActions: ["read_messages", "observe_profile", "view_status", "status_view", "do_nothing"],
    },
    reactive: {
      trustMin: 21,
      trustMax: 40,
      fallbackAgeDaysStart: 4,
      fallbackAgeDaysEnd: 7,
      maxDailyBudget: 30,
      minReciprocityRatio: 1.5,
      requireInboundFirst: true,
      sessionCountRange: [1, 2],
      allowedActions: ["read_messages", "view_status", "status_view", "reply", "reaction", "group_read", "do_nothing"],
    },
    interactive: {
      trustMin: 41,
      trustMax: 60,
      fallbackAgeDaysStart: 8,
      fallbackAgeDaysEnd: 14,
      maxDailyBudget: 48,
      minReciprocityRatio: 1.2,
      requireInboundFirst: false,
      sessionCountRange: [1, 2],
      allowedActions: [
        "read_messages",
        "view_status",
        "status_view",
        "reply",
        "reaction",
        "group_read",
        "group_observe",
        "profile_update",
        "message_sent",
        "do_nothing",
      ],
    },
    active: {
      trustMin: 61,
      trustMax: 80,
      fallbackAgeDaysStart: 15,
      fallbackAgeDaysEnd: 30,
      maxDailyBudget: 72,
      minReciprocityRatio: 0.9,
      requireInboundFirst: false,
      sessionCountRange: [2, 3],
      allowedActions: [
        "read_messages",
        "view_status",
        "status_view",
        "reply",
        "reaction",
        "group_read",
        "group_observe",
        "group_interact",
        "profile_update",
        "message_sent",
        "initiate_dm",
        "do_nothing",
      ],
    },
    mature: {
      trustMin: 81,
      trustMax: 100,
      fallbackAgeDaysStart: 31,
      fallbackAgeDaysEnd: 3650,
      maxDailyBudget: 96,
      minReciprocityRatio: 0.75,
      requireInboundFirst: false,
      sessionCountRange: [2, 4],
      allowedActions: [
        "read_messages",
        "view_status",
        "status_view",
        "reply",
        "reaction",
        "group_read",
        "group_observe",
        "group_interact",
        "profile_update",
        "message_sent",
        "initiate_dm",
        "join_group",
        "do_nothing",
      ],
    },
  },
  dailyBudgetCosts: {
    read_messages: 1,
    observe_profile: 1,
    view_status: 1,
    status_view: 1,
    group_read: 1,
    group_observe: 2,
    reaction: 2,
    reply: 6,
    message_sent: 8,
    initiate_dm: 10,
    group_interact: 6,
    profile_update: 4,
    join_group: 7,
    do_nothing: 0,
  },
  jitter: {
    minReplyDelaySeconds: 90,
    maxReplyDelaySeconds: 18 * 60,
    interActionDelayMinSeconds: 50,
    interActionDelayMaxSeconds: 8 * 60,
    sessionTimeVarianceHours: 2,
    sleepWindowStartHour: 0,
    sleepWindowEndHour: 7,
  },
  thresholds: {
    attentionRiskScore: 55,
    blockRiskScore: 80,
  },
  cooldown: {
    defaultMinutes: 90,
    afterOutboundMinutes: 120,
  },
};

function deepMerge<T>(base: T, override: Partial<T> | undefined): T {
  if (!override) {
    return structuredClone(base);
  }

  if (Array.isArray(base) || Array.isArray(override)) {
    return structuredClone((override as T) ?? base);
  }

  if (typeof base !== "object" || base == null || typeof override !== "object" || override == null) {
    return structuredClone((override as T) ?? base);
  }

  const result: Record<string, unknown> = { ...structuredClone(base as Record<string, unknown>) };
  for (const [key, value] of Object.entries(override as Record<string, unknown>)) {
    const current = result[key];
    if (
      value != null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      current != null &&
      typeof current === "object" &&
      !Array.isArray(current)
    ) {
      result[key] = deepMerge(current, value);
    } else if (value !== undefined) {
      result[key] = value;
    }
  }
  return result as T;
}

export function loadBehaviorPolicyConfig(): BehaviorPolicyConfig {
  try {
    const raw = fs.readFileSync(RULES_PATH, "utf-8");
    const parsed = JSON.parse(raw) as {
      maturation?: {
        policy?: Partial<BehaviorPolicyConfig>;
      };
    };
    return deepMerge(DEFAULT_CONFIG, parsed.maturation?.policy);
  } catch {
    return structuredClone(DEFAULT_CONFIG);
  }
}

export function getBehaviorPolicyVersion(config: BehaviorPolicyConfig) {
  const configWithVersion = config as BehaviorPolicyConfig & { version?: string };
  return configWithVersion.version?.trim() || DEFAULT_POLICY_VERSION;
}

export function getBehaviorPolicyHash(config: BehaviorPolicyConfig) {
  const effectiveRules = {
    thresholds: config.thresholds,
    cooldown: config.cooldown,
    jitter: config.jitter,
    dailyBudgetCosts: config.dailyBudgetCosts,
    trustScoreBands: config.trustScoreBands,
  };

  return crypto.createHash("sha1").update(JSON.stringify(effectiveRules)).digest("hex").slice(0, 8);
}
