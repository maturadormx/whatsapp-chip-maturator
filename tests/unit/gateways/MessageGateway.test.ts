import { describe, expect, it } from "vitest";
import type { GatewayResult } from "../../../server/gateways/GatewayResult";
import type { OutboundMessage } from "../../../server/gateways/OutboundMessage";
import { FakeMessageGateway } from "../../fakes/FakeMessageGateway";

describe("MessageGateway — Contrato", () => {
  const sampleMessage: OutboundMessage = {
    executionId: "test-001",
    recipient: "5511999999999",
    content: "Hello",
  };

  it("deve retornar ACKED por padrão", async () => {
    const gateway = new FakeMessageGateway();
    const result = await gateway.send(sampleMessage);
    expect(result.status).toBe("ACKED");
  });

  it("deve permitir configurar resultado por executionId", async () => {
    const gateway = new FakeMessageGateway();
    const failedResult: GatewayResult = {
      status: "FAILED",
      attempt: 1,
      occurredAt: new Date(),
    };

    gateway.when("test-001", failedResult);
    const result = await gateway.send(sampleMessage);
    expect(result.status).toBe("FAILED");
  });

  it("deve registrar mensagens enviadas", async () => {
    const gateway = new FakeMessageGateway();
    await gateway.send(sampleMessage);
    expect(gateway.wasSent("test-001")).toBe(true);
  });

  it("deve contar envios duplicados", async () => {
    const gateway = new FakeMessageGateway();
    await gateway.send(sampleMessage);
    await gateway.send(sampleMessage);
    expect(gateway.sendCount("test-001")).toBe(2);
  });

  it("deve permitir reset de estado", async () => {
    const gateway = new FakeMessageGateway();
    await gateway.send(sampleMessage);
    gateway.reset();
    expect(gateway.getSentMessages()).toHaveLength(0);
  });

  it("deve incluir attempt no resultado", async () => {
    const gateway = new FakeMessageGateway();
    const result = await gateway.send(sampleMessage);
    expect(result.attempt).toBeGreaterThanOrEqual(1);
  });

  it("deve incluir occurredAt no resultado", async () => {
    const gateway = new FakeMessageGateway();
    const before = new Date();
    const result = await gateway.send(sampleMessage);
    const after = new Date();
    expect(result.occurredAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(result.occurredAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });
});
