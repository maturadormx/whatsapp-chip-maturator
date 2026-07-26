import { recordAuditEvent } from "../audit/AuditEngine";
import { getConfigurationCenter } from "../config/ConfigurationCenter";
import type { PlatformPolicyCondition, PlatformPolicyEvaluation, PlatformPolicyRule } from "./types";

function policyKey(key: string) {
  return `policy.rule.${key.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "_")}`;
}

function resolveFieldValue(source: Record<string, unknown>, field: string) {
  return field.split(".").reduce<unknown>((acc, segment) => {
    if (acc == null || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[segment];
  }, source);
}

function evaluateCondition(source: Record<string, unknown>, condition: PlatformPolicyCondition) {
  const actual = resolveFieldValue(source, condition.field);

  switch (condition.operator) {
    case "eq":
      return actual === condition.value;
    case "neq":
      return actual !== condition.value;
    case "gte":
      return Number(actual ?? 0) >= Number(condition.value ?? 0);
    case "lte":
      return Number(actual ?? 0) <= Number(condition.value ?? 0);
    case "includes":
      return Array.isArray(actual)
        ? actual.includes(condition.value)
        : typeof actual === "string"
          ? actual.includes(String(condition.value ?? ""))
          : false;
    case "exists":
      return actual !== undefined && actual !== null;
    default:
      return false;
  }
}

export async function listPolicyRules() {
  const rows = await getConfigurationCenter().list("policy.rule.");
  return rows
    .map((row) => row.payload as PlatformPolicyRule | null)
    .filter((row): row is PlatformPolicyRule => Boolean(row))
    .sort((a, b) => a.key.localeCompare(b.key));
}

export async function upsertPolicyRule(input: Omit<PlatformPolicyRule, "updatedAt"> & { userId?: number | null }) {
  const next: PlatformPolicyRule = {
    ...input,
    updatedAt: new Date().toISOString(),
  };

  await getConfigurationCenter().set({
    key: policyKey(input.key),
    value: next,
    description: `Policy rule ${input.scope}:${input.key}`,
  });

  await recordAuditEvent({
    userId: input.userId ?? null,
    engine: "PolicyEngineService",
    action: "policy_rule_upserted",
    entityType: "policy_rule",
    entityId: input.key,
    payload: {
      scope: input.scope,
      effect: input.effect,
      enabled: input.enabled,
      conditions: input.conditions.length,
    },
  }).catch(() => null);

  return next;
}

export async function evaluatePolicyRules(params: {
  resource: string;
  context: Record<string, unknown>;
  userId?: number | null;
}) {
  const rules = await listPolicyRules();
  const matched = rules.filter((rule) => rule.enabled && rule.conditions.every((condition) => evaluateCondition(params.context, condition)));
  const denyRules = matched.filter((rule) => rule.effect === "deny");
  const warnings = matched.filter((rule) => rule.effect === "warn").map((rule) => rule.description ?? rule.key);

  const result: PlatformPolicyEvaluation = {
    resource: params.resource,
    allowed: denyRules.length === 0,
    matched: matched.map((rule) => ({
      key: rule.key,
      effect: rule.effect,
      description: rule.description ?? null,
    })),
    warnings,
  };

  await recordAuditEvent({
    userId: params.userId ?? null,
    engine: "PolicyEngineService",
    action: "policy_rules_evaluated",
    entityType: "policy_evaluation",
    entityId: params.resource,
    payload: {
      allowed: result.allowed,
      matched: result.matched.length,
      warnings: result.warnings,
    },
  }).catch(() => null);

  return result;
}
