import {
  getChipById,
  getChipCertification,
  getChipCertificationState,
  getChipHealthSnapshot,
  getChipBehaviorScore,
  getUserChips,
  listBehaviorTimelineEvents,
  listCertifiedChips,
  searchUserActivityLogs,
  upsertChipBehaviorScore,
  upsertChipCertification,
  upsertChipHealth,
} from "../db";
import { refreshChipCertification } from "./certification/CertificationEngine";
import { getChipHealth } from "./whatsappService";

type CertificationStatus = "NOVO" | "EM_MATURACAO" | "EM_OBSERVACAO" | "APROVADO" | "RESTRITO" | "REPROVADO";
type RuntimeHealth = Awaited<ReturnType<typeof getChipHealth>>;

type TimelineMetrics = {
  totalEvents: number;
  sessionConnectedCount: number;
  contactsSyncedCount: number;
  profileUpdatedCount: number;
  statusViewedCount: number;
  chatListOpenedCount: number;
  sentCount: number;
  acknowledgedCount: number;
  receivedCount: number;
  groupJoinCount: number;
  groupOpenCount: number;
  participantsLoadedCount: number;
  readCount: number;
  distinctConversations: number;
  distinctGroupsVisited: number;
  activeMinutes: number;
  idleMinutes: number;
  lastEventAt: string | null;
  lastEventType: string | null;
};

type HealthSnapshot = {
  healthScore: number;
  reconnectCount: number;
  disconnectCount: number;
  lastDisconnect: Date | null;
  sessionAge: number;
  lastReceive: Date | null;
  lastSend: Date | null;
};

type EvidenceCoverageSnapshot = {
  evidenceCoverage: number;
  messages: number;
  status: number;
  groups: number;
  profile: number;
  passivity: number;
  presence: number;
  coveredSignals: string[];
  missingSignals: string[];
};

type ChipRecord = NonNullable<Awaited<ReturnType<typeof getChipById>>>;

export type OperationalCertificationDecision = {
  status: CertificationStatus;
  usable: boolean;
  reason: string;
};

export type OperationalStateSnapshot = {
  userId: number;
  chipId: number;
  chipName: string;
  connected: boolean;
  phoneNumber: string | null;
  status: string;
  lastActivity: Date | null;
  lastEventAt: string | null;
  lastEventType: string | null;
  metrics: TimelineMetrics;
  health: HealthSnapshot;
  scores: {
    humanScore: number;
    riskScore: number;
    evidenceQuality: number;
    evidenceNaturalness: number;
    evidenceDiversity: number;
    evidenceConsistency: number;
    evidenceSocialPresence: number;
  };
  coverage: EvidenceCoverageSnapshot;
  certification: OperationalCertificationDecision;
  phaseStartedAt: string;
  connectedMinutes: number;
  certificationChanged: boolean;
  approvedAtToPersist: Date | null;
};

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function toDate(value?: string | Date | null) {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
}

export function computeTimelineMetrics(events: any[], dateFrom: Date, dateTo: Date): TimelineMetrics {
  const sorted = [...events].sort(
    (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()
  );
  const conversationSet = new Set<string>();
  const groupSet = new Set<string>();

  let sessionConnectedCount = 0;
  let contactsSyncedCount = 0;
  let profileUpdatedCount = 0;
  let statusViewedCount = 0;
  let chatListOpenedCount = 0;
  let sentCount = 0;
  let acknowledgedCount = 0;
  let receivedCount = 0;
  let groupJoinCount = 0;
  let groupOpenCount = 0;
  let participantsLoadedCount = 0;
  let readCount = 0;
  let activeMinutes = 0;

  for (let index = 0; index < sorted.length; index++) {
    const event = sorted[index];
    const occurredAt = new Date(event.occurredAt);
    const next = sorted[index + 1];
    const conversationKey = event.groupJid || event.remoteJid;
    if (conversationKey) {
      conversationSet.add(String(conversationKey));
    }
    if (event.groupJid) {
      groupSet.add(String(event.groupJid));
    }

    switch (event.eventType) {
      case "session_connected":
        sessionConnectedCount += 1;
        break;
      case "contacts_synced":
        contactsSyncedCount += 1;
        break;
      case "profile_name_updated":
      case "profile_photo_updated":
      case "about_updated":
        profileUpdatedCount += 1;
        break;
      case "status_viewed":
        statusViewedCount += 1;
        break;
      case "chat_list_opened":
        chatListOpenedCount += 1;
        break;
      case "message_sent":
        sentCount += 1;
        break;
      case "message_acknowledged":
        acknowledgedCount += 1;
        break;
      case "message_received":
        receivedCount += 1;
        break;
      case "group_joined":
        groupJoinCount += 1;
        break;
      case "group_opened":
        groupOpenCount += 1;
        break;
      case "participants_loaded":
        participantsLoadedCount += 1;
        break;
      case "messages_read":
        readCount += 1;
        break;
    }

    const nextAt = next ? new Date(next.occurredAt) : dateTo;
    const gapMinutes = Math.max(0, (nextAt.getTime() - occurredAt.getTime()) / 60000);
    activeMinutes += Math.min(gapMinutes, 10);
  }

  const periodMinutes = Math.max(0, Math.round((dateTo.getTime() - dateFrom.getTime()) / 60000));
  activeMinutes = Math.min(periodMinutes, Math.round(activeMinutes));
  const idleMinutes = Math.max(0, periodMinutes - activeMinutes);
  const lastEvent = sorted[sorted.length - 1];

  return {
    totalEvents: sorted.length,
    sessionConnectedCount,
    contactsSyncedCount,
    profileUpdatedCount,
    statusViewedCount,
    chatListOpenedCount,
    sentCount,
    acknowledgedCount,
    receivedCount,
    groupJoinCount,
    groupOpenCount,
    participantsLoadedCount,
    readCount,
    distinctConversations: conversationSet.size,
    distinctGroupsVisited: groupSet.size,
    activeMinutes,
    idleMinutes,
    lastEventAt: lastEvent?.occurredAt ? new Date(lastEvent.occurredAt).toISOString() : null,
    lastEventType: lastEvent?.eventType ?? null,
  };
}

export function computeHumanScore(metrics: TimelineMetrics) {
  let score = 0;

  if (metrics.sentCount > 0) score += 18;
  if (metrics.receivedCount > 0) score += 24;
  if (metrics.sessionConnectedCount > 0) score += 8;
  if (metrics.contactsSyncedCount > 0) score += 6;
  if (metrics.profileUpdatedCount > 0) score += 8;
  if (metrics.chatListOpenedCount > 0) score += 6;
  if (metrics.statusViewedCount > 0) score += 8;
  if (metrics.acknowledgedCount > 0) score += 8;
  if (metrics.distinctConversations >= 2) score += 18;
  else if (metrics.distinctConversations === 1) score += 8;
  if (metrics.groupJoinCount > 0) score += 12;
  if (metrics.groupOpenCount > 0) score += 10;
  if (metrics.participantsLoadedCount > 0) score += 6;
  if (metrics.readCount > 0) score += 8;
  if (metrics.activeMinutes >= 30) score += 12;
  else if (metrics.activeMinutes >= 10) score += 6;
  if (metrics.idleMinutes > 0 && metrics.activeMinutes > 0) score += 10;

  return clampScore(score);
}

export function computeRiskScore(metrics: TimelineMetrics, healthSnapshot: HealthSnapshot) {
  let score = 0;

  if (metrics.sentCount >= 10 && metrics.receivedCount === 0) score += 35;
  else if (metrics.sentCount > 0 && metrics.receivedCount === 0) score += 20;

  if (metrics.distinctConversations <= 1 && metrics.sentCount >= 5) score += 15;
  if (metrics.sentCount >= 10 && metrics.sentCount > Math.max(1, metrics.receivedCount) * 5) score += 15;
  if ((healthSnapshot?.reconnectCount ?? 0) >= 3) score += 15;
  if ((healthSnapshot?.disconnectCount ?? 0) >= 3) score += 10;
  if ((healthSnapshot?.healthScore ?? 100) < 60) score += 10;
  if (metrics.activeMinutes > 0 && metrics.idleMinutes === 0) score += 10;

  return clampScore(score);
}

export function computeEvidenceQuality(metrics: TimelineMetrics) {
  const evidenceNaturalness = clampScore(
    (metrics.activeMinutes >= 20 ? 30 : metrics.activeMinutes) +
      (metrics.idleMinutes >= 20 ? 20 : Math.round(metrics.idleMinutes / 2)) +
      (metrics.receivedCount > 0 ? 20 : 0) +
      (metrics.statusViewedCount > 0 ? 15 : 0) +
      (metrics.readCount > 0 ? 15 : 0)
  );

  const evidenceDiversity = clampScore(
    Math.min(25, metrics.distinctConversations * 5) +
      Math.min(20, metrics.distinctGroupsVisited * 5) +
      (metrics.statusViewedCount > 0 ? 15 : 0) +
      (metrics.readCount > 0 ? 15 : 0) +
      (metrics.groupJoinCount > 0 || metrics.groupOpenCount > 0 ? 15 : 0) +
      (metrics.profileUpdatedCount > 0 ? 10 : 0)
  );

  const evidenceConsistency = clampScore(
    (metrics.totalEvents >= 4 ? 35 : metrics.totalEvents * 8) +
      (metrics.sessionConnectedCount > 0 ? 20 : 0) +
      (metrics.contactsSyncedCount > 0 ? 10 : 0) +
      (metrics.activeMinutes >= 30 ? 20 : 0) +
      (metrics.idleMinutes >= 30 ? 15 : 0)
  );

  const evidenceSocialPresence = clampScore(
    Math.min(30, metrics.receivedCount * 12) +
      Math.min(20, metrics.sentCount * 8) +
      Math.min(20, metrics.distinctConversations * 5) +
      (metrics.statusViewedCount > 0 ? 10 : 0) +
      (metrics.groupJoinCount > 0 || metrics.groupOpenCount > 0 ? 10 : 0) +
      (metrics.readCount > 0 ? 10 : 0)
  );

  const evidenceQuality = clampScore(
    Math.round(
      (evidenceNaturalness + evidenceDiversity + evidenceConsistency + evidenceSocialPresence) / 4
    )
  );

  return {
    evidenceQuality,
    evidenceNaturalness,
    evidenceDiversity,
    evidenceConsistency,
    evidenceSocialPresence,
  };
}

export function computeEvidenceCoverage(metrics: TimelineMetrics): EvidenceCoverageSnapshot {
  const coverageBySignal = {
    messages: metrics.sentCount + metrics.receivedCount + metrics.acknowledgedCount + metrics.readCount,
    status: metrics.statusViewedCount,
    groups: metrics.groupJoinCount + metrics.groupOpenCount + metrics.participantsLoadedCount,
    profile: metrics.profileUpdatedCount,
    passivity: metrics.chatListOpenedCount + metrics.readCount + metrics.statusViewedCount,
    presence:
      metrics.sessionConnectedCount +
      metrics.contactsSyncedCount +
      metrics.distinctConversations +
      metrics.distinctGroupsVisited,
  };

  const coveredSignals = Object.entries(coverageBySignal)
    .filter(([, value]) => value > 0)
    .map(([key]) => key);
  const missingSignals = Object.entries(coverageBySignal)
    .filter(([, value]) => value <= 0)
    .map(([key]) => key);

  return {
    evidenceCoverage: clampScore((coveredSignals.length / Object.keys(coverageBySignal).length) * 100),
    ...coverageBySignal,
    coveredSignals,
    missingSignals,
  };
}

export function computeCertificationStatus(params: {
  connected: boolean;
  totalEvents: number;
  sentCount: number;
  receivedCount: number;
  readCount: number;
  statusViewedCount: number;
  distinctConversations: number;
  distinctGroupsVisited: number;
  healthScore: number;
  humanScore: number;
  riskScore: number;
  sessionAgeMinutes: number;
  disconnectCount: number;
}): OperationalCertificationDecision {
  const {
    connected,
    totalEvents,
    sentCount,
    receivedCount,
    readCount,
    statusViewedCount,
    distinctConversations,
    distinctGroupsVisited,
    healthScore,
    humanScore,
    riskScore,
    sessionAgeMinutes,
    disconnectCount,
  } = params;

  if (
    healthScore > 80 &&
    humanScore > 70 &&
    riskScore < 30 &&
    sentCount > 0 &&
    receivedCount > 0 &&
    distinctConversations >= 2
  ) {
    return { status: "APROVADO", usable: true, reason: "Atende aos thresholds iniciais de certificação." };
  }

  if (healthScore < 40 || riskScore >= 80) {
    return { status: "REPROVADO", usable: false, reason: "Sessão muito instável ou risco alto demais." };
  }

  if (healthScore < 60 || riskScore >= 50) {
    return { status: "RESTRITO", usable: false, reason: "Chip ainda instável ou com padrão arriscado." };
  }

  if (
    connected &&
    sessionAgeMinutes >= 24 * 60 &&
    distinctGroupsVisited >= 3 &&
    readCount > 0 &&
    statusViewedCount > 0 &&
    disconnectCount === 0 &&
    healthScore >= 70
  ) {
    return {
      status: "EM_OBSERVACAO",
      usable: false,
      reason: "Evidência passiva suficiente coletada: sessão estável, grupos visitados, leituras e observação sem bloqueios.",
    };
  }

  if (connected || totalEvents > 0) {
    return { status: "EM_MATURACAO", usable: false, reason: "Chip em coleta e maturação inicial." };
  }

  return { status: "NOVO", usable: false, reason: "Chip novo sem evidência suficiente." };
}

export function buildOperationalStateSnapshot(params: {
  chip: ChipRecord;
  runtimeHealth: RuntimeHealth;
  timelineEvents: any[];
  connectionLogs: any[];
  disconnectionLogs: any[];
  persistedCertification: Awaited<ReturnType<typeof getChipCertification>>;
  dateTo: Date;
  dateFrom: Date;
}): OperationalStateSnapshot {
  const { chip, runtimeHealth, timelineEvents, connectionLogs, disconnectionLogs, persistedCertification, dateFrom, dateTo } = params;
  const metrics = computeTimelineMetrics(timelineEvents, dateFrom, dateTo);
  const healthSnapshot: HealthSnapshot = {
    healthScore: clampScore(runtimeHealth.healthScore ?? 0),
    reconnectCount: Math.max(0, connectionLogs.length - 1),
    disconnectCount: disconnectionLogs.length,
    lastDisconnect: toDate(runtimeHealth.lastDisconnectAt),
    sessionAge: runtimeHealth.sessionAgeMinutes ?? 0,
    lastReceive: toDate(runtimeHealth.lastReceive),
    lastSend: toDate(runtimeHealth.lastSend),
  };
  const humanScore = computeHumanScore(metrics);
  const riskScore = computeRiskScore(metrics, healthSnapshot);
  const evidenceQuality = computeEvidenceQuality(metrics);
  const coverage = computeEvidenceCoverage(metrics);
  const certification = computeCertificationStatus({
    connected: Boolean(runtimeHealth.connected),
    totalEvents: metrics.totalEvents,
    sentCount: metrics.sentCount,
    receivedCount: metrics.receivedCount,
    readCount: metrics.readCount,
    statusViewedCount: metrics.statusViewedCount,
    distinctConversations: metrics.distinctConversations,
    distinctGroupsVisited: metrics.distinctGroupsVisited,
    healthScore: healthSnapshot.healthScore,
    humanScore,
    riskScore,
    sessionAgeMinutes: runtimeHealth.sessionAgeMinutes ?? 0,
    disconnectCount: healthSnapshot.disconnectCount,
  });

  const certificationChanged =
    !persistedCertification ||
    persistedCertification.status !== certification.status ||
    Boolean(persistedCertification.usable) !== certification.usable ||
    (persistedCertification.reason ?? null) !== certification.reason;

  const phaseStartedAt = certificationChanged
    ? new Date().toISOString()
    : persistedCertification?.updatedAt
      ? new Date(persistedCertification.updatedAt).toISOString()
      : new Date().toISOString();

  const approvedAtToPersist =
    certification.status === "APROVADO"
      ? persistedCertification?.approvedAt ?? new Date()
      : null;

  return {
    userId: chip.userId,
    chipId: chip.id,
    chipName: chip.chipName,
    connected: Boolean(runtimeHealth.connected),
    phoneNumber: chip.phoneNumber,
    status: chip.status,
    lastActivity: chip.lastActivity,
    lastEventAt: metrics.lastEventAt,
    lastEventType: metrics.lastEventType,
    metrics,
    health: healthSnapshot,
    scores: {
      humanScore,
      riskScore,
      evidenceQuality: evidenceQuality.evidenceQuality,
      evidenceNaturalness: evidenceQuality.evidenceNaturalness,
      evidenceDiversity: evidenceQuality.evidenceDiversity,
      evidenceConsistency: evidenceQuality.evidenceConsistency,
      evidenceSocialPresence: evidenceQuality.evidenceSocialPresence,
    },
    coverage,
    certification,
    phaseStartedAt,
    connectedMinutes: runtimeHealth.sessionAgeMinutes ?? 0,
    certificationChanged,
    approvedAtToPersist,
  };
}

export async function calculateOperationalState(chipId: number, userId: number, options?: { windowHours?: number }) {
  const chip = await getChipById(chipId);
  if (!chip || chip.userId !== userId) {
    throw new Error("Chip não encontrado");
  }

  const windowHours = options?.windowHours ?? 48;
  const dateTo = new Date();
  const dateFrom = new Date(dateTo.getTime() - windowHours * 60 * 60 * 1000);
  const [runtimeHealth, timelineEvents, connectionLogs, disconnectionLogs, persistedCertification] = await Promise.all([
    getChipHealth(chip.id, chip.userId, chip.phoneNumber),
    listBehaviorTimelineEvents({
      userId,
      chipId,
      dateFrom,
      dateTo,
      limit: 5000,
    }),
    searchUserActivityLogs({
      userId,
      chipId,
      actionType: "connection",
      dateFrom,
      dateTo,
      limit: 500,
    }),
    searchUserActivityLogs({
      userId,
      chipId,
      actionType: "disconnection",
      dateFrom,
      dateTo,
      limit: 500,
    }),
    getChipCertification(userId, chipId),
  ]);

  return buildOperationalStateSnapshot({
    chip,
    runtimeHealth,
    timelineEvents,
    connectionLogs,
    disconnectionLogs,
    persistedCertification,
    dateFrom,
    dateTo,
  });
}

export async function persistOperationalState(snapshot: OperationalStateSnapshot) {
  await Promise.all([
    upsertChipHealth({
      userId: snapshot.userId,
      chipId: snapshot.chipId,
      healthScore: snapshot.health.healthScore,
      reconnectCount: snapshot.health.reconnectCount,
      disconnectCount: snapshot.health.disconnectCount,
      lastDisconnect: snapshot.health.lastDisconnect,
      sessionAge: snapshot.health.sessionAge,
      lastReceive: snapshot.health.lastReceive,
      lastSend: snapshot.health.lastSend,
    }),
    upsertChipBehaviorScore({
      userId: snapshot.userId,
      chipId: snapshot.chipId,
      humanScore: snapshot.scores.humanScore,
      riskScore: snapshot.scores.riskScore,
      evidenceQuality: snapshot.scores.evidenceQuality,
      evidenceCoverage: snapshot.coverage.evidenceCoverage,
      evidenceCoverageDetail: snapshot.coverage,
      evidenceNaturalness: snapshot.scores.evidenceNaturalness,
      evidenceDiversity: snapshot.scores.evidenceDiversity,
      evidenceConsistency: snapshot.scores.evidenceConsistency,
      evidenceSocialPresence: snapshot.scores.evidenceSocialPresence,
      sentCount: snapshot.metrics.sentCount,
      receivedCount: snapshot.metrics.receivedCount,
      groupJoinCount: snapshot.metrics.groupJoinCount,
      readCount: snapshot.metrics.readCount,
      distinctConversations: snapshot.metrics.distinctConversations,
      activeMinutes: snapshot.metrics.activeMinutes,
      idleMinutes: snapshot.metrics.idleMinutes,
    }),
    snapshot.certificationChanged
      ? upsertChipCertification({
          userId: snapshot.userId,
          chipId: snapshot.chipId,
          status: snapshot.certification.status,
          usable: snapshot.certification.usable,
          reason: snapshot.certification.reason,
          approvedAt: snapshot.approvedAtToPersist,
        })
      : Promise.resolve(null),
  ]);

  return snapshot;
}

export function toOperationalStateResult(snapshot: OperationalStateSnapshot) {
  return {
    chipId: snapshot.chipId,
    chipName: snapshot.chipName,
    connected: snapshot.connected,
    phoneNumber: snapshot.phoneNumber,
    status: snapshot.status,
    lastActivity: snapshot.lastActivity,
    lastEventAt: snapshot.lastEventAt,
    lastEventType: snapshot.lastEventType,
    metrics: snapshot.metrics,
    health: snapshot.health,
    scores: snapshot.scores,
    coverage: snapshot.coverage,
    certification: snapshot.certification,
    phaseStartedAt: snapshot.phaseStartedAt,
    connectedMinutes: snapshot.connectedMinutes,
  };
}

export async function refreshChipOperationalState(chipId: number, userId: number, options?: { windowHours?: number }) {
  const snapshot = await calculateOperationalState(chipId, userId, options);
  await persistOperationalState(snapshot);
  const certificationState = await refreshChipCertification(chipId, userId).catch(() => null);
  const operational = toOperationalStateResult(snapshot);
  return certificationState
    ? {
        ...operational,
        certification: certificationState.compatibility,
        certificationState,
      }
    : operational;
}

export async function refreshAllOperationalStates(userId: number, options?: { windowHours?: number }) {
  const chips = await getUserChips(userId);
  return Promise.all(chips.map((chip) => refreshChipOperationalState(chip.id, userId, options)));
}

export async function getCertifiedChipPool(userId: number) {
  await refreshAllOperationalStates(userId, { windowHours: 48 });
  const rows = await listCertifiedChips(userId);
  return rows.map((row) => ({
    chipId: row.chipId,
    health: row.health ?? 0,
    human: row.human ?? 0,
    risk: row.risk ?? 100,
    usable: Boolean(row.usable),
    status: row.status,
    chipName: row.chipName,
    phoneNumber: row.phoneNumber,
  }));
}

export async function getChipOperationalSummary(userId: number, chipId: number, options?: { windowHours?: number }) {
  const operational = await refreshChipOperationalState(chipId, userId, options);
  const [health, scores, certification, certificationState] = await Promise.all([
    getChipHealthSnapshot(userId, chipId),
    getChipBehaviorScore(userId, chipId),
    getChipCertification(userId, chipId),
    getChipCertificationState(userId, chipId),
  ]);

  return {
    ...operational,
    persisted: {
      health,
      scores,
      certification,
      certificationState,
    },
  };
}
