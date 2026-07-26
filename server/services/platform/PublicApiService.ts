import { PlannerLayerPublicApi } from "../../contracts/public-layer-api";
import type { BehaviorIntent, OpportunitySignal } from "../behaviorPlannerService";
import { recordAuditEvent } from "../audit/AuditEngine";
import { getConfigurationCenter } from "../config/ConfigurationCenter";
import { resolveSecretValue } from "./SecretsManagerService";
import type { OpenApiDocument, WebhookRegistration } from "./intelligenceTypes";

function webhookKey(key: string) {
  return `public_api.webhook.${key.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "_")}`;
}

export function generateOpenApiDocument(): OpenApiDocument {
  return {
    openapi: "3.1.0",
    info: {
      title: "WhatsApp Chip Maturator Public API",
      version: "1.0.0",
      description: "API pública estável para planner, simulação, webhooks e integrações externas.",
    },
    paths: {
      "/api/public/openapi.json": {
        get: {
          summary: "Retorna o documento OpenAPI",
        },
      },
      "/api/public/planner/simulate": {
        post: {
          summary: "Simula uma decisão do planner sem executar ação real",
        },
      },
      "/api/public/webhooks/test": {
        post: {
          summary: "Dispara um evento de teste para um webhook registrado",
        },
      },
    },
    components: {
      schemas: {
        PlannerSimulationRequest: {
          type: "object",
          properties: {
            intent: { type: "string" },
            opportunity: { type: "object" },
          },
        },
        PlannerSimulationResponse: {
          type: "object",
          properties: {
            payload: { type: "object" },
          },
        },
      },
    },
  };
}

export async function listWebhookRegistrations() {
  const rows = await getConfigurationCenter().list("public_api.webhook.");
  return rows
    .map((row) => row.payload as WebhookRegistration | null)
    .filter((row): row is WebhookRegistration => Boolean(row))
    .sort((a, b) => a.key.localeCompare(b.key));
}

export async function upsertWebhookRegistration(input: WebhookRegistration & { userId?: number | null }) {
  await getConfigurationCenter().set({
    key: webhookKey(input.key),
    value: input,
    description: "Webhook público para integrações estáveis.",
  });

  await recordAuditEvent({
    userId: input.userId ?? null,
    engine: "PublicApiService",
    action: "webhook_upserted",
    entityType: "webhook",
    entityId: input.key,
    payload: {
      url: input.url,
      events: input.eventTypes,
      enabled: input.enabled,
    },
  }).catch(() => null);

  return input;
}

export async function dispatchWebhookTest(params: {
  key: string;
  userId?: number | null;
}) {
  const webhook = await getConfigurationCenter().get<WebhookRegistration | null>(webhookKey(params.key), null);
  if (!webhook) {
    throw new Error(`webhook_not_found:${params.key}`);
  }
  if (!webhook.enabled) {
    throw new Error(`webhook_disabled:${params.key}`);
  }

  const secret = webhook.secretName
    ? await resolveSecretValue({
        scope: "tenant",
        name: webhook.secretName,
        tenantId: params.userId ?? null,
      })
    : null;

  const response = await fetch(webhook.url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(secret?.resolved && secret.value ? { "x-webhook-secret": String(secret.value) } : {}),
    },
    body: JSON.stringify({
      eventType: "platform.test",
      emittedAt: new Date().toISOString(),
      payload: {
        ok: true,
        source: "PublicApiService",
      },
    }),
  });

  await recordAuditEvent({
    userId: params.userId ?? null,
    engine: "PublicApiService",
    action: "webhook_test_dispatched",
    entityType: "webhook",
    entityId: params.key,
    result: response.ok ? "success" : "failed",
    payload: {
      status: response.status,
      url: webhook.url,
    },
  }).catch(() => null);

  return {
    status: response.status,
    ok: response.ok,
  };
}

export function generateSdkArtifact() {
  return {
    packageName: "@maturator/public-sdk",
    language: "typescript",
    version: "1.0.0",
    example: `import { simulatePlanner } from "@maturator/public-sdk";\n\nawait simulatePlanner({ baseUrl: "https://api.example.com", token: "token" });`,
  };
}

export function simulatePlannerViaPublicApi(input: {
  intent: BehaviorIntent;
  opportunity: Partial<OpportunitySignal>;
  trustScore?: number;
  riskScore?: number;
  todayActionCount?: number;
  inboundCount?: number;
  outboundCount?: number;
}) {
  return PlannerLayerPublicApi.simulate({
    intent: input.intent,
    opportunity: {
      signalId: input.opportunity.signalId ?? "public-api",
      hasUnreadReply: input.opportunity.hasUnreadReply ?? false,
      hasRecentStatus: input.opportunity.hasRecentStatus ?? true,
      hasRecentGroupMovement: input.opportunity.hasRecentGroupMovement ?? false,
      cooldownUntil: input.opportunity.cooldownUntil ?? null,
    },
    history: [],
    risk: {
      overallRisk: Number(((input.riskScore ?? 20) / 100).toFixed(2)),
      status:
        (input.riskScore ?? 0) >= 70 ? "high" : (input.riskScore ?? 0) >= 40 ? "attention" : "low",
      dimensions: {
        connectionRisk: 0.2,
        spamRisk: 0.2,
        behaviorRisk: 0.2,
        reputationRisk: 0.2,
        timingRisk: 0.2,
        socialExposureRisk: 0.2,
      },
      summary: "simulação pública simplificada",
    },
    identitySummary: "public-api",
    policyContext: {
      chipId: 0,
      trustScore: input.trustScore ?? 0,
      riskScore: input.riskScore ?? 20,
      todayActionCount: input.todayActionCount ?? 0,
      todayActionTypes: [],
      inboundCount: input.inboundCount ?? 0,
      outboundCount: input.outboundCount ?? 0,
    },
  });
}
