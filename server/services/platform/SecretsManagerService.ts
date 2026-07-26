import crypto from "node:crypto";
import { ENV } from "../../_core/env";
import { recordAuditEvent } from "../audit/AuditEngine";
import { getConfigurationCenter } from "../config/ConfigurationCenter";
import type { SecretDescriptor, SecretProvider } from "./types";

type Scope = "global" | "tenant";

function buildSecretKey(scope: Scope, name: string, tenantId?: number | null) {
  const normalized = name.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "_");
  if (scope === "tenant") {
    return `secret.record.tenant.${tenantId ?? "unknown"}.${normalized}`;
  }
  return `secret.record.global.${normalized}`;
}

function getMasterKey() {
  const seed = ENV.secretsMasterKey || ENV.cookieSecret || ENV.databaseUrl || "maturator-platform3";
  return crypto.createHash("sha256").update(seed).digest();
}

function encryptValue(value: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getMasterKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

function decryptValue(encoded: string) {
  const raw = Buffer.from(encoded, "base64");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const encrypted = raw.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", getMasterKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

async function readSecretDescriptor(configKey: string) {
  return getConfigurationCenter().get<SecretDescriptor | null>(configKey, null);
}

export async function listSecretsCatalog(params?: { scope?: Scope; tenantId?: number | null }) {
  const rows = await getConfigurationCenter().list("secret.record.");

  return rows
    .map((row) => ({
      configKey: row.configKey,
      descriptor: row.payload as SecretDescriptor | null,
    }))
    .filter((row): row is { configKey: string; descriptor: SecretDescriptor } => Boolean(row.descriptor))
    .filter((row) => {
      if (!params?.scope) return true;
      if (row.descriptor.scope !== params.scope) return false;
      if (row.descriptor.scope === "tenant" && params.scope === "tenant" && params.tenantId != null) {
        return row.configKey.includes(`.tenant.${params.tenantId}.`);
      }
      return true;
    })
    .map((row) => ({
      ...row.descriptor,
      encryptedValue: undefined,
    }));
}

export async function upsertSecretRecord(params: {
  scope: Scope;
  name: string;
  value?: string | null;
  tenantId?: number | null;
  provider?: SecretProvider;
  description?: string | null;
  remoteRef?: string | null;
  tags?: string[];
  userId?: number | null;
}) {
  const configKey = buildSecretKey(params.scope, params.name, params.tenantId);
  const current = await readSecretDescriptor(configKey);
  const next: SecretDescriptor = {
    scope: params.scope,
    name: params.name,
    provider: params.provider ?? current?.provider ?? "local",
    description: params.description ?? current?.description ?? null,
    remoteRef: params.remoteRef ?? current?.remoteRef ?? null,
    tags: params.tags ?? current?.tags ?? [],
    updatedAt: new Date().toISOString(),
    version: (current?.version ?? 0) + 1,
    encryptedValue:
      params.value !== undefined
        ? params.value
          ? encryptValue(params.value)
          : null
        : current?.encryptedValue ?? null,
  };

  await getConfigurationCenter().set({
    key: configKey,
    value: next,
    description: `Secret gerenciado em escopo ${params.scope}.`,
  });

  await recordAuditEvent({
    userId: params.userId ?? null,
    engine: "SecretsManagerService",
    action: "secret_upserted",
    entityType: "secret",
    entityId: configKey,
    payload: {
      provider: next.provider,
      scope: next.scope,
      version: next.version,
      remoteRef: next.remoteRef,
      tags: next.tags,
    },
  }).catch(() => null);

  return {
    ...next,
    encryptedValue: undefined,
  };
}

export async function resolveSecretValue(params: {
  scope: Scope;
  name: string;
  tenantId?: number | null;
}) {
  const configKey = buildSecretKey(params.scope, params.name, params.tenantId);
  const descriptor = await readSecretDescriptor(configKey);
  if (!descriptor) {
    return {
      resolved: false,
      source: "missing" as const,
      value: null,
      descriptor: null,
    };
  }

  if (descriptor.provider !== "local") {
    const envKey = `${descriptor.provider}_${descriptor.name}`.toUpperCase().replace(/[^A-Z0-9_]+/g, "_");
    const envValue = process.env[envKey];
    return {
      resolved: Boolean(envValue),
      source: envValue ? ("env-fallback" as const) : ("external-reference" as const),
      value: envValue ?? null,
      descriptor: {
        ...descriptor,
        encryptedValue: undefined,
      },
    };
  }

  return {
    resolved: Boolean(descriptor.encryptedValue),
    source: "local" as const,
    value: descriptor.encryptedValue ? decryptValue(descriptor.encryptedValue) : null,
    descriptor: {
      ...descriptor,
      encryptedValue: undefined,
    },
  };
}

export async function deleteSecretRecord(params: {
  scope: Scope;
  name: string;
  tenantId?: number | null;
  userId?: number | null;
}) {
  const configKey = buildSecretKey(params.scope, params.name, params.tenantId);
  await getConfigurationCenter().set({
    key: configKey,
    value: null,
    description: "Secret removido logicamente do catálogo.",
  });

  await recordAuditEvent({
    userId: params.userId ?? null,
    engine: "SecretsManagerService",
    action: "secret_deleted",
    entityType: "secret",
    entityId: configKey,
    payload: {
      scope: params.scope,
      name: params.name,
    },
  }).catch(() => null);

  return {
    deleted: true,
    configKey,
  };
}
