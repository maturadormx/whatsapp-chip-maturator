import { describe, expect, it } from "vitest";
import { MemoryEventStore } from "./MemoryEventStore";

describe("MemoryEventStore", () => {
  it("append e get funcionam por stream", async () => {
    const store = new MemoryEventStore();
    await store.append("observation", {
      type: "ObservationSaved",
      occurredAt: "2026-07-20T10:00:00.000Z",
      payload: { id: "obs-1" },
    }, 0);

    const events = await store.get("observation");
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe("ObservationSaved");
    expect(events[0]?.version).toBe(1);
  });

  it("falha se expectedVersion não bater", async () => {
    const store = new MemoryEventStore();
    await store.append("observation", {
      type: "ObservationSaved",
      occurredAt: "2026-07-20T10:00:00.000Z",
      payload: { id: "obs-1" },
    }, 0);

    await expect(
      store.append("observation", {
        type: "ObservationSaved",
        occurredAt: "2026-07-20T10:01:00.000Z",
        payload: { id: "obs-2" },
      }, 0),
    ).rejects.toThrow("event_store_version_conflict");
  });
});
