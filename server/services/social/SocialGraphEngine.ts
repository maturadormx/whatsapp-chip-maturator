import { listBehaviorTimelineEvents, listChipGroupsForChip, listChipRelationships, upsertChipSocialGraphEntry } from "../../db";

function toDate(value?: string | Date | null) {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function resolveRelationshipLevel(interactions: number, trust: number) {
  if (trust >= 80 || interactions >= 15) return 5;
  if (trust >= 65 || interactions >= 10) return 4;
  if (trust >= 45 || interactions >= 6) return 3;
  if (trust >= 25 || interactions >= 3) return 2;
  if (interactions >= 1) return 1;
  return 0;
}

export async function refreshChipSocialGraph(params: {
  chipId: number;
  userId: number;
}) {
  const { chipId, userId } = params;
  const [relationships, groups, timeline] = await Promise.all([
    listChipRelationships(chipId, userId),
    listChipGroupsForChip(chipId, userId),
    listBehaviorTimelineEvents({
      userId,
      chipId,
      limit: 500,
    }),
  ]);

  for (const relationship of relationships) {
    const contactEvents = timeline.filter((event) => event.remoteJid === relationship.contact);
    const groupsSeen = Array.from(
      new Set(
        contactEvents
          .map((event) => String(event.groupJid ?? ""))
          .filter(Boolean)
      )
    );

    await upsertChipSocialGraphEntry({
      userId,
      chipId,
      entityType: "contact",
      entityId: relationship.contact,
      label: relationship.contact,
      trust: clampScore(Number(relationship.trustScore ?? 0)),
      interactionCount: Number(relationship.interactions ?? 0),
      lastSeen: toDate(relationship.lastSeen),
      relationshipLevel: resolveRelationshipLevel(
        Number(relationship.interactions ?? 0),
        Number(relationship.trustScore ?? 0)
      ),
      favorite: Number(relationship.favorite ?? 0),
      payload: {
        conversationLevel: relationship.conversationLevel,
        firstInteraction: relationship.firstInteraction,
        groupsSeen,
      },
    });
  }

  for (const group of groups) {
    const groupEvents = timeline.filter((event) => event.groupJid === group.groupJid || event.remoteJid === group.groupJid);
    const lastSeen = group.lastInteraction ?? group.joinedAt ?? null;
    const interactionCount = groupEvents.length;
    const trust = clampScore(20 + interactionCount * 8 - Number(group.risk ?? 0) * 0.4);

    await upsertChipSocialGraphEntry({
      userId,
      chipId,
      entityType: "group",
      entityId: group.groupJid,
      label: group.groupName ?? group.category ?? group.groupJid,
      trust,
      interactionCount,
      lastSeen: toDate(lastSeen),
      relationshipLevel: resolveRelationshipLevel(interactionCount, trust),
      favorite: Number(group.origin === "internal" || interactionCount >= 4),
      payload: {
        origin: group.origin,
        status: group.status,
        risk: group.risk,
        category: group.category,
      },
    });
  }

  return {
    success: true,
    contacts: relationships.length,
    groups: groups.length,
  };
}
