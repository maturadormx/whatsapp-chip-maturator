import { listAuditEvents } from "../../db";
import { recordAuditEvent } from "../audit/AuditEngine";
import { getConfigurationCenter } from "../config/ConfigurationCenter";

const COMPLIANCE_POLICY_KEY = "compliance.governance";

export async function getComplianceGovernancePolicy() {
  return getConfigurationCenter().get<Record<string, unknown>>(COMPLIANCE_POLICY_KEY, {
    retentionDays: 90,
    anonymizePhoneNumbers: true,
    lgpdMode: true,
    auditTrailEnabled: true,
  });
}

export async function updateComplianceGovernancePolicy(params: {
  policy: Record<string, unknown>;
  userId?: number | null;
}) {
  await getConfigurationCenter().set({
    key: COMPLIANCE_POLICY_KEY,
    value: params.policy,
    description: "Política de compliance, retenção e anonimização.",
  });

  await recordAuditEvent({
    userId: params.userId ?? null,
    engine: "ComplianceGovernanceService",
    action: "compliance_policy_updated",
    entityType: "compliance_policy",
    entityId: "default",
    payload: params.policy,
  }).catch(() => null);

  return params.policy;
}

export async function buildComplianceGovernanceView(userId: number) {
  const [policy, audit] = await Promise.all([
    getComplianceGovernancePolicy(),
    listAuditEvents({ userId, limit: 200 }),
  ]);

  const anonymizedPreview = audit.slice(0, 10).map((event) => ({
    id: event.id,
    engine: event.engine,
    action: event.action,
    entityId:
      typeof event.entityId === "string"
        ? event.entityId.replace(/\d(?=\d{4})/g, "*")
        : event.entityId,
  }));

  return {
    generatedAt: new Date().toISOString(),
    lgpd: {
      enabled: Boolean(policy.lgpdMode),
      retentionDays: Number(policy.retentionDays ?? 90),
      anonymizePhoneNumbers: Boolean(policy.anonymizePhoneNumbers),
    },
    governance: {
      auditTrailEnabled: Boolean(policy.auditTrailEnabled),
      retainedEvents: audit.length,
    },
    anonymizedPreview,
  };
}
