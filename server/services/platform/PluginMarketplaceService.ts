import { recordAuditEvent } from "../audit/AuditEngine";
import { getConfigurationCenter } from "../config/ConfigurationCenter";
import { getInternalEventBus } from "../events/InternalEventBus";
import type { PluginManifest } from "./intelligenceTypes";

function pluginKey(key: string) {
  return `plugin.marketplace.${key.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "_")}`;
}

export async function listInstalledPlugins() {
  const rows = await getConfigurationCenter().list("plugin.marketplace.");
  return rows
    .map((row) => row.payload as PluginManifest | null)
    .filter((row): row is PluginManifest => Boolean(row))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function installPluginManifest(input: Omit<PluginManifest, "updatedAt"> & { userId?: number | null }) {
  const next: PluginManifest = {
    ...input,
    updatedAt: new Date().toISOString(),
  };

  await getConfigurationCenter().set({
    key: pluginKey(input.key),
    value: next,
    description: "Manifesto de plugin carregável sem alterar o core.",
  });

  await recordAuditEvent({
    userId: input.userId ?? null,
    engine: "PluginMarketplaceService",
    action: "plugin_installed",
    entityType: "plugin",
    entityId: input.key,
    payload: next,
  }).catch(() => null);

  return next;
}

export async function setPluginEnabled(key: string, enabled: boolean, userId?: number | null) {
  const current = await getConfigurationCenter().get<PluginManifest | null>(pluginKey(key), null);
  if (!current) {
    throw new Error(`plugin_not_found:${key}`);
  }

  return installPluginManifest({
    ...current,
    enabled,
    userId,
  });
}

export async function executePluginHook(params: {
  key: string;
  hook: string;
  payload?: Record<string, unknown>;
  userId?: number | null;
}) {
  const plugin = await getConfigurationCenter().get<PluginManifest | null>(pluginKey(params.key), null);
  if (!plugin) {
    throw new Error(`plugin_not_found:${params.key}`);
  }
  if (!plugin.enabled) {
    throw new Error(`plugin_disabled:${params.key}`);
  }
  if (!plugin.hooks.includes(params.hook)) {
    throw new Error(`plugin_hook_not_found:${params.key}:${params.hook}`);
  }

  await getInternalEventBus().publish({
    type: `plugin.${params.key}.${params.hook}`,
    source: "PluginMarketplaceService",
    payload: {
      plugin: plugin.key,
      hook: params.hook,
      ...(params.payload ?? {}),
    },
  });

  await recordAuditEvent({
    userId: params.userId ?? null,
    engine: "PluginMarketplaceService",
    action: "plugin_hook_executed",
    entityType: "plugin_hook",
    entityId: `${params.key}:${params.hook}`,
    payload: params.payload ?? {},
  }).catch(() => null);

  return {
    plugin: plugin.key,
    hook: params.hook,
    executedAt: new Date().toISOString(),
  };
}
