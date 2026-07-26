import type { BehaviorPolicyEvaluation } from "./types";

export type PolicyEvaluatedContext = {
  userId: number;
  chipId: number;
  requestedAction: string;
  destination?: "console" | "db" | "both";
};

export type PolicyEvaluatedEvent = {
  decision: BehaviorPolicyEvaluation;
  context: PolicyEvaluatedContext;
  fingerprint: BehaviorPolicyEvaluation["fingerprint"];
  timestamp: string;
};

type PolicyEvaluatedHandler = (event: PolicyEvaluatedEvent) => void | Promise<void>;
type ActionExecutedHandler = (event: ActionExecutedEvent) => void | Promise<void>;

const handlers: PolicyEvaluatedHandler[] = [];
const actionHandlers: ActionExecutedHandler[] = [];

export type ActionExecutedEvent = {
  executionId: string;
  decisionId: string;
  chipId: number;
  requestedAction: string;
  status: "PENDING" | "SENDING" | "ACKED" | "FAILED" | "RETRYING";
  budgetState: "NOT_RESERVED" | "RESERVED" | "COMMITTED" | "RELEASED";
  messageId: string | null;
  fingerprint: BehaviorPolicyEvaluation["fingerprint"];
  timestamp: string;
  error?: string;
};

export function onPolicyEvaluated(handler: PolicyEvaluatedHandler) {
  handlers.push(handler);
}

export function onActionExecuted(handler: ActionExecutedHandler) {
  actionHandlers.push(handler);
}

export async function notifyPolicyEvaluated(decision: BehaviorPolicyEvaluation, context: PolicyEvaluatedContext) {
  const event: PolicyEvaluatedEvent = {
    decision,
    context,
    fingerprint: decision.fingerprint,
    timestamp: new Date().toISOString(),
  };

  for (const handler of handlers) {
    await handler(event);
  }
}

export async function notifyActionExecuted(event: ActionExecutedEvent) {
  for (const handler of actionHandlers) {
    await handler(event);
  }
}
