import {
  getChipCertificationState,
  getChipRiskState,
  getChipRoutineState,
  getChipCertification,
  listBehaviorTimelineEvents,
  listChipGroupsForChip,
  listChipRelationships,
  upsertChipCertification,
  upsertChipCertificationState,
} from "../../db";
import { loadPersona } from "../persona/PersonaService";

type CompatibilityStatus = "NOVO" | "EM_MATURACAO" | "EM_OBSERVACAO" | "APROVADO" | "RESTRITO" | "REPROVADO";
type FinalDecision = "APPROVED" | "BLOCKED";

const LEVEL_LABELS = [
  "Nível 0 - Novo",
  "Nível 1 - Agenda criada",
  "Nível 2 - Social",
  "Nível 3 - Ativo",
  "Nível 4 - Maduro",
  "Nível 5 - Certificado",
] as const;

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function resolveLevelLabel(level: number) {
  return LEVEL_LABELS[Math.max(0, Math.min(LEVEL_LABELS.length - 1, level))];
}

function computeCompatibilityStatus(params: {
  level: number;
  decision: FinalDecision;
  spamRisk: number;
  banRisk: number;
}): CompatibilityStatus {
  if (params.banRisk >= 85 || params.spamRisk >= 80) return "REPROVADO";
  if (params.banRisk >= 60 || params.spamRisk >= 55) return "RESTRITO";
  if (params.decision === "APPROVED" && params.level >= 5) return "APROVADO";
  if (params.level >= 3) return "EM_OBSERVACAO";
  if (params.level >= 1) return "EM_MATURACAO";
  return "NOVO";
}

export async function refreshChipCertification(chipId: number, userId: number) {
  const [persona, groups, relationships, riskState, routineState, recentEvents, previousState, previousCompatibility] = await Promise.all([
    loadPersona(chipId),
    listChipGroupsForChip(chipId, userId),
    listChipRelationships(chipId, userId),
    getChipRiskState(userId, chipId),
    getChipRoutineState(userId, chipId),
    listBehaviorTimelineEvents({
      userId,
      chipId,
      limit: 500,
    }),
    getChipCertificationState(userId, chipId),
    getChipCertification(userId, chipId),
  ]);

  const contactsReady = recentEvents.some((event) => event.eventType === "contacts_synced");
  const joinedGroups = groups.filter((group) => group.status === "joined").length;
  const presenceEvents = recentEvents.filter((event) => String(event.eventType).startsWith("presence_")).length;
  const conversationEvents = recentEvents.filter((event) => ["message_received", "message_sent", "reaction_sent"].includes(event.eventType)).length;
  const averageTrust =
    relationships.length > 0
      ? relationships.reduce((sum, item) => sum + Number(item.trustScore ?? 0), 0) / relationships.length
      : 0;

  const humanScore = clamp(Number(riskState?.humanScore ?? 0));
  const socialScore = clamp(Number(riskState?.socialScore ?? joinedGroups * 18));
  const routineScore = clamp(Number(riskState?.routineScore ?? (routineState ? 35 : 0)));
  const trustScore = clamp(Math.max(averageTrust, relationships.length > 0 ? 20 : 0));
  const spamRisk = clamp(Number(riskState?.spamRisk ?? 0));
  const banRisk = clamp(Number(riskState?.banRisk ?? 0));

  let level = 0;
  if (persona && contactsReady) level = Math.max(level, 1);
  if (level >= 1 && (joinedGroups > 0 || relationships.length >= 1)) level = Math.max(level, 2);
  if (level >= 2 && (presenceEvents >= 3 || conversationEvents >= 2)) level = Math.max(level, 3);
  if (level >= 3 && humanScore >= 70 && socialScore >= 55 && routineScore >= 50 && trustScore >= 45 && spamRisk < 45 && banRisk < 45) {
    level = Math.max(level, 4);
  }
  if (level >= 4 && humanScore >= 80 && socialScore >= 70 && routineScore >= 65 && trustScore >= 60 && spamRisk < 30 && banRisk < 35) {
    level = 5;
  }

  const decision: FinalDecision = level >= 5 && spamRisk < 30 && banRisk < 35 ? "APPROVED" : "BLOCKED";
  const compatibilityStatus = computeCompatibilityStatus({
    level,
    decision,
    spamRisk,
    banRisk,
  });
  const usable = compatibilityStatus === "APROVADO";
  const maturityLabel = resolveLevelLabel(level);
  const reason =
    decision === "APPROVED"
      ? "Chip certificado pelo núcleo de maturação e liberado para campanhas."
      : banRisk >= 60 || spamRisk >= 55
        ? "Chip bloqueado por risco elevado; campanhas continuam proibidas."
        : `${maturityLabel}. Ainda falta evidência suficiente para liberar uso comercial.`;

  await upsertChipCertificationState({
    userId,
    chipId,
    maturityLevel: level,
    maturityLabel,
    decision,
    humanScore,
    socialScore,
    routineScore,
    trustScore,
    spamRisk,
    banRisk,
    payload: {
      joinedGroups,
      relationships: relationships.length,
      presenceEvents,
      conversationEvents,
      previousLevel: previousState?.maturityLevel ?? null,
      previousStatus: previousCompatibility?.status ?? null,
    },
  });

  await upsertChipCertification({
    userId,
    chipId,
    status: compatibilityStatus,
    usable,
    reason,
    approvedAt: usable ? previousCompatibility?.approvedAt ?? new Date() : null,
  });

  return {
    chipId,
    userId,
    maturityLevel: level,
    maturityLabel,
    decision,
    scores: {
      humanScore,
      socialScore,
      routineScore,
      trustScore,
      spamRisk,
      banRisk,
    },
    compatibility: {
      status: compatibilityStatus,
      usable,
      reason,
    },
  };
}
