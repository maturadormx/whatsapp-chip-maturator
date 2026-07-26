import type { IdentitySnapshot } from "./behaviorMemoryService";
import type { BehaviorEpisode } from "./episodeBuilderService";
import type { RawBehaviorEvent } from "./evidenceNormalizerService";

type Severity = "low" | "attention" | "high" | "critical";

export type AntiPatternSignal = {
  pattern: string;
  severity: Severity;
  confidence: number;
  riskImpact: number;
  recommendation: string;
  explanation: string;
  weights: Array<{ label: string; weight: number }>;
  evidence: string[];
  observedOccurrences?: number | null;
  restrictionCorrelation?: number | null;
  banCorrelation?: number | null;
  falsePositiveRate?: number | null;
};

export type AntiPatternReport = {
  findings: AntiPatternSignal[];
  summary: {
    total: number;
    critical: number;
    high: number;
    attention: number;
    low: number;
    overallRisk: number;
  };
};

export type BehaviorVarianceScore = {
  score: number;
  status: "stable" | "attention" | "predictable";
  components: {
    timeVariance: number;
    responseVariance: number;
    mediaVariance: number;
    contactVariance: number;
    groupVariance: number;
    pauseVariance: number;
  };
};

export type PersonaDiversityIndex = {
  score: number;
  activeChannels: string[];
  channelDistribution: Record<string, number>;
  summary: string;
};

export type SocialGraphHealth = {
  score: number;
  activeContacts: number;
  recurringContacts: number;
  newContacts: number;
  activeGroups: number;
  reciprocityRate: number;
  distributionBalance: number;
};

export type CredibilityTrendWindow = {
  windowDays: 7 | 15 | 30 | 90;
  sampleSize: number;
  credibility: { current: number | null; previous: number | null; delta: number | null; direction: "up" | "down" | "stable" };
  risk: { current: number | null; previous: number | null; delta: number | null; direction: "up" | "down" | "stable" };
  diversity: { current: number | null; previous: number | null; delta: number | null; direction: "up" | "down" | "stable" };
  naturality: { current: number | null; previous: number | null; delta: number | null; direction: "up" | "down" | "stable" };
};

export type IdentityDriftTimelineEntry = {
  observedAt: string;
  drift: number | null;
  communicationStyle: number | null;
  socialExposure: number | null;
  responsiveness: number | null;
  diversity: number | null;
  predictability: number | null;
};

export type BehaviorObservabilitySnapshot = {
  antiPatterns: AntiPatternReport;
  behaviorVariance: BehaviorVarianceScore;
  personaDiversity: PersonaDiversityIndex;
  socialGraphHealth: SocialGraphHealth;
};

type HistorySnapshotLike = {
  windowEnd?: Date | string | null;
  createdAt?: Date | string | null;
  payload?: {
    averageConfidence?: number | null;
    pipelineHealth?: { score?: number | null } | null;
    identitySnapshot?: IdentitySnapshot | null;
    evidenceCoverage?: { evidenceCoverage?: number | null } | null;
    extra?: {
      observability?: Partial<BehaviorObservabilitySnapshot> | null;
    } | null;
  } | null;
};

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function toDate(value?: Date | string | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function mean(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function std(values: number[]) {
  if (values.length <= 1) return 0;
  const avg = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - avg) ** 2)));
}

function normalizedEntropy(values: number[]) {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total <= 0 || values.filter((value) => value > 0).length <= 1) return 0;

  const probabilities = values.filter((value) => value > 0).map((value) => value / total);
  const entropy = -probabilities.reduce((sum, probability) => sum + probability * Math.log2(probability), 0);
  const maxEntropy = Math.log2(probabilities.length);

  return maxEntropy === 0 ? 0 : round((entropy / maxEntropy) * 100);
}

function severityFromRisk(riskImpact: number): Severity {
  if (riskImpact >= 0.85) return "critical";
  if (riskImpact >= 0.65) return "high";
  if (riskImpact >= 0.4) return "attention";
  return "low";
}

function buildSignal(params: {
  pattern: string;
  confidence: number;
  riskImpact: number;
  recommendation: string;
  explanation: string;
  weights: Array<{ label: string; weight: number }>;
  evidence: string[];
}): AntiPatternSignal {
  return {
    pattern: params.pattern,
    severity: severityFromRisk(params.riskImpact),
    confidence: round(clamp(params.confidence, 0, 1), 2),
    riskImpact: round(clamp(params.riskImpact, 0, 1), 2),
    recommendation: params.recommendation,
    explanation: params.explanation,
    weights: params.weights,
    evidence: params.evidence,
    observedOccurrences: null,
    restrictionCorrelation: null,
    banCorrelation: null,
    falsePositiveRate: null,
  };
}

function groupKey(event: RawBehaviorEvent) {
  return event.remoteJid ?? event.groupJid ?? "__none__";
}

function extractOutgoingContacts(rawEvents: RawBehaviorEvent[]) {
  return rawEvents.filter((event) => event.direction === "outbound" && !!event.remoteJid).map((event) => String(event.remoteJid));
}

function extractReplyDelays(rawEvents: RawBehaviorEvent[]) {
  const ordered = [...rawEvents]
    .filter((event) => event.occurredAt)
    .sort((left, right) => new Date(left.occurredAt!).getTime() - new Date(right.occurredAt!).getTime());

  const lastInboundByConversation = new Map<string, Date>();
  const delaysMinutes: number[] = [];

  for (const event of ordered) {
    const occurredAt = toDate(event.occurredAt);
    if (!occurredAt) continue;
    const conversation = groupKey(event);
    if (event.direction === "inbound") {
      lastInboundByConversation.set(conversation, occurredAt);
      continue;
    }
    if (event.direction === "outbound") {
      const lastInbound = lastInboundByConversation.get(conversation);
      if (lastInbound) {
        const delayMinutes = Math.max(0, (occurredAt.getTime() - lastInbound.getTime()) / 60000);
        if (delayMinutes <= 360) {
          delaysMinutes.push(round(delayMinutes, 1));
        }
      }
    }
  }

  return delaysMinutes;
}

function detectRepeatedSequence(episodes: BehaviorEpisode[]) {
  const counts = new Map<string, number>();
  for (const episode of episodes) {
    const signature = `${episode.episodeType}|${episode.catalogs.join("+")}|${episode.result}|${episode.initiatedBy}`;
    counts.set(signature, (counts.get(signature) ?? 0) + 1);
  }

  const ranked = Array.from(counts.entries()).sort((left, right) => right[1] - left[1]);
  const [signature, repeats] = ranked[0] ?? [null, 0];
  const share = episodes.length ? repeats / episodes.length : 0;

  if (!signature || repeats < 3 || share < 0.45) return null;

  return buildSignal({
    pattern: "repeated_episode_sequence",
    confidence: clamp(0.55 + share * 0.4, 0, 0.99),
    riskImpact: clamp(0.45 + share * 0.5, 0, 0.99),
    recommendation: "Introduzir variação de tipos de episódio, origem e ordem de ações antes de manter o mesmo repertório.",
    explanation: "o mesmo arranjo de episódio apareceu com frequência alta demais para a janela observada",
    weights: [
      { label: "share_da_assinatura", weight: round(share, 2) },
      { label: "repeticoes_absolutas", weight: repeats },
    ],
    evidence: [`assinatura repetida ${repeats}x`, `share ${round(share * 100)}%`, signature],
  });
}

function detectFixedResponseTime(rawEvents: RawBehaviorEvent[]) {
  const delays = extractReplyDelays(rawEvents).filter((value) => value <= 30);
  if (delays.length < 3) return null;

  const counts = new Map<string, number>();
  for (const delay of delays) {
    const bucket = String(delay);
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
  }

  const [delay, repeats] = Array.from(counts.entries()).sort((left, right) => right[1] - left[1])[0] ?? [null, 0];
  const share = delays.length ? repeats / delays.length : 0;

  if (!delay || repeats < 3 || share < 0.7) return null;

  return buildSignal({
    pattern: "fixed_response_time",
    confidence: clamp(0.6 + share * 0.35, 0, 0.99),
    riskImpact: clamp(0.5 + share * 0.45, 0, 0.99),
    recommendation: "Adicionar jitter real de tempo de resposta e permitir pausas maiores quando o contexto estiver raso.",
    explanation: "as respostas recentes convergiram para o mesmo delay, reduzindo naturalidade temporal",
    weights: [
      { label: "share_do_delay", weight: round(share, 2) },
      { label: "repeticoes", weight: repeats },
    ],
    evidence: [`delay dominante ${delay} min`, `repetido ${repeats}x`, `share ${round(share * 100)}%`],
  });
}

function detectExactSchedule(rawEvents: RawBehaviorEvent[]) {
  const outgoingTimes = rawEvents
    .filter((event) => event.direction === "outbound" && event.occurredAt)
    .map((event) => {
      const date = toDate(event.occurredAt);
      if (!date) return null;
      return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
    })
    .filter((value): value is string => Boolean(value));

  if (outgoingTimes.length < 3) return null;

  const counts = new Map<string, number>();
  for (const time of outgoingTimes) {
    counts.set(time, (counts.get(time) ?? 0) + 1);
  }

  const [time, repeats] = Array.from(counts.entries()).sort((left, right) => right[1] - left[1])[0] ?? [null, 0];
  const share = outgoingTimes.length ? repeats / outgoingTimes.length : 0;

  if (!time || repeats < 3 || share < 0.6) return null;

  return buildSignal({
    pattern: "exact_schedule_repetition",
    confidence: clamp(0.58 + share * 0.35, 0, 0.99),
    riskImpact: clamp(0.48 + share * 0.4, 0, 0.99),
    recommendation: "Quebrar a concentração em horário exato e distribuir a janela de envio com variância orgânica.",
    explanation: "o horário outbound ficou excessivamente concentrado no mesmo minuto do relógio",
    weights: [
      { label: "share_do_horario", weight: round(share, 2) },
      { label: "repeticoes", weight: repeats },
    ],
    evidence: [`horário dominante ${time}`, `repetido ${repeats}x`, `share ${round(share * 100)}%`],
  });
}

function detectImmediateGroupSpeech(rawEvents: RawBehaviorEvent[]) {
  const ordered = [...rawEvents]
    .filter((event) => event.occurredAt)
    .sort((left, right) => new Date(left.occurredAt!).getTime() - new Date(right.occurredAt!).getTime());

  let hits = 0;
  for (let index = 0; index < ordered.length; index++) {
    const event = ordered[index];
    if (event.eventType !== "group_joined" || !event.groupJid) continue;
    const joinedAt = toDate(event.occurredAt);
    if (!joinedAt) continue;
    const followUp = ordered.find((candidate, candidateIndex) => {
      if (candidateIndex <= index) return false;
      if (candidate.groupJid !== event.groupJid) return false;
      if (candidate.direction !== "outbound") return false;
      const candidateAt = toDate(candidate.occurredAt);
      if (!candidateAt) return false;
      return candidateAt.getTime() - joinedAt.getTime() <= 5 * 60 * 1000;
    });
    if (followUp) hits += 1;
  }

  if (hits === 0) return null;

  const share = hits / Math.max(1, ordered.filter((event) => event.eventType === "group_joined").length);

  return buildSignal({
    pattern: "immediate_group_speech",
    confidence: clamp(0.62 + share * 0.3, 0, 0.99),
    riskImpact: clamp(0.55 + share * 0.35, 0, 0.99),
    recommendation: "Inserir fase de observação antes de falar em grupo recém-entrado e privilegiar leitura passiva primeiro.",
    explanation: "o chip falou logo após entrar em grupo, sem fase de observação suficiente",
    weights: [
      { label: "share_de_grupos_com_fala_imediata", weight: round(share, 2) },
      { label: "ocorrencias", weight: hits },
    ],
    evidence: [`ocorrências ${hits}`, `share ${round(share * 100)}%`],
  });
}

function detectOnlyNewContacts(rawEvents: RawBehaviorEvent[]) {
  const outgoingContacts = extractOutgoingContacts(rawEvents);
  if (outgoingContacts.length < 4) return null;

  const counts = outgoingContacts.reduce<Record<string, number>>((acc, contact) => {
    acc[contact] = (acc[contact] ?? 0) + 1;
    return acc;
  }, {});

  const uniqueOnce = Object.values(counts).filter((count) => count === 1).length;
  const share = Object.keys(counts).length ? uniqueOnce / Object.keys(counts).length : 0;

  if (Object.keys(counts).length < 4 || share < 0.8) return null;

  return buildSignal({
    pattern: "only_new_contacts",
    confidence: clamp(0.57 + share * 0.3, 0, 0.99),
    riskImpact: clamp(0.55 + share * 0.35, 0, 0.99),
    recommendation: "Reforçar recorrência e reciprocidade antes de continuar expandindo contatos únicos.",
    explanation: "os contatos outbound recentes não estão virando recorrência, só expansão",
    weights: [
      { label: "share_sem_recorrencia", weight: round(share, 2) },
      { label: "contatos_unicos", weight: Object.keys(counts).length },
    ],
    evidence: [`contatos únicos ${Object.keys(counts).length}`, `contatos sem recorrência ${uniqueOnce}`, `share ${round(share * 100)}%`],
  });
}

function detectExcessMedia(rawEvents: RawBehaviorEvent[]) {
  const mediaEvents = rawEvents.filter((event) => /(image|audio|video|media|document)/i.test(event.eventType));
  if (!mediaEvents.length) return null;
  const share = mediaEvents.length / Math.max(1, rawEvents.length);
  if (share < 0.35) return null;

  return buildSignal({
    pattern: "excess_media_usage",
    confidence: clamp(0.55 + share * 0.35, 0, 0.99),
    riskImpact: clamp(0.4 + share * 0.4, 0, 0.99),
    recommendation: "Alternar mídias com leitura, status, grupos e DM textual para evitar repertório monotemático.",
    explanation: "o repertório recente concentrou mídia demais em relação ao restante da atividade",
    weights: [
      { label: "share_de_midias", weight: round(share, 2) },
      { label: "total_midias", weight: mediaEvents.length },
    ],
    evidence: [`mídias ${mediaEvents.length}/${rawEvents.length}`, `share ${round(share * 100)}%`],
  });
}

function detectExcessLinks(rawEvents: RawBehaviorEvent[]) {
  const linkRegex = /https?:\/\/|www\./i;
  const linkEvents = rawEvents.filter(
    (event) =>
      linkRegex.test(event.contentPreview ?? "") ||
      linkRegex.test(JSON.stringify(event.payload ?? {}))
  );

  if (!linkEvents.length) return null;
  const share = linkEvents.length / Math.max(1, rawEvents.filter((event) => event.direction === "outbound").length || 1);
  if (share < 0.3) return null;

  return buildSignal({
    pattern: "excess_links",
    confidence: clamp(0.58 + share * 0.3, 0, 0.99),
    riskImpact: clamp(0.48 + share * 0.35, 0, 0.99),
    recommendation: "Reduzir volume de links por janela e misturar com interações sem URL.",
    explanation: "links demais em outbound aumentam a legibilidade de padrão promocional ou automatizado",
    weights: [
      { label: "share_de_links", weight: round(share, 2) },
      { label: "total_links", weight: linkEvents.length },
    ],
    evidence: [`links detectados ${linkEvents.length}`, `share sobre outbound ${round(share * 100)}%`],
  });
}

function detectExcessUniqueContacts(rawEvents: RawBehaviorEvent[]) {
  const outgoingContacts = extractOutgoingContacts(rawEvents);
  if (outgoingContacts.length < 5) return null;
  const uniqueContacts = new Set(outgoingContacts).size;
  const share = uniqueContacts / outgoingContacts.length;
  if (share < 0.8) return null;

  return buildSignal({
    pattern: "excess_unique_contacts",
    confidence: clamp(0.56 + share * 0.3, 0, 0.99),
    riskImpact: clamp(0.5 + share * 0.35, 0, 0.99),
    recommendation: "Trocar expansão agressiva por aprofundamento de relações já abertas.",
    explanation: "o outbound está distribuído em contatos únicos demais e pouco aprofundados",
    weights: [
      { label: "share_contatos_unicos", weight: round(share, 2) },
      { label: "contatos_unicos", weight: uniqueContacts },
    ],
    evidence: [`contatos únicos ${uniqueContacts}`, `outbound ${outgoingContacts.length}`, `share ${round(share * 100)}%`],
  });
}

export function detectAntiPatterns(params: {
  rawEvents: RawBehaviorEvent[];
  episodes: BehaviorEpisode[];
}): AntiPatternReport {
  const findings = [
    detectRepeatedSequence(params.episodes),
    detectFixedResponseTime(params.rawEvents),
    detectExactSchedule(params.rawEvents),
    detectImmediateGroupSpeech(params.rawEvents),
    detectOnlyNewContacts(params.rawEvents),
    detectExcessMedia(params.rawEvents),
    detectExcessLinks(params.rawEvents),
    detectExcessUniqueContacts(params.rawEvents),
  ]
    .filter((item): item is AntiPatternSignal => Boolean(item))
    .sort((left, right) => right.riskImpact - left.riskImpact);

  return {
    findings,
    summary: {
      total: findings.length,
      critical: findings.filter((item) => item.severity === "critical").length,
      high: findings.filter((item) => item.severity === "high").length,
      attention: findings.filter((item) => item.severity === "attention").length,
      low: findings.filter((item) => item.severity === "low").length,
      overallRisk: round(mean(findings.map((item) => item.riskImpact)) || 0, 2),
    },
  };
}

function timeVariance(rawEvents: RawBehaviorEvent[]) {
  const buckets = new Array(24).fill(0);
  for (const event of rawEvents) {
    const date = toDate(event.occurredAt);
    if (!date) continue;
    buckets[date.getHours()] += 1;
  }
  return normalizedEntropy(buckets);
}

function responseVariance(rawEvents: RawBehaviorEvent[]) {
  const delays = extractReplyDelays(rawEvents);
  if (delays.length <= 1) return delays.length ? 20 : 0;
  return round(clamp((std(delays) / 30) * 100, 0, 100));
}

function mediaVariance(rawEvents: RawBehaviorEvent[]) {
  const categories = {
    text: 0,
    image: 0,
    audio: 0,
    video: 0,
    link: 0,
    other: 0,
  };

  for (const event of rawEvents.filter((item) => item.direction === "outbound")) {
    const type = event.eventType.toLowerCase();
    if (type.includes("image")) categories.image += 1;
    else if (type.includes("audio")) categories.audio += 1;
    else if (type.includes("video")) categories.video += 1;
    else if (/https?:\/\/|www\./i.test(event.contentPreview ?? "") || /https?:\/\/|www\./i.test(JSON.stringify(event.payload ?? {}))) categories.link += 1;
    else if (type.includes("message")) categories.text += 1;
    else categories.other += 1;
  }

  return normalizedEntropy(Object.values(categories));
}

function contactVariance(rawEvents: RawBehaviorEvent[]) {
  const contactCounts = rawEvents
    .filter((event) => !!event.remoteJid)
    .reduce<Record<string, number>>((acc, event) => {
      acc[String(event.remoteJid)] = (acc[String(event.remoteJid)] ?? 0) + 1;
      return acc;
    }, {});

  return normalizedEntropy(Object.values(contactCounts));
}

function groupVariance(rawEvents: RawBehaviorEvent[]) {
  const groupCounts = rawEvents
    .filter((event) => !!event.groupJid)
    .reduce<Record<string, number>>((acc, event) => {
      acc[String(event.groupJid)] = (acc[String(event.groupJid)] ?? 0) + 1;
      return acc;
    }, {});

  return normalizedEntropy(Object.values(groupCounts));
}

function pauseVariance(rawEvents: RawBehaviorEvent[]) {
  const ordered = [...rawEvents]
    .filter((event) => event.occurredAt)
    .sort((left, right) => new Date(left.occurredAt!).getTime() - new Date(right.occurredAt!).getTime());

  if (ordered.length <= 2) return 0;

  const gaps: number[] = [];
  for (let index = 1; index < ordered.length; index++) {
    const previous = toDate(ordered[index - 1].occurredAt);
    const current = toDate(ordered[index].occurredAt);
    if (!previous || !current) continue;
    gaps.push(Math.max(0, (current.getTime() - previous.getTime()) / 60000));
  }

  if (gaps.length <= 1) return 0;
  return round(clamp((std(gaps) / 120) * 100, 0, 100));
}

export function calculateBehaviorVarianceScore(rawEvents: RawBehaviorEvent[]): BehaviorVarianceScore {
  const components = {
    timeVariance: timeVariance(rawEvents),
    responseVariance: responseVariance(rawEvents),
    mediaVariance: mediaVariance(rawEvents),
    contactVariance: contactVariance(rawEvents),
    groupVariance: groupVariance(rawEvents),
    pauseVariance: pauseVariance(rawEvents),
  };

  const score = round(
    components.timeVariance * 0.2 +
      components.responseVariance * 0.15 +
      components.mediaVariance * 0.1 +
      components.contactVariance * 0.25 +
      components.groupVariance * 0.1 +
      components.pauseVariance * 0.2
  );

  return {
    score,
    status: score >= 65 ? "stable" : score >= 40 ? "attention" : "predictable",
    components,
  };
}

export function calculatePersonaDiversityIndex(rawEvents: RawBehaviorEvent[]): PersonaDiversityIndex {
  const channels: Record<string, number> = {
    Status: 0,
    Grupos: 0,
    DM: 0,
    Fotos: 0,
    Áudios: 0,
    Reações: 0,
    Chamadas: 0,
    Listas: 0,
    Comunidades: 0,
  };

  for (const event of rawEvents) {
    const type = event.eventType.toLowerCase();
    if (type.includes("status")) channels.Status += 1;
    if (type.includes("group") || event.groupJid) channels.Grupos += 1;
    if (event.remoteJid && !event.groupJid) channels.DM += 1;
    if (type.includes("image") || type.includes("photo")) channels.Fotos += 1;
    if (type.includes("audio")) channels.Áudios += 1;
    if (type.includes("reaction")) channels.Reações += 1;
    if (type.includes("call")) channels.Chamadas += 1;
    if (type.includes("list")) channels.Listas += 1;
    if (type.includes("community")) channels.Comunidades += 1;
  }

  const activeChannels = Object.entries(channels)
    .filter(([, count]) => count > 0)
    .map(([channel]) => channel);

  const coverage = (activeChannels.length / Object.keys(channels).length) * 100;
  const balance = normalizedEntropy(Object.values(channels));
  const score = round(coverage * 0.6 + balance * 0.4);

  return {
    score,
    activeChannels,
    channelDistribution: channels,
    summary:
      activeChannels.length === 0
        ? "sem sinais suficientes de diversidade"
        : `${activeChannels.length} canais ativos com distribuição ${score >= 60 ? "saudável" : "concentrada"}`,
  };
}

export function calculateSocialGraphHealth(rawEvents: RawBehaviorEvent[]): SocialGraphHealth {
  const contactInteractions = rawEvents
    .filter((event) => !!event.remoteJid && !event.groupJid)
    .reduce<Record<string, { total: number; inbound: number; outbound: number }>>((acc, event) => {
      const key = String(event.remoteJid);
      acc[key] = acc[key] ?? { total: 0, inbound: 0, outbound: 0 };
      acc[key].total += 1;
      if (event.direction === "inbound") acc[key].inbound += 1;
      if (event.direction === "outbound") acc[key].outbound += 1;
      return acc;
    }, {});

  const groupInteractions = new Set(rawEvents.filter((event) => !!event.groupJid).map((event) => String(event.groupJid)));
  const activeContacts = Object.keys(contactInteractions).length;
  const recurringContacts = Object.values(contactInteractions).filter((item) => item.total >= 2).length;
  const newContacts = Object.values(contactInteractions).filter((item) => item.total === 1).length;
  const reciprocalContacts = Object.values(contactInteractions).filter((item) => item.inbound > 0 && item.outbound > 0).length;
  const reciprocityRate = activeContacts ? round((reciprocalContacts / activeContacts) * 100) : 0;
  const distributionBalance = normalizedEntropy(Object.values(contactInteractions).map((item) => item.total));

  const score = round(
    Math.min(100, activeContacts * 8) * 0.2 +
      (activeContacts ? (recurringContacts / activeContacts) * 100 : 0) * 0.25 +
      reciprocityRate * 0.3 +
      Math.min(100, groupInteractions.size * 15) * 0.1 +
      distributionBalance * 0.15
  );

  return {
    score,
    activeContacts,
    recurringContacts,
    newContacts,
    activeGroups: groupInteractions.size,
    reciprocityRate,
    distributionBalance,
  };
}

export function buildBehaviorObservabilitySnapshot(params: {
  rawEvents: RawBehaviorEvent[];
  episodes: BehaviorEpisode[];
}): BehaviorObservabilitySnapshot {
  return {
    antiPatterns: detectAntiPatterns(params),
    behaviorVariance: calculateBehaviorVarianceScore(params.rawEvents),
    personaDiversity: calculatePersonaDiversityIndex(params.rawEvents),
    socialGraphHealth: calculateSocialGraphHealth(params.rawEvents),
  };
}

function extractHistoricalObservability(snapshot: HistorySnapshotLike) {
  const extra = snapshot.payload?.extra as { observability?: Partial<BehaviorObservabilitySnapshot> | null } | null | undefined;
  return extra?.observability ?? null;
}

function deriveCredibilitySnapshot(snapshot: HistorySnapshotLike) {
  const observability = extractHistoricalObservability(snapshot);
  const identity = snapshot.payload?.identitySnapshot ?? null;
  const confidence = (snapshot.payload?.averageConfidence ?? 0) * 100;
  const coverage = snapshot.payload?.evidenceCoverage?.evidenceCoverage ?? 0;
  const pipelineHealth = snapshot.payload?.pipelineHealth?.score ?? 0;
  const diversity =
    observability?.personaDiversity?.score ??
    ((identity?.dimensions?.diversity?.value ?? 0) * 100);
  const naturality =
    observability?.behaviorVariance?.score ??
    ((1 - (identity?.dimensions?.predictability?.value ?? 0.5)) * 100);
  const risk =
    (observability?.antiPatterns?.summary?.overallRisk != null
      ? observability.antiPatterns.summary.overallRisk * 100
      : (identity?.dimensions?.predictability?.value ?? 0.5) * 100);
  const credibility = round(
    confidence * 0.2 +
      coverage * 0.15 +
      pipelineHealth * 0.2 +
      (identity?.stability ?? 0) * 100 * 0.15 +
      (identity?.maturity ?? 0) * 100 * 0.1 +
      diversity * 0.1 +
      naturality * 0.1
  );

  return {
    credibility,
    risk: round(risk),
    diversity: round(diversity),
    naturality: round(naturality),
    observedAt: toDate(snapshot.windowEnd) ?? toDate(snapshot.createdAt),
    drift: identity?.drift ?? null,
    identity,
  };
}

function deltaDirection(current: number | null, previous: number | null, invert = false) {
  if (current == null || previous == null) return { delta: null, direction: "stable" as const };
  const rawDelta = round(current - previous);
  if (Math.abs(rawDelta) < 1) return { delta: rawDelta, direction: "stable" as const };
  const positive = rawDelta > 0;
  return { delta: rawDelta, direction: (invert ? (positive ? "down" : "up") : positive ? "up" : "down") as "up" | "down" };
}

export function buildCredibilityTrend(params: {
  history: HistorySnapshotLike[];
  now?: Date;
}): CredibilityTrendWindow[] {
  const now = params.now ?? new Date();
  const history = params.history
    .map((snapshot) => deriveCredibilitySnapshot(snapshot))
    .filter((item) => item.observedAt)
    .sort((left, right) => left.observedAt!.getTime() - right.observedAt!.getTime());

  return [7, 15, 30, 90].map((windowDays) => {
    const windowStart = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);
    const points = history.filter((item) => item.observedAt! >= windowStart);
    const previous = points[0] ?? null;
    const current = points[points.length - 1] ?? null;
    const credibilityDelta = deltaDirection(current?.credibility ?? null, previous?.credibility ?? null);
    const riskDelta = deltaDirection(current?.risk ?? null, previous?.risk ?? null, true);
    const diversityDelta = deltaDirection(current?.diversity ?? null, previous?.diversity ?? null);
    const naturalityDelta = deltaDirection(current?.naturality ?? null, previous?.naturality ?? null);

    return {
      windowDays: windowDays as 7 | 15 | 30 | 90,
      sampleSize: points.length,
      credibility: {
        current: current?.credibility ?? null,
        previous: previous?.credibility ?? null,
        delta: credibilityDelta.delta,
        direction: credibilityDelta.direction,
      },
      risk: {
        current: current?.risk ?? null,
        previous: previous?.risk ?? null,
        delta: riskDelta.delta,
        direction: riskDelta.direction,
      },
      diversity: {
        current: current?.diversity ?? null,
        previous: previous?.diversity ?? null,
        delta: diversityDelta.delta,
        direction: diversityDelta.direction,
      },
      naturality: {
        current: current?.naturality ?? null,
        previous: previous?.naturality ?? null,
        delta: naturalityDelta.delta,
        direction: naturalityDelta.direction,
      },
    };
  });
}

export function buildIdentityDriftTimeline(params: {
  history: HistorySnapshotLike[];
  limit?: number;
}): IdentityDriftTimelineEntry[] {
  const ordered = params.history
    .map((snapshot) => deriveCredibilitySnapshot(snapshot))
    .filter((item) => item.observedAt && item.identity)
    .sort((left, right) => left.observedAt!.getTime() - right.observedAt!.getTime());

  return ordered.slice(-(params.limit ?? 12)).map((item) => ({
    observedAt: item.observedAt!.toISOString(),
    drift: item.drift,
    communicationStyle: item.identity?.dimensions.communicationStyle?.value ?? null,
    socialExposure: item.identity?.dimensions.socialExposure?.value ?? null,
    responsiveness: item.identity?.dimensions.responsiveness?.value ?? null,
    diversity: item.identity?.dimensions.diversity?.value ?? null,
    predictability: item.identity?.dimensions.predictability?.value ?? null,
  }));
}
