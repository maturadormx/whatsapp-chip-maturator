import { asc, desc, eq, sql } from "drizzle-orm";
import { observationRuntimeEvents } from "../../../../drizzle/schema";
import { getDb } from "../../../db";
import type { EventEnvelope, EventStorePort } from "../../../ports/EventStorePort";

let _ensured = false;

async function ensureObservationRuntimeEventsTable() {
  if (_ensured) return;
  const db = await getDb();
  if (!db) return;

  await (db as any).execute?.(sql`
    CREATE TABLE IF NOT EXISTS observation_runtime_events (
      id INT AUTO_INCREMENT PRIMARY KEY,
      stream VARCHAR(191) NOT NULL,
      version INT NOT NULL,
      type VARCHAR(120) NOT NULL,
      occurredAt VARCHAR(64) NOT NULL,
      payload MEDIUMTEXT NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX observation_runtime_events_stream_idx (stream),
      UNIQUE KEY observation_runtime_events_stream_version_uidx (stream, version)
    )
  `);
  _ensured = true;
}

export class MysqlEventStore implements EventStorePort {
  async append(stream: string, event: EventEnvelope, expectedVersion?: number): Promise<number> {
    await ensureObservationRuntimeEventsTable();
    const db = await getDb();
    if (!db) throw new Error("mysql_not_available");

    return db.transaction(async (tx) => {
      const currentRows = await tx
        .select({ version: observationRuntimeEvents.version })
        .from(observationRuntimeEvents)
        .where(eq(observationRuntimeEvents.stream, stream))
        .orderBy(desc(observationRuntimeEvents.version))
        .limit(1);

      const currentVersion = currentRows[0]?.version ?? 0;
      if (expectedVersion !== undefined && currentVersion !== expectedVersion) {
        throw new Error(`event_store_version_conflict:${stream}:${expectedVersion}:${currentVersion}`);
      }

      const nextVersion = currentVersion + 1;
      await tx.insert(observationRuntimeEvents).values({
        stream,
        version: nextVersion,
        type: event.type,
        occurredAt: event.occurredAt,
        payload: JSON.stringify(event.payload ?? {}),
      });

      return nextVersion;
    });
  }

  async get(stream: string): Promise<EventEnvelope[]> {
    await ensureObservationRuntimeEventsTable();
    const db = await getDb();
    if (!db) throw new Error("mysql_not_available");

    const rows = await db
      .select()
      .from(observationRuntimeEvents)
      .where(eq(observationRuntimeEvents.stream, stream))
      .orderBy(asc(observationRuntimeEvents.version));

    return rows.map((row) => ({
      type: row.type,
      version: row.version,
      occurredAt: row.occurredAt,
      payload: row.payload ? JSON.parse(row.payload) : {},
    }));
  }

  async clear(): Promise<void> {
    await ensureObservationRuntimeEventsTable();
    const db = await getDb();
    if (!db) throw new Error("mysql_not_available");
    await db.delete(observationRuntimeEvents);
  }

  async ping(): Promise<boolean> {
    try {
      await ensureObservationRuntimeEventsTable();
      const db = await getDb();
      if (!db) return false;
      await (db as any).execute?.(sql`SELECT 1`);
      return true;
    } catch {
      return false;
    }
  }
}
