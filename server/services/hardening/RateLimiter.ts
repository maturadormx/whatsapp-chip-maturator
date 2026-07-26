export class TokenBucketRateLimiter {
  private tokens: number;
  private lastRefillAt = Date.now();

  constructor(
    private readonly params: {
      capacity: number;
      refillPerSecond: number;
    },
  ) {
    this.tokens = params.capacity;
  }

  allow() {
    const now = Date.now();
    const elapsedSeconds = Math.max(0, (now - this.lastRefillAt) / 1000);
    this.tokens = Math.min(
      this.params.capacity,
      this.tokens + elapsedSeconds * this.params.refillPerSecond,
    );
    this.lastRefillAt = now;

    if (this.tokens < 1) {
      return false;
    }

    this.tokens -= 1;
    return true;
  }

  snapshot() {
    return {
      capacity: this.params.capacity,
      refillPerSecond: this.params.refillPerSecond,
      availableTokens: Number(this.tokens.toFixed(2)),
    };
  }
}
