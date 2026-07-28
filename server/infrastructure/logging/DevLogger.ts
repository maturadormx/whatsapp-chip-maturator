import type { LoggerPort } from "../../ports/LoggerPort";
import { childStructuredLogger } from "./StructuredLogger";

export class DevLogger implements LoggerPort {
  private readonly logger = childStructuredLogger({
    component: "observation-runtime",
  });

  debug(event: string, context?: Record<string, unknown>): void {
    this.logger.emit("debug", event, context);
  }

  info(event: string, context?: Record<string, unknown>): void {
    this.logger.emit("info", event, context);
  }

  warn(event: string, context?: Record<string, unknown>): void {
    this.logger.emit("warn", event, context);
  }

  error(event: string, context?: Record<string, unknown>, error?: unknown): void {
    this.logger.emit("error", event, context, error);
  }
}

