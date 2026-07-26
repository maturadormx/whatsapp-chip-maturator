import type { MessageGateway } from "../../server/gateways/MessageGateway";
import type { GatewayResult } from "../../server/gateways/GatewayResult";
import type { OutboundMessage } from "../../server/gateways/OutboundMessage";

/**
 * FakeMessageGateway — implementação controlada para testes.
 * Não é mock. É um fake determinístico.
 */
export class FakeMessageGateway implements MessageGateway {
  private readonly responses = new Map<string, GatewayResult>();
  private sentMessages: OutboundMessage[] = [];
  private readonly defaultResult: GatewayResult;

  constructor(defaultResult?: GatewayResult) {
    this.defaultResult = defaultResult ?? {
      status: "ACKED",
      attempt: 1,
      occurredAt: new Date(),
    };
  }

  /**
   * Configura o resultado para uma executionId específica.
   */
  when(executionId: string, result: GatewayResult): this {
    this.responses.set(executionId, result);
    return this;
  }

  /**
   * Retorna ACKED por padrão, ou o resultado configurado.
   */
  async send(message: OutboundMessage): Promise<GatewayResult> {
    this.sentMessages.push(message);
    const configured = this.responses.get(message.executionId);
    return configured ?? this.defaultResult;
  }

  /**
   * Verifica se uma mensagem foi enviada.
   */
  wasSent(executionId: string): boolean {
    return this.sentMessages.some((message) => message.executionId === executionId);
  }

  /**
   * Retorna todas as mensagens enviadas.
   */
  getSentMessages(): readonly OutboundMessage[] {
    return [...this.sentMessages];
  }

  /**
   * Conta quantas vezes uma executionId foi enviada.
   */
  sendCount(executionId: string): number {
    return this.sentMessages.filter((message) => message.executionId === executionId).length;
  }

  /**
   * Limpa o estado.
   */
  reset(): void {
    this.sentMessages = [];
    this.responses.clear();
  }
}
