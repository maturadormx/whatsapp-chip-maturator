import { asc, eq, sql } from "drizzle-orm";
import { chipAuditEvidences, type ChipAuditEvidenceRow } from "../../../drizzle/schema";
import { getDb } from "../../db";
import type { AppendChipAuditEvidenceInput, ChipAuditEvidence, ChipAuditEvidenceStore } from "./audit";

function mapRow(row: ChipAuditEvidenceRow): ChipAuditEvidence {
  return {
    evidence_id: row.evidenceId,
    chip_id: row.chipId,
    evidence_type: row.evidenceType as ChipAuditEvidence["evidence_type"],
    recorded_at: row.recordedAt.toISOString(),
    payload: JSON.parse(row.payload) as Record<string, unknown>,
  };
}

function isDuplicateKeyError(error: unknown): boolean {
  const code = String((error as { code?: string })?.code ?? "");
  const message = String((error as { message?: string })?.message ?? "");
  return code === "ER_DUP_ENTRY" || /duplicate/i.test(message);
}

export class MysqlChipAuditEvidenceStore implements ChipAuditEvidenceStore {
  private tableEnsured = false;

  private async ensureTable() {
    if (this.tableEnsured) return;

    const db = await getDb();
    if (!db) throw new Error("DATABASE_UNAVAILABLE");

    await (db as any).execute?.(sql`
      CREATE TABLE IF NOT EXISTS chip_audit_evidences (
        id INT AUTO_INCREMENT PRIMARY KEY,
        evidenceId VARCHAR(191) NOT NULL,
        chipId VARCHAR(191) NOT NULL,
        evidenceType VARCHAR(64) NOT NULL,
        recordedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        payload MEDIUMTEXT NOT NULL,
        UNIQUE KEY ux_chip_audit_evidences_evidenceId (evidenceId),
        KEY ix_chip_audit_evidences_chipId_recordedAt (chipId, recordedAt)
      )
    `);

    this.tableEnsured = true;
  }

  async appendEvidence(input: AppendChipAuditEvidenceInput): Promise<ChipAuditEvidence> {
    await this.ensureTable();
    const db = await getDb();
    if (!db) throw new Error("DATABASE_UNAVAILABLE");

    try {
      const recordedAt = new Date();
      await db.insert(chipAuditEvidences).values({
        evidenceId: input.evidence_id,
        chipId: input.chip_id,
        evidenceType: input.evidence_type,
        recordedAt,
        payload: JSON.stringify(input.payload),
      });

      return {
        ...input,
        recorded_at: recordedAt.toISOString(),
      };
    } catch (error) {
      if (!isDuplicateKeyError(error)) {
        throw error;
      }

      const rows = await db.select().from(chipAuditEvidences).where(eq(chipAuditEvidences.evidenceId, input.evidence_id)).limit(1);
      if (!rows[0]) throw error;
      return mapRow(rows[0]);
    }
  }

  async getEvidenceByChip(chipId: string): Promise<ChipAuditEvidence[]> {
    await this.ensureTable();
    const db = await getDb();
    if (!db) throw new Error("DATABASE_UNAVAILABLE");

    const rows = await db.select().from(chipAuditEvidences).where(eq(chipAuditEvidences.chipId, chipId)).orderBy(asc(chipAuditEvidences.recordedAt));
    return rows.map(mapRow);
  }
}
