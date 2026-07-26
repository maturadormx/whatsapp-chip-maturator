export const CHIP_AUDIT_EVIDENCE_TYPES = ["REPLAY_VALIDATION", "INCONSISTENCY_DETECTION", "CONFORMITY_VERIFICATION"] as const;

export type ChipAuditEvidenceType = (typeof CHIP_AUDIT_EVIDENCE_TYPES)[number];

export type ChipAuditEvidence = {
  evidence_id: string;
  chip_id: string;
  evidence_type: ChipAuditEvidenceType;
  recorded_at: string;
  payload: Record<string, unknown>;
};

export type AppendChipAuditEvidenceInput = Omit<ChipAuditEvidence, "recorded_at"> & {
  recorded_at?: never;
};

export type ChipAuditEvidenceStore = {
  appendEvidence(input: AppendChipAuditEvidenceInput): Promise<ChipAuditEvidence>;
  getEvidenceByChip(chipId: string): Promise<ChipAuditEvidence[]>;
};
