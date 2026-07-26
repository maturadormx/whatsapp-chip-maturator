import { and, asc, desc, eq, gt, gte, lte, sql } from "drizzle-orm";
import { chipEventHistory, type ChipEventHistoryRow } from "../../../drizzle/schema";
import { getDb } from "../../db";
import { createRecordedEvent, type AppendChipEventInput, type ChipEventStore, type ChipHistorySlice } from "./persistence";
import type { ChipEventRecord } from "./types";

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function parseJsonObject(value: string | null): Record<string, unknown> | undefined {
  if (!value) return undefined;
  const parsed = JSON.parse(value) as unknown;
  return parsed !== null && typeof parsed === "object" ? (parsed as Record<string, unknown>) : undefined;
}

function mapRowToEvent(row: ChipEventHistoryRow): ChipEventRecord {
  return {
    event_id: row.eventId,
    chip_id: row.chipId,
    event_type: row.eventType,
    event_version: row.eventVersion,
    sequence: row.sequence,
    occurred_at: toIsoString(row.occurredAt),
    recorded_at: toIsoString(row.recordedAt),
    payload: parseJsonObject(row.payload) ?? {},
    metadata: parseJsonObject(row.metadata),
  };
}

function isDuplicateKeyError(error: unknown): boolean {
  const code = String((error as { code?: string })?.code ?? "");
  const message = String((error as { message?: string })?.message ?? "");
  return code === "ER_DUP_ENTRY" || /duplicate/i.test(message);
}

export class MysqlChipEventStore implements ChipEventStore {
  private tableEnsured = false;

  private async ensureTable() {
    if (this.tableEnsured) return;

    const db = await getDb();
    if (!db) {
      throw new Error("DATABASE_UNAVAILABLE");
    }

    await (db as any).execute?.(sql`
      CREATE TABLE IF NOT EXISTS chip_event_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        eventId VARCHAR(191) NOT NULL,
        chipId VARCHAR(191) NOT NULL,
        eventType VARCHAR(100) NOT NULL,
        eventVersion INT NOT NULL,
        sequence INT NOT NULL,
        occurredAt TIMESTAMP NOT NULL,
        recordedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        payload MEDIUMTEXT NOT NULL,
        metadata MEDIUMTEXT NULL,
        UNIQUE KEY ux_chip_event_history_eventId (eventId),
        UNIQUE KEY ux_chip_event_history_chipId_sequence (chipId, sequence),
        KEY ix_chip_event_history_chipId_sequence (chipId, sequence)
      )
    `);

    this.tableEnsured = true;
  }

  async append(event: AppendChipEventInput): Promise<ChipEventRecord> {
    await this.ensureTable();
    const db = await getDb();
    if (!db) {
      throw new Error("DATABASE_UNAVAILABLE");
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const persisted = await db.transaction(async (tx) => {
          const existing = await tx.select().from(chipEventHistory).where(eq(chipEventHistory.eventId, event.event_id)).limit(1);
          if (existing[0]) {
            return mapRowToEvent(existing[0]);
          }

          const [lastRow] = await tx
            .select({ sequence: chipEventHistory.sequence })
            .from(chipEventHistory)
            .where(eq(chipEventHistory.chipId, event.chip_id))
            .orderBy(desc(chipEventHistory.sequence))
            .limit(1);

          const nextSequence = (lastRow?.sequence ?? 0) + 1;
          const recordedAt = new Date().toISOString();

          await tx.insert(chipEventHistory).values({
            eventId: event.event_id,
            chipId: event.chip_id,
            eventType: event.event_type,
            eventVersion: event.event_version,
            sequence: nextSequence,
            occurredAt: new Date(event.occurred_at),
            recordedAt: new Date(recordedAt),
            payload: JSON.stringify(event.payload),
            metadata: event.metadata ? JSON.stringify(event.metadata) : null,
          });

          return createRecordedEvent(event, nextSequence, recordedAt);
        });

        return persisted;
      } catch (error) {
        if (isDuplicateKeyError(error)) {
          const existing = await db.select().from(chipEventHistory).where(eq(chipEventHistory.eventId, event.event_id)).limit(1);
          if (existing[0]) {
            return mapRowToEvent(existing[0]);
          }

          if (attempt < 2) {
            continue;
          }
        }

        throw error;
      }
    }

    throw new Error("CHIP_EVENT_APPEND_FAILED");
  }

  async getHistory(
    chipId: string,
    options?: {
      fromSequence?: number;
      toSequence?: number;
      limit?: number;
    }
  ): Promise<ChipHistorySlice> {
    await this.ensureTable();
    const db = await getDb();
    if (!db) {
      throw new Error("DATABASE_UNAVAILABLE");
    }

    const filters = [eq(chipEventHistory.chipId, chipId)];

    if (options?.fromSequence !== undefined) {
      filters.push(gte(chipEventHistory.sequence, options.fromSequence));
    }

    if (options?.toSequence !== undefined) {
      filters.push(lte(chipEventHistory.sequence, options.toSequence));
    }

    let query = db.select().from(chipEventHistory).where(and(...filters)).orderBy(asc(chipEventHistory.sequence)).$dynamic();

    if (options?.limit !== undefined) {
      query = query.limit(options.limit);
    }

    const rows = await query;

    return {
      chip_id: chipId,
      mode:
        options?.fromSequence !== undefined || options?.toSequence !== undefined || options?.limit !== undefined ? "partial" : "complete",
      events: rows.map(mapRowToEvent),
    };
  }

  async listPersistedEvents(options?: { afterOffset?: number; limit?: number }) {
    await this.ensureTable();
    const db = await getDb();
    if (!db) {
      throw new Error("DATABASE_UNAVAILABLE");
    }

    let query = db.select().from(chipEventHistory).orderBy(asc(chipEventHistory.id)).$dynamic();

    if (options?.afterOffset !== undefined) {
      query = query.where(gt(chipEventHistory.id, options.afterOffset));
    }

    if (options?.limit !== undefined) {
      query = query.limit(options.limit);
    }

    const rows = await query;

    return {
      items: rows.map((row) => ({
        offset: row.id,
        event: mapRowToEvent(row),
      })),
    };
  }
}
