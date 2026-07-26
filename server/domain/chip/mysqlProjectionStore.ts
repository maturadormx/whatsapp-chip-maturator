import { eq, sql } from "drizzle-orm";
import { chipStateProjections, chipWorkerCheckpoints, type ChipStateProjectionRow, type ChipWorkerCheckpointRow } from "../../../drizzle/schema";
import { getDb } from "../../db";
import type { ChipProjectionStore, ChipStateProjection, ChipWorkerCheckpoint } from "./persistence";

function toProjection(row: ChipStateProjectionRow): ChipStateProjection {
  return {
    chip_id: row.chipId,
    current_state: row.currentState,
    previous_state: row.previousState,
    last_sequence: row.lastSequence,
    inconsistency_count: row.inconsistencyCount,
    updated_at: row.updatedAt.toISOString(),
  };
}

function toCheckpoint(row: ChipWorkerCheckpointRow): ChipWorkerCheckpoint {
  return {
    worker_name: row.workerName,
    last_offset: row.lastOffset,
    updated_at: row.updatedAt.toISOString(),
  };
}

export class MysqlChipProjectionStore implements ChipProjectionStore {
  private tableEnsured = false;

  private async ensureTables() {
    if (this.tableEnsured) return;

    const db = await getDb();
    if (!db) {
      throw new Error("DATABASE_UNAVAILABLE");
    }

    await (db as any).execute?.(sql`
      CREATE TABLE IF NOT EXISTS chip_state_projections (
        id INT AUTO_INCREMENT PRIMARY KEY,
        chipId VARCHAR(191) NOT NULL,
        currentState VARCHAR(64) NULL,
        previousState VARCHAR(64) NULL,
        lastSequence INT NULL,
        inconsistencyCount INT NOT NULL DEFAULT 0,
        updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY ux_chip_state_projections_chipId (chipId)
      )
    `);

    await (db as any).execute?.(sql`
      CREATE TABLE IF NOT EXISTS chip_worker_checkpoints (
        id INT AUTO_INCREMENT PRIMARY KEY,
        workerName VARCHAR(120) NOT NULL,
        lastOffset INT NOT NULL DEFAULT 0,
        updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY ux_chip_worker_checkpoints_workerName (workerName)
      )
    `);

    this.tableEnsured = true;
  }

  async saveProjection(projection: ChipStateProjection): Promise<void> {
    await this.ensureTables();
    const db = await getDb();
    if (!db) throw new Error("DATABASE_UNAVAILABLE");

    await db
      .insert(chipStateProjections)
      .values({
        chipId: projection.chip_id,
        currentState: projection.current_state,
        previousState: projection.previous_state,
        lastSequence: projection.last_sequence,
        inconsistencyCount: projection.inconsistency_count,
        updatedAt: new Date(projection.updated_at),
      })
      .onDuplicateKeyUpdate({
        set: {
          currentState: projection.current_state,
          previousState: projection.previous_state,
          lastSequence: projection.last_sequence,
          inconsistencyCount: projection.inconsistency_count,
          updatedAt: new Date(projection.updated_at),
        },
      });
  }

  async getProjection(chipId: string): Promise<ChipStateProjection | null> {
    await this.ensureTables();
    const db = await getDb();
    if (!db) throw new Error("DATABASE_UNAVAILABLE");

    const rows = await db.select().from(chipStateProjections).where(eq(chipStateProjections.chipId, chipId)).limit(1);
    return rows[0] ? toProjection(rows[0]) : null;
  }

  async saveCheckpoint(checkpoint: ChipWorkerCheckpoint): Promise<void> {
    await this.ensureTables();
    const db = await getDb();
    if (!db) throw new Error("DATABASE_UNAVAILABLE");

    await db
      .insert(chipWorkerCheckpoints)
      .values({
        workerName: checkpoint.worker_name,
        lastOffset: checkpoint.last_offset,
        updatedAt: new Date(checkpoint.updated_at),
      })
      .onDuplicateKeyUpdate({
        set: {
          lastOffset: checkpoint.last_offset,
          updatedAt: new Date(checkpoint.updated_at),
        },
      });
  }

  async getCheckpoint(workerName: string): Promise<ChipWorkerCheckpoint | null> {
    await this.ensureTables();
    const db = await getDb();
    if (!db) throw new Error("DATABASE_UNAVAILABLE");

    const rows = await db.select().from(chipWorkerCheckpoints).where(eq(chipWorkerCheckpoints.workerName, workerName)).limit(1);
    return rows[0] ? toCheckpoint(rows[0]) : null;
  }
}
