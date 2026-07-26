import { describe, expect, it } from "vitest";
import { InMemoryBehaviorActionLedgerRepository } from "../../../server/repositories/ledger";

describe("InMemoryBehaviorActionLedgerRepository", () => {
  it("cria e recupera uma execução", async () => {
    const repository = new InMemoryBehaviorActionLedgerRepository();

    await repository.create({
      id: "exec-1",
      decisionId: "dec-1",
      userId: 1,
      chipId: 1,
      requestedAction: "message_sent",
      targetType: "number",
      targetValue: "5511999999999",
      payload: "{}",
    });

    const found = await repository.findById("exec-1");
    expect(found?.id).toBe("exec-1");
    expect(found?.status).toBe("PENDING");
  });

  it("atualiza campos do ledger", async () => {
    const repository = new InMemoryBehaviorActionLedgerRepository();

    await repository.create({
      id: "exec-1",
      decisionId: "dec-1",
      userId: 1,
      chipId: 1,
      requestedAction: "message_sent",
      targetType: "number",
      targetValue: "5511999999999",
      payload: "{}",
    });

    await repository.update("exec-1", {
      status: "FAILED",
      recoverable: 1,
      nextRetryAt: new Date("2026-07-20T12:00:00.000Z"),
    });

    const found = await repository.findById("exec-1");
    expect(found?.status).toBe("FAILED");
    expect(found?.recoverable).toBe(1);
  });

  it("lista apenas execuções recuperáveis elegíveis", async () => {
    const repository = new InMemoryBehaviorActionLedgerRepository();

    await repository.create({
      id: "exec-1",
      decisionId: "dec-1",
      userId: 1,
      chipId: 1,
      requestedAction: "message_sent",
      targetType: "number",
      targetValue: "5511999999999",
      payload: "{}",
      status: "FAILED",
      recoverable: 1,
      nextRetryAt: new Date("2026-07-20T10:00:00.000Z"),
    });

    await repository.create({
      id: "exec-2",
      decisionId: "dec-2",
      userId: 1,
      chipId: 1,
      requestedAction: "message_sent",
      targetType: "number",
      targetValue: "5511999999999",
      payload: "{}",
      status: "FAILED",
      recoverable: 1,
      nextRetryAt: new Date("2026-07-20T14:00:00.000Z"),
    });

    const recoverable = await repository.listRecoverable(new Date("2026-07-20T12:00:00.000Z"), 10);
    expect(recoverable.map((entry) => entry.id)).toEqual(["exec-1"]);
  });
});
