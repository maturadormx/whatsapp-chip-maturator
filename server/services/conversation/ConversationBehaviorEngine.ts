import { listBehaviorTimelineEvents, listChipRelationships } from "../../db";
import type { BehaviorPlan } from "../planner/BehaviorPlanner";
import type { ChipPersonaRecord } from "../persona/PersonaRepository";
import { markMessagesAsRead, sendMessage, sendReaction, setChipPresenceState } from "../whatsappService";

function buildReplyFromInbound(params: {
  inboundPreview: string;
  persona: ChipPersonaRecord;
  trustScore: number;
}) {
  const normalized = params.inboundPreview.toLowerCase();
  if (normalized.includes("?")) {
    return `Oi, vi agora. ${params.persona.homeCity} está corrida hoje, mas te respondo por aqui.`;
  }
  if (normalized.includes("bom dia") || normalized.includes("boa tarde") || normalized.includes("boa noite")) {
    return `Oi! Passei agora pra responder. Tudo certo por aí?`;
  }
  if (params.trustScore >= 70) {
    return `Vi sua mensagem agora e lembrei daqui. Depois me conta melhor isso.`;
  }
  return `Oi, apareceu aqui agora. Depois seguimos falando com calma.`;
}

export async function executeConversationBehaviorPlan(params: {
  chipId: number;
  userId: number;
  persona: ChipPersonaRecord;
  plan: BehaviorPlan;
}) {
  const { chipId, userId, persona, plan } = params;
  const events = await listBehaviorTimelineEvents({
    userId,
    chipId,
    limit: 200,
  });

  const inbound = events.find(
    (event) =>
      event.eventType === "message_received" &&
      event.remoteJid &&
      !String(event.remoteJid).includes("@g.us")
  );

  if (!inbound?.remoteJid) {
    return {
      success: false,
      skipped: true,
      reason: "Nenhuma mensagem inbound elegível para resposta contextual.",
    };
  }

  const relationships = await listChipRelationships(chipId, userId);
  const relationship = relationships.find((item) => item.contact === inbound.remoteJid);
  const trustScore = relationship?.trustScore ?? 0;
  const inboundPreview = String(inbound.contentPreview ?? "");

  if (inbound.messageId) {
    await markMessagesAsRead(chipId, [
      {
        remoteJid: inbound.remoteJid,
        id: inbound.messageId,
        fromMe: false,
      },
    ]).catch(() => null);
  }

  if (plan.action === "conversation_reaction") {
    await setChipPresenceState(chipId, "reading", inbound.remoteJid).catch(() => null);
    return sendReaction(chipId, inbound.remoteJid, trustScore >= 60 ? "👍" : "👀");
  }

  if (plan.action === "conversation_emoji") {
    await setChipPresenceState(chipId, "typing", inbound.remoteJid).catch(() => null);
    return sendMessage(chipId, inbound.remoteJid, trustScore >= 60 ? "😂" : "👍", {
      delay: 1000 + Math.floor(Math.random() * 3000),
      showTyping: true,
    });
  }

  if (plan.action === "conversation_reply") {
    const reply = buildReplyFromInbound({
      inboundPreview,
      persona,
      trustScore,
    });

    await setChipPresenceState(chipId, inboundPreview.length > 80 ? "recording" : "typing", inbound.remoteJid).catch(() => null);
    return sendMessage(chipId, inbound.remoteJid, reply, {
      delay: 1500 + Math.floor(Math.random() * 5000),
      showTyping: true,
    });
  }

  return {
    success: false,
    skipped: true,
    reason: `Plano ${plan.action} não pertence ao ConversationBehaviorEngine.`,
  };
}
