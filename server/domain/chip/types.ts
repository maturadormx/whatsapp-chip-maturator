export const CHIP_LIFE_STATES = ["CRIADO", "PAREADO", "NOVO", "EM_MATURACAO", "MADURO"] as const;

export const CHIP_OPERATIONAL_STATES = ["INCIDENTE", "DIAGNOSTICO", "RECUPERACAO", "ISOLADO", "ENCERRADO"] as const;

export const CHIP_STATES = [...CHIP_LIFE_STATES, ...CHIP_OPERATIONAL_STATES] as const;

export type ChipLifeState = (typeof CHIP_LIFE_STATES)[number];
export type ChipOperationalState = (typeof CHIP_OPERATIONAL_STATES)[number];
export type ChipState = (typeof CHIP_STATES)[number];

export const KNOWN_CHIP_EVENT_TYPES = [
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
] as const;

export type KnownChipEventType = (typeof KNOWN_CHIP_EVENT_TYPES)[number];

export type ChipEventRecord = {
  event_id: string;
  chip_id: string;
  event_type: string;
  event_version: number;
  sequence: number;
  occurred_at: string;
  recorded_at: string;
  payload: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export const MOTOR_INCONSISTENCY_CODES = [
  "UNKNOWN_EVENT",
  "INVALID_TRANSITION",
  "INVALID_PAYLOAD",
  "SEQUENCE_GAP",
  "DUPLICATED_SEQUENCE",
  "RESTORE_WITHOUT_PREVIOUS_STATE",
  "HISTORY_CORRUPTED",
  "MISSING_PREVIOUS_STATE",
] as const;

export type MotorInconsistencyCode = (typeof MOTOR_INCONSISTENCY_CODES)[number];

export type MotorInconsistency = {
  code: MotorInconsistencyCode;
  sequence: number;
  event_id: string;
  event_type: string;
  message: string;
};

export type TransitionEntry = {
  sequence: number;
  event_id: string;
  event_type: KnownChipEventType;
  from_state: ChipState | null;
  to_state: ChipState;
};

export type MotorResult = {
  current_state: ChipState | null;
  previous_state: ChipLifeState | null;
  last_sequence: number | null;
  inconsistencies: MotorInconsistency[];
  processed_events: number;
  transitions_applied: number;
  transition_log: TransitionEntry[];
};

export function isChipState(value: unknown): value is ChipState {
  return typeof value === "string" && CHIP_STATES.includes(value as ChipState);
}

export function isChipLifeState(value: unknown): value is ChipLifeState {
  return typeof value === "string" && CHIP_LIFE_STATES.includes(value as ChipLifeState);
}

export function isKnownChipEventType(value: string): value is KnownChipEventType {
  return KNOWN_CHIP_EVENT_TYPES.includes(value as KnownChipEventType);
}
