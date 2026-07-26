import { getChipHealthSnapshot, listBehaviorTimelineEvents, listChipGroupsForChip, listChipRelationships, upsertChipBehaviorScore, upsertChipRiskState } from "../../db";

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export async function refreshChipRiskState(params: {
  chipId: number;
  userId: number;
}) {
  const { chipId, userId } = params;
  const [events, relationships, groups, health] = await Promise.all([
    listBehaviorTimelineEvents({
      userId,
      chipId,
      limit: 500,
    }),
    listChipRelationships(chipId, userId),
    listChipGroupsForChip(chipId, userId),
    getChipHealthSnapshot(userId, chipId),
  ]);

  const sentCount = events.filter((event) => event.eventType === "message_sent").length;
  const receivedCount = events.filter((event) => event.eventType === "message_received").length;
  const contactAddedCount = events.filter((event) => event.eventType === "contact_added").length;
  const presenceEvents = events.filter((event) => String(event.eventType).startsWith("presence_"));
  const distinctPresenceStates = new Set(presenceEvents.map((event) => event.eventType)).size;
  const joinedGroups = groups.filter((group) => group.status === "joined").length;
  const favoriteRelationships = relationships.filter((relationship) => Number(relationship.favorite) === 1).length;
  const averageTrust =
    relationships.length > 0
      ? relationships.reduce((sum, item) => sum + Number(item.trustScore ?? 0), 0) / relationships.length
      : 0;

  const spamRisk = clampScore(contactAddedCount * 12 + Math.max(0, sentCount - receivedCount * 2) * 4);
  const banRisk = clampScore(spamRisk * 0.6 + Math.max(0, Number(health?.disconnectCount ?? 0)) * 8 + Math.max(0, 60 - Number(health?.healthScore ?? 100)));
  const socialScore = clampScore(joinedGroups * 18 + favoriteRelationships * 12 + averageTrust * 0.4);
  const presenceScore = clampScore(distinctPresenceStates * 15 + (presenceEvents.length >= 4 ? 25 : presenceEvents.length * 5));
  const conversationScore = clampScore(receivedCount * 14 + Math.min(sentCount, receivedCount) * 8);
  const routineScore = clampScore((presenceScore * 0.5) + (socialScore * 0.2) + (conversationScore * 0.3));
  const humanScore = clampScore(100 - banRisk * 0.45 - spamRisk * 0.2 + socialScore * 0.25 + presenceScore * 0.15);

  await upsertChipRiskState({
    userId,
    chipId,
    spamRisk,
    banRisk,
    humanScore,
    socialScore,
    routineScore,
    conversationScore,
    presenceScore,
    payload: {
      sentCount,
      receivedCount,
      contactAddedCount,
      joinedGroups,
      favoriteRelationships,
      distinctPresenceStates,
    },
  });

  await upsertChipBehaviorScore({
    userId,
    chipId,
    humanScore,
    riskScore: banRisk,
    evidenceQuality: clampScore((socialScore + routineScore + conversationScore) / 3),
    evidenceCoverage: clampScore(Math.min(100, 20 + joinedGroups * 10 + relationships.length * 5 + distinctPresenceStates * 10)),
    evidenceNaturalness: routineScore,
    evidenceDiversity: clampScore((distinctPresenceStates * 20) + Math.min(20, joinedGroups * 6)),
    evidenceConsistency: clampScore(Math.max(0, 100 - spamRisk)),
    evidenceSocialPresence: socialScore,
    evidenceCoverageDetail: {
      socialScore,
      routineScore,
      conversationScore,
      presenceScore,
    },
    sentCount,
    receivedCount,
    groupJoinCount: joinedGroups,
    readCount: events.filter((event) => event.eventType === "messages_read").length,
    distinctConversations: new Set(events.map((event) => event.remoteJid).filter(Boolean)).size,
    activeMinutes: Number(health?.sessionAge ?? 0),
    idleMinutes: Math.max(0, 1440 - Number(health?.sessionAge ?? 0)),
  });

  return {
    success: true,
    spamRisk,
    banRisk,
    humanScore,
  };
}
