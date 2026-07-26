import { describe, expect, it } from "vitest";
import { replayChipHistory } from "./engine";
import type { ChipEventRecord } from "./types";

function makeEvent(
  sequence: number,
  eventType: string,
  payload: Record<string, unknown>,
  overrides: Partial<ChipEventRecord> = {}
): ChipEventRecord {
  return {
    event_id: `event-${sequence}-${eventType}`,
    chip_id: "chip-1",
    event_type: eventType,
    event_version: 1,
    sequence,
    occurred_at: `2026-07-18T10:${String(sequence).padStart(2, "0")}:00.000Z`,
    recorded_at: `2026-07-18T10:${String(sequence).padStart(2, "0")}:01.000Z`,
    payload,
    ...overrides,
  };
}

describe("replayChipHistory", () => {
  it("reconstrói o estado final de forma determinística", () => {
    const history = [
      makeEvent(1, "chip_created", { created_by: "system", sprint: 0 }),
      makeEvent(2, "chip_paired", { paired_with: "+5511999999999" }),
      makeEvent(3, "chip_state_changed", { from_state: "PAREADO", to_state: "NOVO", trigger: "evolved" }),
      makeEvent(4, "chip_state_changed", { from_state: "NOVO", to_state: "EM_MATURACAO", trigger: "maturation_started" }),
      makeEvent(5, "incident_opened", {
        previous_state: "EM_MATURACAO",
        incident_class: "AUTENTICACAO",
        incident_origin: "SISTEMA",
      }),
      makeEvent(6, "diagnosis_started", { incident_id: "inc-1" }),
      makeEvent(7, "recovery_started", { incident_id: "inc-1", action: "refresh_token", attempt: 1 }),
      makeEvent(8, "recovery_finished", { incident_id: "inc-1", restored_state: "EM_MATURACAO" }),
    ] satisfies ChipEventRecord[];

    const firstRun = replayChipHistory(history);
    const secondRun = replayChipHistory(history);

    expect(firstRun).toEqual(secondRun);
    expect(firstRun.current_state).toBe("EM_MATURACAO");
    expect(firstRun.previous_state).toBe("EM_MATURACAO");
    expect(firstRun.last_sequence).toBe(8);
    expect(firstRun.inconsistencies).toEqual([]);
    expect(firstRun.transitions_applied).toBe(8);
  });

  it("registra evento desconhecido sem interromper o replay", () => {
    const result = replayChipHistory([
      makeEvent(1, "chip_created", { created_by: "system", sprint: 0 }),
      makeEvent(2, "evento_inexistente", { foo: "bar" }),
      makeEvent(3, "chip_paired", { paired_with: "+5511999999999" }),
    ]);

    expect(result.current_state).toBe("PAREADO");
    expect(result.inconsistencies.map((item) => item.code)).toContain("UNKNOWN_EVENT");
  });

  it("detecta quebra de sequência e duplicidade", () => {
    const result = replayChipHistory([
      makeEvent(1, "chip_created", { created_by: "system", sprint: 0 }),
      makeEvent(3, "chip_paired", { paired_with: "+5511999999999" }),
      makeEvent(3, "chip_state_changed", { from_state: "PAREADO", to_state: "NOVO", trigger: "evolved" }),
    ]);

    const codes = result.inconsistencies.map((item) => item.code);
    expect(codes).toContain("SEQUENCE_GAP");
    expect(codes).toContain("DUPLICATED_SEQUENCE");
    expect(result.current_state).toBe("NOVO");
  });

  it("exige previous_state em incident_opened", () => {
    const result = replayChipHistory([
      makeEvent(1, "chip_created", { created_by: "system", sprint: 0 }),
      makeEvent(2, "chip_paired", { paired_with: "+5511999999999" }),
      makeEvent(3, "incident_opened", {
        incident_class: "AUTENTICACAO",
        incident_origin: "SISTEMA",
      }),
    ]);

    expect(result.current_state).toBe("PAREADO");
    expect(result.inconsistencies.map((item) => item.code)).toContain("MISSING_PREVIOUS_STATE");
  });

  it("detecta corrupção estrutural quando há múltiplos chip_id", () => {
    const result = replayChipHistory([
      makeEvent(1, "chip_created", { created_by: "system", sprint: 0 }),
      makeEvent(2, "chip_paired", { paired_with: "+5511999999999" }, { chip_id: "chip-2" }),
    ]);

    expect(result.current_state).toBe("CRIADO");
    expect(result.inconsistencies.map((item) => item.code)).toContain("HISTORY_CORRUPTED");
  });

  it("permite encerramento definitivo do chip", () => {
    const result = replayChipHistory([
      makeEvent(1, "chip_created", { created_by: "system", sprint: 0 }),
      makeEvent(2, "chip_closed", { reason: "fim_da_vida", closed_by: "operator" }),
    ]);

    expect(result.current_state).toBe("ENCERRADO");
    expect(result.transitions_applied).toBe(2);
  });
});
