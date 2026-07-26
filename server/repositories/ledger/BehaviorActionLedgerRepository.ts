export type BehaviorActionLedgerStatus = "PENDING" | "SENDING" | "ACKED" | "FAILED" | "RETRYING";
export type BehaviorActionBudgetState = "NOT_RESERVED" | "RESERVED" | "COMMITTED" | "RELEASED";

export type BehaviorActionLedgerRecord = {
  id: string;
  decisionId: string;
  userId: number;
  chipId: number;
  requestedAction: string;
  targetType: "number" | "group" | "list" | "chip";
  targetValue: string;
  messageId: string | null;
  status: BehaviorActionLedgerStatus;
  budgetState: BehaviorActionBudgetState;
  attempt: number;
  recoverable?: number;
  maxAttempts?: number;
  nextRetryAt?: Date | null;
  lastRetryAt?: Date | null;
  payload?: string | null;
  error?: string | null;
  sentAt?: Date | null;
  ackAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
};

export type CreateBehaviorActionLedgerRecord = Omit<
  BehaviorActionLedgerRecord,
  "status" | "budgetState" | "attempt" | "messageId"
> & {
  status?: BehaviorActionLedgerStatus;
  budgetState?: BehaviorActionBudgetState;
  attempt?: number;
  messageId?: string | null;
};

export type UpdateBehaviorActionLedgerRecord = Partial<
  Omit<BehaviorActionLedgerRecord, "id" | "decisionId" | "userId" | "chipId" | "requestedAction" | "targetType" | "targetValue">
>;

export interface BehaviorActionLedgerRepository {
  create(record: CreateBehaviorActionLedgerRecord): Promise<unknown>;
  findById(executionId: string): Promise<BehaviorActionLedgerRecord | null>;
  update(executionId: string, data: UpdateBehaviorActionLedgerRecord): Promise<unknown>;
  listRecoverable(now?: Date, limit?: number): Promise<BehaviorActionLedgerRecord[]>;
}
