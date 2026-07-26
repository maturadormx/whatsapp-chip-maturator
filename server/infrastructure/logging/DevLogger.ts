import type { LoggerPort } from "../../ports/LoggerPort";

export class DevLogger implements LoggerPort {
  debug(event: string, context?: Record<string, unknown>): void {
    console.debug(`[DEBUG] ${event}`, context ?? {});
  }

  info(event: string, context?: Record<string, unknown>): void {
    console.info(`[INFO] ${event}`, context ?? {});
  }

  warn(event: string, context?: Record<string, unknown>): void {
    console.warn(`[WARN] ${event}`, context ?? {});
  }

  error(event: string, context?: Record<string, unknown>, error?: unknown): void {
    console.error(`[ERROR] ${event}`, context ?? {}, error ?? "");
  }
}

