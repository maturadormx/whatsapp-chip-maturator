import { CatalogedEvidence, EvidenceCatalogType } from "./evidenceCatalogService";

export const EPISODE_BUILDER_VERSION = 1;

export type BehaviorEpisode = {
  episodeType: "conversation" | "status" | "discovery" | "group" | "passive" | "media" | "mixed";
  startedAt: Date | null;
  endedAt: Date | null;
  actionsCount: number;
  initiatedBy: "chip" | "remote" | "system" | "unknown";
  responded: boolean;
  responseDelayMinutes: number | null;
  result: "continued" | "stopped" | "passive" | "unknown";
  participants: string[];
  origins: string[];
  catalogs: EvidenceCatalogType[];
  confidence: number;
  normalizerVersion: number;
  catalogVersion: number;
  episodeBuilderVersion: number;
  rawEventTrail: Array<{
    rawEventType: string;
    rawSource: string | null;
    rawOccurredAt: Date | null;
    conversationKey: string | null;
  }>;
  events: CatalogedEvidence[];
};

function uniquePush<T>(list: T[], value: T) {
  if (!list.includes(value)) {
    list.push(value);
  }
}

function inferEpisodeType(evidence: CatalogedEvidence): BehaviorEpisode["episodeType"] {
  if (evidence.catalog === "GROUP_INTERACTION") return "group";
  if (evidence.catalog === "STATUS_INTERACTION") return "status";
  if (evidence.catalog === "PROFILE_ACTIVITY" || evidence.catalog === "SOCIAL_DISCOVERY") return "discovery";
  if (evidence.activityClass === "passive") return "passive";
  if (evidence.type.includes("image") || evidence.type.includes("audio") || evidence.type.includes("media")) return "media";
  return "conversation";
}

function resolveEpisodeResult(episode: Omit<BehaviorEpisode, "result" | "confidence">): BehaviorEpisode["result"] {
  if (episode.actionsCount >= 3) return "continued";
  if (episode.episodeType === "status" || episode.episodeType === "passive" || !episode.responded) return "passive";
  return "stopped";
}

function averageConfidence(events: CatalogedEvidence[]) {
  if (!events.length) return 0;
  const total = events.reduce((sum, item) => sum + item.confidence, 0);
  return Number((total / events.length).toFixed(2));
}

export function buildBehaviorEpisodes(evidenceList: CatalogedEvidence[]): BehaviorEpisode[] {
  const ordered = [...evidenceList].sort(
    (a, b) => (a.occurredAt?.getTime() ?? 0) - (b.occurredAt?.getTime() ?? 0)
  );

  const episodes: Array<Omit<BehaviorEpisode, "result" | "confidence">> = [];

  for (const evidence of ordered) {
    const conversationKey = evidence.conversationKey ?? "__none__";
    const last = episodes[episodes.length - 1];
    const sameConversation = last?.participants.includes(conversationKey);
    const withinWindow =
      last?.endedAt && evidence.occurredAt
        ? evidence.occurredAt.getTime() - last.endedAt.getTime() <= 15 * 60 * 1000
        : false;

    if (last && sameConversation && withinWindow) {
      last.endedAt = evidence.occurredAt ?? last.endedAt;
      last.actionsCount += 1;
      last.responded = last.responded || evidence.direction === "incoming";
      last.responseDelayMinutes = last.responseDelayMinutes ?? evidence.responseDelayMinutes;
      last.events.push(evidence);
      uniquePush(last.participants, conversationKey);
      uniquePush(last.origins, evidence.origin);
      uniquePush(last.catalogs, evidence.catalog);
      last.rawEventTrail.push({
        rawEventType: evidence.derivation.rawEventType,
        rawSource: evidence.derivation.rawSource,
        rawOccurredAt: evidence.derivation.rawOccurredAt,
        conversationKey: evidence.derivation.rawConversationKey,
      });
      continue;
    }

    episodes.push({
      episodeType: inferEpisodeType(evidence),
      startedAt: evidence.occurredAt,
      endedAt: evidence.occurredAt,
      actionsCount: 1,
      initiatedBy: evidence.initiatedBy,
      responded: evidence.direction === "incoming",
      responseDelayMinutes: evidence.responseDelayMinutes,
      participants: [conversationKey],
      origins: [evidence.origin],
      catalogs: [evidence.catalog],
      normalizerVersion: evidence.normalizerVersion,
      catalogVersion: evidence.catalogVersion,
      episodeBuilderVersion: EPISODE_BUILDER_VERSION,
      rawEventTrail: [
        {
          rawEventType: evidence.derivation.rawEventType,
          rawSource: evidence.derivation.rawSource,
          rawOccurredAt: evidence.derivation.rawOccurredAt,
          conversationKey: evidence.derivation.rawConversationKey,
        },
      ],
      events: [evidence],
    });
  }

  return episodes.map((episode) => ({
    ...episode,
    confidence: averageConfidence(episode.events),
    result: resolveEpisodeResult(episode),
  }));
}
