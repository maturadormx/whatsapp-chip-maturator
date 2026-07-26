import { sql } from "drizzle-orm";
import { getDb } from "../../db";
import { getDefaultChipEventStore } from "../chipInfrastructure";
import { recordAuditEvent } from "../audit/AuditEngine";
import { getInternalEventBus } from "../events/InternalEventBus";
import { MemoryEventStore } from "../../infrastructure/event-store/MemoryEventStore";
import { MysqlEventStore } from "../../infrastructure/persistence/mysql/MysqlEventStore";

function getObservationEventStore() {
  return process.env.DATABASE_URL ? new MysqlEventStore() : new MemoryEventStore();
}

export async function listReplayStreams(limit = 50) {
  const db = await getDb();
  if (!db) {
    return {
      observationStreams: [],
      chipStreams: [],
    };
  }

  const [observationRows, chipRows] = await Promise.all([
    (db as any).execute?.(sql`
      SELECT stream, MAX(version) AS lastVersion, MAX(createdAt) AS lastCreatedAt
      FROM observation_runtime_events
      GROUP BY stream
      ORDER BY MAX(createdAt) DESC
      LIMIT ${limit}
    `),
    (db as any).execute?.(sql`
      SELECT chipId, MAX(sequence) AS lastSequence, MAX(recordedAt) AS lastRecordedAt
      FROM chip_event_history
      GROUP BY chipId
      ORDER BY MAX(recordedAt) DESC
      LIMIT ${limit}
    `),
  ]);

  return {
    observationStreams: Array.isArray((observationRows as any)?.rows) ? (observationRows as any).rows : [],
    chipStreams: Array.isArray((chipRows as any)?.rows) ? (chipRows as any).rows : [],
  };
}

export async function replayObservationStream(params: {
  stream: string;
  fromVersion?: number;
  limit?: number;
  dryRun?: boolean;
  userId?: number | null;
}) {
  const store = getObservationEventStore();
  const events = await store.get(params.stream);
  const filtered = events
    .filter((event) => (params.fromVersion ? (event.version ?? 0) >= params.fromVersion : true))
    .slice(0, params.limit ?? 200);

  if (!params.dryRun) {
    for (const event of filtered) {
      await getInternalEventBus().publish({
        type: "message_replay.observation_event",
        source: "MessageReplayService",
        payload: {
          stream: params.stream,
          event,
        },
      });
    }
  }

  await recordAuditEvent({
    userId: params.userId ?? null,
    engine: "MessageReplayService",
    action: params.dryRun ? "observation_stream_replay_preview" : "observation_stream_replayed",
    entityType: "observation_stream",
    entityId: params.stream,
    payload: {
      fromVersion: params.fromVersion ?? null,
      limit: params.limit ?? null,
      replayed: filtered.length,
    },
  }).catch(() => null);

  return {
    stream: params.stream,
    replayed: filtered.length,
    dryRun: Boolean(params.dryRun),
    lastVersion: filtered.at(-1)?.version ?? null,
  };
}

export async function replayChipHistory(params: {
  chipId: string;
  fromSequence?: number;
  limit?: number;
  dryRun?: boolean;
  userId?: number | null;
}) {
  const store = getDefaultChipEventStore();
  const history = await store.getHistory(params.chipId, {
    fromSequence: params.fromSequence,
    limit: params.limit,
  });

  if (!params.dryRun) {
    for (const event of history.events) {
      await getInternalEventBus().publish({
        type: "message_replay.chip_event",
        source: "MessageReplayService",
        payload: {
          chipId: params.chipId,
          event,
        },
      });
    }
  }

  await recordAuditEvent({
    userId: params.userId ?? null,
    engine: "MessageReplayService",
    action: params.dryRun ? "chip_history_replay_preview" : "chip_history_replayed",
    entityType: "chip_history",
    entityId: params.chipId,
    payload: {
      fromSequence: params.fromSequence ?? null,
      limit: params.limit ?? null,
      replayed: history.events.length,
    },
  }).catch(() => null);

  return {
    chipId: params.chipId,
    replayed: history.events.length,
    dryRun: Boolean(params.dryRun),
    lastSequence: history.events.at(-1)?.sequence ?? null,
  };
}
