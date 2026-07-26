import { describe, expect, it } from "vitest";
import { ObservationFactory } from "./ObservationFactory";

describe("ObservationFactory", () => {
  it("cria Observation a partir do DTO", () => {
    const observation = ObservationFactory.create({
      source: "test",
      eventType: "test.event",
      payload: { foo: "bar" },
      correlationId: "corr-1",
      timestamp: "2026-07-20T10:00:00.000Z",
    });

    expect(observation.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(observation.source).toBe("test");
    expect(observation.eventType).toBe("test.event");
    expect(observation.payload).toEqual({ foo: "bar" });
    expect(observation.timestamp).toBe("2026-07-20T10:00:00.000Z");
    expect(observation.correlationId).toBe("corr-1");
  });

  it("gera defaults para eventType, payload e timestamp", () => {
    const before = Date.now();
    const observation = ObservationFactory.create({
      source: "test",
    });
    const after = Date.now();

    expect(observation.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(observation.eventType).toBe("generic.event");
    expect(observation.payload).toEqual({});
    expect(new Date(observation.timestamp).getTime()).toBeGreaterThanOrEqual(before);
    expect(new Date(observation.timestamp).getTime()).toBeLessThanOrEqual(after);
  });
});
