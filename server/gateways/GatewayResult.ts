export type GatewayStatus = "ACKED" | "FAILED" | "TIMEOUT";

export interface GatewayResult {
  status: GatewayStatus;
  attempt: number;
  occurredAt: Date;
  providerMessageId?: string;
  providerMetadata?: Record<string, unknown>;
}
