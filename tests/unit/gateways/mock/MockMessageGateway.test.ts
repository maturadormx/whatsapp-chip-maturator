import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GatewayResult } from "../../../../server/gateways/GatewayResult";
import type { OutboundMessage } from "../../../../server/gateways/OutboundMessage";
import { MockMessageGateway } from "../../../../server/gateways/mock/MockMessageGateway";

describe("MockMessageGateway", () => {
  const message: OutboundMessage = {
    executionId: "mock-001",
    recipient: "5511999999999",
    content: "Test",
    metadata: { attempt: 1 },
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("deve retornar ACKED por padrão", async () => {
    const gateway = new MockMessageGateway({ defaultDelayMs: 0 });
    const result = await gateway.send(message);
    expect(result.status).toBe("ACKED");
    expect(result.providerMessageId).toMatch(/^mock-/);
  });

  it("deve consumir FAILED da fila determinística", async () => {
    const gateway = new MockMessageGateway({
      defaultDelayMs: 0,
      initialResults: [
        {
          status: "FAILED",
          attempt: 1,
          occurredAt: new Date(),
        },
      ],
    });
    const result = await gateway.send(message);
    expect(result.status).toBe("FAILED");
  });

  it("deve consumir TIMEOUT da fila determinística", async () => {
    const gateway = new MockMessageGateway({
      defaultDelayMs: 0,
      initialResults: [
        {
          status: "TIMEOUT",
          attempt: 1,
          occurredAt: new Date(),
        },
      ],
    });
    await expect(gateway.send(message)).rejects.toThrow("GATEWAY_TIMEOUT");
  });

  it("deve permitir enfileirar resultados explicitamente", async () => {
    const gateway = new MockMessageGateway({ defaultDelayMs: 0 });
    const failedResult: GatewayResult = {
      status: "FAILED",
      attempt: 1,
      occurredAt: new Date(),
    };
    gateway.enqueueResult(failedResult);
    const result = await gateway.send(message);
    expect(result.status).toBe("FAILED");
  });

  it("deve registrar mensagens enviadas", async () => {
    const gateway = new MockMessageGateway({ defaultDelayMs: 0 });
    await gateway.send(message);
    expect(gateway.getSentMessages()).toHaveLength(1);
  });

  it("deve permitir reset", async () => {
    const gateway = new MockMessageGateway({
      defaultDelayMs: 0,
      initialResults: [
        {
          status: "FAILED",
          attempt: 1,
          occurredAt: new Date(),
        },
      ],
    });
    await gateway.send(message);
    gateway.reset();
    expect(gateway.getSentMessages()).toHaveLength(0);
    const result = await gateway.send(message);
    expect(result.status).toBe("FAILED");
  });

  it("deve propagar attempt do metadata", async () => {
    const gateway = new MockMessageGateway({ defaultDelayMs: 0 });
    const result = await gateway.send({
      ...message,
      metadata: { attempt: 3 },
    });
    expect(result.attempt).toBe(3);
  });
});
