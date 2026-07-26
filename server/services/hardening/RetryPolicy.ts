function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(params: {
  attempts: number;
  backoffMs: number;
  operation: () => Promise<T>;
}) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= params.attempts; attempt += 1) {
    try {
      return await params.operation();
    } catch (error) {
      lastError = error;
      if (attempt >= params.attempts) break;
      await sleep(params.backoffMs * attempt);
    }
  }

  throw lastError;
}
