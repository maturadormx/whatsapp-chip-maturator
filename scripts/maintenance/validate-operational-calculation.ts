import assert from "node:assert/strict";
import { buildOperationalStateSnapshot } from "../../server/services/maturatorOperational";

const userId = 7;
const chipId = 42;
const dateFrom = new Date("2026-01-01T00:00:00.000Z");
const dateTo = new Date("2026-01-01T02:00:00.000Z");
const lastActivity = new Date("2026-01-01T01:50:00.000Z");
const updatedAt = new Date("2026-01-01T01:30:00.000Z");

const snapshot = buildOperationalStateSnapshot({
  chip: {
    id: chipId,
    userId,
    chipName: "Chip Observador",
    phoneNumber: "+5511999999999",
    status: "conectado",
    lastActivity,
  } as any,
  runtimeHealth: {
    chipId,
    connected: true,
    healthScore: 88,
    sessionAgeMinutes: 1600,
    lastDisconnectAt: null,
    lastReceive: null,
    lastSend: null,
  } as any,
  timelineEvents: [
    { eventType: "session_connected", occurredAt: "2026-01-01T00:05:00.000Z", remoteJid: "runtime@system" },
    { eventType: "group_opened", occurredAt: "2026-01-01T00:15:00.000Z", groupJid: "grupo-1@g.us" },
    { eventType: "group_opened", occurredAt: "2026-01-01T00:25:00.000Z", groupJid: "grupo-2@g.us" },
    { eventType: "group_opened", occurredAt: "2026-01-01T00:35:00.000Z", groupJid: "grupo-3@g.us" },
    { eventType: "status_viewed", occurredAt: "2026-01-01T00:45:00.000Z", remoteJid: "status@broadcast" },
    { eventType: "messages_read", occurredAt: "2026-01-01T00:55:00.000Z", remoteJid: "grupo-3@g.us" },
  ],
  connectionLogs: [{ id: 1, actionType: "connection" }],
  disconnectionLogs: [],
  persistedCertification: {
    status: "EM_OBSERVACAO",
    usable: 0,
    reason: "Evidência passiva suficiente coletada: sessão estável, grupos visitados, leituras e observação sem bloqueios.",
    approvedAt: null,
    updatedAt,
  } as any,
  dateFrom,
  dateTo,
});

const normalized = {
  ...snapshot,
  lastActivity: snapshot.lastActivity?.toISOString() ?? null,
  health: {
    ...snapshot.health,
    lastDisconnect: snapshot.health.lastDisconnect?.toISOString() ?? null,
    lastReceive: snapshot.health.lastReceive?.toISOString() ?? null,
    lastSend: snapshot.health.lastSend?.toISOString() ?? null,
  },
  approvedAtToPersist: snapshot.approvedAtToPersist?.toISOString() ?? null,
};

assert.deepStrictEqual(normalized, {
  userId,
  chipId,
  chipName: "Chip Observador",
  connected: true,
  phoneNumber: "+5511999999999",
  status: "conectado",
  lastActivity: "2026-01-01T01:50:00.000Z",
  lastEventAt: "2026-01-01T00:55:00.000Z",
  lastEventType: "messages_read",
  metrics: {
    totalEvents: 6,
    sessionConnectedCount: 1,
    contactsSyncedCount: 0,
    profileUpdatedCount: 0,
    statusViewedCount: 1,
    chatListOpenedCount: 0,
    sentCount: 0,
    acknowledgedCount: 0,
    receivedCount: 0,
    groupJoinCount: 0,
    groupOpenCount: 3,
    participantsLoadedCount: 0,
    readCount: 1,
    distinctConversations: 5,
    distinctGroupsVisited: 3,
    activeMinutes: 60,
    idleMinutes: 60,
    lastEventAt: "2026-01-01T00:55:00.000Z",
    lastEventType: "messages_read",
  },
  health: {
    healthScore: 88,
    reconnectCount: 0,
    disconnectCount: 0,
    lastDisconnect: null,
    sessionAge: 1600,
    lastReceive: null,
    lastSend: null,
  },
  scores: {
    humanScore: 74,
    riskScore: 0,
    evidenceQuality: 76,
    evidenceNaturalness: 80,
    evidenceDiversity: 85,
    evidenceConsistency: 90,
    evidenceSocialPresence: 50,
  },
  coverage: {
    evidenceCoverage: 83,
    messages: 1,
    status: 1,
    groups: 3,
    profile: 0,
    passivity: 2,
    presence: 9,
    coveredSignals: ["messages", "status", "groups", "passivity", "presence"],
    missingSignals: ["profile"],
  },
  certification: {
    status: "EM_OBSERVACAO",
    usable: false,
    reason: "Evidência passiva suficiente coletada: sessão estável, grupos visitados, leituras e observação sem bloqueios.",
  },
  phaseStartedAt: "2026-01-01T01:30:00.000Z",
  connectedMinutes: 1600,
  certificationChanged: false,
  approvedAtToPersist: null,
});

console.log("Validação operacional: OK");

type ScenarioInput = {
  name: string;
  runtimeHealth: any;
  timelineEvents: any[];
  connectionLogs?: any[];
  disconnectionLogs?: any[];
  persistedCertification?: any;
  expectedStatus: string;
  expectedUsable: boolean;
};

function runScenario(input: ScenarioInput) {
  const scenarioSnapshot = buildOperationalStateSnapshot({
    chip: {
      id: chipId,
      userId,
      chipName: `Chip ${input.name}`,
      phoneNumber: "+5511999999999",
      status: "conectado",
      lastActivity,
    } as any,
    runtimeHealth: input.runtimeHealth,
    timelineEvents: input.timelineEvents,
    connectionLogs: input.connectionLogs ?? [],
    disconnectionLogs: input.disconnectionLogs ?? [],
    persistedCertification:
      input.persistedCertification ??
      ({
        status: "NOVO",
        usable: 0,
        reason: null,
        approvedAt: null,
        updatedAt,
      } as any),
    dateFrom,
    dateTo,
  });

  assert.equal(
    scenarioSnapshot.certification.status,
    input.expectedStatus,
    `Cenário ${input.name}: status inesperado`
  );
  assert.equal(
    scenarioSnapshot.certification.usable,
    input.expectedUsable,
    `Cenário ${input.name}: usable inesperado`
  );
}

runScenario({
  name: "NOVO",
  runtimeHealth: {
    chipId,
    connected: false,
    healthScore: 85,
    sessionAgeMinutes: 0,
    lastDisconnectAt: null,
    lastReceive: null,
    lastSend: null,
  },
  timelineEvents: [],
  expectedStatus: "NOVO",
  expectedUsable: false,
});

runScenario({
  name: "EM_MATURACAO",
  runtimeHealth: {
    chipId,
    connected: true,
    healthScore: 86,
    sessionAgeMinutes: 180,
    lastDisconnectAt: null,
    lastReceive: null,
    lastSend: null,
  },
  timelineEvents: [
    { eventType: "session_connected", occurredAt: "2026-01-01T00:05:00.000Z", remoteJid: "runtime@system" },
    { eventType: "chat_list_opened", occurredAt: "2026-01-01T00:15:00.000Z", remoteJid: "runtime@system" },
  ],
  connectionLogs: [{ id: 1, actionType: "connection" }],
  expectedStatus: "EM_MATURACAO",
  expectedUsable: false,
});

runScenario({
  name: "EM_OBSERVACAO",
  runtimeHealth: {
    chipId,
    connected: true,
    healthScore: 88,
    sessionAgeMinutes: 1600,
    lastDisconnectAt: null,
    lastReceive: null,
    lastSend: null,
  },
  timelineEvents: [
    { eventType: "session_connected", occurredAt: "2026-01-01T00:05:00.000Z", remoteJid: "runtime@system" },
    { eventType: "group_opened", occurredAt: "2026-01-01T00:15:00.000Z", groupJid: "grupo-1@g.us" },
    { eventType: "group_opened", occurredAt: "2026-01-01T00:25:00.000Z", groupJid: "grupo-2@g.us" },
    { eventType: "group_opened", occurredAt: "2026-01-01T00:35:00.000Z", groupJid: "grupo-3@g.us" },
    { eventType: "status_viewed", occurredAt: "2026-01-01T00:45:00.000Z", remoteJid: "status@broadcast" },
    { eventType: "messages_read", occurredAt: "2026-01-01T00:55:00.000Z", remoteJid: "grupo-3@g.us" },
  ],
  connectionLogs: [{ id: 1, actionType: "connection" }],
  expectedStatus: "EM_OBSERVACAO",
  expectedUsable: false,
});

runScenario({
  name: "APROVADO",
  runtimeHealth: {
    chipId,
    connected: true,
    healthScore: 95,
    sessionAgeMinutes: 1700,
    lastDisconnectAt: null,
    lastReceive: "2026-01-01T01:35:00.000Z",
    lastSend: "2026-01-01T01:30:00.000Z",
  },
  timelineEvents: [
    { eventType: "session_connected", occurredAt: "2026-01-01T00:05:00.000Z", remoteJid: "runtime@system" },
    { eventType: "contacts_synced", occurredAt: "2026-01-01T00:10:00.000Z", remoteJid: "runtime@system" },
    { eventType: "profile_name_updated", occurredAt: "2026-01-01T00:15:00.000Z", remoteJid: "runtime@system" },
    { eventType: "chat_list_opened", occurredAt: "2026-01-01T00:20:00.000Z", remoteJid: "runtime@system" },
    { eventType: "status_viewed", occurredAt: "2026-01-01T00:25:00.000Z", remoteJid: "status@broadcast" },
    { eventType: "message_sent", occurredAt: "2026-01-01T00:30:00.000Z", remoteJid: "contato-1@s.whatsapp.net" },
    { eventType: "message_received", occurredAt: "2026-01-01T00:35:00.000Z", remoteJid: "contato-1@s.whatsapp.net" },
    { eventType: "message_acknowledged", occurredAt: "2026-01-01T00:36:00.000Z", remoteJid: "contato-1@s.whatsapp.net" },
    { eventType: "message_sent", occurredAt: "2026-01-01T00:45:00.000Z", remoteJid: "contato-2@s.whatsapp.net" },
    { eventType: "message_received", occurredAt: "2026-01-01T00:50:00.000Z", remoteJid: "contato-2@s.whatsapp.net" },
    { eventType: "messages_read", occurredAt: "2026-01-01T00:55:00.000Z", remoteJid: "contato-2@s.whatsapp.net" },
    { eventType: "group_joined", occurredAt: "2026-01-01T01:05:00.000Z", groupJid: "grupo-1@g.us" },
    { eventType: "group_opened", occurredAt: "2026-01-01T01:15:00.000Z", groupJid: "grupo-1@g.us" },
    { eventType: "participants_loaded", occurredAt: "2026-01-01T01:20:00.000Z", groupJid: "grupo-1@g.us" },
  ],
  connectionLogs: [{ id: 1, actionType: "connection" }],
  expectedStatus: "APROVADO",
  expectedUsable: true,
});

runScenario({
  name: "RESTRITO",
  runtimeHealth: {
    chipId,
    connected: true,
    healthScore: 55,
    sessionAgeMinutes: 220,
    lastDisconnectAt: null,
    lastReceive: null,
    lastSend: null,
  },
  timelineEvents: [
    { eventType: "session_connected", occurredAt: "2026-01-01T00:05:00.000Z", remoteJid: "runtime@system" },
    { eventType: "message_sent", occurredAt: "2026-01-01T00:25:00.000Z", remoteJid: "contato-1@s.whatsapp.net" },
  ],
  connectionLogs: [{ id: 1, actionType: "connection" }],
  expectedStatus: "RESTRITO",
  expectedUsable: false,
});

runScenario({
  name: "REPROVADO",
  runtimeHealth: {
    chipId,
    connected: false,
    healthScore: 20,
    sessionAgeMinutes: 15,
    lastDisconnectAt: "2026-01-01T01:40:00.000Z",
    lastReceive: null,
    lastSend: null,
  },
  timelineEvents: [
    { eventType: "session_connected", occurredAt: "2026-01-01T00:05:00.000Z", remoteJid: "runtime@system" },
    { eventType: "message_sent", occurredAt: "2026-01-01T00:25:00.000Z", remoteJid: "contato-1@s.whatsapp.net" },
  ],
  connectionLogs: [{ id: 1, actionType: "connection" }],
  disconnectionLogs: [
    { id: 1, actionType: "disconnection" },
    { id: 2, actionType: "disconnection" },
    { id: 3, actionType: "disconnection" },
  ],
  expectedStatus: "REPROVADO",
  expectedUsable: false,
});

console.log("Cenários de regressão: OK");
