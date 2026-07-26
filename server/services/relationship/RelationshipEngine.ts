import { listBehaviorTimelineEvents, listRelationshipMemories, upsertChipRelationship, upsertRelationshipMemory } from "../../db";

function toDate(value?: string | Date | null) {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
}

export async function refreshChipRelationships(params: {
  chipId: number;
  userId: number;
}) {
  const { chipId, userId } = params;
  const [events, legacyMemories] = await Promise.all([
    listBehaviorTimelineEvents({
      userId,
      chipId,
      limit: 500,
    }),
    listRelationshipMemories({
      userId,
      chipId,
      limit: 500,
    }),
  ]);

  const contactEvents = events.filter(
    (event) => event.remoteJid && !String(event.remoteJid).includes("@g.us")
  );

  const grouped = new Map<string, typeof contactEvents>();
  for (const event of contactEvents) {
    const key = String(event.remoteJid);
    const list = grouped.get(key) ?? [];
    list.push(event);
    grouped.set(key, list);
  }

  for (const [contact, history] of grouped.entries()) {
    const first = history[history.length - 1];
    const last = history[0];
    const inboundCount = history.filter((item) => item.eventType === "message_received").length;
    const outboundCount = history.filter((item) => item.eventType === "message_sent").length;
    const interactions = inboundCount + outboundCount;
    const legacy = legacyMemories.find((memory) => memory.counterpartKey === contact);
    const trustScore = Math.max(
      legacy?.trustScore ?? 0,
      Math.min(100, inboundCount * 8 + outboundCount * 4 + (history.length >= 8 ? 20 : 0))
    );
    const conversationLevel = Math.min(100, inboundCount * 10 + outboundCount * 6);
    const favorite = Number(inboundCount >= 5 || trustScore >= 70);

    await upsertChipRelationship({
      userId,
      chipId,
      contact,
      interactions,
      lastSeen: toDate(last.occurredAt),
      trustScore,
      conversationLevel,
      firstInteraction: toDate(first.occurredAt),
      lastInteraction: toDate(last.occurredAt),
      favorite,
      payload: {
        inboundCount,
        outboundCount,
      },
    });

    await upsertRelationshipMemory({
      userId,
      chipId,
      counterpartKey: contact,
      counterpartType: "contact",
      stage:
        trustScore >= 75
          ? "trust"
          : interactions >= 6
            ? "recurring"
            : interactions >= 2
              ? "known"
              : "unknown",
      firstInteractionAt: toDate(first.occurredAt),
      lastInteractionAt: toDate(last.occurredAt),
      trustScore,
      relationshipRisk: Math.max(0, 100 - trustScore),
      idealContactFrequencyHours: favorite ? 24 : 72,
      payload: {
        inboundCount,
        outboundCount,
        conversationLevel,
      },
    });
  }

  return {
    success: true,
    relationships: grouped.size,
  };
}
