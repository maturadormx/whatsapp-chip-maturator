import type { GatewayResult } from "../GatewayResult";

export interface MockConfig {
  defaultDelayMs?: number;
  initialResults?: GatewayResult[];
}
