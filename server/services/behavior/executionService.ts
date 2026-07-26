import crypto from "node:crypto";
import type { Clock } from "../../clock";
import { SystemClock } from "../../clock";
import type { MessageGateway } from "../../gateways";
import type { GatewayResult } from "../../gateways/GatewayResult";
import type { OutboundMessage } from "../../gateways/OutboundMessage";
import type { BehaviorActionLedgerRepository } from "../../repositories/ledger";
import { PostgresBehaviorActionLedgerRepository } from "../../repositories/ledger";
import type { CreateBehaviorActionLedgerRecord } from "../../repositories/ledger/BehaviorActionLedgerRepository";
import { sendMessage } from "../whatsappService";
import {
  commitBudgetReservation,
  releaseBudgetReservation,
  reserveBudgetForExecution,
} from "./budgetReservationService";
import { notifyActionExecuted } from "./dispatcher";
import type { BehaviorPolicyEvaluation } from "./types";

export type BehaviorExecutionStatus = "PENDING" | "SENDING" | "ACKED" | "FAILED" | "RETRYING";
export type BehaviorBudgetState = "NOT_RESERVED" | "RESERVED" | "COMMITTED" | "RELEASED";

export type BehaviorRetryPolicy = {
  recoverable: boolean;
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
};

export type BehaviorExecutionRecord = {
  id: string;
  decisionId: string;
  userId: number;
  chipId: number;
  requestedAction: string;
  targetType: "number" | "group" | "list" | "chip";
  targetValue: string;
  recoverable: boolean;
  maxAttempts: number;
  nextRetryAt: Date | null;
  lastRetryAt: Date | null;
  payload: string | null;
};

export type BehaviorExecutionResult = {
  executionId: string;
  decisionId: string;
  status: BehaviorExecutionStatus;
  budgetState: BehaviorBudgetState;
  messageId: string | null;
  sentAt: Date | null;
  ackAt: Date | null;
  error: string | null;
};

type BehaviorExecutionDeps = {
  ledgerRepository: BehaviorActionLedgerRepository;
  reserveBudget: typeof reserveBudgetForExecution;
  commitBudget: typeof commitBudgetReservation;
  releaseBudget: typeof releaseBudgetReservation;
  clock: Clock;
  gateway: MessageGateway;
  notify: typeof notifyActionExecuted;
};

const DEFAULT_RETRY_POLICY: BehaviorRetryPolicy = {
  recoverable: true,
  maxAttempts: 3,
  baseDelayMs: 30_000,
  maxDelayMs: 5 * 60_000,
};

const defaultMessageGateway: MessageGateway = {
  async send(message: OutboundMessage): Promise<GatewayResult> {
    const result = await sendMessage(Number(message.metadata?.chipId ?? 0), message.recipient, message.content, {
      delay: Number(message.metadata?.delayMs ?? 0),
      showTyping: false,
    });

    return {
      status: "ACKED",
      attempt: Number(message.metadata?.attempt ?? 1),
      occurredAt: new Date(),
      providerMessageId: result.messageId ?? undefined,
      providerMetadata: {
        success: result.success,
      },
    };
  },
};

const defaultDeps: BehaviorExecutionDeps = {
  ledgerRepository: new PostgresBehaviorActionLedgerRepository(),
  reserveBudget: reserveBudgetForExecution,
  commitBudget: commitBudgetReservation,
  releaseBudget: releaseBudgetReservation,
  clock: new SystemClock(),
  gateway: defaultMessageGateway,
  notify: notifyActionExecuted,
};

export function createBehaviorExecutionRecord(params: {
  userId: number;
  chipId: number;
  requestedAction: string;
  targetType: "number" | "group" | "list" | "chip";
  targetValue: string;
  retryPolicy?: Partial<BehaviorRetryPolicy>;
  payload?: Record<string, unknown>;
}) {
  const retryPolicy = { ...DEFAULT_RETRY_POLICY, ...params.retryPolicy };
  const decisionId = crypto.randomUUID();
  const executionId = crypto.randomUUID();
  const payload = params.payload ? JSON.stringify(params.payload) : null;

  return {
    executionId,
    decisionId,
    record: {
      id: executionId,
      decisionId,
      userId: params.userId,
      chipId: params.chipId,
      requestedAction: params.requestedAction,
      targetType: params.targetType,
      targetValue: params.targetValue,
      recoverable: retryPolicy.recoverable ? 1 : 0,
      maxAttempts: retryPolicy.maxAttempts,
      nextRetryAt: null,
      lastRetryAt: null,
      payload,
    } satisfies CreateBehaviorActionLedgerRecord,
  };
}

function canRetry(params: { attempt: number; policy: BehaviorRetryPolicy }) {
  return params.policy.recoverable && params.attempt < params.policy.maxAttempts;
}

export function computeRetryDelayMs(attempt: number, policy: Partial<BehaviorRetryPolicy> = {}) {
  const effective = { ...DEFAULT_RETRY_POLICY, ...policy };
  const delay = effective.baseDelayMs * 2 ** Math.max(0, attempt - 1);
  return Math.min(delay, effective.maxDelayMs);
}

function parseExecutionPayload(payload: string | null) {
  if (!payload) return null;
  try {
    return JSON.parse(payload) as {
      message?: string;
      fingerprint?: BehaviorPolicyEvaluation["fingerprint"];
      phase?: string;
      delayMs?: number;
      retryPolicy?: BehaviorRetryPolicy;
    };
  } catch {
    return null;
  }
}

async function notifyExecutionTransition(
  deps: BehaviorExecutionDeps,
  params: {
    executionId: string;
    decisionId: string;
    chipId: number;
    requestedAction: string;
    status: BehaviorExecutionStatus;
    budgetState: BehaviorBudgetState;
    messageId: string | null;
    fingerprint: BehaviorPolicyEvaluation["fingerprint"];
    error?: string | null;
  },
) {
  const timestamp = deps.clock.now().toISOString();
  await deps.notify({
    executionId: params.executionId,
    decisionId: params.decisionId,
    chipId: params.chipId,
    requestedAction: params.requestedAction,
    status: params.status,
    budgetState: params.budgetState,
    messageId: params.messageId,
    fingerprint: params.fingerprint,
    timestamp,
    error: params.error ?? undefined,
  });
}

async function runExecutionAttempt(
  params: {
    executionId: string;
    decisionId: string;
    userId: number;
    chipId: number;
    targetValue: string;
    requestedAction: string;
    message: string;
    attempt: number;
    fingerprint: BehaviorPolicyEvaluation["fingerprint"];
    delayMs: number;
    retryPolicy: BehaviorRetryPolicy;
  },
  deps: BehaviorExecutionDeps,
): Promise<BehaviorExecutionResult> {
  let budgetReserved = false;
  let budgetCommitted = false;
  const attemptTimestamp = params.attempt > 1 ? deps.clock.now() : null;

  await deps.ledgerRepository.update(params.executionId, {
    attempt: params.attempt,
    lastRetryAt: attemptTimestamp,
    nextRetryAt: null,
    error: null,
  });

  try {
    await deps.reserveBudget({
      executionId: params.executionId,
      attempt: params.attempt,
      userId: params.userId,
      amount: 1,
    });
    budgetReserved = true;

    await deps.ledgerRepository.update(params.executionId, {
      budgetState: "RESERVED",
      status: "SENDING",
      attempt: params.attempt,
      lastRetryAt: attemptTimestamp,
      nextRetryAt: null,
      error: null,
    });

    await notifyExecutionTransition(deps, {
      executionId: params.executionId,
      decisionId: params.decisionId,
      chipId: params.chipId,
      requestedAction: params.requestedAction,
      status: "SENDING",
      budgetState: "RESERVED",
      messageId: null,
      fingerprint: params.fingerprint,
    });

    const gatewayResult = await deps.gateway.send({
      executionId: params.executionId,
      recipient: params.targetValue,
      content: params.message,
      metadata: {
        chipId: params.chipId,
        delayMs: params.delayMs,
        attempt: params.attempt,
        requestedAction: params.requestedAction,
      },
    });
    if (gatewayResult.status !== "ACKED") {
      throw new Error(gatewayResult.status === "TIMEOUT" ? "GATEWAY_TIMEOUT" : String(gatewayResult.providerMetadata?.error ?? "GATEWAY_FAILED"));
    }

    const sentAt = gatewayResult.occurredAt;
    const ackAt = gatewayResult.occurredAt;
    await deps.commitBudget({
      executionId: params.executionId,
      attempt: params.attempt,
    });
    budgetCommitted = true;

    await deps.ledgerRepository.update(params.executionId, {
      status: "ACKED",
      budgetState: "COMMITTED",
      messageId: gatewayResult.providerMessageId ?? null,
      sentAt,
      ackAt,
      attempt: params.attempt,
      recoverable: params.retryPolicy.recoverable ? 1 : 0,
      maxAttempts: params.retryPolicy.maxAttempts,
      nextRetryAt: null,
    });

    const result: BehaviorExecutionResult = {
      executionId: params.executionId,
      decisionId: params.decisionId,
      status: "ACKED",
      budgetState: "COMMITTED",
      messageId: gatewayResult.providerMessageId ?? null,
      sentAt,
      ackAt,
      error: null,
    };

    await notifyExecutionTransition(deps, {
      executionId: params.executionId,
      decisionId: params.decisionId,
      chipId: params.chipId,
      requestedAction: params.requestedAction,
      status: result.status,
      budgetState: result.budgetState,
      messageId: result.messageId,
      fingerprint: params.fingerprint,
    });

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const budgetFailure = errorMessage.includes("INSUFFICIENT_BUDGET") || errorMessage.includes("BUDGET_RESERVATION");
    const shouldRetry = canRetry({
      attempt: params.attempt,
      policy: params.retryPolicy,
    }) && !budgetFailure;
    const nextRetryAt = shouldRetry
      ? new Date(deps.clock.now().getTime() + computeRetryDelayMs(params.attempt, params.retryPolicy))
      : null;

    if (budgetReserved && !budgetCommitted) {
      try {
        await deps.releaseBudget({
          executionId: params.executionId,
          attempt: params.attempt,
          reason: errorMessage,
        });
      } catch {
        // Mantém o erro original e evita sobrescrever a falha principal.
      }
    }

    await deps.ledgerRepository.update(params.executionId, {
      status: "FAILED",
      budgetState: budgetReserved ? "RELEASED" : "NOT_RESERVED",
      error: errorMessage,
      attempt: params.attempt,
      recoverable: shouldRetry ? 1 : 0,
      maxAttempts: params.retryPolicy.maxAttempts,
      nextRetryAt,
      lastRetryAt: attemptTimestamp,
    });

    await notifyExecutionTransition(deps, {
      executionId: params.executionId,
      decisionId: params.decisionId,
      chipId: params.chipId,
      requestedAction: params.requestedAction,
      status: "FAILED",
      budgetState: budgetReserved ? "RELEASED" : "NOT_RESERVED",
      messageId: null,
      fingerprint: params.fingerprint,
      error: errorMessage,
    });

    throw error;
  }
}

export async function executeBehaviorAction(
  params: {
    userId: number;
    chipId: number;
    targetType: "number" | "group" | "list" | "chip";
    targetValue: string;
    requestedAction: string;
    message: string;
    policyDecision: BehaviorPolicyEvaluation;
    retryPolicy?: Partial<BehaviorRetryPolicy>;
  },
  deps: Partial<BehaviorExecutionDeps> = {},
): Promise<BehaviorExecutionResult> {
  const runtime = { ...defaultDeps, ...deps };
  const retryPolicy = { ...DEFAULT_RETRY_POLICY, ...params.retryPolicy };
  const { executionId, decisionId, record } = createBehaviorExecutionRecord({
    userId: params.userId,
    chipId: params.chipId,
    requestedAction: params.requestedAction,
    targetType: params.targetType,
    targetValue: params.targetValue,
    retryPolicy,
    payload: {
      message: params.message,
      fingerprint: params.policyDecision.fingerprint,
      phase: params.policyDecision.phase,
      delayMs: params.policyDecision.delayMs,
      retryPolicy,
    },
  });

  await runtime.ledgerRepository.create(record);

  return runExecutionAttempt(
    {
      executionId,
      decisionId,
      userId: params.userId,
      chipId: params.chipId,
      targetValue: params.targetValue,
      requestedAction: params.requestedAction,
      message: params.message,
      attempt: 1,
      fingerprint: params.policyDecision.fingerprint,
      delayMs: params.policyDecision.delayMs,
      retryPolicy,
    },
    runtime,
  );
}

export async function retryBehaviorActionExecution(
  params: {
    executionId: string;
  },
  deps: Partial<BehaviorExecutionDeps> = {},
): Promise<BehaviorExecutionResult | null> {
  const runtime = { ...defaultDeps, ...deps };
  const execution = await runtime.ledgerRepository.findById(params.executionId);
  if (!execution) return null;

  if (execution.status !== "FAILED" || Number(execution.recoverable) !== 1) {
    return null;
  }

  const payload = parseExecutionPayload(execution.payload ?? null);
  const retryPolicy: BehaviorRetryPolicy = {
    ...DEFAULT_RETRY_POLICY,
    ...payload?.retryPolicy,
    recoverable: Number(execution.recoverable) === 1,
    maxAttempts: execution.maxAttempts ?? DEFAULT_RETRY_POLICY.maxAttempts,
  };

  const nextAttempt = (execution.attempt ?? 1) + 1;
  if (nextAttempt > retryPolicy.maxAttempts) {
    return null;
  }

  await runtime.ledgerRepository.update(execution.id, {
    status: "RETRYING",
    lastRetryAt: runtime.clock.now(),
    nextRetryAt: null,
  });

  await notifyExecutionTransition(runtime, {
    executionId: execution.id,
    decisionId: execution.decisionId,
    chipId: execution.chipId,
    requestedAction: execution.requestedAction,
    status: "RETRYING",
    budgetState: execution.budgetState,
    messageId: execution.messageId,
    fingerprint: payload?.fingerprint ?? {
      engineVersion: "N/D",
      policyVersion: "N/D",
      policyHash: "N/D",
      fingerprint: "N/D",
    },
  });

  return runExecutionAttempt(
    {
      executionId: execution.id,
      decisionId: execution.decisionId,
      userId: execution.userId,
      chipId: execution.chipId,
      targetValue: execution.targetValue,
      requestedAction: execution.requestedAction,
      message: payload?.message ?? "",
      attempt: nextAttempt,
      fingerprint: payload?.fingerprint ?? {
        engineVersion: "N/D",
        policyVersion: "N/D",
        policyHash: "N/D",
        fingerprint: "N/D",
      },
      delayMs: payload?.delayMs ?? 0,
      retryPolicy,
    },
    runtime,
  );
}
