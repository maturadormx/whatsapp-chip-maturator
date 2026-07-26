import type { GatewayResult, GatewayStatus } from "../GatewayResult";
import type { MessageGateway } from "../MessageGateway";
import type { OutboundMessage } from "../OutboundMessage";
import type { MockConfig } from "./MockConfig";

export class MockMessageGateway implements MessageGateway {
  private readonly config: MockConfig;
  private readonly initialResultsSnapshot: GatewayResult[];
  private sentMessages: OutboundMessage[] = [];
  private queuedResults: GatewayResult[];

  constructor(config: MockConfig = {}) {
    this.config = {
      defaultDelayMs: 10,
      ...config,
    };
    this.initialResultsSnapshot = [...(config.initialResults ?? [])];
    this.queuedResults = [...this.initialResultsSnapshot];
  }

  async send(message: OutboundMessage): Promise<GatewayResult> {
    this.sentMessages.push(message);

    const delayMs = this.config.defaultDelayMs ?? 0;
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    const queued = this.queuedResults.shift();
    if (queued) {
      if (queued.status === "TIMEOUT") {
        throw new Error("GATEWAY_TIMEOUT");
      }
      return {
        ...queued,
        attempt: (message.metadata?.attempt as number) ?? queued.attempt ?? 1,
        providerMessageId: queued.providerMessageId ?? `mock-${message.executionId}`,
        providerMetadata: {
          mock: true,
          ...(queued.providerMetadata ?? {}),
        },
      };
    }

    return this.buildResult(message, "ACKED");
  }

  private buildResult(message: OutboundMessage, status: GatewayStatus): GatewayResult {
    return {
      status,
      attempt: (message.metadata?.attempt as number) ?? 1,
      occurredAt: new Date(),
      providerMessageId: `mock-${message.executionId}`,
      providerMetadata: { mock: true },
    };
  }

  getSentMessages(): readonly OutboundMessage[] {
    return [...this.sentMessages];
  }

  enqueueResult(result: GatewayResult): void {
    this.queuedResults.push(result);
  }

  wasSent(executionId: string): boolean {
    return this.sentMessages.some((message) => message.executionId === executionId);
  }

  sendCount(executionId: string): number {
    return this.sentMessages.filter((message) => message.executionId === executionId).length;
  }

  reset(): void {
    this.sentMessages = [];
    this.queuedResults = [...this.initialResultsSnapshot];
  }
}
