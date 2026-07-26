import { canTransition, isLifeState } from "./machine";
import {
  type ChipEventRecord,
  type ChipLifeState,
  type ChipState,
  type KnownChipEventType,
  type MotorInconsistency,
  type MotorInconsistencyCode,
  type MotorResult,
  type TransitionEntry,
  isChipLifeState,
  isChipState,
  isKnownChipEventType,
} from "./types";

type EngineContext = {
  currentState: ChipState | null;
  previousState: ChipLifeState | null;
};

type ApplySuccess = {
  ok: true;
  currentState: ChipState | null;
  previousState: ChipLifeState | null;
  transition: TransitionEntry | null;
};

type ApplyFailure = {
  ok: false;
  code: MotorInconsistencyCode;
  message: string;
};

type ApplyResult = ApplySuccess | ApplyFailure;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function requireString(payload: Record<string, unknown>, key: string): boolean {
  return typeof payload[key] === "string" && payload[key]!.toString().trim().length > 0;
}

function requirePositiveInteger(payload: Record<string, unknown>, key: string): boolean {
  return Number.isInteger(payload[key]) && Number(payload[key]) > 0;
}

function validatePayload(event: ChipEventRecord, currentState: ChipState | null): ApplyFailure | null {
  const payload = asRecord(event.payload);

  if (!payload) {
    return {
      ok: false,
      code: "INVALID_PAYLOAD",
      message: "payload ausente ou inválido",
    };
  }

  switch (event.event_type as KnownChipEventType) {
    case "chip_created":
      return requireString(payload, "created_by") && Number.isInteger(payload.sprint) && Number(payload.sprint) >= 0
        ? null
        : { ok: false, code: "INVALID_PAYLOAD", message: "chip_created exige created_by e sprint >= 0" };
    case "chip_paired":
      return requireString(payload, "paired_with")
        ? null
        : { ok: false, code: "INVALID_PAYLOAD", message: "chip_paired exige paired_with" };
    case "chip_state_changed":
      return requireString(payload, "trigger") && isChipState(payload.from_state) && isChipState(payload.to_state)
        ? null
        : { ok: false, code: "INVALID_PAYLOAD", message: "chip_state_changed exige from_state, to_state e trigger" };
    case "incident_opened":
      return isChipLifeState(payload.previous_state) && requireString(payload, "incident_class") && requireString(payload, "incident_origin")
        ? null
        : {
            ok: false,
            code: isChipLifeState(payload.previous_state) ? "INVALID_PAYLOAD" : "MISSING_PREVIOUS_STATE",
            message: "incident_opened exige previous_state, incident_class e incident_origin",
          };
    case "incident_classified":
      return requireString(payload, "incident_id") && requireString(payload, "incident_class") && requireString(payload, "severity")
        ? null
        : { ok: false, code: "INVALID_PAYLOAD", message: "incident_classified exige incident_id, incident_class e severity" };
    case "diagnosis_started":
      return requireString(payload, "incident_id")
        ? null
        : { ok: false, code: "INVALID_PAYLOAD", message: "diagnosis_started exige incident_id" };
    case "diagnosis_finished":
      return requireString(payload, "incident_id") && requireString(payload, "finding")
        ? null
        : { ok: false, code: "INVALID_PAYLOAD", message: "diagnosis_finished exige incident_id e finding" };
    case "recovery_started":
      return requireString(payload, "incident_id") && requireString(payload, "action") && requirePositiveInteger(payload, "attempt")
        ? null
        : { ok: false, code: "INVALID_PAYLOAD", message: "recovery_started exige incident_id, action e attempt > 0" };
    case "recovery_finished":
      if (currentState === "RECUPERACAO" && !isChipLifeState(payload.restored_state)) {
        return { ok: false, code: "RESTORE_WITHOUT_PREVIOUS_STATE", message: "recovery_finished exige restored_state de vida válido" };
      }
      return requireString(payload, "incident_id") && isChipLifeState(payload.restored_state)
        ? null
        : { ok: false, code: "INVALID_PAYLOAD", message: "recovery_finished exige incident_id e restored_state" };
    case "recovery_failed":
      return requireString(payload, "incident_id") && requireString(payload, "reason") && requirePositiveInteger(payload, "attempts")
        ? null
        : { ok: false, code: "INVALID_PAYLOAD", message: "recovery_failed exige incident_id, reason e attempts > 0" };
    case "chip_isolated":
      return requireString(payload, "reason")
        ? null
        : { ok: false, code: "INVALID_PAYLOAD", message: "chip_isolated exige reason" };
    case "chip_state_restored":
      if (currentState !== "RECUPERACAO" && currentState !== "ISOLADO") {
        return requireString(payload, "incident_id") && isChipLifeState(payload.restored_state)
          ? null
          : { ok: false, code: "INVALID_PAYLOAD", message: "chip_state_restored exige incident_id e restored_state" };
      }
      return requireString(payload, "incident_id") && isChipLifeState(payload.restored_state)
        ? null
        : { ok: false, code: "RESTORE_WITHOUT_PREVIOUS_STATE", message: "chip_state_restored exige restored_state de vida válido" };
    case "chip_closed":
      return requireString(payload, "reason") && requireString(payload, "closed_by")
        ? null
        : { ok: false, code: "INVALID_PAYLOAD", message: "chip_closed exige reason e closed_by" };
  }
}

function applyTransition(
  event: ChipEventRecord,
  fromState: ChipState | null,
  toState: ChipState,
  previousState: ChipLifeState | null
): ApplySuccess {
  return {
    ok: true,
    currentState: toState,
    previousState: isLifeState(toState) ? toState : previousState,
    transition: {
      sequence: event.sequence,
      event_id: event.event_id,
      event_type: event.event_type as KnownChipEventType,
      from_state: fromState,
      to_state: toState,
    },
  };
}

function applyChipEvent(context: EngineContext, event: ChipEventRecord): ApplyResult {
  const payload = event.payload;

  switch (event.event_type as KnownChipEventType) {
    case "chip_created":
      return canTransition(context.currentState, "CRIADO")
        ? applyTransition(event, context.currentState, "CRIADO", context.previousState)
        : { ok: false, code: "INVALID_TRANSITION", message: "chip_created só pode iniciar a vida do chip" };

    case "chip_paired":
      return canTransition(context.currentState, "PAREADO")
        ? applyTransition(event, context.currentState, "PAREADO", context.previousState)
        : { ok: false, code: "INVALID_TRANSITION", message: "chip_paired exige estado CRIADO" };

    case "chip_state_changed": {
      const fromState = payload.from_state;
      const toState = payload.to_state;

      if (!isChipState(fromState) || !isChipState(toState)) {
        return { ok: false, code: "INVALID_PAYLOAD", message: "chip_state_changed recebeu estados inválidos" };
      }

      if (context.currentState !== fromState || !canTransition(fromState, toState)) {
        return {
          ok: false,
          code: "INVALID_TRANSITION",
          message: `chip_state_changed não pode mover ${String(context.currentState)} para ${toState}`,
        };
      }

      return applyTransition(event, context.currentState, toState, context.previousState);
    }

    case "incident_opened": {
      const previousState = payload.previous_state;

      if (!isChipLifeState(previousState)) {
        return { ok: false, code: "MISSING_PREVIOUS_STATE", message: "incident_opened exige previous_state" };
      }

      if (context.currentState !== previousState || !canTransition(previousState, "INCIDENTE")) {
        return {
          ok: false,
          code: "INVALID_TRANSITION",
          message: "incident_opened exige estado de vida compatível com previous_state",
        };
      }

      return {
        ok: true,
        currentState: "INCIDENTE",
        previousState,
        transition: {
          sequence: event.sequence,
          event_id: event.event_id,
          event_type: event.event_type as KnownChipEventType,
          from_state: context.currentState,
          to_state: "INCIDENTE",
        },
      };
    }

    case "incident_classified":
      return context.currentState === "INCIDENTE" || context.currentState === "DIAGNOSTICO"
        ? { ok: true, currentState: context.currentState, previousState: context.previousState, transition: null }
        : {
            ok: false,
            code: "INVALID_TRANSITION",
            message: "incident_classified exige incidente previamente aberto",
          };

    case "diagnosis_started":
      if (context.currentState === "DIAGNOSTICO") {
        return { ok: true, currentState: context.currentState, previousState: context.previousState, transition: null };
      }

      return canTransition(context.currentState, "DIAGNOSTICO")
        ? applyTransition(event, context.currentState, "DIAGNOSTICO", context.previousState)
        : { ok: false, code: "INVALID_TRANSITION", message: "diagnosis_started exige estado INCIDENTE" };

    case "diagnosis_finished":
      return context.currentState === "DIAGNOSTICO"
        ? { ok: true, currentState: context.currentState, previousState: context.previousState, transition: null }
        : { ok: false, code: "INVALID_TRANSITION", message: "diagnosis_finished exige estado DIAGNOSTICO" };

    case "recovery_started":
      return context.currentState === "DIAGNOSTICO" || context.currentState === "ISOLADO"
        ? applyTransition(event, context.currentState, "RECUPERACAO", context.previousState)
        : {
            ok: false,
            code: "INVALID_TRANSITION",
            message: "recovery_started exige estado DIAGNOSTICO ou ISOLADO",
          };

    case "recovery_finished": {
      if (context.currentState !== "RECUPERACAO") {
        return { ok: false, code: "INVALID_TRANSITION", message: "recovery_finished exige estado RECUPERACAO" };
      }

      if (!context.previousState) {
        return {
          ok: false,
          code: "RESTORE_WITHOUT_PREVIOUS_STATE",
          message: "recovery_finished não pode restaurar sem previous_state preservado",
        };
      }

      if (payload.restored_state !== context.previousState) {
        return {
          ok: false,
          code: "INVALID_PAYLOAD",
          message: "recovery_finished exige restored_state igual ao previous_state preservado",
        };
      }

      return applyTransition(event, context.currentState, context.previousState, context.previousState);
    }

    case "recovery_failed":
      return context.currentState === "RECUPERACAO"
        ? { ok: true, currentState: context.currentState, previousState: context.previousState, transition: null }
        : { ok: false, code: "INVALID_TRANSITION", message: "recovery_failed exige estado RECUPERACAO" };

    case "chip_isolated": {
      if (context.currentState === null || context.currentState === "ENCERRADO" || context.currentState === "ISOLADO") {
        return { ok: false, code: "INVALID_TRANSITION", message: "chip_isolated exige chip existente e não isolado" };
      }

      const payloadPreviousState = payload.previous_state;
      const preservedPreviousState = isChipLifeState(payloadPreviousState) ? payloadPreviousState : context.previousState;
      return {
        ok: true,
        currentState: "ISOLADO",
        previousState: preservedPreviousState,
        transition: {
          sequence: event.sequence,
          event_id: event.event_id,
          event_type: event.event_type as KnownChipEventType,
          from_state: context.currentState,
          to_state: "ISOLADO",
        },
      };
    }

    case "chip_state_restored": {
      if (context.currentState !== "RECUPERACAO" && context.currentState !== "ISOLADO") {
        return {
          ok: false,
          code: "INVALID_TRANSITION",
          message: "chip_state_restored exige estado RECUPERACAO ou ISOLADO",
        };
      }

      if (!context.previousState) {
        return {
          ok: false,
          code: "RESTORE_WITHOUT_PREVIOUS_STATE",
          message: "chip_state_restored não pode restaurar sem previous_state preservado",
        };
      }

      if (payload.restored_state !== context.previousState) {
        return {
          ok: false,
          code: "INVALID_PAYLOAD",
          message: "chip_state_restored exige restored_state igual ao previous_state preservado",
        };
      }

      return applyTransition(event, context.currentState, context.previousState, context.previousState);
    }

    case "chip_closed":
      return context.currentState !== null && context.currentState !== "ENCERRADO"
        ? applyTransition(event, context.currentState, "ENCERRADO", context.previousState)
        : { ok: false, code: "INVALID_TRANSITION", message: "chip_closed exige chip existente e ainda não encerrado" };
  }
}

function buildInconsistency(
  event: ChipEventRecord,
  code: MotorInconsistencyCode,
  message: string
): MotorInconsistency {
  return {
    code,
    sequence: event.sequence,
    event_id: event.event_id,
    event_type: event.event_type,
    message,
  };
}

export function replayChipHistory(history: readonly ChipEventRecord[]): MotorResult {
  let currentState: ChipState | null = null;
  let previousState: ChipLifeState | null = null;
  let lastSequence: number | null = null;
  let canonicalChipId: string | null = null;

  const seenSequences = new Set<number>();
  const transitionLog: TransitionEntry[] = [];
  const inconsistencies: MotorInconsistency[] = [];

  for (const event of history) {
    if (canonicalChipId === null) {
      canonicalChipId = event.chip_id;
    } else if (event.chip_id !== canonicalChipId) {
      inconsistencies.push(buildInconsistency(event, "HISTORY_CORRUPTED", "histórico contém mais de um chip_id"));
      continue;
    }

    if (seenSequences.has(event.sequence)) {
      inconsistencies.push(buildInconsistency(event, "DUPLICATED_SEQUENCE", "sequence repetida para o mesmo chip"));
    } else {
      if (lastSequence !== null && event.sequence > lastSequence + 1) {
        inconsistencies.push(buildInconsistency(event, "SEQUENCE_GAP", "há quebra de continuidade lógica na sequence"));
      }

      seenSequences.add(event.sequence);
    }

    if (!isKnownChipEventType(event.event_type)) {
      inconsistencies.push(buildInconsistency(event, "UNKNOWN_EVENT", "event_type não existe no contrato oficial"));
      continue;
    }

    const payloadValidation = validatePayload(event, currentState);
    if (payloadValidation) {
      inconsistencies.push(buildInconsistency(event, payloadValidation.code, payloadValidation.message));
      continue;
    }

    const result = applyChipEvent({ currentState, previousState }, event);
    if (!result.ok) {
      const failure = result as ApplyFailure;
      inconsistencies.push(buildInconsistency(event, failure.code, failure.message));
      continue;
    }

    currentState = result.currentState;
    previousState = result.previousState;
    lastSequence = event.sequence;

    if (result.transition) {
      transitionLog.push(result.transition);
    }
  }

  return {
    current_state: currentState,
    previous_state: previousState,
    last_sequence: lastSequence,
    inconsistencies,
    processed_events: history.length,
    transitions_applied: transitionLog.length,
    transition_log: transitionLog,
  };
}
