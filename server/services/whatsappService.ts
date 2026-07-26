import { Boom } from "@hapi/boom";
import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  jidDecode,
  jidNormalizedUser,
  useMultiFileAuthState,
  WASocket,
} from "baileys";
import fs from "node:fs";
import path from "node:path";
import pino from "pino";
import QRCode from "qrcode";
import {
  countPendingExecutionJobsForChip,
  createActivityLog,
  createBehaviorTimelineEvent,
  getAllChips,
  searchUserActivityLogs,
  updateChipPhoneNumber,
  updateChipStatus,
} from "../db";
import { normalizeGroupTarget, normalizeNumberTarget } from "../utils/targets";
import { ENV } from "../_core/env";

interface WhatsAppSession {
  socket: WASocket | null;
  socketInstanceId: string;
  qrCode: string | null;
  isConnected: boolean;
  lastActivity: Date;
  createdAt: Date;
  connectionState: string;
  connectedAt: Date | null;
  lastReconnectAt: Date | null;
  lastDisconnectAt: Date | null;
  lastDisconnectReason: string | null;
  lastDisconnectStatusCode: number | null;
  lastDisconnectShouldReconnect: boolean | null;
  lastReceiveAt: Date | null;
  lastSendStartedAt: Date | null;
  lastSendFinishedAt: Date | null;
  lastSendLatencyMs: number | null;
  lastSendError: string | null;
  lastResolvedJid: string | null;
}

const sessions = new Map<number, WhatsAppSession>();
const initializingChips = new Set<number>();
const whatsappLogger = pino({ level: "silent" });
let socketInstanceSequence = 0;

function getSocketReadyStateLabel(session?: WhatsAppSession | null) {
  const readyState = (session?.socket as any)?.ws?.readyState;
  switch (readyState) {
    case 0:
      return "connecting";
    case 1:
      return "open";
    case 2:
      return "closing";
    case 3:
      return "closed";
    default:
      return "unknown";
  }
}

function getSocketReadyStateValue(session?: WhatsAppSession | null) {
  const readyState = (session?.socket as any)?.ws?.readyState;
  return typeof readyState === "number" ? readyState : null;
}

function getConnectionAgeMs(session?: WhatsAppSession | null) {
  if (!session?.connectedAt) return null;
  return Math.max(0, Date.now() - session.connectedAt.getTime());
}

function extractDisconnectMetadata(lastDisconnect: unknown) {
  const boom = lastDisconnect as Boom | undefined;
  const statusCode = boom?.output?.statusCode ?? null;
  return {
    reason: boom?.message || null,
    statusCode,
    label: getDisconnectReasonLabel(statusCode),
  };
}

function getDisconnectReasonLabel(statusCode: number | null) {
  if (statusCode == null) return null;
  const entries = Object.entries(DisconnectReason) as Array<[string, string | number]>;
  const match = entries.find(([, value]) => value === statusCode && typeof value === "number");
  return match?.[0] ?? null;
}

function buildSocketDiagnostics(session: WhatsAppSession | null | undefined) {
  return {
    socketInstanceId: session?.socketInstanceId ?? null,
    connectionState: session?.connectionState ?? "missing",
    isConnected: session?.isConnected ?? false,
    wsReadyState: getSocketReadyStateValue(session),
    wsReadyStateLabel: getSocketReadyStateLabel(session),
    connectionAgeMs: getConnectionAgeMs(session),
    connectedAt: session?.connectedAt?.toISOString() ?? null,
    lastReconnectAt: session?.lastReconnectAt?.toISOString() ?? null,
    lastDisconnectAt: session?.lastDisconnectAt?.toISOString() ?? null,
    lastDisconnectReason: session?.lastDisconnectReason ?? null,
    lastDisconnectStatusCode: session?.lastDisconnectStatusCode ?? null,
    lastDisconnectStatusLabel: getDisconnectReasonLabel(session?.lastDisconnectStatusCode ?? null),
    shouldReconnect: session?.lastDisconnectShouldReconnect ?? null,
    lastReceiveAt: session?.lastReceiveAt?.toISOString() ?? null,
    lastSendStartedAt: session?.lastSendStartedAt?.toISOString() ?? null,
    lastSendFinishedAt: session?.lastSendFinishedAt?.toISOString() ?? null,
    lastSendLatencyMs: session?.lastSendLatencyMs ?? null,
    lastSendError: session?.lastSendError ?? null,
    lastResolvedJid: session?.lastResolvedJid ?? null,
  };
}

function logStructuredSocketEvent(
  event: string,
  chipId: number,
  session: WhatsAppSession | null | undefined,
  payload: Record<string, unknown> = {}
) {
  console.log(
    JSON.stringify({
      scope: "whatsapp_socket",
      event,
      timestamp: new Date().toISOString(),
      chipId,
      socketInstanceId: session?.socketInstanceId ?? null,
      connectionState: session?.connectionState ?? "missing",
      isConnected: session?.isConnected ?? false,
      wsReadyState: getSocketReadyStateValue(session),
      wsReadyStateLabel: getSocketReadyStateLabel(session),
      connectedAt: session?.connectedAt?.toISOString() ?? null,
      lastReconnectAt: session?.lastReconnectAt?.toISOString() ?? null,
      lastDisconnectAt: session?.lastDisconnectAt?.toISOString() ?? null,
      ...payload,
    })
  );
}

function computeChipHealthScore(session: WhatsAppSession | null, pendingJobs: number) {
  if (!session) return 0;

  let score = 100;
  if (!session.isConnected) score -= 45;
  if (getSocketReadyStateValue(session) !== 1) score -= 25;
  if (session.lastSendError) score -= 15;
  if (session.lastDisconnectAt && Date.now() - session.lastDisconnectAt.getTime() < 10 * 60 * 1000) score -= 20;
  if (!session.lastReceiveAt || Date.now() - session.lastReceiveAt.getTime() > 60 * 60 * 1000) score -= 10;
  if (pendingJobs > 0) score -= Math.min(10, pendingJobs * 2);

  return Math.max(0, Math.min(100, score));
}

function logStructuredSendEvent(
  event: "SEND_START" | "SEND_SUCCESS" | "SEND_FAILED",
  payload: Record<string, unknown>
) {
  console.log(
    JSON.stringify({
      scope: "whatsapp_send",
      event,
      timestamp: new Date().toISOString(),
      ...payload,
    })
  );
}

function logWhatsAppSendDebug(payload: Record<string, unknown>) {
  if (!ENV.runtimeDebugLogsEnabled) return;
  console.log(JSON.stringify(payload));
}

function buildLogTargetPayload(rawTarget: string) {
  if (!rawTarget?.trim()) {
    return {
      targetNumber: undefined,
      targetGroup: undefined,
    };
  }

  if (rawTarget.includes("@g.us")) {
    const normalizedGroup = normalizeGroupTarget(rawTarget);
    return {
      targetNumber: undefined,
      targetGroup: normalizedGroup.normalizedValue,
    };
  }

  const normalizedNumber = normalizeNumberTarget(rawTarget);
  return {
    targetNumber: normalizedNumber.normalizedValue,
    targetGroup: undefined,
  };
}

function buildTimelineRemoteMeta(rawJid?: string | null, fallbackLabel?: string | null) {
  const normalizedJid = jidNormalizedUser(rawJid ?? undefined) || rawJid || null;
  if (!normalizedJid) {
    return {
      remoteJid: null,
      remoteType: "unknown" as const,
      remoteLabel: fallbackLabel ?? null,
      groupJid: null,
    };
  }

  if (normalizedJid.includes("@g.us")) {
    return {
      remoteJid: normalizedJid,
      remoteType: "group" as const,
      remoteLabel: fallbackLabel ?? normalizedJid,
      groupJid: normalizedJid,
    };
  }

  if (normalizedJid.includes("@broadcast")) {
    return {
      remoteJid: normalizedJid,
      remoteType: "broadcast" as const,
      remoteLabel: fallbackLabel ?? normalizedJid,
      groupJid: null,
    };
  }

  try {
    const normalizedNumber = normalizeNumberTarget(normalizedJid);
    return {
      remoteJid: normalizedJid,
      remoteType: "number" as const,
      remoteLabel: fallbackLabel ?? normalizedNumber.normalizedValue,
      groupJid: null,
    };
  } catch {
    return {
      remoteJid: normalizedJid,
      remoteType: "unknown" as const,
      remoteLabel: fallbackLabel ?? normalizedJid,
      groupJid: null,
    };
  }
}

function extractMessageContentPreview(message: any) {
  if (!message) return "";
  return (
    message.conversation ||
    message.extendedTextMessage?.text ||
    message.imageMessage?.caption ||
    message.videoMessage?.caption ||
    message.documentMessage?.caption ||
    message.buttonsResponseMessage?.selectedDisplayText ||
    message.listResponseMessage?.title ||
    message.protocolMessage?.type?.toString?.() ||
    ""
  );
}

function getAuthFolderPath(chipId: number) {
  return path.resolve(process.cwd(), `auth_info_${chipId}`);
}

function extractPhoneNumberFromJid(rawJid?: string | null) {
  const normalizedJid = jidNormalizedUser(rawJid ?? undefined) || rawJid || "";
  const decoded = jidDecode(normalizedJid);
  const digits = decoded?.user?.replace(/\D+/g, "") ?? "";
  return digits || null;
}

async function syncChipPhoneNumber(chipId: number, rawJid?: string | null) {
  const phoneNumber = extractPhoneNumberFromJid(rawJid);
  if (!phoneNumber) {
    return null;
  }

  await updateChipPhoneNumber(chipId, phoneNumber);
  return phoneNumber;
}

function requireConnectedSession(chipId: number) {
  const session = sessions.get(chipId);
  if (!session || !session.socket || !session.isConnected) {
    throw new Error(`Chip ${chipId} não está conectado`);
  }

  return session;
}

function countCollectionEntries(collection: unknown) {
  if (Array.isArray(collection)) {
    return collection.length;
  }

  if (collection && typeof collection === "object") {
    return Object.keys(collection as Record<string, unknown>).length;
  }

  return 0;
}

function getSessionContactsCount(session: WhatsAppSession) {
  const socket = session.socket as any;
  return countCollectionEntries(socket?.contacts || socket?.store?.contacts);
}

function getSessionChatsCount(session: WhatsAppSession) {
  const socket = session.socket as any;
  return countCollectionEntries(socket?.chats || socket?.store?.chats);
}

function upsertSessionCollectionEntry(collection: any, key: string, value: Record<string, unknown>) {
  if (!collection) return false;
  if (typeof collection.set === "function") {
    collection.set(key, value);
    return true;
  }
  if (typeof collection.upsert === "function") {
    collection.upsert(value);
    return true;
  }
  if (typeof collection.insert === "function") {
    collection.insert(value);
    return true;
  }
  if (typeof collection === "object") {
    collection[key] = value;
    return true;
  }
  return false;
}

async function createPassiveTimelineEvent(
  chipId: number,
  eventType:
    | "session_connected"
    | "contacts_synced"
    | "contact_added"
    | "profile_name_updated"
    | "profile_photo_updated"
    | "about_updated"
    | "group_created"
    | "group_left"
    | "wake_up"
    | "idle"
    | "status_viewed"
    | "chat_list_opened"
    | "sleep"
    | "group_opened"
    | "participants_loaded"
    | "presence_online"
    | "presence_offline"
    | "presence_reading"
    | "presence_typing"
    | "presence_recording"
    | "presence_away",
  source: string,
  payload?: Record<string, unknown>,
  overrides?: Partial<{
    remoteJid: string | null;
    remoteType: "number" | "group" | "broadcast" | "unknown" | null;
    remoteLabel: string | null;
    groupJid: string | null;
    groupSubject: string | null;
    contentPreview: string | null;
    occurredAt: Date;
  }>
) {
  return createBehaviorTimelineEvent({
    chipId,
    eventType,
    source,
    direction: "system",
    remoteJid: overrides?.remoteJid ?? null,
    remoteType: overrides?.remoteType ?? null,
    remoteLabel: overrides?.remoteLabel ?? null,
    groupJid: overrides?.groupJid ?? null,
    groupSubject: overrides?.groupSubject ?? null,
    contentPreview: overrides?.contentPreview ?? null,
    payload: payload ?? null,
    occurredAt: overrides?.occurredAt ?? new Date(),
  });
}

async function resolveExactTargetJid(session: WhatsAppSession, rawTarget: string) {
  if (rawTarget.includes("@g.us")) {
    return normalizeGroupTarget(rawTarget);
  }

  const normalizedNumber = normalizeNumberTarget(rawTarget);
  const ownJid = (session.socket as any)?.user?.id as string | undefined;
  if (!ownJid) {
    throw new Error("Chip conectado sem identidade válida de sessão. Reconecte o chip para sincronizar a conta.");
  }

  const lookup = await (session.socket as any).onWhatsApp(normalizedNumber.normalizedValue);
  const firstMatch = Array.isArray(lookup) ? lookup.find((item: any) => item?.exists && item?.jid) : null;
  const resolvedJid = jidNormalizedUser(firstMatch?.jid || normalizedNumber.whatsappJid);

  if (!resolvedJid) {
    throw new Error(`Número ${normalizedNumber.normalizedValue} não foi validado pelo WhatsApp.`);
  }

  return {
    ...normalizedNumber,
    whatsappJid: resolvedJid,
  };
}

function hasPersistedAuthState(chipId: number) {
  const authFolderPath = getAuthFolderPath(chipId);
  if (!fs.existsSync(authFolderPath)) return false;

  const entries = fs.readdirSync(authFolderPath);
  return entries.length > 0;
}

function extractInviteCode(inviteLinkOrCode: string) {
  const trimmed = inviteLinkOrCode.trim();
  if (!trimmed) {
    throw new Error("Link ou código de convite inválido.");
  }

  const match = trimmed.match(/chat\.whatsapp\.com\/([A-Za-z0-9]+)/i);
  if (match?.[1]) {
    return match[1];
  }

  const compact = trimmed.replace(/[^A-Za-z0-9]/g, "");
  if (compact.length < 6) {
    throw new Error("Código de convite inválido.");
  }

  return compact;
}

export async function initializeChipSession(chipId: number, chipName: string) {
  if (initializingChips.has(chipId)) {
    return {
      success: true,
      chipId,
      message: "Sessão já está sendo inicializada",
    };
  }

  const existingSession = sessions.get(chipId) ?? null;
  if (existingSession?.socket) {
    if (!existingSession.isConnected) {
      sessions.delete(chipId);
    } else {
      return {
        success: true,
        chipId,
        message: existingSession.isConnected ? "Sessão já conectada" : "Sessão já inicializada",
      };
    }
  }

  initializingChips.add(chipId);

  try {
    const { version, isLatest } = await fetchLatestBaileysVersion();

    const { state, saveCreds } = await useMultiFileAuthState(getAuthFolderPath(chipId));

    const socket = makeWASocket({
      version,
      logger: whatsappLogger,
      printQRInTerminal: false,
      auth: state,
      generateHighQualityLinkPreview: false,
      browser: ["WhatsApp", "Desktop", "2.2412.54"],
    } as any);

    socket.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;
      const disconnectMetadata = extractDisconnectMetadata(lastDisconnect?.error);
      const session = sessions.get(chipId);

      logStructuredSocketEvent("CONNECTION_UPDATE", chipId, session, {
        connection,
        hasQr: Boolean(qr),
        disconnectReason: disconnectMetadata.reason,
        disconnectStatusCode: disconnectMetadata.statusCode,
        disconnectStatusLabel: disconnectMetadata.label,
      });

      if (qr) {
        if (session) {
          session.qrCode = await QRCode.toDataURL(qr, {
            width: 320,
            margin: 1,
          });
        }
        console.log(`[Chip ${chipId}] QR Code gerado`);
      }

      if (connection === "connecting") {
        if (session) {
          session.connectionState = "connecting";
        }
        console.log(`[Chip ${chipId}] Conectando...`);
      } else if (connection === "open") {
        console.log(`[Chip ${chipId}] Conectado!`);
        await updateChipStatus(chipId, "conectado");
        const detectedPhoneNumber = await syncChipPhoneNumber(chipId, (socket as any).user?.id);
        const session = sessions.get(chipId);
        if (session) {
          session.isConnected = true;
          session.lastActivity = new Date();
          session.connectionState = "open";
          session.connectedAt = new Date();
          session.lastReconnectAt = new Date();
        }
        if (detectedPhoneNumber) {
          console.log(`[Chip ${chipId}] Número sincronizado automaticamente: ${detectedPhoneNumber}`);
        }
        await createActivityLog({
          chipId,
          actionType: "connection",
          status: "success",
        });
        await createPassiveTimelineEvent(
          chipId,
          "session_connected",
          "connection.update",
          {
            socketInstanceId: session?.socketInstanceId ?? null,
            connectionState: session?.connectionState ?? connection,
            phoneNumber: detectedPhoneNumber,
            socketUserId: (socket as any)?.user?.id ?? null,
          },
          {
            contentPreview: detectedPhoneNumber ? `Sessão conectada em ${detectedPhoneNumber}` : "Sessão conectada",
          }
        );
        try {
          await syncChipContacts(chipId);
        } catch (syncError) {
          console.warn(`[Chip ${chipId}] Falha ao sincronizar contatos após conexão:`, syncError);
        }
      } else if (connection === "close") {
        const shouldReconnect =
          (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
        console.log(
          `[Chip ${chipId}] Desconectado: ${(lastDisconnect?.error as Boom)?.message}, reconectando: ${shouldReconnect}`
        );
        await updateChipStatus(chipId, "desconectado");
        const session = sessions.get(chipId);
        if (session) {
          session.isConnected = false;
          session.connectionState = "close";
          session.lastDisconnectAt = new Date();
          session.lastDisconnectReason = disconnectMetadata.reason;
          session.lastDisconnectStatusCode = disconnectMetadata.statusCode;
          session.lastDisconnectShouldReconnect = shouldReconnect;
        }
        await createActivityLog({
          chipId,
          actionType: "disconnection",
          status: "success",
        });

        if (shouldReconnect) {
          sessions.delete(chipId);
          setTimeout(() => {
            initializeChipSession(chipId, chipName);
          }, 3000);
        } else {
          sessions.delete(chipId);
        }
      }
    });

    socket.ev.on("creds.update", async () => {
      const session = sessions.get(chipId);
      logStructuredSocketEvent("CREDS_UPDATE", chipId, session);
      await saveCreds();
    });

    socket.ev.on("messages.upsert", async (m) => {
      const session = sessions.get(chipId);
      logStructuredSocketEvent("MESSAGES_UPSERT", chipId, session, {
        type: m.type,
        messageCount: Array.isArray(m.messages) ? m.messages.length : 0,
      });
      if (m.type === "notify") {
        for (const msg of m.messages) {
          if (!msg.key.fromMe && msg.message) {
            if (session) {
              session.lastActivity = new Date();
              session.lastReceiveAt = new Date();
            }

            const messageContent = extractMessageContentPreview(msg.message);
            let targetPayload: { targetNumber?: string; targetGroup?: string } = {};
            if (msg.key.remoteJid) {
              try {
                targetPayload = buildLogTargetPayload(msg.key.remoteJid);
              } catch (error) {
                console.warn(`[Chip ${chipId}] Ignorando target inválido em messages.upsert: ${msg.key.remoteJid}`, error);
                targetPayload = {};
              }
            }
            await createActivityLog({
              chipId,
              actionType: "message_received",
              targetNumber: targetPayload.targetNumber,
              targetGroup: targetPayload.targetGroup,
              messageContent,
              status: "success",
            });

            const remoteMeta = buildTimelineRemoteMeta(msg.key.remoteJid, targetPayload.targetGroup || targetPayload.targetNumber);
            await createBehaviorTimelineEvent({
              chipId,
              eventType: "message_received",
              source: "messages.upsert",
              direction: "inbound",
              remoteJid: remoteMeta.remoteJid,
              remoteType: remoteMeta.remoteType,
              remoteLabel: remoteMeta.remoteLabel,
              groupJid: remoteMeta.groupJid,
              messageId: msg.key.id || null,
              contentPreview: messageContent,
              payload: {
                upsertType: m.type,
                fromMe: Boolean(msg.key.fromMe),
                participant: msg.key.participant ?? null,
                hasPushName: Boolean((msg as any).pushName),
                messageStubType: (msg as any).messageStubType ?? null,
              },
              occurredAt: new Date((msg.messageTimestamp ? Number(msg.messageTimestamp) * 1000 : Date.now())),
            });

            if (msg.key.remoteJid?.includes("@g.us") && msg.key.id) {
              try {
                await markMessagesAsRead(chipId, [
                  {
                    remoteJid: msg.key.remoteJid,
                    id: msg.key.id,
                    fromMe: Boolean(msg.key.fromMe),
                    participant: msg.key.participant ?? undefined,
                  },
                ]);
              } catch (readError) {
                console.warn(`[Chip ${chipId}] Falha ao marcar mensagem de grupo como lida:`, readError);
              }
            }
          }
        }
      }
    });

    socket.ev.on("presence.update", (presence) => {
      const session = sessions.get(chipId);
      logStructuredSocketEvent("PRESENCE_UPDATE", chipId, session, {
        id: (presence as any)?.id ?? null,
        participantCount: Array.isArray((presence as any)?.presences)
          ? (presence as any).presences.length
          : Object.keys((presence as any)?.presences || {}).length,
      });
    });

    sessions.set(chipId, {
      socket,
      socketInstanceId: `chip-${chipId}-socket-${++socketInstanceSequence}`,
      qrCode: null,
      isConnected: false,
      lastActivity: new Date(),
      createdAt: new Date(),
      connectionState: "initializing",
      connectedAt: null,
      lastReconnectAt: existingSession?.lastReconnectAt ?? null,
      lastDisconnectAt: existingSession?.lastDisconnectAt ?? null,
      lastDisconnectReason: existingSession?.lastDisconnectReason ?? null,
      lastDisconnectStatusCode: existingSession?.lastDisconnectStatusCode ?? null,
      lastDisconnectShouldReconnect: existingSession?.lastDisconnectShouldReconnect ?? null,
      lastReceiveAt: existingSession?.lastReceiveAt ?? null,
      lastSendStartedAt: existingSession?.lastSendStartedAt ?? null,
      lastSendFinishedAt: existingSession?.lastSendFinishedAt ?? null,
      lastSendLatencyMs: existingSession?.lastSendLatencyMs ?? null,
      lastSendError: existingSession?.lastSendError ?? null,
      lastResolvedJid: existingSession?.lastResolvedJid ?? null,
    });

    return {
      success: true,
      chipId,
      message: "Sessão inicializada",
    };
  } catch (error) {
    console.error(`[Chip ${chipId}] Erro ao inicializar:`, error);
    await createActivityLog({
      chipId,
      actionType: "error",
      errorMessage: String(error),
      status: "failed",
    });
    throw error;
  } finally {
    initializingChips.delete(chipId);
  }
}

export async function restoreChipSessionsOnStartup() {
  const chips = await getAllChips();
  if (!chips.length) {
    console.log("[WhatsApp Restore] Nenhum chip cadastrado para restaurar.");
    return;
  }

  let restoredCount = 0;
  let skippedCount = 0;

  for (const chip of chips) {
    const hasAuthState = hasPersistedAuthState(chip.id);

    if (!hasAuthState) {
      skippedCount++;
      if (chip.status !== "desconectado") {
        await updateChipStatus(chip.id, "desconectado");
      }
      continue;
    }

    try {
      await updateChipStatus(chip.id, "desconectado");
      await initializeChipSession(chip.id, chip.chipName);
      restoredCount++;
    } catch (error) {
      console.error(`[WhatsApp Restore] Falha ao restaurar chip ${chip.id}:`, error);
      await updateChipStatus(chip.id, "desconectado");
      await createActivityLog({
        chipId: chip.id,
        actionType: "error",
        errorMessage: `Falha ao restaurar sessão no boot: ${String(error)}`,
        status: "failed",
      });
    }
  }

  console.log(
    `[WhatsApp Restore] Restauração concluída. Restaurados: ${restoredCount}. Ignorados sem auth: ${skippedCount}.`
  );
}

export async function sendMessage(
  chipId: number,
  phoneNumber: string,
  message: string,
  options?: { delay?: number; showTyping?: boolean; retryAttempt?: number }
) {
  const traceId = `svc-send-${chipId}-${Date.now()}`;
  const session = sessions.get(chipId);
  if (!session || !session.socket || !session.isConnected) {
    throw new Error(`Chip ${chipId} não está conectado`);
  }

  const sendStartedAt = new Date();
  session.lastSendStartedAt = sendStartedAt;
  session.lastSendError = null;

  try {
    const normalizedTarget = await resolveExactTargetJid(session, phoneNumber);
    const targetPayload = buildLogTargetPayload(normalizedTarget.normalizedValue);
    session.lastResolvedJid = normalizedTarget.whatsappJid;

    logStructuredSendEvent("SEND_START", {
      chipId,
      socketInstanceId: session.socketInstanceId,
      socketState: getSocketReadyStateLabel(session),
      wsReadyState: getSocketReadyStateValue(session),
      connectionState: session.connectionState,
      isConnected: session.isConnected,
      jid: normalizedTarget.whatsappJid,
      normalizedTarget: normalizedTarget.normalizedValue,
      targetType: normalizedTarget.targetType,
      messageSize: message.length,
      retry: options?.retryAttempt ?? 0,
      connectionAgeMs: getConnectionAgeMs(session),
      lastDisconnectReason: session.lastDisconnectReason,
      lastDisconnectStatusCode: session.lastDisconnectStatusCode,
      lastDisconnectStatusLabel: getDisconnectReasonLabel(session.lastDisconnectStatusCode),
      shouldReconnect: session.lastDisconnectShouldReconnect,
      lastReceiveAt: session.lastReceiveAt?.toISOString() ?? null,
      lastReconnectAt: session.lastReconnectAt?.toISOString() ?? null,
    });

    logWhatsAppSendDebug({
      scope: "whatsapp_send_service",
      step: "[3] before_baileys_send",
      traceId,
      timestamp: new Date().toISOString(),
      chipId,
      target: normalizedTarget.whatsappJid,
      messageLength: message.length,
      socketInstanceId: session.socketInstanceId,
    });

    if (options?.showTyping) {
      await session.socket.sendPresenceUpdate("composing", normalizedTarget.whatsappJid);
      await new Promise((resolve) => setTimeout(resolve, options.delay || 2000));
      await session.socket.sendPresenceUpdate("paused", normalizedTarget.whatsappJid);
    }

    if (options?.delay) {
      await new Promise((resolve) => setTimeout(resolve, options.delay));
    }

    const result = await session.socket.sendMessage(normalizedTarget.whatsappJid, {
      text: message,
    });

    logWhatsAppSendDebug({
      scope: "whatsapp_send_service",
      step: "[4] Retorno do Baileys",
      traceId,
      timestamp: new Date().toISOString(),
      chipId,
      resultType: typeof result,
      resultKeys: result && typeof result === "object" ? Object.keys(result) : [],
      rawResponse: result,
    });

    session.lastActivity = new Date();
    session.lastSendFinishedAt = new Date();
    session.lastSendLatencyMs = session.lastSendFinishedAt.getTime() - sendStartedAt.getTime();
    session.lastSendError = null;

    await createActivityLog({
      chipId,
      actionType: "message_sent",
      targetNumber: targetPayload.targetNumber,
      targetGroup: targetPayload.targetGroup,
      messageContent: message,
      status: "success",
    });

    const remoteMeta = buildTimelineRemoteMeta(
      normalizedTarget.whatsappJid,
      targetPayload.targetGroup || targetPayload.targetNumber
    );
    await createBehaviorTimelineEvent({
      chipId,
      eventType: "message_sent",
      source: "sendMessage",
      direction: "outbound",
      remoteJid: remoteMeta.remoteJid,
      remoteType: remoteMeta.remoteType,
      remoteLabel: remoteMeta.remoteLabel,
      groupJid: remoteMeta.groupJid,
      messageId: result?.key?.id || null,
      contentPreview: message,
      payload: {
        targetType: normalizedTarget.targetType,
        normalizedTarget: normalizedTarget.normalizedValue,
        jid: normalizedTarget.whatsappJid,
      },
      occurredAt: session.lastSendFinishedAt ?? new Date(),
    });

    await createBehaviorTimelineEvent({
      chipId,
      eventType: "message_acknowledged",
      source: "sendMessage",
      direction: "outbound",
      remoteJid: remoteMeta.remoteJid,
      remoteType: remoteMeta.remoteType,
      remoteLabel: remoteMeta.remoteLabel,
      groupJid: remoteMeta.groupJid,
      messageId: result?.key?.id || null,
      relatedMessageId: result?.key?.id || null,
      ackType: "provider_accepted",
      contentPreview: message,
      payload: {
        ack: "provider_accepted",
        latencyMs: session.lastSendLatencyMs,
      },
      occurredAt: session.lastSendFinishedAt ?? new Date(),
    });

    logStructuredSendEvent("SEND_SUCCESS", {
      chipId,
      socketInstanceId: session.socketInstanceId,
      socketState: getSocketReadyStateLabel(session),
      wsReadyState: getSocketReadyStateValue(session),
      connectionState: session.connectionState,
      jid: normalizedTarget.whatsappJid,
      latencyMs: session.lastSendLatencyMs,
      messageId: result?.key?.id || null,
      ack: "provider_accepted",
      retry: options?.retryAttempt ?? 0,
      connectionAgeMs: getConnectionAgeMs(session),
    });

    return { success: true, messageId: result?.key?.id || "" };
  } catch (error) {
    console.error(`[Chip ${chipId}] Erro ao enviar mensagem:`, error);
    logWhatsAppSendDebug({
      scope: "whatsapp_send_service",
      step: "SERVICE_SEND_ERROR",
      traceId,
      timestamp: new Date().toISOString(),
      chipId,
      errorName: error instanceof Error ? error.name : typeof error,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : null,
      rawError: error,
    });
    session.lastSendFinishedAt = new Date();
    session.lastSendLatencyMs = session.lastSendFinishedAt.getTime() - sendStartedAt.getTime();
    session.lastSendError = String(error);
    const targetPayload = phoneNumber.trim()
      ? (() => {
          try {
            return buildLogTargetPayload(phoneNumber);
          } catch {
            return { targetNumber: phoneNumber, targetGroup: undefined };
          }
        })()
      : { targetNumber: undefined, targetGroup: undefined };
    await createActivityLog({
      chipId,
      actionType: "message_sent",
      targetNumber: targetPayload.targetNumber,
      targetGroup: targetPayload.targetGroup,
      messageContent: message,
      errorMessage: String(error),
      status: "failed",
    });

    logStructuredSendEvent("SEND_FAILED", {
      chipId,
      socketInstanceId: session.socketInstanceId,
      socketState: getSocketReadyStateLabel(session),
      wsReadyState: getSocketReadyStateValue(session),
      connectionState: session.connectionState,
      jid: session.lastResolvedJid,
      latencyMs: session.lastSendLatencyMs,
      retry: options?.retryAttempt ?? 0,
      connectionAgeMs: getConnectionAgeMs(session),
      lastDisconnectReason: session.lastDisconnectReason,
      lastDisconnectStatusCode: session.lastDisconnectStatusCode,
      lastDisconnectStatusLabel: getDisconnectReasonLabel(session.lastDisconnectStatusCode),
      shouldReconnect: session.lastDisconnectShouldReconnect,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

export async function sendReaction(
  chipId: number,
  targetNumber: string,
  emoji: string
) {
  const session = sessions.get(chipId);
  if (!session || !session.socket || !session.isConnected) {
    throw new Error(`Chip ${chipId} não está conectado`);
  }

  try {
    const normalizedTarget = targetNumber.includes("@g.us")
      ? normalizeGroupTarget(targetNumber)
      : normalizeNumberTarget(targetNumber);
    const targetPayload = buildLogTargetPayload(normalizedTarget.normalizedValue);

    session.lastActivity = new Date();

    await createActivityLog({
      chipId,
      actionType: "reaction_sent",
      targetNumber: targetPayload.targetNumber,
      targetGroup: targetPayload.targetGroup,
      messageContent: emoji,
      status: "success",
    });

    return { success: true };
  } catch (error) {
    console.error(`[Chip ${chipId}] Erro ao enviar reação:`, error);
    await createActivityLog({
      chipId,
      actionType: "reaction_sent",
      errorMessage: String(error),
      status: "failed",
    });
    throw error;
  }
}

export async function syncChipContacts(chipId: number) {
  const session = requireConnectedSession(chipId);
  session.lastActivity = new Date();

  const contactsCount = getSessionContactsCount(session);
  await createPassiveTimelineEvent(
    chipId,
    "contacts_synced",
    "syncChipContacts",
    {
      contactsCount,
      socketInstanceId: session.socketInstanceId,
    },
    {
      contentPreview: `${contactsCount} contatos sincronizados`,
    }
  );

  return {
    success: true,
    contactsCount,
  };
}

export async function addChipContact(chipId: number, targetNumber: string, displayName: string) {
  const session = requireConnectedSession(chipId);
  const resolvedTarget = await resolveExactTargetJid(session, targetNumber);
  const socket = session.socket as any;
  const contactRecord = {
    id: resolvedTarget.whatsappJid,
    name: displayName,
    notify: displayName,
    verifiedName: displayName,
    lid: resolvedTarget.whatsappJid,
  };

  const storedOnSocket = upsertSessionCollectionEntry(socket?.contacts, resolvedTarget.whatsappJid, contactRecord);
  const storedOnStore = upsertSessionCollectionEntry(socket?.store?.contacts, resolvedTarget.whatsappJid, contactRecord);

  session.lastActivity = new Date();
  await createPassiveTimelineEvent(
    chipId,
    "contact_added",
    "addChipContact",
    {
      displayName,
      phoneNumber: resolvedTarget.normalizedValue,
      storedOnSocket,
      storedOnStore,
    },
    {
      remoteJid: resolvedTarget.whatsappJid,
      remoteType: "number",
      remoteLabel: displayName,
      contentPreview: `${displayName} (${resolvedTarget.normalizedValue})`,
    }
  );

  return {
    success: true,
    applied: storedOnSocket || storedOnStore,
    contact: {
      jid: resolvedTarget.whatsappJid,
      displayName,
      phoneNumber: resolvedTarget.normalizedValue,
    },
    contactsCount: getSessionContactsCount(session),
  };
}

export async function updateChipProfileName(chipId: number, profileName: string) {
  const session = requireConnectedSession(chipId);
  const socket = session.socket as any;
  const updater =
    socket?.updateProfileName ||
    socket?.profileUpdateName ||
    socket?.setProfileName;

  if (typeof updater === "function") {
    await updater.call(socket, profileName);
  }

  session.lastActivity = new Date();
  await createPassiveTimelineEvent(
    chipId,
    "profile_name_updated",
    "updateChipProfileName",
    {
      profileName,
      applied: typeof updater === "function",
    },
    {
      contentPreview: profileName,
    }
  );

  return {
    success: true,
    applied: typeof updater === "function",
    profileName,
  };
}

export async function updateChipAbout(chipId: number, about: string) {
  const session = requireConnectedSession(chipId);
  const socket = session.socket as any;
  const updater =
    socket?.updateProfileStatus ||
    socket?.profileUpdateStatus ||
    socket?.setProfileStatus;

  if (typeof updater === "function") {
    await updater.call(socket, about);
  }

  session.lastActivity = new Date();
  await createPassiveTimelineEvent(
    chipId,
    "about_updated",
    "updateChipAbout",
    {
      about,
      applied: typeof updater === "function",
    },
    {
      contentPreview: about,
    }
  );

  return {
    success: true,
    applied: typeof updater === "function",
    about,
  };
}

export async function updateChipProfilePhoto(chipId: number, imageBuffer: Buffer) {
  const session = requireConnectedSession(chipId);
  const socket = session.socket as any;
  const updater = socket?.updateProfilePicture || socket?.profileUpdatePicture;
  const ownJid = jidNormalizedUser(socket?.user?.id);
  const applied = typeof updater === "function" && Boolean(ownJid);

  if (applied) {
    await updater.call(socket, ownJid, imageBuffer);
  }

  session.lastActivity = new Date();
  await createPassiveTimelineEvent(
    chipId,
    "profile_photo_updated",
    "updateChipProfilePhoto",
    {
      applied,
      hasBuffer: Boolean(imageBuffer?.length),
      bytes: imageBuffer?.length ?? 0,
    },
    {
      contentPreview: applied ? "Foto de perfil aplicada" : "Foto de perfil indisponível",
    }
  );

  return {
    success: true,
    applied,
  };
}

export async function recordChipPassiveLifecycle(
  chipId: number,
  eventType: "wake_up" | "idle" | "sleep"
) {
  const session = requireConnectedSession(chipId);
  session.lastActivity = new Date();

  await createPassiveTimelineEvent(
    chipId,
    eventType,
    "recordChipPassiveLifecycle",
    {
      socketInstanceId: session.socketInstanceId,
      connectionState: session.connectionState,
    },
    {
      contentPreview:
        eventType === "wake_up"
          ? "Chip despertou para rotina passiva"
          : eventType === "idle"
            ? "Chip em período ocioso"
            : "Chip voltou para janela offline",
    }
  );

  return {
    success: true,
    eventType,
  };
}

export async function openChipChatList(chipId: number) {
  const session = requireConnectedSession(chipId);
  session.lastActivity = new Date();

  const contactsCount = getSessionContactsCount(session);
  const chatsCount = getSessionChatsCount(session);
  const groups = await listChipGroups(chipId);

  await createPassiveTimelineEvent(
    chipId,
    "chat_list_opened",
    "openChipChatList",
    {
      contactsCount,
      chatsCount,
      groupsCount: groups.length,
    },
    {
      contentPreview: `${chatsCount} conversas e ${groups.length} grupos observados`,
    }
  );

  return {
    success: true,
    chatsCount,
    contactsCount,
    groupsCount: groups.length,
  };
}

export async function viewChipStatus(chipId: number) {
  const session = requireConnectedSession(chipId);
  session.lastActivity = new Date();

  await createPassiveTimelineEvent(
    chipId,
    "status_viewed",
    "viewChipStatus",
    {
      contactsCount: getSessionContactsCount(session),
      chatsCount: getSessionChatsCount(session),
    },
    {
      contentPreview: "Status observados pela rotina passiva",
    }
  );

  return {
    success: true,
  };
}

export async function openChipGroupConversation(chipId: number, groupJid: string) {
  const session = requireConnectedSession(chipId);
  const metadata = await (session.socket as any).groupMetadata(groupJid);
  const participantCount = Array.isArray(metadata?.participants) ? metadata.participants.length : Number(metadata?.size || 0);
  const normalizedGroupJid = String(metadata?.id || groupJid || "");
  const groupSubject = String(metadata?.subject || "Grupo sem nome");

  session.lastActivity = new Date();

  await createPassiveTimelineEvent(
    chipId,
    "group_opened",
    "openChipGroupConversation",
    {
      participantCount,
    },
    {
      remoteJid: normalizedGroupJid,
      remoteType: "group",
      remoteLabel: groupSubject,
      groupJid: normalizedGroupJid,
      groupSubject,
      contentPreview: groupSubject,
    }
  );

  await createPassiveTimelineEvent(
    chipId,
    "participants_loaded",
    "openChipGroupConversation",
    {
      participantCount,
    },
    {
      remoteJid: normalizedGroupJid,
      remoteType: "group",
      remoteLabel: groupSubject,
      groupJid: normalizedGroupJid,
      groupSubject,
      contentPreview: `${participantCount} participantes carregados`,
    }
  );

  return {
    success: true,
    group: {
      id: normalizedGroupJid,
      subject: groupSubject,
      size: participantCount,
    },
  };
}

export function getChipSession(chipId: number) {
  return sessions.get(chipId);
}

export function getAllSessions() {
  return Array.from(sessions.entries()).map(([chipId, session]) => ({
    chipId,
    isConnected: session.isConnected,
    lastActivity: session.lastActivity,
    hasQR: !!session.qrCode,
  }));
}

export async function getChipHealth(chipId: number, userId: number, phoneNumber?: string | null) {
  const session = sessions.get(chipId) ?? null;
  const logs = await searchUserActivityLogs({
    userId,
    chipId,
    limit: 50,
  });
  const pendingJobs = await countPendingExecutionJobsForChip(chipId);

  const lastSendLog = logs.find((log) => log.actionType === "message_sent");
  const lastReceiveLog = logs.find((log) => log.actionType === "message_received");

  return {
    chipId,
    connected: Boolean(session?.isConnected),
    socketState: getSocketReadyStateLabel(session),
    wsReadyState: getSocketReadyStateValue(session),
    connectionState: session?.connectionState ?? "missing",
    socketInstanceId: session?.socketInstanceId ?? null,
    lastReconnect: session?.lastReconnectAt?.toISOString() ?? null,
    lastDisconnectAt: session?.lastDisconnectAt?.toISOString() ?? null,
    lastDisconnectReason: session?.lastDisconnectReason ?? null,
    lastDisconnectStatusCode: session?.lastDisconnectStatusCode ?? null,
    lastDisconnectStatusLabel: getDisconnectReasonLabel(session?.lastDisconnectStatusCode ?? null),
    shouldReconnect: session?.lastDisconnectShouldReconnect ?? null,
    lastSend: session?.lastSendFinishedAt?.toISOString() ?? lastSendLog?.createdAt ?? null,
    lastSendError: session?.lastSendError ?? lastSendLog?.errorMessage ?? null,
    lastReceive: session?.lastReceiveAt?.toISOString() ?? lastReceiveLog?.createdAt ?? null,
    phoneNumber: phoneNumber ?? extractPhoneNumberFromJid((session?.socket as any)?.user?.id) ?? null,
    sessionAgeMinutes: session?.connectedAt ? Math.round((Date.now() - session.connectedAt.getTime()) / 60000) : 0,
    pendingJobs,
    healthScore: computeChipHealthScore(session, pendingJobs),
    lastResolvedJid: session?.lastResolvedJid ?? null,
    lastSendLatencyMs: session?.lastSendLatencyMs ?? null,
  };
}

export function getChipSocketDiagnostics(chipId: number) {
  return buildSocketDiagnostics(sessions.get(chipId) ?? null);
}

export async function listChipGroups(chipId: number) {
  const session = sessions.get(chipId);
  if (!session || !session.socket || !session.isConnected) {
    throw new Error(`Chip ${chipId} não está conectado`);
  }

  const groupsMap = await (session.socket as any).groupFetchAllParticipating();
  const groups = Object.values(groupsMap || {}).map((group: any) => ({
    id: String(group.id),
    subject: String(group.subject || "Grupo sem nome"),
    size: Array.isArray(group.participants) ? group.participants.length : 0,
    announce: Boolean(group.announce),
  }));

  return groups.sort((a, b) => a.subject.localeCompare(b.subject, "pt-BR"));
}

export async function previewGroupInvite(chipId: number, inviteLinkOrCode: string) {
  const session = sessions.get(chipId);
  if (!session || !session.socket || !session.isConnected) {
    throw new Error(`Chip ${chipId} não está conectado`);
  }

  const inviteCode = extractInviteCode(inviteLinkOrCode);
  const inviteInfo = await (session.socket as any).groupGetInviteInfo(inviteCode);

  return {
    inviteCode,
    id: String(inviteInfo?.id || ""),
    subject: String(inviteInfo?.subject || "Grupo sem nome"),
    size: Array.isArray(inviteInfo?.participants) ? inviteInfo.participants.length : Number(inviteInfo?.size || 0),
  };
}

export async function joinGroupByInvite(chipId: number, inviteLinkOrCode: string) {
  const session = sessions.get(chipId);
  if (!session || !session.socket || !session.isConnected) {
    throw new Error(`Chip ${chipId} não está conectado`);
  }

  const inviteCode = extractInviteCode(inviteLinkOrCode);
  const groupJid = await (session.socket as any).groupAcceptInvite(inviteCode);
  const metadata = await (session.socket as any).groupMetadata(groupJid);

  session.lastActivity = new Date();

  await createBehaviorTimelineEvent({
    chipId,
    eventType: "group_joined",
    source: "groupAcceptInvite",
    direction: "system",
    remoteJid: String(metadata?.id || groupJid || ""),
    remoteType: "group",
    remoteLabel: String(metadata?.subject || "Grupo sem nome"),
    groupJid: String(metadata?.id || groupJid || ""),
    groupSubject: String(metadata?.subject || "Grupo sem nome"),
    payload: {
      inviteCode,
      participantCount: Array.isArray(metadata?.participants) ? metadata.participants.length : Number(metadata?.size || 0),
    },
    occurredAt: new Date(),
  });

  return {
    id: String(metadata?.id || groupJid),
    subject: String(metadata?.subject || "Grupo sem nome"),
    size: Array.isArray(metadata?.participants) ? metadata.participants.length : 0,
  };
}

export async function createChipGroup(
  chipId: number,
  subject: string,
  participantNumbers: string[]
) {
  const session = requireConnectedSession(chipId);
  const participantJids: string[] = [];

  for (const rawParticipant of participantNumbers) {
    const resolved = await resolveExactTargetJid(session, rawParticipant);
    participantJids.push(resolved.whatsappJid);
  }

  const result = await (session.socket as any).groupCreate(subject, participantJids);
  const groupJid = String(result?.id || "");
  const metadata = groupJid ? await (session.socket as any).groupMetadata(groupJid) : null;
  const normalizedGroupJid = String(metadata?.id || groupJid || "");
  const participantCount = Array.isArray(metadata?.participants) ? metadata.participants.length : participantJids.length;

  session.lastActivity = new Date();
  await createPassiveTimelineEvent(
    chipId,
    "group_created",
    "groupCreate",
    {
      participantCount,
      participantJids,
    },
    {
      remoteJid: normalizedGroupJid,
      remoteType: "group",
      remoteLabel: subject,
      groupJid: normalizedGroupJid,
      groupSubject: subject,
      contentPreview: subject,
    }
  );

  return {
    success: true,
    id: normalizedGroupJid,
    subject,
    size: participantCount,
  };
}

export async function leaveChipGroup(chipId: number, groupJid: string) {
  const session = requireConnectedSession(chipId);
  const normalized = normalizeGroupTarget(groupJid);
  await (session.socket as any).groupLeave(normalized.whatsappJid);
  session.lastActivity = new Date();

  await createPassiveTimelineEvent(
    chipId,
    "group_left",
    "groupLeave",
    {},
    {
      remoteJid: normalized.whatsappJid,
      remoteType: "group",
      groupJid: normalized.whatsappJid,
      contentPreview: normalized.normalizedValue,
    }
  );

  return {
    success: true,
    groupJid: normalized.whatsappJid,
  };
}

export async function setChipPresenceState(
  chipId: number,
  state: "online" | "offline" | "reading" | "typing" | "recording" | "away",
  targetJid?: string | null
) {
  const session = requireConnectedSession(chipId);
  const presenceMap: Record<string, "available" | "unavailable" | "composing" | "recording" | "paused"> = {
    online: "available",
    offline: "unavailable",
    reading: "available",
    typing: "composing",
    recording: "recording",
    away: "paused",
  };
  const eventMap = {
    online: "presence_online",
    offline: "presence_offline",
    reading: "presence_reading",
    typing: "presence_typing",
    recording: "presence_recording",
    away: "presence_away",
  } as const;

  const target = targetJid?.trim() ? targetJid.trim() : undefined;
  await (session.socket as any).sendPresenceUpdate(presenceMap[state], target);
  session.lastActivity = new Date();

  await createPassiveTimelineEvent(
    chipId,
    eventMap[state],
    "setChipPresenceState",
    {
      state,
      targetJid: target ?? null,
    },
    {
      remoteJid: target ?? null,
      remoteType: target?.includes("@g.us") ? "group" : target ? "number" : null,
      groupJid: target?.includes("@g.us") ? target : null,
      contentPreview: state,
    }
  );

  return {
    success: true,
    state,
    targetJid: target ?? null,
  };
}

export async function markMessagesAsRead(
  chipId: number,
  keys: Array<{ remoteJid: string; id: string; fromMe?: boolean; participant?: string }>
) {
  const session = sessions.get(chipId);
  if (!session || !session.socket || !session.isConnected) {
    throw new Error(`Chip ${chipId} não está conectado`);
  }

  if (!Array.isArray(keys) || keys.length === 0) {
    throw new Error("Nenhuma mensagem informada para marcação de leitura");
  }

  await (session.socket as any).readMessages(keys);
  session.lastActivity = new Date();

  const firstKey = keys[0];
  const remoteMeta = buildTimelineRemoteMeta(firstKey?.remoteJid);
  await createBehaviorTimelineEvent({
    chipId,
    eventType: "messages_read",
    source: "readMessages",
    direction: "system",
    remoteJid: remoteMeta.remoteJid,
    remoteType: remoteMeta.remoteType,
    remoteLabel: remoteMeta.remoteLabel,
    groupJid: remoteMeta.groupJid,
    messageId: firstKey?.id ?? null,
    payload: {
      count: keys.length,
      keys,
    },
    occurredAt: new Date(),
  });

  return {
    success: true,
    count: keys.length,
  };
}

export async function disconnectChip(chipId: number) {
  const session = sessions.get(chipId);
  if (session && session.socket) {
    try {
      await session.socket.logout();
      session.socket.end(undefined);
    } catch (error) {
      console.error(`[Chip ${chipId}] Erro ao desconectar:`, error);
    }
  }
  sessions.delete(chipId);
  initializingChips.delete(chipId);
  await updateChipStatus(chipId, "desconectado");
}
