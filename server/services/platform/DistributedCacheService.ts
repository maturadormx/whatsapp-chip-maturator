import { getConfigurationCenter } from "../config/ConfigurationCenter";
import { getInternalEventBus } from "../events/InternalEventBus";
import { getRedisCommandClient } from "../distributed/RedisClient";

type CacheEntry = {
  value: unknown;
  expiresAt: number;
};

class DistributedCacheService {
  private readonly local = new Map<string, CacheEntry>();
  private initialized = false;
  private hits = 0;
  private misses = 0;

  private buildKey(namespace: string, key: string, tenantId?: number | null) {
    return `platform_cache:${tenantId ?? "global"}:${namespace}:${key}`;
  }

  private async init() {
    if (this.initialized) return;
    this.initialized = true;

    getInternalEventBus().subscribe("cache.invalidate", async (event) => {
      const payload = event.payload as { cacheKey?: string; namespace?: string; tenantId?: number | null };
      if (payload.cacheKey) {
        this.local.delete(payload.cacheKey);
        return;
      }

      const prefix = `platform_cache:${payload.tenantId ?? "global"}:${payload.namespace ?? ""}`;
      for (const key of this.local.keys()) {
        if (key.startsWith(prefix)) {
          this.local.delete(key);
        }
      }
    });
  }

  async get<T = unknown>(params: {
    namespace: string;
    key: string;
    tenantId?: number | null;
    fallback?: T | null;
  }) {
    await this.init();
    const cacheKey = this.buildKey(params.namespace, params.key, params.tenantId);
    const now = Date.now();
    const localEntry = this.local.get(cacheKey);

    if (localEntry && localEntry.expiresAt > now) {
      this.hits += 1;
      return (localEntry.value as T) ?? (params.fallback as T);
    }

    const redis = await getRedisCommandClient();
    if (redis) {
      const raw = await redis.get(cacheKey);
      if (raw) {
        const parsed = JSON.parse(raw) as CacheEntry;
        this.local.set(cacheKey, parsed);
        this.hits += 1;
        return (parsed.value as T) ?? (params.fallback as T);
      }
    }

    const persisted = await getConfigurationCenter().get<CacheEntry | null>(`cache.persistence.${cacheKey}`, null);
    if (persisted && persisted.expiresAt > now) {
      this.local.set(cacheKey, persisted);
      this.hits += 1;
      return (persisted.value as T) ?? (params.fallback as T);
    }

    this.misses += 1;
    return (params.fallback as T) ?? null;
  }

  async set(params: {
    namespace: string;
    key: string;
    value: unknown;
    ttlSeconds?: number;
    tenantId?: number | null;
    persist?: boolean;
  }) {
    await this.init();
    const ttlSeconds = Math.max(1, params.ttlSeconds ?? 300);
    const cacheKey = this.buildKey(params.namespace, params.key, params.tenantId);
    const entry: CacheEntry = {
      value: params.value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    };

    this.local.set(cacheKey, entry);

    const redis = await getRedisCommandClient();
    if (redis) {
      await redis.set(cacheKey, JSON.stringify(entry), "EX", ttlSeconds);
    }

    if (params.persist) {
      await getConfigurationCenter().set({
        key: `cache.persistence.${cacheKey}`,
        value: entry,
        description: "Entrada persistida do cache distribuído.",
      });
    }

    return {
      cacheKey,
      expiresAt: new Date(entry.expiresAt).toISOString(),
    };
  }

  async invalidate(params: {
    namespace: string;
    key?: string;
    tenantId?: number | null;
  }) {
    await this.init();
    const redis = await getRedisCommandClient();

    if (params.key) {
      const cacheKey = this.buildKey(params.namespace, params.key, params.tenantId);
      this.local.delete(cacheKey);
      if (redis) {
        await redis.del(cacheKey);
      }
      await getInternalEventBus().publish({
        type: "cache.invalidate",
        source: "DistributedCacheService",
        payload: { cacheKey, namespace: params.namespace, tenantId: params.tenantId ?? null },
      });
      return { invalidated: 1, scope: "single" as const };
    }

    const prefix = this.buildKey(params.namespace, "", params.tenantId);
    let invalidated = 0;
    for (const key of [...this.local.keys()]) {
      if (key.startsWith(prefix)) {
        this.local.delete(key);
        invalidated += 1;
      }
    }

    if (redis) {
      const keys = await redis.keys(`${prefix}*`);
      if (keys.length > 0) {
        invalidated += keys.length;
        await redis.del(...keys);
      }
    }

    await getInternalEventBus().publish({
      type: "cache.invalidate",
      source: "DistributedCacheService",
      payload: { namespace: params.namespace, tenantId: params.tenantId ?? null },
    });

    return { invalidated, scope: "namespace" as const };
  }

  getStats() {
    const total = this.hits + this.misses;
    return {
      localEntries: this.local.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? Number((this.hits / total).toFixed(2)) : 0,
    };
  }
}

const globalDistributedCacheService = new DistributedCacheService();

export function getDistributedCacheService() {
  return globalDistributedCacheService;
}
