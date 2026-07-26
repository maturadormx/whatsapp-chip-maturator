import { createAuditEvent, type AuditEventResult } from "../../db";

export async function recordAuditEvent(params: {
  userId?: number | null;
  chipId?: number | null;
  engine: string;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  beforeState?: unknown;
  afterState?: unknown;
  result?: AuditEventResult;
  errorMessage?: string | null;
  durationMs?: number | null;
  workerId?: string | null;
  payload?: unknown;
}) {
  return createAuditEvent({
    userId: params.userId ?? null,
    chipId: params.chipId ?? null,
    engine: params.engine,
    action: params.action,
    entityType: params.entityType ?? null,
    entityId: params.entityId ?? null,
    beforeState: params.beforeState,
    afterState: params.afterState,
    result: params.result ?? "success",
    errorMessage: params.errorMessage ?? null,
    durationMs: params.durationMs ?? null,
    workerId: params.workerId ?? null,
    payload: params.payload,
  });
}
