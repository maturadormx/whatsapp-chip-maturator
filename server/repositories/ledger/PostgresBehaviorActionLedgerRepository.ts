import {
  createBehaviorActionExecution,
  getBehaviorActionExecutionById,
  listRecoverableBehaviorActionExecutions,
  updateBehaviorActionExecution,
} from "../../db";
import type {
  BehaviorActionLedgerRecord,
  BehaviorActionLedgerRepository,
  CreateBehaviorActionLedgerRecord,
  UpdateBehaviorActionLedgerRecord,
} from "./BehaviorActionLedgerRepository";

export class PostgresBehaviorActionLedgerRepository implements BehaviorActionLedgerRepository {
  async create(record: CreateBehaviorActionLedgerRecord): Promise<unknown> {
    return createBehaviorActionExecution(record as any);
  }

  async findById(executionId: string): Promise<BehaviorActionLedgerRecord | null> {
    return (await getBehaviorActionExecutionById(executionId)) as BehaviorActionLedgerRecord | null;
  }

  async update(executionId: string, data: UpdateBehaviorActionLedgerRecord): Promise<unknown> {
    return updateBehaviorActionExecution(executionId, data as any);
  }

  async listRecoverable(now: Date = new Date(), limit = 25): Promise<BehaviorActionLedgerRecord[]> {
    return (await listRecoverableBehaviorActionExecutions(now, limit)) as BehaviorActionLedgerRecord[];
  }
}
