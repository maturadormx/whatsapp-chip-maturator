import {
  BehaviorMemoryEvidenceCoverage,
  BehaviorMemoryPipelineVersions,
  IdentitySnapshot,
  IdentitySnapshotDimension,
  IdentitySnapshotDimensionName,
  IdentitySnapshotEpisodeReference,
} from "./behaviorMemoryService";
import { BehaviorEpisode } from "./episodeBuilderService";

type DimensionContribution = {
  episode: BehaviorEpisode;
  score: number;
  rationale: string;
};

type IdentitySnapshotInput = {
  episodes: BehaviorEpisode[];
  evidenceCoverage: BehaviorMemoryEvidenceCoverage | null;
  pipelineVersions: BehaviorMemoryPipelineVersions | null;
  averageConfidence: number;
  previousIdentitySnapshot?: IdentitySnapshot | null;
  generatedAt?: Date;
};

function clamp01(value: number) {
  return Math.max(0, Math.min(1, Number(value.toFixed(4))));
}

function bucketToScalar(hourBucket: string) {
  switch (hourBucket) {
    case "dawn":
      return 0.1;
    case "morning":
      return 0.25;
    case "afternoon":
      return 0.5;
    case "evening":
      return 0.75;
    case "night":
      return 1;
    default:
      return 0.5;
  }
}

function toEpisodeReference(
  contribution: DimensionContribution,
  episodes: BehaviorEpisode[]
): IdentitySnapshotEpisodeReference {
  return {
    episodeIndex: episodes.indexOf(contribution.episode) + 1,
    episodeType: contribution.episode.episodeType,
    confidence: contribution.episode.confidence,
    startedAt: contribution.episode.startedAt,
    endedAt: contribution.episode.endedAt,
    rationale: contribution.rationale,
  };
}

function pickSupportAndContradiction(
  contributions: DimensionContribution[],
  episodes: BehaviorEpisode[]
) {
  const supporting = [...contributions]
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((item) => toEpisodeReference(item, episodes));

  const contradicting = [...contributions]
    .filter((item) => item.score < 0)
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map((item) => toEpisodeReference(item, episodes));

  return { supporting, contradicting };
}

function baseDimensionConfidence(params: {
  episodeCount: number;
  averageConfidence: number;
  evidenceCoverage: number;
  contributionStrength: number;
}) {
  const episodeFactor = Math.min(1, params.episodeCount / 12);
  const strengthFactor = Math.min(1, params.contributionStrength);
  return clamp01(
    params.averageConfidence * 0.45 +
      (params.evidenceCoverage / 100) * 0.35 +
      episodeFactor * 0.1 +
      strengthFactor * 0.1
  );
}

function buildNeutralDimension(): IdentitySnapshotDimension {
  return {
    value: 0.5,
    confidence: 0.2,
    supportingEpisodes: [],
    contradictingEpisodes: [],
  };
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildCommunicationStyle(episodes: BehaviorEpisode[], evidenceCoverage: number, averageConfidence: number): IdentitySnapshotDimension {
  if (!episodes.length) return buildNeutralDimension();
  const contributions: DimensionContribution[] = episodes.map((episode) => {
    let score = 0;
    const reasons: string[] = [];

    if (episode.episodeType === "conversation") {
      score += 0.35;
      reasons.push("episódio de conversa sustenta traço comunicativo");
    }
    if (episode.catalogs.includes("HUMAN_REPLY")) {
      score += 0.2;
      reasons.push("presença de resposta humana reforça troca comunicativa");
    }
    if (episode.initiatedBy === "chip") {
      score += 0.15;
      reasons.push("chip iniciou interação");
    }
    if (episode.actionsCount >= 3) {
      score += 0.2;
      reasons.push("sequência prolongada de ações");
    }
    if (episode.episodeType === "passive") {
      score -= 0.25;
      reasons.push("episódio passivo contradiz perfil comunicativo");
    }
    if (episode.result === "passive") {
      score -= 0.15;
      reasons.push("resultado passivo reduz sinal comunicativo");
    }

    return { episode, score, rationale: reasons.join("; ") || "sem evidência forte" };
  });

  const positive = contributions.filter((item) => item.score > 0).map((item) => item.score);
  const negative = contributions.filter((item) => item.score < 0).map((item) => Math.abs(item.score));
  const value = clamp01(0.5 + average(positive) * 0.5 - average(negative) * 0.35);
  const contributionStrength = average(contributions.map((item) => Math.abs(item.score)));
  const refs = pickSupportAndContradiction(contributions, episodes);

  return {
    value,
    confidence: baseDimensionConfidence({
      episodeCount: episodes.length,
      averageConfidence,
      evidenceCoverage,
      contributionStrength,
    }),
    supportingEpisodes: refs.supporting,
    contradictingEpisodes: refs.contradicting,
  };
}

function buildActivityRhythm(episodes: BehaviorEpisode[], evidenceCoverage: number, averageConfidence: number): IdentitySnapshotDimension {
  if (!episodes.length) return buildNeutralDimension();
  const contributions: DimensionContribution[] = episodes.map((episode) => {
    const bucketValues = episode.events.map((event) => bucketToScalar(event.hourBucket));
    const score = bucketValues.length ? average(bucketValues) - 0.5 : 0;
    const avgBucket = clamp01(average(bucketValues));
    const rationale =
      avgBucket >= 0.75
        ? "episódio concentrado em horário tardio"
        : avgBucket <= 0.3
          ? "episódio concentrado em horário cedo"
          : "episódio em faixa intermediária";
    return { episode, score, rationale };
  });

  const rawValue = clamp01(average(episodes.flatMap((episode) => episode.events.map((event) => bucketToScalar(event.hourBucket)))));
  const refs = pickSupportAndContradiction(contributions, episodes);

  return {
    value: rawValue,
    confidence: baseDimensionConfidence({
      episodeCount: episodes.length,
      averageConfidence,
      evidenceCoverage,
      contributionStrength: average(contributions.map((item) => Math.abs(item.score))),
    }),
    supportingEpisodes: refs.supporting,
    contradictingEpisodes: refs.contradicting,
  };
}

function buildSocialExposure(episodes: BehaviorEpisode[], evidenceCoverage: number, averageConfidence: number): IdentitySnapshotDimension {
  if (!episodes.length) return buildNeutralDimension();
  const contributions: DimensionContribution[] = episodes.map((episode) => {
    let score = 0;
    const reasons: string[] = [];
    if (episode.episodeType === "group") {
      score += 0.45;
      reasons.push("grupo amplia exposição social");
    }
    if (episode.episodeType === "status" || episode.episodeType === "discovery") {
      score += 0.2;
      reasons.push("status/discovery indicam exposição");
    }
    if (episode.participants.length > 1) {
      score += 0.2;
      reasons.push("múltiplos participantes");
    }
    if (episode.episodeType === "passive") {
      score -= 0.2;
      reasons.push("passividade reduz exposição social");
    }
    return { episode, score, rationale: reasons.join("; ") || "sem evidência forte" };
  });

  const value = clamp01(0.4 + average(contributions.map((item) => item.score)));
  const refs = pickSupportAndContradiction(contributions, episodes);
  return {
    value,
    confidence: baseDimensionConfidence({
      episodeCount: episodes.length,
      averageConfidence,
      evidenceCoverage,
      contributionStrength: average(contributions.map((item) => Math.abs(item.score))),
    }),
    supportingEpisodes: refs.supporting,
    contradictingEpisodes: refs.contradicting,
  };
}

function buildInitiativeProfile(episodes: BehaviorEpisode[], evidenceCoverage: number, averageConfidence: number): IdentitySnapshotDimension {
  if (!episodes.length) return buildNeutralDimension();
  const contributions: DimensionContribution[] = episodes.map((episode) => {
    let score = 0;
    let rationale = "equilíbrio entre iniciativa e resposta";
    if (episode.initiatedBy === "chip") {
      score = 0.4;
      rationale = "chip iniciou o episódio";
    } else if (episode.initiatedBy === "remote") {
      score = -0.3;
      rationale = "episódio dependeu de estímulo externo";
    }
    return { episode, score, rationale };
  });

  const chipInitiated = episodes.filter((episode) => episode.initiatedBy === "chip").length;
  const remoteInitiated = episodes.filter((episode) => episode.initiatedBy === "remote").length;
  const total = Math.max(episodes.length, 1);
  const value = clamp01(0.5 + (chipInitiated - remoteInitiated) / total / 2);
  const refs = pickSupportAndContradiction(contributions, episodes);

  return {
    value,
    confidence: baseDimensionConfidence({
      episodeCount: episodes.length,
      averageConfidence,
      evidenceCoverage,
      contributionStrength: average(contributions.map((item) => Math.abs(item.score))),
    }),
    supportingEpisodes: refs.supporting,
    contradictingEpisodes: refs.contradicting,
  };
}

function buildResponsiveness(episodes: BehaviorEpisode[], evidenceCoverage: number, averageConfidence: number): IdentitySnapshotDimension {
  if (!episodes.length) return buildNeutralDimension();
  const contributions: DimensionContribution[] = episodes.map((episode) => {
    let score = 0;
    const reasons: string[] = [];
    if (episode.responded) {
      score += 0.35;
      reasons.push("houve resposta dentro do episódio");
    }
    if (episode.responseDelayMinutes != null) {
      const fastness = 1 - Math.min(1, episode.responseDelayMinutes / 180);
      score += fastness * 0.35;
      reasons.push(`tempo de resposta de ${episode.responseDelayMinutes} min`);
    } else if (episode.result === "passive") {
      score -= 0.2;
      reasons.push("episódio sem resposta explícita");
    }
    return { episode, score, rationale: reasons.join("; ") || "sem evidência forte" };
  });

  const value = clamp01(average(contributions.map((item) => 0.5 + item.score / 2)));
  const refs = pickSupportAndContradiction(contributions, episodes);

  return {
    value,
    confidence: baseDimensionConfidence({
      episodeCount: episodes.length,
      averageConfidence,
      evidenceCoverage,
      contributionStrength: average(contributions.map((item) => Math.abs(item.score))),
    }),
    supportingEpisodes: refs.supporting,
    contradictingEpisodes: refs.contradicting,
  };
}

function buildDiversity(episodes: BehaviorEpisode[], evidenceCoverage: number, averageConfidence: number): IdentitySnapshotDimension {
  if (!episodes.length) return buildNeutralDimension();
  const allCatalogs = new Set(episodes.flatMap((episode) => episode.catalogs));
  const allOrigins = new Set(episodes.flatMap((episode) => episode.origins));
  const episodeTypes = new Set(episodes.map((episode) => episode.episodeType));
  const value = clamp01(
    Math.min(1, allCatalogs.size / 6) * 0.45 +
      Math.min(1, episodeTypes.size / 5) * 0.35 +
      Math.min(1, allOrigins.size / 4) * 0.2
  );

  const contributions: DimensionContribution[] = episodes.map((episode) => {
    const score =
      new Set(episode.catalogs).size * 0.12 +
      new Set(episode.origins).size * 0.08 +
      (episode.episodeType === "mixed" ? 0.15 : 0) -
      (episode.actionsCount === 1 ? 0.05 : 0);
    return {
      episode,
      score,
      rationale: score >= 0.15 ? "episódio aumenta diversidade observável" : "episódio contribui pouco para diversidade",
    };
  });

  const refs = pickSupportAndContradiction(contributions, episodes);

  return {
    value,
    confidence: baseDimensionConfidence({
      episodeCount: episodes.length,
      averageConfidence,
      evidenceCoverage,
      contributionStrength: average(contributions.map((item) => Math.abs(item.score))),
    }),
    supportingEpisodes: refs.supporting,
    contradictingEpisodes: refs.contradicting,
  };
}

function buildPredictability(episodes: BehaviorEpisode[], evidenceCoverage: number, averageConfidence: number): IdentitySnapshotDimension {
  if (!episodes.length) return buildNeutralDimension();
  const episodeTypeCounts = episodes.reduce<Record<string, number>>((acc, episode) => {
    acc[episode.episodeType] = (acc[episode.episodeType] ?? 0) + 1;
    return acc;
  }, {});
  const dominantTypeCount = Math.max(0, ...Object.values(episodeTypeCounts));
  const predictabilityBase = episodes.length === 0 ? 0 : dominantTypeCount / episodes.length;

  const contributions: DimensionContribution[] = episodes.map((episode) => {
    const sameTypeDensity = episodeTypeCounts[episode.episodeType] / Math.max(episodes.length, 1);
    const repeatedWindow = episode.actionsCount === 1 ? 0.18 : -0.05;
    const score = sameTypeDensity * 0.5 + repeatedWindow - (episode.episodeType === "mixed" ? 0.1 : 0);
    return {
      episode,
      score,
      rationale:
        score > 0.2
          ? "episódio reforça padrão repetido"
          : "episódio reduz previsibilidade por variar o repertório",
    };
  });

  const refs = pickSupportAndContradiction(contributions, episodes);

  return {
    value: clamp01(predictabilityBase),
    confidence: baseDimensionConfidence({
      episodeCount: episodes.length,
      averageConfidence,
      evidenceCoverage,
      contributionStrength: average(contributions.map((item) => Math.abs(item.score))),
    }),
    supportingEpisodes: refs.supporting,
    contradictingEpisodes: refs.contradicting,
  };
}

function computeDrift(
  currentDimensions: Record<IdentitySnapshotDimensionName, IdentitySnapshotDimension>,
  previous?: IdentitySnapshot | null
) {
  if (!previous) return 0;
  const names = Object.keys(currentDimensions) as IdentitySnapshotDimensionName[];
  return clamp01(
    average(
      names.map((name) => Math.abs(currentDimensions[name].value - (previous.dimensions?.[name]?.value ?? currentDimensions[name].value)))
    )
  );
}

function computeStability(drift: number, previous?: IdentitySnapshot | null, averageConfidence = 0, coverage = 0) {
  if (!previous) {
    return clamp01(averageConfidence * 0.5 + (coverage / 100) * 0.3 + 0.2);
  }
  return clamp01(1 - drift * 0.85);
}

function computeMaturity(params: {
  coverage: number;
  confidence: number;
  stability: number;
  episodeCount: number;
}) {
  const episodeFactor = Math.min(1, params.episodeCount / 14);
  return clamp01(
    (params.coverage / 100) * 0.35 +
      params.confidence * 0.3 +
      params.stability * 0.2 +
      episodeFactor * 0.15
  );
}

function buildAggregateEpisodes(
  dimensions: Record<IdentitySnapshotDimensionName, IdentitySnapshotDimension>,
  key: "supportingEpisodes" | "contradictingEpisodes"
) {
  const dedup = new Map<string, IdentitySnapshotEpisodeReference>();
  for (const dimension of Object.values(dimensions)) {
    for (const ref of dimension[key]) {
      const uniqueKey = `${ref.episodeIndex}:${ref.rationale}`;
      if (!dedup.has(uniqueKey)) {
        dedup.set(uniqueKey, ref);
      }
    }
  }
  return Array.from(dedup.values()).slice(0, 6);
}

export function generateIdentitySnapshot(input: IdentitySnapshotInput): IdentitySnapshot {
  const coverage = input.evidenceCoverage?.evidenceCoverage ?? 0;
  const dimensions: Record<IdentitySnapshotDimensionName, IdentitySnapshotDimension> = {
    communicationStyle: buildCommunicationStyle(input.episodes, coverage, input.averageConfidence),
    activityRhythm: buildActivityRhythm(input.episodes, coverage, input.averageConfidence),
    socialExposure: buildSocialExposure(input.episodes, coverage, input.averageConfidence),
    initiativeProfile: buildInitiativeProfile(input.episodes, coverage, input.averageConfidence),
    responsiveness: buildResponsiveness(input.episodes, coverage, input.averageConfidence),
    diversity: buildDiversity(input.episodes, coverage, input.averageConfidence),
    predictability: buildPredictability(input.episodes, coverage, input.averageConfidence),
  };

  const confidence = clamp01(average(Object.values(dimensions).map((dimension) => dimension.confidence)));
  const drift = computeDrift(dimensions, input.previousIdentitySnapshot);
  const stability = computeStability(drift, input.previousIdentitySnapshot, input.averageConfidence, coverage);
  const maturity = computeMaturity({
    coverage,
    confidence,
    stability,
    episodeCount: input.episodes.length,
  });

  return {
    generatedAt: input.generatedAt ?? new Date(),
    confidence,
    stability,
    evidenceCoverage: coverage,
    maturity,
    drift,
    readOnly: true,
    dimensions,
    supportingEpisodes: buildAggregateEpisodes(dimensions, "supportingEpisodes"),
    contradictingEpisodes: buildAggregateEpisodes(dimensions, "contradictingEpisodes"),
    pipelineVersions: input.pipelineVersions,
    gating: {
      coverageReady: coverage > 70,
      confidenceReady: confidence > 0.85,
      stabilityReady: stability > 0.8,
      maturityReady: maturity > 0.75,
      driftReady: drift < 0.15,
      readyForStrategy: coverage > 70 && confidence > 0.85 && stability > 0.8 && maturity > 0.75 && drift < 0.15,
    },
  };
}
