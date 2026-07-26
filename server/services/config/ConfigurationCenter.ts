import {
  getSystemConfigByKey,
  listSystemConfigs,
  upsertSystemConfig,
  type SystemConfigValueType,
} from "../../db";

type CacheEntry = {
  value: unknown;
  expiresAt: number;
};

class ConfigurationCenter {
  private cache = new Map<string, CacheEntry>();
  private readonly ttlMs = 30_000;

  private decodeValue(row: Awaited<ReturnType<typeof getSystemConfigByKey>>) {
    if (!row) return null;
    if (row.valueType === "number") return row.valueNumber;
    if (row.valueType === "boolean") return Boolean(row.valueBoolean);
    if (row.valueType === "json") return row.payload;
    return row.valueText;
  }

  async get<T = unknown>(key: string, fallback: T): Promise<T> {
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value as T;
    }

    const row = await getSystemConfigByKey(key);
    const value = row ? this.decodeValue(row) : fallback;
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMs,
    });
    return (value as T) ?? fallback;
  }

  async set(params: {
    key: string;
    value: string | number | boolean | Record<string, unknown> | Array<unknown> | null;
    description?: string | null;
  }) {
    const valueType: SystemConfigValueType =
      typeof params.value === "number"
        ? "number"
        : typeof params.value === "boolean"
          ? "boolean"
          : typeof params.value === "string" || params.value === null
            ? "string"
            : "json";

    await upsertSystemConfig({
      configKey: params.key,
      valueType,
      valueText:
        typeof params.value === "string" || params.value === null
          ? (params.value as string | null)
          : null,
      valueNumber: typeof params.value === "number" ? params.value : null,
      valueBoolean: typeof params.value === "boolean" ? params.value : null,
      payload: params.value !== null && typeof params.value === "object" ? params.value : null,
      description: params.description ?? null,
    });

    this.cache.delete(params.key);
  }

  async list(prefix?: string) {
    const rows = await listSystemConfigs(500);
    return rows.filter((row) => !prefix || row.configKey.startsWith(prefix));
  }

  reload(key?: string) {
    if (key) {
      this.cache.delete(key);
      return;
    }
    this.cache.clear();
  }
}

const globalConfigurationCenter = new ConfigurationCenter();

export function getConfigurationCenter() {
  return globalConfigurationCenter;
}
