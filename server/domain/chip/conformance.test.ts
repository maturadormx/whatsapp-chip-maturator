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
    chip_id: "chip-conformance-1",
    event_type: eventType,
    event_version: 1,
    sequence,
    occurred_at: `2026-07-18T11:${String(sequence).padStart(2, "0")}:00.000Z`,
    recorded_at: `2026-07-18T11:${String(sequence).padStart(2, "0")}:01.000Z`,
    payload,
    ...overrides,
  };
}

describe("Conformidade do catálogo oficial do chip", () => {
  it("aceita um fluxo válido cobrindo incidente, diagnóstico, falha, isolamento e restauração", () => {
    const history = [
      makeEvent(1, "chip_created", { created_by: "system", sprint: 0 }),
      makeEvent(2, "chip_paired", { paired_with: "+5511999999999" }),
      makeEvent(3, "chip_state_changed", { from_state: "PAREADO", to_state: "NOVO", trigger: "evolved" }),
      makeEvent(4, "incident_opened", {
        previous_state: "NOVO",
        incident_class: "AUTENTICACAO",
        incident_origin: "SISTEMA",
      }),
      makeEvent(5, "incident_classified", {
        incident_id: "inc-1",
        incident_class: "AUTENTICACAO",
        severity: "ALTA",
      }),
      makeEvent(6, "diagnosis_started", { incident_id: "inc-1" }),
      makeEvent(7, "diagnosis_finished", { incident_id: "inc-1", finding: "token_expired" }),
      makeEvent(8, "recovery_started", { incident_id: "inc-1", action: "refresh_token", attempt: 1 }),
      makeEvent(9, "recovery_failed", { incident_id: "inc-1", reason: "upstream_timeout", attempts: 1 }),
      makeEvent(10, "chip_isolated", { reason: "manual_isolation", previous_state: "NOVO" }),
      makeEvent(11, "recovery_started", { incident_id: "inc-1", action: "retry_refresh", attempt: 2 }),
      makeEvent(12, "chip_state_restored", { incident_id: "inc-1", restored_state: "NOVO" }),
      makeEvent(13, "chip_closed", { reason: "manual_shutdown", closed_by: "operator" }),
    ] satisfies ChipEventRecord[];

    const result = replayChipHistory(history);

    expect(result.current_state).toBe("ENCERRADO");
    expect(result.previous_state).toBe("NOVO");
    expect(result.inconsistencies).toEqual([]);
    expect(result.transitions_applied).toBe(10);
  });

  it("aceita recuperação concluída restaurando exatamente o previous_state preservado", () => {
    const history = [
      makeEvent(1, "chip_created", { created_by: "system", sprint: 0 }),
      makeEvent(2, "chip_paired", { paired_with: "+5511999999999" }),
      makeEvent(3, "chip_state_changed", { from_state: "PAREADO", to_state: "NOVO", trigger: "seeded" }),
      makeEvent(4, "chip_state_changed", { from_state: "NOVO", to_state: "EM_MATURACAO", trigger: "warming_up" }),
      makeEvent(5, "incident_opened", {
        previous_state: "EM_MATURACAO",
        incident_class: "AUTENTICACAO",
        incident_origin: "SISTEMA",
      }),
      makeEvent(6, "diagnosis_started", { incident_id: "inc-2" }),
      makeEvent(7, "recovery_started", { incident_id: "inc-2", action: "reconnect", attempt: 1 }),
      makeEvent(8, "recovery_finished", { incident_id: "inc-2", restored_state: "EM_MATURACAO" }),
    ] satisfies ChipEventRecord[];

    const result = replayChipHistory(history);

    expect(result.current_state).toBe("EM_MATURACAO");
    expect(result.previous_state).toBe("EM_MATURACAO");
    expect(result.inconsistencies).toEqual([]);
  });

  it("rejeita restauração com estado divergente do previous_state preservado", () => {
    const history = [
      makeEvent(1, "chip_created", { created_by: "system", sprint: 0 }),
      makeEvent(2, "chip_paired", { paired_with: "+5511999999999" }),
      makeEvent(3, "incident_opened", {
        previous_state: "PAREADO",
        incident_class: "AUTENTICACAO",
        incident_origin: "SISTEMA",
      }),
      makeEvent(4, "diagnosis_started", { incident_id: "inc-3" }),
      makeEvent(5, "recovery_started", { incident_id: "inc-3", action: "reconnect", attempt: 1 }),
      makeEvent(6, "recovery_finished", { incident_id: "inc-3", restored_state: "NOVO" }),
    ] satisfies ChipEventRecord[];

    const result = replayChipHistory(history);

    expect(result.current_state).toBe("RECUPERACAO");
    expect(result.inconsistencies.map((item) => item.code)).toContain("INVALID_PAYLOAD");
  });

  it("trata todo event_type fora do contrato oficial como UNKNOWN_EVENT", () => {
    const officialTypes = new Set([
      "chip_created",
      "chip_paired",
      "chip_state_changed",
      "incident_opened",
      "incident_classified",
      "diagnosis_started",
      "diagnosis_finished",
      "recovery_started",
      "recovery_finished",
      "recovery_failed",
      "chip_isolated",
      "chip_state_restored",
      "chip_closed",
    ]);

    expect(officialTypes.size).toBe(13);

    const result = replayChipHistory([
      makeEvent(1, "chip_created", { created_by: "system", sprint: 0 }),
      makeEvent(2, "not_in_contract", {}),
    ]);

    expect(result.inconsistencies.map((item) => item.code)).toContain("UNKNOWN_EVENT");
  });
});
