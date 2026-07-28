import pino, { type Logger } from "pino";

type LogLevel = "debug" | "info" | "warn" | "error";

type LogContext = Record<string, unknown> | undefined;

const serviceName = process.env.LOG_SERVICE_NAME ?? "whatsapp-chip-maturator";
const environment = process.env.NODE_ENV ?? "development";
const vectorEndpoint = process.env.VECTOR_HTTP_ENDPOINT?.trim() || null;

const logger: Logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: {
    service: serviceName,
    env: environment,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  return error;
}

function mirrorToVector(payload: Record<string, unknown>) {
  if (!vectorEndpoint) return;

  const body = JSON.stringify(payload);
  void fetch(vectorEndpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body,
    signal: AbortSignal.timeout(1500),
  }).catch(() => null);
}

export function emitStructuredLog(level: LogLevel, event: string, context?: LogContext, error?: unknown) {
  const payload: Record<string, unknown> = {
    event,
    ...context,
  };

  if (error !== undefined) {
    payload.error = serializeError(error);
  }

  logger[level](payload);
  mirrorToVector({
    level,
    service: serviceName,
    env: environment,
    timestamp: new Date().toISOString(),
    ...payload,
  });
}

export function childStructuredLogger(bindings: Record<string, unknown>) {
  const child = logger.child(bindings);

  return {
    emit(level: LogLevel, event: string, context?: LogContext, error?: unknown) {
      const payload: Record<string, unknown> = {
        event,
        ...context,
      };

      if (error !== undefined) {
        payload.error = serializeError(error);
      }

      child[level](payload);
      mirrorToVector({
        level,
        service: serviceName,
        env: environment,
        timestamp: new Date().toISOString(),
        ...bindings,
        ...payload,
      });
    },
  };
}
