import {
  getAllChips,
  getChipCertification,
  getUserMaturationTargets,
  listBehaviorTimelineEvents,
  listChipGroupsForChip,
} from "../db";
import type { ChipMaturityStatus } from "./maturityPolicy";
import {
  getChipSession,
  listChipGroups,
  openChipChatList,
  openChipGroupConversation,
  recordChipPassiveLifecycle,
  syncChipContacts,
  updateChipAbout,
  updateChipProfileName,
  viewChipStatus,
} from "./whatsappService";
import { executeContactBehaviorPlan } from "./contact/ContactBehaviorEngine";
import { executeConversationBehaviorPlan } from "./conversation/ConversationBehaviorEngine";
import { refreshChipCertification } from "./certification/CertificationEngine";
import { executeGroupBehaviorPlan } from "./group/GroupBehaviorEngine";
import { executeIdentityEvolutionPlan } from "./identity/IdentityEvolutionEngine";
import { applyLearningToPlan, loadLearningMetricsMap, registerLearningOutcome } from "./learning/LearningEngine";
import { planBehavior, type BehaviorPlannerAction, type BehaviorPlan } from "./planner/BehaviorPlanner";
import { executePresenceBehaviorPlan } from "./presence/PresenceBehaviorEngine";
import { buildPersonaAbout } from "./persona/PersonaFactory";
import { createPersona } from "./persona/PersonaService";
import { refreshChipRelationships } from "./relationship/RelationshipEngine";
import { refreshChipRiskState } from "./risk/RiskEngine";
import { scheduleRoutineWindow } from "./routine/RoutineEngine";
import { refreshChipSocialGraph } from "./social/SocialGraphEngine";
import { refreshInternalEcosystem } from "./ecosystem/EcosystemEngine";
import { recordAuditEvent } from "./audit/AuditEngine";
import { getInternalEventBus } from "./events/InternalEventBus";

export type PassiveBehaviorActionType = BehaviorPlannerAction;

export interface PassiveBehaviorScheduleState {
  chipId: number;
  phase: ChipMaturityStatus;
  lastActionType: PassiveBehaviorActionType | null;
  lastActionAt: string | null;
  nextActionType: PassiveBehaviorActionType | null;
  nextActionAt: string | null;
  lastResult: "success" | "failed" | "skipped" | null;
  lastError: string | null;
}

const passiveScheduleState = new Map<number, PassiveBehaviorScheduleState>();
const runningChips = new Set<number>();

let passiveBehaviorTimer: NodeJS.Timeout | null = null;
let passiveBehaviorStarted = false;

const PASSIVE_TICK_MS = 60_000;

function getRandomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function toIsoOrNull(date: Date | null) {
  return date ? date.toISOString() : null;
}

function normalizePhase(status?: string | null): ChipMaturityStatus {
  switch (status) {
    case "EM_MATURACAO":
    case "EM_OBSERVACAO":
    case "APROVADO":
    case "RESTRITO":
    case "REPROVADO":
      return status;
    default:
      return "NOVO";
  }
}

function ensureChipState(chipId: number, phase: ChipMaturityStatus) {
  const existing = passiveScheduleState.get(chipId);
  if (existing) {
    existing.phase = phase;
    return existing;
  }

  const created: PassiveBehaviorScheduleState = {
    chipId,
    phase,
    lastActionType: null,
    lastActionAt: null,
    nextActionType: null,
    nextActionAt: null,
    lastResult: null,
    lastError: null,
  };
  passiveScheduleState.set(chipId, created);
  return created;
}

async function scheduleNextAction(
  state: PassiveBehaviorScheduleState,
  userId: number,
  chipId: number,
  persona: Awaited<ReturnType<typeof createPersona>>,
  plan: BehaviorPlan,
  phase: ChipMaturityStatus,
  nextActionType: PassiveBehaviorActionType,
  lastResult: "success" | "failed" | "skipped"
) {
  const nextActionAt = persona
    ? (
        await scheduleRoutineWindow({
          userId,
          chipId,
          persona,
          plan,
          phase,
          lastResult,
        })
      ).nextActionAt
    : new Date(Date.now() + getRandomInt(10, 35) * 60_000);

  state.phase = phase;
  state.nextActionType = nextActionType;
  state.nextActionAt = nextActionAt.toISOString();
}

function eventSetFromTimeline(events: Array<{ eventType: string }>) {
  return new Set(events.map((event) => event.eventType));
}

function pickWeightedAction(actions: PassiveBehaviorActionType[]) {
  return actions[getRandomInt(0, actions.length - 1)];
}

async function choosePassiveFallbackAction(params: {
  chipId: number;
  chipName: string;
  userId: number;
  phase: ChipMaturityStatus;
}) {
  const { chipId, phase, userId } = params;
  const recentEvents = await listBehaviorTimelineEvents({
    userId,
    chipId,
    limit: 200,
  });
  const events = eventSetFromTimeline(recentEvents);

  if (!events.has("contacts_synced")) {
    return { actionType: "contacts_synced" as const };
  }

  if (!events.has("profile_name_updated")) {
    return { actionType: "profile_name_updated" as const };
  }

  if (!events.has("about_updated")) {
    return { actionType: "about_updated" as const };
  }

  const candidates: PassiveBehaviorActionType[] = ["wake_up", "chat_list_opened", "status_viewed", "idle", "sleep"];
  if (phase !== "NOVO") {
    try {
      const groups = await listChipGroups(chipId);
      if (groups.length > 0) {
        candidates.push("group_opened");
      }
    } catch {
      // Grupo é opcional; se a leitura falhar, a rotina segue com ações passivas simples.
    }
  }

  return {
    actionType: pickWeightedAction(candidates),
  };
}

function isSkippablePlan(plan: BehaviorPlan) {
  return plan.action === "paused" || plan.action === "waiting_connection" || plan.action === "do_nothing";
}

async function buildPlanForChip(params: {
  chipId: number;
  chipName: string;
  userId: number;
  phase: ChipMaturityStatus;
  isPaused: boolean;
  isConnected: boolean;
  createdAt?: Date | string | null;
}) {
  const recentEvents = await listBehaviorTimelineEvents({
    userId: params.userId,
    chipId: params.chipId,
    limit: 200,
  });

  const persona = await createPersona(params.chipId, {
    chipName: params.chipName,
  });

  if (!persona) {
    const fallback = await choosePassiveFallbackAction(params);
    return {
      persona: null,
      recentEvents,
      plan: {
        engine: "passive_behavior" as const,
        action: fallback.actionType,
        probability: 0.5,
        reason: "Persona indisponível; fallback conservador do motor passivo.",
        context: {
          localHour: new Date().getHours(),
          weekday: new Date().getDay(),
          personaMode: "fallback",
        },
      },
    };
  }

  let availableGroupsCount = 0;
  let joinedGroupsCount = 0;
  if (params.isConnected && params.phase !== "NOVO") {
    try {
      availableGroupsCount = (await listChipGroups(params.chipId)).length;
    } catch {
      availableGroupsCount = 0;
    }
  }

  const [contactTargets, groupTargets, trackedGroups] = await Promise.all([
    getUserMaturationTargets(params.userId, "number"),
    getUserMaturationTargets(params.userId, "group"),
    listChipGroupsForChip(params.chipId, params.userId),
  ]);
  const availableContactTargetsCount = contactTargets.filter((target) => Number(target.isActive) === 1).length;
  const availableGroupTargetsCount = groupTargets.filter((target) => Number(target.isActive) === 1).length;
  joinedGroupsCount = trackedGroups.filter((group) => group.status === "joined").length;
  const recentInboundCount = recentEvents.filter((event) => event.eventType === "message_received").length;

  const certification = await getChipCertification(params.userId, params.chipId);
  const learnedPlan = planBehavior({
    persona,
    phase: params.phase,
    runtimeState: {
      isPaused: params.isPaused,
      isConnected: params.isConnected,
    },
    recentEvents,
    certification,
    availableGroupsCount,
    availableContactTargetsCount,
    availableGroupTargetsCount,
    joinedGroupsCount,
    recentInboundCount,
    chipCreatedAt: params.createdAt ?? null,
  });
  const learningMetrics = await loadLearningMetricsMap(params.chipId, params.userId);
  const plan = applyLearningToPlan(learnedPlan, learningMetrics);

  return {
    persona,
    recentEvents,
    plan,
  };
}

async function executeAction(params: {
  chipId: number;
  chipName: string;
  userId: number;
  persona: Awaited<ReturnType<typeof createPersona>>;
  plan: BehaviorPlan;
  recentEvents: Array<{ eventType: string; remoteJid?: string | null }>;
  actionType: PassiveBehaviorActionType;
}) {
  const { chipId, chipName, userId, persona, plan, recentEvents, actionType } = params;

  switch (actionType) {
    case "contacts_synced":
    case "contact_added":
      if (!persona) {
        return {
          success: false,
          skipped: true,
          reason: "Persona indisponível para o ContactBehaviorEngine.",
        };
      }
      return executeContactBehaviorPlan({
        chipId,
        userId,
        persona,
        plan,
        recentEvents,
      });
    case "profile_name_updated":
      return updateChipProfileName(chipId, persona?.displayName || chipName);
    case "about_updated":
      return updateChipAbout(
        chipId,
        persona
          ? buildPersonaAbout(persona)
          : `${chipName} em maturação operacional. Presença passiva e observação contínua.`
      );
    case "wake_up":
    case "idle":
    case "sleep":
      return recordChipPassiveLifecycle(chipId, actionType);
    case "chat_list_opened":
      return openChipChatList(chipId);
    case "status_viewed":
      return viewChipStatus(chipId);
    case "group_opened": {
      const groups = await listChipGroups(chipId);
      if (!groups.length) {
        throw new Error("Nenhum grupo disponível para observação");
      }
      const group = groups[getRandomInt(0, groups.length - 1)];
      return openChipGroupConversation(chipId, group.id);
    }
    case "join_group":
    case "create_group":
    case "open_group":
    case "read_group_messages":
    case "leave_group":
      if (!persona) {
        return {
          success: false,
          skipped: true,
          reason: "Persona indisponível para o GroupBehaviorEngine.",
        };
      }
      return executeGroupBehaviorPlan({
        chipId,
        userId,
        persona,
        plan,
      });
    case "presence_online":
    case "presence_offline":
    case "presence_reading":
    case "presence_typing":
    case "presence_recording":
    case "presence_away":
      return executePresenceBehaviorPlan({
        chipId,
        plan,
      });
    case "conversation_reply":
    case "conversation_emoji":
    case "conversation_reaction":
      if (!persona) {
        return {
          success: false,
          skipped: true,
          reason: "Persona indisponível para o ConversationBehaviorEngine.",
        };
      }
      return executeConversationBehaviorPlan({
        chipId,
        userId,
        persona,
        plan,
      });
    case "identity_name_refresh":
    case "identity_about_refresh":
    case "identity_photo_refresh":
      return executeIdentityEvolutionPlan({
        chipId,
        userId,
        plan,
      });
    default:
      return {
        success: false,
      };
  }
}

async function runChipPassiveCycle(chip: Awaited<ReturnType<typeof getAllChips>>[number]) {
  const certification = await getChipCertification(chip.userId, chip.id);
  const phase = normalizePhase(certification?.status);
  const state = ensureChipState(chip.id, phase);
  const session = getChipSession(chip.id);

  const nextActionAtMs = state.nextActionAt ? new Date(state.nextActionAt).getTime() : 0;
  if (nextActionAtMs > Date.now()) {
    return;
  }

  const { plan, persona, recentEvents } = await buildPlanForChip({
    chipId: chip.id,
    chipName: chip.chipName,
    userId: chip.userId,
    phase,
    isPaused: Number(chip.isPaused) === 1,
    isConnected: Boolean(session?.isConnected),
    createdAt: chip.createdAt,
  });

  const actionType = plan.action;

  if (isSkippablePlan(plan)) {
    state.phase = phase;
    state.lastActionType = actionType;
    state.lastActionAt = new Date().toISOString();
    state.lastResult = "skipped";
    state.lastError = null;
    await scheduleNextAction(state, chip.userId, chip.id, persona, plan, phase, actionType, "skipped");
    return;
  }

  try {
    const startedAt = Date.now();
    await recordAuditEvent({
      userId: chip.userId,
      chipId: chip.id,
      engine: "BehaviorPlanner",
      action: "plan_selected",
      entityType: "chip",
      entityId: String(chip.id),
      workerId: `passive:${process.pid}`,
      payload: {
        actionType,
        plan,
        phase,
      },
    }).catch(() => null);
    await getInternalEventBus().publish({
      type: "planner.plan_selected",
      source: "PassiveBehaviorEngine",
      payload: {
        userId: chip.userId,
        chipId: chip.id,
        actionType,
        plan,
        phase,
      },
    }).catch(() => null);
    await executeAction({
      chipId: chip.id,
      chipName: chip.chipName,
      userId: chip.userId,
      persona,
      plan,
      recentEvents,
      actionType,
    });

    await registerLearningOutcome({
      chipId: chip.id,
      userId: chip.userId,
      plan,
      result: "success",
      durationMs: Date.now() - startedAt,
    }).catch(() => null);
    await refreshChipRelationships({
      chipId: chip.id,
      userId: chip.userId,
    }).catch(() => null);
    await refreshChipSocialGraph({
      chipId: chip.id,
      userId: chip.userId,
    }).catch(() => null);
    await refreshChipRiskState({
      chipId: chip.id,
      userId: chip.userId,
    }).catch(() => null);
    await refreshChipCertification(chip.id, chip.userId).catch(() => null);
    await refreshInternalEcosystem(chip.userId).catch(() => null);
    await recordAuditEvent({
      userId: chip.userId,
      chipId: chip.id,
      engine: plan.engine,
      action: plan.action,
      entityType: "chip",
      entityId: String(chip.id),
      result: "success",
      durationMs: Date.now() - startedAt,
      workerId: `passive:${process.pid}`,
      afterState: {
        phase,
        result: "success",
      },
      payload: {
        reason: plan.reason,
      },
    }).catch(() => null);
    await getInternalEventBus().publish({
      type: "planner.action_success",
      source: "PassiveBehaviorEngine",
      payload: {
        userId: chip.userId,
        chipId: chip.id,
        action: plan.action,
        engine: plan.engine,
        phase,
        durationMs: Date.now() - startedAt,
      },
    }).catch(() => null);

    state.phase = phase;
    state.lastActionType = actionType;
    state.lastActionAt = new Date().toISOString();
    state.lastResult = "success";
    state.lastError = null;
    await scheduleNextAction(state, chip.userId, chip.id, persona, plan, phase, actionType, "success");
  } catch (error) {
    await recordAuditEvent({
      userId: chip.userId,
      chipId: chip.id,
      engine: plan.engine,
      action: plan.action,
      entityType: "chip",
      entityId: String(chip.id),
      result: "failed",
      workerId: `passive:${process.pid}`,
      errorMessage: error instanceof Error ? error.message : String(error),
      afterState: {
        phase,
        result: "failed",
      },
      payload: {
        reason: plan.reason,
      },
    }).catch(() => null);
    await getInternalEventBus().publish({
      type: "planner.action_failed",
      source: "PassiveBehaviorEngine",
      payload: {
        userId: chip.userId,
        chipId: chip.id,
        action: plan.action,
        engine: plan.engine,
        phase,
        error: error instanceof Error ? error.message : String(error),
      },
    }).catch(() => null);
    await registerLearningOutcome({
      chipId: chip.id,
      userId: chip.userId,
      plan,
      result: "failed",
    }).catch(() => null);
    state.phase = phase;
    state.lastActionType = actionType;
    state.lastActionAt = new Date().toISOString();
    state.lastResult = "failed";
    state.lastError =
      error instanceof Error ? `${plan.reason} | ${error.message}` : `${plan.reason} | ${String(error)}`;
    await scheduleNextAction(state, chip.userId, chip.id, persona, plan, phase, actionType, "failed");
    console.warn(`[PassiveBehavior] Falha ao executar ${actionType} no chip ${chip.id}:`, error);
  }
}

export async function runPassiveBehaviorTick() {
  const chips = await getAllChips();

  for (const chip of chips) {
    if (runningChips.has(chip.id)) {
      continue;
    }

    runningChips.add(chip.id);
    try {
      await runChipPassiveCycle(chip);
    } finally {
      runningChips.delete(chip.id);
    }
  }
}

export async function startPassiveBehaviorEngine() {
  if (passiveBehaviorStarted) {
    return;
  }

  passiveBehaviorStarted = true;
  await runPassiveBehaviorTick();
  passiveBehaviorTimer = setInterval(() => {
    void runPassiveBehaviorTick();
  }, PASSIVE_TICK_MS);
}

export function stopPassiveBehaviorEngine() {
  if (passiveBehaviorTimer) {
    clearInterval(passiveBehaviorTimer);
    passiveBehaviorTimer = null;
  }
  passiveBehaviorStarted = false;
}

export function getPassiveBehaviorScheduleState(chipId: number) {
  const state = passiveScheduleState.get(chipId);
  if (!state) {
    return null;
  }

  return {
    ...state,
    lastActionAt: state.lastActionAt,
    nextActionAt: state.nextActionAt,
  };
}

export function listPassiveBehaviorScheduleStates() {
  return Array.from(passiveScheduleState.values()).map((state) => ({
    ...state,
    phase: state.phase,
    lastActionAt: toIsoOrNull(state.lastActionAt ? new Date(state.lastActionAt) : null),
    nextActionAt: toIsoOrNull(state.nextActionAt ? new Date(state.nextActionAt) : null),
  }));
}
