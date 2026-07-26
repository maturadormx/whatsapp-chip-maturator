import type { GatewayResult } from "./GatewayResult";
import type { OutboundMessage } from "./OutboundMessage";

/**
 * Abstração pura. Zero lógica de retry, budget ou orquestração.
 * Apenas recebe uma mensagem e retorna o resultado do gateway.
 */
export interface MessageGateway {
  send(message: OutboundMessage): Promise<GatewayResult>;
}
