import { eq, inArray, sql } from "drizzle-orm";
import { observationRuntimeRecords } from "../../../../drizzle/schema";
import { getDb } from "../../../db";
import type { Observation } from "../../../domain/observation";
import type { ObservationRepositoryPort } from "../../../ports/ObservationRepositoryPort";
import { telemetry } from "../../../telemetry";

let _ensured = false;

async function ensureObservationRuntimeRecordsTable() {
  if (_ensured) return;
  const db = await getDb();
  if (!db) return;

  await (db as any).execute?.(sql`
    CREATE TABLE IF NOT EXISTS observation_runtime_records (
      id VARCHAR(191) PRIMARY KEY,
      source VARCHAR(120) NOT NULL,
      eventType VARCHAR(191) NOT NULL,
      payload MEDIUMTEXT NOT NULL,
      timestamp VARCHAR(64) NOT NULL,
      correlationId VARCHAR(191) NULL,
      processingStatus ENUM('PENDING','PROCESSING','PROCESSED','FAILED') NOT NULL DEFAULT 'PENDING',
      claimedBy VARCHAR(191) NULL,
      claimedAt TIMESTAMP NULL,
      leaseExpiresAt TIMESTAMP NULL,
      processedAt TIMESTAMP NULL,
      lastError TEXT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX observation_runtime_records_status_idx (processingStatus),
      INDEX observation_runtime_records_claimed_by_idx (claimedBy),
      INDEX observation_runtime_records_correlation_idx (correlationId),
      INDEX observation_runtime_records_lease_idx (leaseExpiresAt)
    )
  `);
  _ensured = true;
}

export class MysqlObservationRepository implements ObservationRepositoryPort {
  async save(observation: Observation): Promise<void> {
    await telemetry.withSpan(
      "repository.save",
      async () => {
        await ensureObservationRuntimeRecordsTable();
        const db = await getDb();
        if (!db) throw new Error("mysql_not_available");

        await db
          .insert(observationRuntimeRecords)
          .values({
            id: observation.id,
            source: observation.source,
            eventType: observation.eventType,
            payload: JSON.stringify(observation.payload ?? {}),
            timestamp: observation.timestamp,
            correlationId: observation.correlationId ?? null,
          })
          .onDuplicateKeyUpdate({
            set: {
              source: observation.source,
              eventType: observation.eventType,
              payload: JSON.stringify(observation.payload ?? {}),
              timestamp: observation.timestamp,
              correlationId: observation.correlationId ?? null,
            },
          });
      },
      {
        attributes: {
          "observation.id": observation.id,
        },
      },
    );
  }

  async findById(id: string): Promise<Observation | null> {
    return telemetry.withSpan(
      "repository.findById",
      async () => {
        await ensureObservationRuntimeRecordsTable();
        const db = await getDb();
        if (!db) throw new Error("mysql_not_available");

        const rows = await db.select().from(observationRuntimeRecords).where(eq(observationRuntimeRecords.id, id)).limit(1);
        const row = rows[0];
        if (!row) return null;
        return {
          id: row.id,
          source: row.source,
          eventType: row.eventType,
          payload: row.payload ? JSON.parse(row.payload) : {},
          timestamp: row.timestamp,
          correlationId: row.correlationId ?? undefined,
        };
      },
      {
        attributes: {
          "observation.id": id,
        },
      },
    );
  }

  async claimPending(limit: number, workerId: string): Promise<Observation[]> {
    return telemetry.withSpan(
      "repository.claimPending",
      async (span) => {
        await ensureObservationRuntimeRecordsTable();
        const db = await getDb();
        if (!db) throw new Error("mysql_not_available");

        const claimed = await db.transaction(async (tx) => {
          const claimedRowsResult = await (tx as any).execute(sql`
            SELECT id
            FROM observation_runtime_records
            WHERE (
              processingStatus = 'PENDING'
              OR processingStatus = 'FAILED'
              OR (processingStatus = 'PROCESSING' AND (leaseExpiresAt IS NULL OR leaseExpiresAt < CURRENT_TIMESTAMP))
            )
            ORDER BY createdAt ASC
            LIMIT ${limit}
            FOR UPDATE SKIP LOCKED
          `);

          const claimedRows = Array.isArray(claimedRowsResult?.[0])
            ? claimedRowsResult[0]
            : claimedRowsResult?.rows ?? claimedRowsResult ?? [];

          const ids = (claimedRows as any[])
            .map((row: any) => row?.id)
            .filter((id: unknown): id is string => typeof id === "string" && id.length > 0);

          if (ids.length === 0) return [];

          await tx
            .update(observationRuntimeRecords)
            .set({
              processingStatus: "PROCESSING",
              claimedBy: workerId,
              claimedAt: sql`CURRENT_TIMESTAMP`,
              leaseExpiresAt: sql`DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 5 MINUTE)`,
              lastError: null,
            })
            .where(inArray(observationRuntimeRecords.id, ids));

          const rows = await tx.select().from(observationRuntimeRecords).where(inArray(observationRuntimeRecords.id, ids));
          return rows.map((row) => ({
            id: row.id,
            source: row.source,
            eventType: row.eventType,
            payload: row.payload ? JSON.parse(row.payload) : {},
            timestamp: row.timestamp,
            correlationId: row.correlationId ?? undefined,
          }));
        });

        telemetry.addEvent(span, "observations_claimed", { count: claimed.length });
        return claimed;
      },
      {
        attributes: {
          "queue.batch_size": limit,
        },
      },
    );
  }

  async completeProcessing(id: string, success: boolean, error?: string): Promise<void> {
    await telemetry.withSpan(
      "repository.completeProcessing",
      async () => {
        await ensureObservationRuntimeRecordsTable();
        const db = await getDb();
        if (!db) throw new Error("mysql_not_available");

        await db
          .update(observationRuntimeRecords)
          .set({
            processingStatus: success ? "PROCESSED" : "FAILED",
            claimedBy: null,
            claimedAt: null,
            leaseExpiresAt: null,
            processedAt: sql`CURRENT_TIMESTAMP`,
            lastError: error ?? null,
          })
          .where(eq(observationRuntimeRecords.id, id));
      },
      {
        attributes: {
          "observation.id": id,
          "processing.success": success,
        },
      },
    );
  }

  async clear(): Promise<void> {
    await ensureObservationRuntimeRecordsTable();
    const db = await getDb();
    if (!db) throw new Error("mysql_not_available");
    await db.delete(observationRuntimeRecords);
  }

  async ping(): Promise<boolean> {
    try {
      await ensureObservationRuntimeRecordsTable();
      const db = await getDb();
      if (!db) return false;
      await (db as any).execute?.(sql`SELECT 1`);
      return true;
    } catch {
      return false;
    }
  }
}
