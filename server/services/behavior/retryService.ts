import type { BehaviorActionLedgerRepository } from "../../repositories/ledger";
import { PostgresBehaviorActionLedgerRepository } from "../../repositories/ledger";
import { retryBehaviorActionExecution } from "./executionService";

type RetryServiceDeps = {
  ledgerRepository: BehaviorActionLedgerRepository;
  retryExecution: typeof retryBehaviorActionExecution;
};

const defaultDeps: RetryServiceDeps = {
  ledgerRepository: new PostgresBehaviorActionLedgerRepository(),
  retryExecution: retryBehaviorActionExecution,
};

export type RetryCycleResult = {
  scanned: number;
  retried: number;
  skipped: number;
  failed: number;
  executionIds: string[];
};

export async function runBehaviorRetryCycle(
  options: {
    now?: Date;
    limit?: number;
  } = {},
  deps: Partial<RetryServiceDeps> = {},
): Promise<RetryCycleResult> {
  const runtime = { ...defaultDeps, ...deps };
  const executions = await runtime.ledgerRepository.listRecoverable(options.now ?? new Date(), options.limit ?? 25);

  const result: RetryCycleResult = {
    scanned: executions.length,
    retried: 0,
    skipped: 0,
    failed: 0,
    executionIds: [],
  };

  for (const execution of executions) {
    result.executionIds.push(execution.id);
    try {
      const retryResult = await runtime.retryExecution({ executionId: execution.id });
      if (retryResult) {
        result.retried += 1;
      } else {
        result.skipped += 1;
      }
    } catch {
      result.failed += 1;
    }
  }

  return result;
}
