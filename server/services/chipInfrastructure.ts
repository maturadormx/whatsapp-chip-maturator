import {
  InMemoryChipAuditEvidenceStore,
  InMemoryChipEventStore,
  InMemoryChipProjectionStore,
  MysqlChipAuditEvidenceStore,
  MysqlChipEventStore,
  MysqlChipProjectionStore,
  type ChipAuditEvidenceStore,
  type ChipEventStore,
  type ChipProjectionStore,
} from "../domain/chip";

let defaultChipEventStore: ChipEventStore | null = null;
let defaultChipProjectionStore: ChipProjectionStore | null = null;
let defaultChipAuditEvidenceStore: ChipAuditEvidenceStore | null = null;

export function getDefaultChipEventStore(): ChipEventStore {
  if (!defaultChipEventStore) {
    defaultChipEventStore = process.env.DATABASE_URL ? new MysqlChipEventStore() : new InMemoryChipEventStore();
  }

  return defaultChipEventStore;
}

export function getDefaultChipProjectionStore(): ChipProjectionStore {
  if (!defaultChipProjectionStore) {
    defaultChipProjectionStore = process.env.DATABASE_URL ? new MysqlChipProjectionStore() : new InMemoryChipProjectionStore();
  }

  return defaultChipProjectionStore;
}

export function getDefaultChipAuditEvidenceStore(): ChipAuditEvidenceStore {
  if (!defaultChipAuditEvidenceStore) {
    defaultChipAuditEvidenceStore = process.env.DATABASE_URL ? new MysqlChipAuditEvidenceStore() : new InMemoryChipAuditEvidenceStore();
  }

  return defaultChipAuditEvidenceStore;
}
