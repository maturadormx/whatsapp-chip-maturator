import type {
  BehaviorActionLedgerRecord,
  BehaviorActionLedgerRepository,
  CreateBehaviorActionLedgerRecord,
  UpdateBehaviorActionLedgerRecord,
} from "./BehaviorActionLedgerRepository";

export class InMemoryBehaviorActionLedgerRepository implements BehaviorActionLedgerRepository {
  private readonly store = new Map<string, BehaviorActionLedgerRecord>();

  async create(record: CreateBehaviorActionLedgerRecord): Promise<void> {
    this.store.set(record.id, {
      ...record,
      status: record.status ?? "PENDING",
      budgetState: record.budgetState ?? "NOT_RESERVED",
      attempt: record.attempt ?? 1,
      messageId: record.messageId ?? null,
    });
  }

  async findById(executionId: string): Promise<BehaviorActionLedgerRecord | null> {
    return this.store.get(executionId) ?? null;
  }

  async update(executionId: string, data: UpdateBehaviorActionLedgerRecord): Promise<void> {
    const current = this.store.get(executionId);
    if (!current) return;
    this.store.set(executionId, {
      ...current,
      ...data,
    });
  }

  async listRecoverable(now: Date = new Date(), limit = 25): Promise<BehaviorActionLedgerRecord[]> {
    return Array.from(this.store.values())
      .filter(
        (entry) =>
          entry.status === "FAILED" &&
          Number(entry.recoverable ?? 0) === 1 &&
          (!entry.nextRetryAt || entry.nextRetryAt.getTime() <= now.getTime()),
      )
      .slice(0, limit);
  }
}
