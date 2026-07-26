type CircuitBreakerState = "closed" | "open" | "half_open";

export class CircuitBreaker {
  private failures = 0;
  private lastFailureAt = 0;
  private state: CircuitBreakerState = "closed";

  constructor(
    private readonly params: {
      failureThreshold: number;
      resetTimeoutMs: number;
    },
  ) {}

  async execute<T>(operation: () => Promise<T>) {
    if (this.state === "open") {
      const elapsed = Date.now() - this.lastFailureAt;
      if (elapsed < this.params.resetTimeoutMs) {
        throw new Error("circuit_open");
      }
      this.state = "half_open";
    }

    try {
      const result = await operation();
      this.failures = 0;
      this.state = "closed";
      return result;
    } catch (error) {
      this.failures += 1;
      this.lastFailureAt = Date.now();
      if (this.failures >= this.params.failureThreshold) {
        this.state = "open";
      }
      throw error;
    }
  }

  snapshot() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureAt: this.lastFailureAt || null,
    };
  }
}
