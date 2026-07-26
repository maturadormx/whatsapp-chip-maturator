import { recordAuditEvent } from "../audit/AuditEngine";
import { getConfigurationCenter } from "../config/ConfigurationCenter";
import { listPolicyRules, upsertPolicyRule } from "./PolicyEngineService";
import { listWorkflowDefinitions, upsertWorkflowDefinition } from "./WorkflowEngineService";
import type { RuleDesignerDocument } from "./intelligenceTypes";

const RULE_DESIGNER_KEY = "rule_designer.document";

export async function exportRuleDesignerDocument(name = "platform-rule-designer"): Promise<RuleDesignerDocument> {
  const [workflows, policies, existingCanvas] = await Promise.all([
    listWorkflowDefinitions(),
    listPolicyRules(),
    getConfigurationCenter().get<Record<string, unknown> | null>(RULE_DESIGNER_KEY, null),
  ]);

  return {
    name,
    version: "1.0.0",
    workflows,
    policies,
    canvas: (existingCanvas?.canvas as RuleDesignerDocument["canvas"]) ?? {
      nodes: [],
      edges: [],
    },
    exportedAt: new Date().toISOString(),
  };
}

export async function saveRuleDesignerCanvas(params: {
  name?: string;
  canvas: NonNullable<RuleDesignerDocument["canvas"]>;
  userId?: number | null;
}) {
  const doc = await exportRuleDesignerDocument(params.name);
  const next = {
    ...doc,
    canvas: params.canvas,
  };

  await getConfigurationCenter().set({
    key: RULE_DESIGNER_KEY,
    value: next,
    description: "Documento visual do editor de workflows e policies.",
  });

  await recordAuditEvent({
    userId: params.userId ?? null,
    engine: "RuleDesignerService",
    action: "rule_designer_canvas_saved",
    entityType: "rule_designer",
    entityId: params.name ?? "platform-rule-designer",
    payload: {
      nodes: params.canvas.nodes.length,
      edges: params.canvas.edges.length,
    },
  }).catch(() => null);

  return next;
}

export async function importRuleDesignerDocument(params: {
  document: RuleDesignerDocument;
  userId?: number | null;
}) {
  for (const workflow of params.document.workflows as any[]) {
    await upsertWorkflowDefinition({
      ...(workflow as any),
      userId: params.userId ?? null,
    });
  }

  for (const policy of params.document.policies as any[]) {
    await upsertPolicyRule({
      ...(policy as any),
      userId: params.userId ?? null,
    });
  }

  await saveRuleDesignerCanvas({
    name: params.document.name,
    canvas: params.document.canvas ?? { nodes: [], edges: [] },
    userId: params.userId ?? null,
  });

  return {
    importedAt: new Date().toISOString(),
    workflows: params.document.workflows.length,
    policies: params.document.policies.length,
  };
}
