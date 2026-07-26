import { eq, sql } from "drizzle-orm";
import type { ScheduledTask } from "../../drizzle/schema";
import { scheduledTasks } from "../../drizzle/schema";
import { getDb } from "../db";
import { getInternalEventBus } from "./events/InternalEventBus";
import { getDistributedLockService } from "./locking/DistributedLockService";
import { executeScheduledTask } from "./schedulingService";

const DEFAULT_PROFILE = "normal" as const;

function parseScheduleTime(scheduleTime?: string | null, now = new Date()) {
  if (!scheduleTime) return null;
  const [hourRaw, minuteRaw, secondRaw = "0"] = scheduleTime.split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  const second = Number(secondRaw);

  if ([hour, minute, second].some(Number.isNaN)) return null;

  const dueAt = new Date(now);
  dueAt.setHours(hour, minute, second, 0);
  return dueAt;
}

function parseCronTime(scheduleCron?: string | null, now = new Date()) {
  if (!scheduleCron) return null;
  const [minuteRaw, hourRaw] = scheduleCron.trim().split(/\s+/);
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);

  if ([hour, minute].some(Number.isNaN)) return null;

  const dueAt = new Date(now);
  dueAt.setHours(hour, minute, 0, 0);
  return dueAt;
}

function resolveDueSlot(task: ScheduledTask, now = new Date()) {
  const dueAt = parseScheduleTime(task.scheduleTime, now) ?? parseCronTime(task.scheduleCron, now);
  if (!dueAt) return null;
  if (dueAt.getTime() > now.getTime()) return null;

  const lastExecutedAt = task.lastExecutedAt ? new Date(task.lastExecutedAt) : null;
  if (lastExecutedAt && lastExecutedAt.getTime() >= dueAt.getTime()) {
    return null;
  }

  return dueAt;
}

function extractAffectedRows(result: unknown) {
  const header = Array.isArray(result) ? result[0] : result;
  return Number((header as any)?.affectedRows ?? (header as any)?.rowsAffected ?? 0);
}

async function claimScheduledTaskExecution(taskId: number, dueAt: Date) {
  const db = await getDb();
  if (!db || typeof (db as any).execute !== "function") return false;

  const result = await (db as any).execute(sql`
    UPDATE scheduled_tasks
    SET
      lastExecutedAt = ${dueAt},
      lastRunStatus = 'RUNNING',
      lastRunError = NULL,
      updatedAt = CURRENT_TIMESTAMP
    WHERE id = ${taskId}
      AND isActive = 1
      AND (
        lastExecutedAt IS NULL
        OR lastExecutedAt < ${dueAt}
      )
  `);

  return extractAffectedRows(result) > 0;
}

async function finalizeScheduledTaskExecution(taskId: number, status: "COMPLETED" | "FAILED", error?: unknown) {
  const db = await getDb();
  if (!db || typeof (db as any).execute !== "function") return;

  await (db as any).execute(sql`
    UPDATE scheduled_tasks
    SET
      lastRunStatus = ${status},
      lastRunError = ${error ? String(error) : null},
      updatedAt = CURRENT_TIMESTAMP
    WHERE id = ${taskId}
  `);
}

export class ScheduledTaskRunnerService {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly intervalMs: number) {}

  start() {
    if (this.timer) return;
    console.log(`[ScheduledTaskRunner] Started with interval ${this.intervalMs}ms`);
    this.timer = setInterval(() => {
      void this.tick();
    }, this.intervalMs);
    void this.tick();
  }

  stop() {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
    console.log("[ScheduledTaskRunner] Stopped");
  }

  private async tick() {
    if (this.running) return;
    this.running = true;

    try {
      await getDistributedLockService().withLock({
        key: "locks:scheduled_task_runner",
        ttlMs: Math.max(this.intervalMs - 500, 1_000),
        task: async () => {
          const db = await getDb();
          if (!db) return;

          const tasks = await db
            .select()
            .from(scheduledTasks)
            .where(eq(scheduledTasks.isActive, 1));

          const now = new Date();

          for (const task of tasks) {
            const dueAt = resolveDueSlot(task, now);
            if (!dueAt) continue;

            const claimed = await claimScheduledTaskExecution(task.id, dueAt);
            if (!claimed) continue;

            try {
              console.log(
                `[ScheduledTaskRunner] Executing task ${task.id} (${task.taskName}) for chip ${task.chipId}`
              );
              const result = await executeScheduledTask(task.id, task.chipId, DEFAULT_PROFILE);
              await finalizeScheduledTaskExecution(
                task.id,
                result.success ? "COMPLETED" : "FAILED",
                result.success ? null : result.error
              );
              await getInternalEventBus().publish({
                type: result.success ? "scheduled_task.completed" : "scheduled_task.failed",
                source: "ScheduledTaskRunnerService",
                payload: {
                  taskId: task.id,
                  chipId: task.chipId,
                  taskName: task.taskName,
                  totalMessagesSent: result.totalMessagesSent ?? 0,
                  error: result.success ? null : result.error,
                },
              }).catch(() => null);
              console.log(
                `[ScheduledTaskRunner] Task ${task.id} completed: success=${result.success} sent=${result.totalMessagesSent ?? 0}`
              );
            } catch (error) {
              await finalizeScheduledTaskExecution(task.id, "FAILED", error);
              await getInternalEventBus().publish({
                type: "scheduled_task.failed",
                source: "ScheduledTaskRunnerService",
                payload: {
                  taskId: task.id,
                  chipId: task.chipId,
                  taskName: task.taskName,
                  error: error instanceof Error ? error.message : String(error),
                },
              }).catch(() => null);
              console.error(`[ScheduledTaskRunner] Task ${task.id} failed:`, error);
            }
          }
        },
      });
    } finally {
      this.running = false;
    }
  }
}

export function createScheduledTaskRunnerService(intervalMs: number) {
  return new ScheduledTaskRunnerService(intervalMs);
}
