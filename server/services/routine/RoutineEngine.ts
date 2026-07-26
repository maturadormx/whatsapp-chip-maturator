import { getChipRoutineState, upsertChipRoutineState } from "../../db";
import type { ChipMaturityStatus } from "../maturityPolicy";
import type { BehaviorPlan } from "../planner/BehaviorPlanner";
import type { ChipPersonaRecord } from "../persona/PersonaRepository";

type RoutineScheduleResult = {
  nextActionAt: Date;
  currentMode: string;
  actionsToday: number;
  pausesToday: number;
};

function getRandomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function resolveActionDelayMinutes(plan: BehaviorPlan, phase: ChipMaturityStatus, isWeekend: boolean) {
  switch (plan.action) {
    case "waiting_connection":
      return { min: 3, max: 6 };
    case "paused":
      return { min: 20, max: 50 };
    case "join_group":
    case "create_group":
      return { min: 40, max: 120 };
    case "open_group":
    case "read_group_messages":
      return { min: 24, max: 75 };
    case "contact_added":
      return { min: isWeekend ? 40 : 18, max: isWeekend ? 110 : 55 };
    case "conversation_reply":
    case "conversation_emoji":
    case "conversation_reaction":
      return { min: 8, max: 40 };
    default:
      if (String(plan.action).startsWith("presence_")) {
        return { min: 8, max: 26 };
      }
      if (String(plan.action).startsWith("identity_")) {
        return { min: 120, max: 420 };
      }
      break;
  }

  if (phase === "NOVO") return { min: 10, max: 30 };
  if (phase === "EM_MATURACAO") return { min: 15, max: 40 };
  return { min: 18, max: 55 };
}

function buildNextWakeTime(now: Date, persona: ChipPersonaRecord) {
  const next = new Date(now);
  next.setDate(next.getDate() + 1);
  next.setHours(Math.max(5, persona.wakeHour + getRandomInt(-1, 1)), getRandomInt(5, 55), 0, 0);
  return next;
}

export async function scheduleRoutineWindow(params: {
  userId: number;
  chipId: number;
  persona: ChipPersonaRecord;
  plan: BehaviorPlan;
  phase: ChipMaturityStatus;
  now?: Date;
  lastResult: "success" | "failed" | "skipped";
}) {
  const now = params.now ?? new Date();
  const weekday = now.getDay();
  const isWeekend = weekday === 0 || weekday === 6;
  const persisted = await getChipRoutineState(params.userId, params.chipId);
  const payload = (persisted?.payload as Record<string, unknown> | null) ?? {};
  const lastDayMarker =
    typeof payload.lastDayMarker === "string" ? new Date(payload.lastDayMarker) : persisted?.updatedAt ? new Date(persisted.updatedAt) : now;
  const sameDay = isSameDay(lastDayMarker, now);
  const actionsToday = sameDay ? Number(persisted?.actionsToday ?? 0) : 0;
  const pausesToday = sameDay ? Number(persisted?.pausesToday ?? 0) : 0;
  const maxActionsPerDay = isWeekend ? 6 : 9;

  let nextActionAt: Date;
  let currentMode = "active_window";
  let nextActionsToday = actionsToday;
  let nextPausesToday = pausesToday;

  const localHour = now.getHours();
  if (localHour >= params.persona.sleepHour || localHour < params.persona.wakeHour) {
    nextActionAt = buildNextWakeTime(now, params.persona);
    currentMode = "night_pause";
    nextPausesToday += 1;
  } else if (params.lastResult === "failed") {
    const delay = getRandomInt(35, 95);
    nextActionAt = new Date(now.getTime() + delay * 60_000);
    currentMode = "recovery_pause";
    nextPausesToday += 1;
  } else if (actionsToday >= maxActionsPerDay) {
    nextActionAt = new Date(now.getTime() + getRandomInt(180, 420) * 60_000);
    currentMode = isWeekend ? "weekend_cooldown" : "daily_cooldown";
    nextPausesToday += 1;
  } else {
    const delay = resolveActionDelayMinutes(params.plan, params.phase, isWeekend);
    nextActionAt = new Date(now.getTime() + getRandomInt(delay.min, delay.max) * 60_000);
    currentMode =
      localHour <= params.persona.wakeHour + 2
        ? "morning_window"
        : localHour >= params.persona.sleepHour - 2
          ? "night_winddown"
          : isWeekend
            ? "weekend_window"
            : "weekday_window";
    if (params.lastResult === "success") {
      nextActionsToday += 1;
    }
  }

  await upsertChipRoutineState({
    userId: params.userId,
    chipId: params.chipId,
    weekday,
    currentMode,
    nextActionAt,
    lastWindowStartedAt: persisted?.lastWindowStartedAt ?? now,
    lastWindowEndedAt: now,
    actionsToday: nextActionsToday,
    pausesToday: nextPausesToday,
    payload: {
      planAction: params.plan.action,
      phase: params.phase,
      lastDayMarker: now.toISOString(),
      personaWakeHour: params.persona.wakeHour,
      personaSleepHour: params.persona.sleepHour,
    },
  });

  return {
    nextActionAt,
    currentMode,
    actionsToday: nextActionsToday,
    pausesToday: nextPausesToday,
  } satisfies RoutineScheduleResult;
}
