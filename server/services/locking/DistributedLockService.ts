import { ENV } from "../../_core/env";

type LockHandle = {
  key: string;
  token: string;
};

class DistributedLockService {
  private memoryLocks = new Map<string, number>();
  private redis: any | null = null;

  private async getRedis() {
    if (!ENV.redisUrl) return null;
    if (this.redis) return this.redis;

    try {
      const { default: IORedis } = await import("ioredis");
      this.redis = new IORedis(ENV.redisUrl, {
        maxRetriesPerRequest: 1,
        lazyConnect: true,
      });
      await this.redis.connect().catch(() => null);
      return this.redis;
    } catch {
      return null;
    }
  }

  async acquire(key: string, ttlMs: number): Promise<LockHandle | null> {
    const token = `${process.pid}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
    const redis = await this.getRedis();

    if (redis) {
      const result = await redis.set(key, token, "PX", ttlMs, "NX");
      if (result === "OK") {
        return { key, token };
      }
      return null;
    }

    const current = this.memoryLocks.get(key);
    if (current && current > Date.now()) {
      return null;
    }
    this.memoryLocks.set(key, Date.now() + ttlMs);
    return { key, token };
  }

  async release(lock: LockHandle | null) {
    if (!lock) return;
    const redis = await this.getRedis();

    if (redis) {
      const current = await redis.get(lock.key);
      if (current === lock.token) {
        await redis.del(lock.key);
      }
      return;
    }

    this.memoryLocks.delete(lock.key);
  }

  async withLock<T>(params: {
    key: string;
    ttlMs: number;
    onSkipped?: () => Promise<T> | T;
    task: () => Promise<T>;
  }) {
    const lock = await this.acquire(params.key, params.ttlMs);
    if (!lock) {
      return params.onSkipped ? await params.onSkipped() : null;
    }

    try {
      return await params.task();
    } finally {
      await this.release(lock);
    }
  }
}

const globalDistributedLockService = new DistributedLockService();

export function getDistributedLockService() {
  return globalDistributedLockService;
}
