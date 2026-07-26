import { describe, expect, it } from "vitest";
import { MemoryObservationRepository } from "./MemoryObservationRepository";

describe("MemoryObservationRepository", () => {
  it("salva e recupera Observation por id", async () => {
    const repo = new MemoryObservationRepository();
    await repo.save({
      id: "obs-1",
      source: "test",
      eventType: "test.event",
      payload: { foo: "bar" },
      timestamp: "2026-07-20T10:00:00.000Z",
      correlationId: "corr-1",
    });

    const found = await repo.findById("obs-1");
    expect(found?.id).toBe("obs-1");
  });

  it("clear remove todas as observações", async () => {
    const repo = new MemoryObservationRepository();
    await repo.save({
      id: "obs-1",
      source: "test",
      eventType: "test.event",
      payload: {},
      timestamp: "2026-07-20T10:00:00.000Z",
    });
    repo.clear();
    const found = await repo.findById("obs-1");
    expect(found).toBeNull();
  });

  it("lista pendentes e permite marcar como processada", async () => {
    const repo = new MemoryObservationRepository();
    await repo.save({
      id: "obs-1",
      source: "test",
      eventType: "test.event",
      payload: {},
      timestamp: "2026-07-20T10:00:00.000Z",
    });

    const claimed = await repo.claimPending(10, "worker-1");
    expect(claimed).toHaveLength(1);
    await repo.completeProcessing("obs-1", true);
    const after = await repo.claimPending(10, "worker-1");
    expect(after).toHaveLength(0);
  });

  it("observation FAILED pode ser reclamada novamente", async () => {
    const repo = new MemoryObservationRepository();
    await repo.save({
      id: "obs-1",
      source: "test",
      eventType: "test.event",
      payload: {},
      timestamp: "2026-07-20T10:00:00.000Z",
    });

    await repo.claimPending(10, "worker-1");
    await repo.completeProcessing("obs-1", false, "boom");

    const claimedAgain = await repo.claimPending(10, "worker-2");
    expect(claimedAgain).toHaveLength(1);
  });
});
