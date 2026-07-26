import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MysqlObservationRepository } from "./MysqlObservationRepository";

const runDbIntegration = process.env.RUN_DB_INTEGRATION_TESTS === "true";
const describeIfDb = runDbIntegration ? describe : describe.skip;

describeIfDb("MysqlObservationRepository integration", () => {
  const repo = new MysqlObservationRepository();

  beforeAll(async () => {
    await repo.clear();
  });

  afterAll(async () => {
    await repo.clear();
  });

  it("save, claimPending e completeProcessing funcionam", async () => {
    await repo.save({
      id: "obs-int-1",
      source: "integration",
      eventType: "integration.event",
      payload: { foo: "bar" },
      timestamp: "2026-07-20T10:00:00.000Z",
    });

    const claimed = await repo.claimPending(10, "worker-int");
    expect(claimed.map((item) => item.id)).toContain("obs-int-1");

    await repo.completeProcessing("obs-int-1", true);
    const claimedAgain = await repo.claimPending(10, "worker-int");
    expect(claimedAgain.map((item) => item.id)).not.toContain("obs-int-1");
  });
});

