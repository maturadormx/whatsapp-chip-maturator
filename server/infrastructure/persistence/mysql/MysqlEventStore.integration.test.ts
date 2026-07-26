import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MysqlEventStore } from "./MysqlEventStore";

const runDbIntegration = process.env.RUN_DB_INTEGRATION_TESTS === "true";
const describeIfDb = runDbIntegration ? describe : describe.skip;

describeIfDb("MysqlEventStore integration", () => {
  const store = new MysqlEventStore();

  beforeAll(async () => {
    await store.clear();
  });

  afterAll(async () => {
    await store.clear();
  });

  it("append e get respeitam versões", async () => {
    const version1 = await store.append(
      "observation:obs-int-1",
      {
        type: "ObservationSaved",
        occurredAt: "2026-07-20T10:00:00.000Z",
        payload: { id: "obs-int-1" },
      },
      0,
    );
    const version2 = await store.append(
      "observation:obs-int-1",
      {
        type: "ObservationReplayed",
        occurredAt: "2026-07-20T10:01:00.000Z",
        payload: { id: "obs-int-1" },
      },
      1,
    );

    const events = await store.get("observation:obs-int-1");
    expect(version1).toBe(1);
    expect(version2).toBe(2);
    expect(events.map((event) => event.version)).toEqual([1, 2]);
  });
});

