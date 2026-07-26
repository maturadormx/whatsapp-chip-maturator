import { describe, expect, it } from "vitest";
import { FakeClock } from "../../../server/clock/FakeClock";
import { SystemClock } from "../../../server/clock/SystemClock";

describe("Clock", () => {
  it("FakeClock deve retornar now() determinístico", () => {
    const clock = new FakeClock(new Date("2026-07-20T10:00:00.000Z"));
    expect(clock.now().toISOString()).toBe("2026-07-20T10:00:00.000Z");
  });

  it("FakeClock deve avançar o tempo via advanceBy()", () => {
    const clock = new FakeClock(new Date("2026-07-20T10:00:00.000Z"));
    clock.advanceBy(5_000);
    expect(clock.now().toISOString()).toBe("2026-07-20T10:00:05.000Z");
  });

  it("FakeClock deve permitir set()", () => {
    const clock = new FakeClock();
    clock.set(new Date("2026-08-01T12:30:00.000Z"));
    expect(clock.now().toISOString()).toBe("2026-08-01T12:30:00.000Z");
  });

  it("FakeClock deve resetar para o instante inicial", () => {
    const clock = new FakeClock(new Date("2026-07-20T10:00:00.000Z"));
    clock.advanceBy(60_000);
    clock.reset();
    expect(clock.now().toISOString()).toBe("2026-07-20T10:00:00.000Z");
  });

  it("SystemClock deve retornar uma data válida", () => {
    const clock = new SystemClock();
    expect(clock.now()).toBeInstanceOf(Date);
  });
});
