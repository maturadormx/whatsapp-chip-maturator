import type { AppendChipAuditEvidenceInput, ChipAuditEvidence, ChipAuditEvidenceStore } from "./audit";

export class InMemoryChipAuditEvidenceStore implements ChipAuditEvidenceStore {
  private readonly evidences: ChipAuditEvidence[] = [];
  private readonly evidenceIds = new Set<string>();

  async appendEvidence(input: AppendChipAuditEvidenceInput): Promise<ChipAuditEvidence> {
    const existing = this.evidences.find((item) => item.evidence_id === input.evidence_id);
    if (existing) {
      return existing;
    }

    const evidence: ChipAuditEvidence = {
      ...input,
      recorded_at: new Date().toISOString(),
    };

    this.evidences.push(evidence);
    this.evidenceIds.add(evidence.evidence_id);

    return evidence;
  }

  async getEvidenceByChip(chipId: string): Promise<ChipAuditEvidence[]> {
    return this.evidences.filter((item) => item.chip_id === chipId);
  }
}
