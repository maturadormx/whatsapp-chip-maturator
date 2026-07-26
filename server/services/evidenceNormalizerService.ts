export const EVIDENCE_NORMALIZER_VERSION = 1;

export type RawBehaviorEvent = {
  eventType: string;
  provider?: string | null;
  sourceType?: string | null;
  source?: string | null;
  direction?: string | null;
  occurredAt?: string | Date | null;
  remoteJid?: string | null;
  remoteType?: string | null;
  remoteLabel?: string | null;
  groupJid?: string | null;
  groupSubject?: string | null;
  contentPreview?: string | null;
  payload?: Record<string, any> | null;
};

export type EvidenceDerivation = {
  rawEventType: string;
  rawProvider: string | null;
  rawSourceType: string | null;
  rawSource: string | null;
  rawOccurredAt: Date | null;
  rawConversationKey: string | null;
  rawRemoteType: string | null;
};

export type NormalizedBehaviorEvidence = {
  origin: "maturation" | "campaign" | "human" | "recovery" | "internal" | "unknown";
  provider: string;
  sourceType: string | null;
  direction: "incoming" | "outgoing" | "system" | "unknown";
  type: string;
  remoteType: string | null;
  remoteLabel: string | null;
  conversationKey: string | null;
  conversationAge: string | null;
  hourBucket: "dawn" | "morning" | "afternoon" | "evening" | "night" | "unknown";
  responseDelayMinutes: number | null;
  initiatedBy: "chip" | "remote" | "system" | "unknown";
  evidenceSource: string | null;
  occurredAt: Date | null;
  confidence: number;
  normalizerVersion: number;
  derivation: EvidenceDerivation;
  payload: Record<string, any> | null;
};

function toDate(value?: string | Date | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function inferHourBucket(date: Date | null): NormalizedBehaviorEvidence["hourBucket"] {
  if (!date) return "unknown";
  const hour = date.getHours();
  if (hour < 6) return "dawn";
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  if (hour < 22) return "evening";
  return "night";
}

function inferOrigin(source?: string | null): NormalizedBehaviorEvidence["origin"] {
  const value = (source ?? "").toLowerCase();
  if (value.includes("maturation")) return "maturation";
  if (value.includes("campaign") || value.includes("dispatch")) return "campaign";
  if (value.includes("recovery") || value.includes("retry") || value.includes("queue")) return "recovery";
  if (value.includes("internal") || value.includes("test")) return "internal";
  if (value.includes("message_upsert") || value.includes("messages.upsert")) return "human";
  return "unknown";
}

function inferInitiatedBy(event: RawBehaviorEvent): NormalizedBehaviorEvidence["initiatedBy"] {
  if (event.direction === "outbound") return "chip";
  if (event.direction === "inbound") return "remote";
  if (event.direction === "system") return "system";
  return "unknown";
}

function clampConfidence(value: number) {
  return Math.max(0.4, Math.min(0.99, Number(value.toFixed(2))));
}

function inferConfidence(event: RawBehaviorEvent) {
  const eventType = event.eventType.toLowerCase();
  const source = (event.source ?? "").toLowerCase();

  let confidence = 0.58;

  if (eventType.includes("message_received")) confidence = 0.98;
  else if (eventType.includes("message_ack")) confidence = 0.96;
  else if (eventType.includes("message_sent")) confidence = 0.94;
  else if (eventType.includes("status_view")) confidence = 0.78;
  else if (eventType.includes("messages_read")) confidence = 0.74;
  else if (eventType.includes("group_join")) confidence = 0.86;
  else if (eventType.includes("group_open") || eventType.includes("participants_loaded")) confidence = 0.7;
  else if (eventType.includes("profile") || eventType.includes("about")) confidence = 0.68;
  else if (eventType.includes("chat_list_opened")) confidence = 0.63;
  else if (eventType.includes("session_connected") || eventType.includes("contacts_synced")) confidence = 0.88;

  if (source.includes("internal") || source.includes("test")) {
    confidence -= 0.12;
  }

  if (source.includes("queue") || source.includes("retry") || source.includes("recovery")) {
    confidence -= 0.05;
  }

  return clampConfidence(confidence);
}

export function normalizeBehaviorEvent(event: RawBehaviorEvent): NormalizedBehaviorEvidence {
  const occurredAt = toDate(event.occurredAt);
  const direction =
    event.direction === "outbound"
      ? "outgoing"
      : event.direction === "inbound"
        ? "incoming"
        : event.direction === "system"
          ? "system"
          : "unknown";

  return {
    origin: inferOrigin(event.source),
    provider: event.provider ?? "whatsapp",
    sourceType: event.sourceType ?? null,
    direction,
    type: event.eventType,
    remoteType: event.remoteType ?? null,
    remoteLabel: event.remoteLabel ?? null,
    conversationKey: event.remoteJid ?? event.groupJid ?? null,
    conversationAge: null,
    hourBucket: inferHourBucket(occurredAt),
    responseDelayMinutes: null,
    initiatedBy: inferInitiatedBy(event),
    evidenceSource: event.source ?? null,
    occurredAt,
    confidence: inferConfidence(event),
    normalizerVersion: EVIDENCE_NORMALIZER_VERSION,
    derivation: {
      rawEventType: event.eventType,
      rawProvider: event.provider ?? "whatsapp",
      rawSourceType: event.sourceType ?? null,
      rawSource: event.source ?? null,
      rawOccurredAt: occurredAt,
      rawConversationKey: event.remoteJid ?? event.groupJid ?? null,
      rawRemoteType: event.remoteType ?? null,
    },
    payload: event.payload ?? null,
  };
}

export function normalizeBehaviorBatch(events: RawBehaviorEvent[]) {
  return events.map(normalizeBehaviorEvent);
}
