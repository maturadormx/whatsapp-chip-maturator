import { recordAuditEvent } from "../audit/AuditEngine";
import { getConfigurationCenter } from "../config/ConfigurationCenter";
import { getDistributedCacheService } from "./DistributedCacheService";
import { getInternalEventBus } from "../events/InternalEventBus";
import { sendOperationalNotification } from "../notifications/NotificationCenter";
import type { PlatformWorkflowDefinition, PlatformWorkflowRunResult, PlatformWorkflowStep } from "./types";

function workflowKey(name: string) {
  return `workflow.definition.${name.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "_")}`;
}

export async function listWorkflowDefinitions() {
  const rows = await getConfigurationCenter().list("workflow.definition.");
  return rows
    .map((row) => row.payload as PlatformWorkflowDefinition | null)
    .filter((row): row is PlatformWorkflowDefinition => Boolean(row))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function upsertWorkflowDefinition(input: {
  name: string;
  enabled?: boolean;
  description?: string | null;
  trigger?: string | null;
  steps: PlatformWorkflowStep[];
  userId?: number | null;
}) {
  const definition: PlatformWorkflowDefinition = {
    name: input.name,
    enabled: input.enabled ?? true,
    description: input.description ?? null,
    trigger: input.trigger ?? null,
    steps: input.steps,
    updatedAt: new Date().toISOString(),
  };

  await getConfigurationCenter().set({
    key: workflowKey(input.name),
    value: definition,
    description: "Workflow configurável da plataforma.",
  });

  await recordAuditEvent({
    userId: input.userId ?? null,
    engine: "WorkflowEngineService",
    action: "workflow_upserted",
    entityType: "workflow",
    entityId: input.name,
    payload: {
      enabled: definition.enabled,
      trigger: definition.trigger,
      steps: definition.steps.length,
    },
  }).catch(() => null);

  return definition;
}

export async function executeWorkflow(params: {
  name: string;
  context?: Record<string, unknown>;
  userId?: number | null;
}) {
  const definition = await getConfigurationCenter().get<PlatformWorkflowDefinition | null>(
    workflowKey(params.name),
    null,
  );

  if (!definition) {
    throw new Error(`workflow_not_found:${params.name}`);
  }
  if (!definition.enabled) {
    throw new Error(`workflow_disabled:${params.name}`);
  }

  const emittedEvents: string[] = [];

  for (const step of definition.steps) {
    if (step.type === "emit_event") {
      await getInternalEventBus().publish({
        type: step.eventType,
        source: `WorkflowEngine:${definition.name}`,
        payload: {
          ...(step.payload ?? {}),
          workflow: definition.name,
          context: params.context ?? {},
        },
      });
      emittedEvents.push(step.eventType);
      continue;
    }

    if (step.type === "set_config") {
      await getConfigurationCenter().set({
        key: step.key,
        value: step.value,
        description: step.description ?? `Definido por workflow ${definition.name}`,
      });
      emittedEvents.push(`config:${step.key}`);
      continue;
    }

    if (step.type === "notify") {
      await sendOperationalNotification({
        title: step.title,
        content: step.content,
        severity: step.severity ?? "info",
      });
      emittedEvents.push(`notify:${step.title}`);
      continue;
    }

    if (step.type === "invalidate_cache") {
      await getDistributedCacheService().invalidate({
        namespace: step.namespace,
        key: step.key,
        tenantId: step.tenantId,
      });
      emittedEvents.push(`cache:${step.namespace}`);
      continue;
    }

    if (step.type === "record_audit") {
      await recordAuditEvent({
        userId: params.userId ?? null,
        engine: "WorkflowEngineService",
        action: step.action,
        entityType: step.entityType ?? "workflow",
        entityId: definition.name,
        payload: {
          workflow: definition.name,
          ...(step.payload ?? {}),
        },
      });
      emittedEvents.push(`audit:${step.action}`);
    }
  }

  const result: PlatformWorkflowRunResult = {
    workflow: definition.name,
    executedAt: new Date().toISOString(),
    executedSteps: definition.steps.length,
    events: emittedEvents,
  };

  await recordAuditEvent({
    userId: params.userId ?? null,
    engine: "WorkflowEngineService",
    action: "workflow_executed",
    entityType: "workflow",
    entityId: definition.name,
    payload: result,
  }).catch(() => null);

  return result;
}
