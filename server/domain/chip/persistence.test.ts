import { describe, expect, it } from "vitest";
import { replayChipHistory } from "./engine";
import { InMemoryChipEventStore } from "./inMemoryEventStore";
import type { AppendChipEventInput } from "./persistence";

function makeEvent(
  eventId: string,
  eventType: AppendChipEventInput["event_type"],
  payload: Record<string, unknown>,
  occurredAt = "2026-07-18T10:00:00.000Z"
): AppendChipEventInput {
  return {
    event_id: eventId,
    chip_id: "chip-1",
    event_type: eventType,
    event_version: 1,
    occurred_at: occurredAt,
    payload,
  };
}

describe("InMemoryChipEventStore", () => {
  it("atribui sequence monotônica por chip", async () => {
    const store = new InMemoryChipEventStore();

    const first = await store.append(makeEvent("evt-1", "chip_created", { created_by: "system", sprint: 0 }));
    const second = await store.append(makeEvent("evt-2", "chip_paired", { paired_with: "+5511999999999" }));

    expect(first.sequence).toBe(1);
    expect(second.sequence).toBe(2);
  });

  it("é idempotente por event_id", async () => {
    const store = new InMemoryChipEventStore();

    const first = await store.append(makeEvent("evt-1", "chip_created", { created_by: "system", sprint: 0 }));
    const duplicate = await store.append(makeEvent("evt-1", "chip_created", { created_by: "system", sprint: 0 }));

    expect(duplicate).toEqual(first);

    const history = await store.getHistory("chip-1");
    expect(history.events).toHaveLength(1);
  });

  it("permite leitura completa e parcial do histórico", async () => {
    const store = new InMemoryChipEventStore();

    await store.append(makeEvent("evt-1", "chip_created", { created_by: "system", sprint: 0 }));
    await store.append(makeEvent("evt-2", "chip_paired", { paired_with: "+5511999999999" }));
    await store.append(makeEvent("evt-3", "chip_state_changed", { from_state: "PAREADO", to_state: "NOVO", trigger: "evolved" }));

    const complete = await store.getHistory("chip-1");
    const partial = await store.getHistory("chip-1", { fromSequence: 2, limit: 1 });

    expect(complete.mode).toBe("complete");
    expect(complete.events).toHaveLength(3);
    expect(partial.mode).toBe("partial");
    expect(partial.events).toHaveLength(1);
    expect(partial.events[0]?.sequence).toBe(2);
  });

  it("entrega histórico apto a replay pelo motor", async () => {
    const store = new InMemoryChipEventStore();

    await store.append(makeEvent("evt-1", "chip_created", { created_by: "system", sprint: 0 }));
    await store.append(makeEvent("evt-2", "chip_paired", { paired_with: "+5511999999999" }));
    await store.append(makeEvent("evt-3", "chip_state_changed", { from_state: "PAREADO", to_state: "NOVO", trigger: "evolved" }));

    const history = await store.getHistory("chip-1");
    const result = replayChipHistory(history.events);

    expect(result.current_state).toBe("NOVO");
    expect(result.inconsistencies).toEqual([]);
  });
});
