import crypto from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { behaviorBudgetReservations, subscriptionPlans, userSubscriptions } from "../../../drizzle/schema";
import { getDb } from "../../db";

export type BudgetReservationStatus = "RESERVED" | "COMMITTED" | "RELEASED";

export type BudgetAvailability = {
  limit: number;
  committed: number;
  reserved: number;
  available: number;
};

export type BudgetReservationRecord = {
  id: string;
  executionId: string;
  attempt: number;
  userId: number;
  amount: number;
  status: BudgetReservationStatus;
  reason: string | null;
  createdAt: Date;
  committedAt: Date | null;
  releasedAt: Date | null;
  updatedAt: Date;
};

export function calculateBudgetAvailability(params: {
  limit: number;
  committed: number;
  reserved: number;
}): BudgetAvailability {
  const limit = Math.max(0, params.limit);
  const committed = Math.max(0, params.committed);
  const reserved = Math.max(0, params.reserved);
  const available = Math.max(0, limit - committed - reserved);
  return { limit, committed, reserved, available };
}

export function canReserveBudget(params: { available: number; amount: number }) {
  return params.amount > 0 && params.available >= params.amount;
}

async function ensureBudgetReservationsTable() {
  const db = await getDb();
  if (!db) return;

  await (db as any).execute?.(sql`
    CREATE TABLE IF NOT EXISTS behavior_budget_reservations (
      id VARCHAR(64) PRIMARY KEY,
      executionId VARCHAR(64) NOT NULL,
      attempt INT NOT NULL,
      userId INT NOT NULL,
      amount INT NOT NULL,
      status ENUM('RESERVED', 'COMMITTED', 'RELEASED') NOT NULL DEFAULT 'RESERVED',
      reason TEXT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      committedAt TIMESTAMP NULL,
      releasedAt TIMESTAMP NULL,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY ux_behavior_budget_execution_attempt (executionId, attempt),
      KEY ix_behavior_budget_user_status_created (userId, status, createdAt)
    )
  `);
}

async function getLockedBudgetContext(tx: any, userId: number) {
  const subscriptionResult = await tx.execute(sql`
    SELECT us.id, us.userId, us.currentMessagesThisMonth, us.planId, sp.maxMessagesPerMonth
    FROM user_subscriptions us
    INNER JOIN subscription_plans sp ON sp.id = us.planId
    WHERE us.userId = ${userId}
    LIMIT 1
    FOR UPDATE
  `);
  const rows = Array.isArray(subscriptionResult?.[0]) ? subscriptionResult[0] : subscriptionResult?.rows ?? [];
  const row = rows[0];
  if (!row) {
    throw new Error("SUBSCRIPTION_NOT_FOUND");
  }

  const reservedResult = await tx.execute(sql`
    SELECT COALESCE(SUM(amount), 0) AS reserved
    FROM behavior_budget_reservations
    WHERE userId = ${userId}
      AND status = 'RESERVED'
  `);
  const reservedRows = Array.isArray(reservedResult?.[0]) ? reservedResult[0] : reservedResult?.rows ?? [];
  const reserved = Number(reservedRows[0]?.reserved ?? 0);

  return {
    subscriptionId: Number(row.id),
    committed: Number(row.currentMessagesThisMonth ?? 0),
    limit: Number(row.maxMessagesPerMonth ?? 0),
    reserved,
  };
}

export async function reserveBudgetForExecution(params: {
  executionId: string;
  attempt: number;
  userId: number;
  amount?: number;
}) {
  await ensureBudgetReservationsTable();
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");

  const amount = params.amount ?? 1;

  return db.transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(behaviorBudgetReservations)
      .where(
        and(
          eq(behaviorBudgetReservations.executionId, params.executionId),
          eq(behaviorBudgetReservations.attempt, params.attempt),
        ),
      )
      .limit(1);

    if (existing[0]) {
      return existing[0];
    }

    const context = await getLockedBudgetContext(tx, params.userId);
    const availability = calculateBudgetAvailability({
      limit: context.limit,
      committed: context.committed,
      reserved: context.reserved,
    });

    if (!canReserveBudget({ available: availability.available, amount })) {
      throw new Error("INSUFFICIENT_BUDGET");
    }

    const reservation: typeof behaviorBudgetReservations.$inferInsert = {
      id: crypto.randomUUID(),
      executionId: params.executionId,
      attempt: params.attempt,
      userId: params.userId,
      amount,
      status: "RESERVED",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await tx.insert(behaviorBudgetReservations).values(reservation);
    return reservation as BudgetReservationRecord;
  });
}

export async function commitBudgetReservation(params: {
  executionId: string;
  attempt: number;
}) {
  await ensureBudgetReservationsTable();
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");

  return db.transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(behaviorBudgetReservations)
      .where(
        and(
          eq(behaviorBudgetReservations.executionId, params.executionId),
          eq(behaviorBudgetReservations.attempt, params.attempt),
        ),
      )
      .limit(1);

    const reservation = existing[0];
    if (!reservation) {
      throw new Error("BUDGET_RESERVATION_NOT_FOUND");
    }

    if (reservation.status === "COMMITTED") {
      return reservation;
    }
    if (reservation.status === "RELEASED") {
      throw new Error("BUDGET_RESERVATION_ALREADY_RELEASED");
    }

    await tx
      .update(userSubscriptions)
      .set({
        currentMessagesThisMonth: sql`${userSubscriptions.currentMessagesThisMonth} + ${reservation.amount}`,
        updatedAt: new Date(),
      })
      .where(eq(userSubscriptions.userId, reservation.userId));

    const committedAt = new Date();
    await tx
      .update(behaviorBudgetReservations)
      .set({
        status: "COMMITTED",
        committedAt,
        updatedAt: committedAt,
      })
      .where(eq(behaviorBudgetReservations.id, reservation.id));

    return { ...reservation, status: "COMMITTED" as const, committedAt, updatedAt: committedAt };
  });
}

export async function releaseBudgetReservation(params: {
  executionId: string;
  attempt: number;
  reason?: string;
}) {
  await ensureBudgetReservationsTable();
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");

  return db.transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(behaviorBudgetReservations)
      .where(
        and(
          eq(behaviorBudgetReservations.executionId, params.executionId),
          eq(behaviorBudgetReservations.attempt, params.attempt),
        ),
      )
      .limit(1);

    const reservation = existing[0];
    if (!reservation) {
      throw new Error("BUDGET_RESERVATION_NOT_FOUND");
    }

    if (reservation.status === "RELEASED") {
      return reservation;
    }
    if (reservation.status === "COMMITTED") {
      return reservation;
    }

    const releasedAt = new Date();
    await tx
      .update(behaviorBudgetReservations)
      .set({
        status: "RELEASED",
        reason: params.reason ?? reservation.reason ?? null,
        releasedAt,
        updatedAt: releasedAt,
      })
      .where(eq(behaviorBudgetReservations.id, reservation.id));

    return {
      ...reservation,
      status: "RELEASED" as const,
      reason: params.reason ?? reservation.reason ?? null,
      releasedAt,
      updatedAt: releasedAt,
    };
  });
}

export async function getReservedBudgetAmount(userId: number) {
  await ensureBudgetReservationsTable();
  const db = await getDb();
  if (!db) return 0;

  const rows = await db
    .select({
      reserved: sql<number>`COALESCE(SUM(${behaviorBudgetReservations.amount}), 0)`,
    })
    .from(behaviorBudgetReservations)
    .where(and(eq(behaviorBudgetReservations.userId, userId), eq(behaviorBudgetReservations.status, "RESERVED")));

  return Number(rows[0]?.reserved ?? 0);
}
