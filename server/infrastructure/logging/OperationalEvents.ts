import { emitStructuredLog } from "./StructuredLogger";

export function logChipConnected(chipId: string | number, userId: string | number, context: Record<string, unknown> = {}) {
  emitStructuredLog("info", "chip.connected", {
    chipId: String(chipId),
    userId: String(userId),
    status: "online",
    ...context,
  });
}

export function logChipDisconnected(
  chipId: string | number,
  userId: string | number,
  reason: string,
  context: Record<string, unknown> = {},
) {
  emitStructuredLog("warn", "chip.disconnected", {
    chipId: String(chipId),
    userId: String(userId),
    status: "offline",
    reason,
    ...context,
  });
}

export function logChipHealth(
  chipId: string | number,
  userId: string | number,
  healthScore: number,
  connectionState: string,
  context: Record<string, unknown> = {},
) {
  emitStructuredLog("info", "chip.health", {
    chipId: String(chipId),
    userId: String(userId),
    healthScore,
    connectionState,
    ...context,
  });
}

export function logRuntimeRestart(context: Record<string, unknown> = {}) {
  emitStructuredLog("warn", "runtime.restart", context);
}

export function logQueueOverflow(queueName: string, queueSize: number, context: Record<string, unknown> = {}) {
  emitStructuredLog("warn", "queue.overflow", {
    queueName,
    queueSize,
    ...context,
  });
}
