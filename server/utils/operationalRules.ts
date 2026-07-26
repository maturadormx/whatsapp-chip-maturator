export type OperationalExecutionType = "dispatch" | "maturation";
export type OperationalProfile = "suave" | "normal" | "ultra";
export type OperationalTargetType = "number" | "group" | "list";
export type OperationalRuleLeaf = { cooldownMinutes: number; maxPerHour: number; maxPerDay: number };
export type OperationalRulesConfig = Record<
  OperationalExecutionType,
  Record<OperationalProfile, Record<"number" | "group", OperationalRuleLeaf>>
>;

import fs from "node:fs";
import path from "node:path";

const operationalRulesFilePath = path.resolve(process.cwd(), "server", "operational-rules.json");

const defaultOperationalRuleConfig: OperationalRulesConfig = {
  dispatch: {
    suave: {
      number: { cooldownMinutes: 30, maxPerHour: 1, maxPerDay: 4 },
      group: { cooldownMinutes: 45, maxPerHour: 1, maxPerDay: 3 },
    },
    normal: {
      number: { cooldownMinutes: 20, maxPerHour: 2, maxPerDay: 6 },
      group: { cooldownMinutes: 35, maxPerHour: 1, maxPerDay: 4 },
    },
    ultra: {
      number: { cooldownMinutes: 12, maxPerHour: 3, maxPerDay: 10 },
      group: { cooldownMinutes: 25, maxPerHour: 2, maxPerDay: 6 },
    },
  },
  maturation: {
    suave: {
      number: { cooldownMinutes: 45, maxPerHour: 2, maxPerDay: 8 },
      group: { cooldownMinutes: 60, maxPerHour: 1, maxPerDay: 5 },
    },
    normal: {
      number: { cooldownMinutes: 30, maxPerHour: 3, maxPerDay: 12 },
      group: { cooldownMinutes: 45, maxPerHour: 2, maxPerDay: 8 },
    },
    ultra: {
      number: { cooldownMinutes: 20, maxPerHour: 4, maxPerDay: 18 },
      group: { cooldownMinutes: 30, maxPerHour: 3, maxPerDay: 12 },
    },
  },
};

let cachedOperationalRulesConfig: OperationalRulesConfig | null = null;

function sanitizeRuleLeaf(value: OperationalRuleLeaf): OperationalRuleLeaf {
  return {
    cooldownMinutes: Math.max(1, Math.floor(value.cooldownMinutes)),
    maxPerHour: Math.max(1, Math.floor(value.maxPerHour)),
    maxPerDay: Math.max(1, Math.floor(value.maxPerDay)),
  };
}

function mergeOperationalRules(
  baseConfig: OperationalRulesConfig,
  incomingConfig?: Partial<OperationalRulesConfig> | null
): OperationalRulesConfig {
  const nextConfig: OperationalRulesConfig = JSON.parse(JSON.stringify(baseConfig));

  for (const executionType of Object.keys(baseConfig) as OperationalExecutionType[]) {
    for (const profile of Object.keys(baseConfig[executionType]) as OperationalProfile[]) {
      for (const targetType of ["number", "group"] as const) {
        const incomingLeaf = incomingConfig?.[executionType]?.[profile]?.[targetType];
        if (incomingLeaf) {
          nextConfig[executionType][profile][targetType] = sanitizeRuleLeaf(incomingLeaf);
        }
      }
    }
  }

  return nextConfig;
}

export function getOperationalRulesConfig() {
  if (cachedOperationalRulesConfig) {
    return cachedOperationalRulesConfig;
  }

  try {
    if (fs.existsSync(operationalRulesFilePath)) {
      const parsed = JSON.parse(fs.readFileSync(operationalRulesFilePath, "utf-8")) as Partial<OperationalRulesConfig>;
      cachedOperationalRulesConfig = mergeOperationalRules(defaultOperationalRuleConfig, parsed);
      return cachedOperationalRulesConfig;
    }
  } catch (error) {
    console.error("[OperationalRules] Falha ao ler arquivo de configuração, usando default.", error);
  }

  cachedOperationalRulesConfig = mergeOperationalRules(defaultOperationalRuleConfig);
  return cachedOperationalRulesConfig;
}

export function updateOperationalRulesConfig(nextConfig: Partial<OperationalRulesConfig>) {
  const merged = mergeOperationalRules(getOperationalRulesConfig(), nextConfig);
  fs.writeFileSync(operationalRulesFilePath, JSON.stringify(merged, null, 2), "utf-8");
  cachedOperationalRulesConfig = merged;
  return merged;
}

export function getOperationalRuleConfig(
  executionType: OperationalExecutionType,
  profile: OperationalProfile,
  targetType: OperationalTargetType
) {
  const normalizedTargetType = targetType === "group" ? "group" : "number";
  return getOperationalRulesConfig()[executionType][profile][normalizedTargetType];
}

export function evaluateOperationalRules(
  executionType: OperationalExecutionType,
  profile: OperationalProfile,
  targetType: OperationalTargetType,
  snapshot: {
    lastSentAt: Date | null;
    sentLastHour: number;
    sentLastDay: number;
  }
) {
  const config = getOperationalRuleConfig(executionType, profile, targetType);
  const now = Date.now();

  if (snapshot.lastSentAt) {
    const elapsedMs = now - new Date(snapshot.lastSentAt).getTime();
    const cooldownMs = config.cooldownMinutes * 60 * 1000;
    if (elapsedMs < cooldownMs) {
      const retryAfterMinutes = Math.ceil((cooldownMs - elapsedMs) / (60 * 1000));
      return {
        allowed: false,
        reason: `Target em cooldown. Aguarde cerca de ${retryAfterMinutes} min.`,
        rule: "cooldown" as const,
      };
    }
  }

  if (snapshot.sentLastHour >= config.maxPerHour) {
    return {
      allowed: false,
      reason: `Limite por hora atingido para este target (${config.maxPerHour}).`,
      rule: "hour_limit" as const,
    };
  }

  if (snapshot.sentLastDay >= config.maxPerDay) {
    return {
      allowed: false,
      reason: `Limite diário atingido para este target (${config.maxPerDay}).`,
      rule: "day_limit" as const,
    };
  }

  return {
    allowed: true,
    reason: null,
    rule: null,
  };
}
