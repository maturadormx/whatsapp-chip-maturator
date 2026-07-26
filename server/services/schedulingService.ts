import { getDb } from "../db";
import { eq, and } from "drizzle-orm";
import { scheduledTasks } from "../../drizzle/schema";
import { executeBulkDispatch } from "./bulkDispatchService";
import type { MaturationProfile } from "./maturationEngine";

export interface ScheduleConfig {
  taskName: string;
  chipId: number;
  userId: number;
  targetType: "number" | "group" | "list";
  targets: string[];
  messageTemplate?: string;
  profile: MaturationProfile;
  intervalSeconds: number;
  scheduleCron?: string; // Cron expression: "0 9 * * *" = 9 AM daily
  scheduleTime?: string; // ISO time: "09:00:00"
  maxMessagesPerTarget?: number;
}

export interface ScheduleResult {
  success: boolean;
  taskId?: number;
  taskName: string;
  nextRun?: Date;
  error?: string;
}

/**
 * Cria uma tarefa agendada
 */
export async function createScheduledTask(
  config: ScheduleConfig
): Promise<ScheduleResult> {
  try {
    const db = await getDb();
    if (!db) {
      return {
        success: false,
        taskName: config.taskName,
        error: "Database not available",
      };
    }

    // Validar que pelo menos cron ou time está definido
    if (!config.scheduleCron && !config.scheduleTime) {
      return {
        success: false,
        taskName: config.taskName,
        error: "scheduleCron or scheduleTime must be provided",
      };
    }

    // Inserir tarefa no banco
    const result = await db.insert(scheduledTasks).values({
      userId: config.userId,
      chipId: config.chipId,
      taskName: config.taskName,
      targetType: config.targetType,
      targetData: JSON.stringify(config.targets),
      messageTemplate: config.messageTemplate,
      scheduleCron: config.scheduleCron,
      scheduleTime: config.scheduleTime,
      intervalSeconds: config.intervalSeconds,
      isActive: 1,
    });

    const nextRun = calculateNextRun(config.scheduleCron, config.scheduleTime);

    return {
      success: true,
      taskId: Number(result[0]),
      taskName: config.taskName,
      nextRun,
    };
  } catch (error) {
    console.error("[Scheduling] Erro ao criar tarefa:", error);
    return {
      success: false,
      taskName: config.taskName,
      error: String(error),
    };
  }
}

/**
 * Obtém todas as tarefas agendadas de um usuário
 */
export async function getUserScheduledTasks(userId: number) {
  try {
    const db = await getDb();
    if (!db) return [];

    const tasks = await db
      .select()
      .from(scheduledTasks)
      .where(and(eq(scheduledTasks.userId, userId), eq(scheduledTasks.isActive, 1)));

    return tasks.map((task) => ({
      ...task,
      targets: JSON.parse(task.targetData || "[]"),
      nextRun: calculateNextRun(task.scheduleCron || undefined, task.scheduleTime || undefined),
    }));
  } catch (error) {
    console.error("[Scheduling] Erro ao obter tarefas:", error);
    return [];
  }
}

/**
 * Atualiza uma tarefa agendada
 */
export async function updateScheduledTask(
  taskId: number,
  updates: Partial<ScheduleConfig>
): Promise<ScheduleResult> {
  try {
    const db = await getDb();
    if (!db) {
      return {
        success: false,
        taskName: updates.taskName || "Unknown",
        error: "Database not available",
      };
    }

    const updateData: any = {};

    if (updates.taskName) updateData.taskName = updates.taskName;
    if (updates.messageTemplate) updateData.messageTemplate = updates.messageTemplate;
    if (updates.scheduleCron) updateData.scheduleCron = updates.scheduleCron;
    if (updates.scheduleTime) updateData.scheduleTime = updates.scheduleTime;
    if (updates.intervalSeconds) updateData.intervalSeconds = updates.intervalSeconds;
    if (updates.targets) updateData.targetData = JSON.stringify(updates.targets);

    await db.update(scheduledTasks).set(updateData).where(eq(scheduledTasks.id, taskId));

    return {
      success: true,
      taskId,
      taskName: updates.taskName || "Unknown",
      nextRun: calculateNextRun(updates.scheduleCron, updates.scheduleTime),
    };
  } catch (error) {
    console.error("[Scheduling] Erro ao atualizar tarefa:", error);
    return {
      success: false,
      taskName: updates.taskName || "Unknown",
      error: String(error),
    };
  }
}

/**
 * Pausa uma tarefa agendada
 */
export async function pauseScheduledTask(taskId: number): Promise<ScheduleResult> {
  try {
    const db = await getDb();
    if (!db) {
      return {
        success: false,
        taskName: "Unknown",
        error: "Database not available",
      };
    }

    await db
      .update(scheduledTasks)
      .set({ isActive: 0 })
      .where(eq(scheduledTasks.id, taskId));

    return {
      success: true,
      taskId,
      taskName: "Paused",
    };
  } catch (error) {
    console.error("[Scheduling] Erro ao pausar tarefa:", error);
    return {
      success: false,
      taskName: "Unknown",
      error: String(error),
    };
  }
}

/**
 * Retoma uma tarefa agendada
 */
export async function resumeScheduledTask(taskId: number): Promise<ScheduleResult> {
  try {
    const db = await getDb();
    if (!db) {
      return {
        success: false,
        taskName: "Unknown",
        error: "Database not available",
      };
    }

    await db
      .update(scheduledTasks)
      .set({ isActive: 1 })
      .where(eq(scheduledTasks.id, taskId));

    return {
      success: true,
      taskId,
      taskName: "Resumed",
    };
  } catch (error) {
    console.error("[Scheduling] Erro ao retomar tarefa:", error);
    return {
      success: false,
      taskName: "Unknown",
      error: String(error),
    };
  }
}

/**
 * Deleta uma tarefa agendada
 */
export async function deleteScheduledTask(taskId: number): Promise<ScheduleResult> {
  try {
    const db = await getDb();
    if (!db) {
      return {
        success: false,
        taskName: "Unknown",
        error: "Database not available",
      };
    }

    await db.delete(scheduledTasks).where(eq(scheduledTasks.id, taskId));

    return {
      success: true,
      taskId,
      taskName: "Deleted",
    };
  } catch (error) {
    console.error("[Scheduling] Erro ao deletar tarefa:", error);
    return {
      success: false,
      taskName: "Unknown",
      error: String(error),
    };
  }
}

/**
 * Executa uma tarefa agendada manualmente
 */
export async function executeScheduledTask(
  taskId: number,
  chipId: number,
  profile: MaturationProfile
) {
  try {
    const db = await getDb();
    if (!db) {
      return {
        success: false,
        error: "Database not available",
      };
    }

    const task = await db
      .select()
      .from(scheduledTasks)
      .where(eq(scheduledTasks.id, taskId))
      .limit(1);

    if (task.length === 0) {
      return {
        success: false,
        error: "Task not found",
      };
    }

    const taskData = task[0];
    const targets = JSON.parse(taskData.targetData || "[]");

    const result = await executeBulkDispatch({
      chipId,
      targetType: taskData.targetType,
      targets,
      messageTemplate: taskData.messageTemplate || undefined,
      profile,
      intervalSeconds: taskData.intervalSeconds,
      maxMessagesPerTarget: 1,
    });

    return {
      success: true,
      taskId,
      dispatchId: result.dispatchId,
      totalMessagesSent: result.totalMessagesSent,
    };
  } catch (error) {
    console.error("[Scheduling] Erro ao executar tarefa:", error);
    return {
      success: false,
      taskId,
      error: String(error),
    };
  }
}

/**
 * Calcula a próxima execução baseado em cron ou time
 */
function calculateNextRun(cron?: string, time?: string): Date {
  const now = new Date();

  if (time) {
    // Formato: "HH:MM:SS"
    const [hours, minutes, seconds] = time.split(":").map(Number);
    const nextRun = new Date(now);
    nextRun.setHours(hours, minutes, seconds || 0, 0);

    // Se o horário já passou hoje, agendar para amanhã
    if (nextRun <= now) {
      nextRun.setDate(nextRun.getDate() + 1);
    }

    return nextRun;
  }

  if (cron) {
    // Cron simples: "0 9 * * *" = 9 AM daily
    const parts = cron.split(" ");
    if (parts.length >= 5) {
      const [minute, hour] = [parseInt(parts[0]), parseInt(parts[1])];

      const nextRun = new Date(now);
      nextRun.setHours(hour, minute, 0, 0);

      // Se o horário já passou hoje, agendar para amanhã
      if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1);
      }

      return nextRun;
    }
  }

  // Padrão: próxima hora
  const nextRun = new Date(now);
  nextRun.setHours(nextRun.getHours() + 1, 0, 0, 0);
  return nextRun;
}

/**
 * Obtém tarefas que devem ser executadas agora
 */
export async function getTasksDueNow(): Promise<any[]> {
  try {
    const db = await getDb();
    if (!db) return [];

    const now = new Date();
    const tasks = await db
      .select()
      .from(scheduledTasks)
      .where(eq(scheduledTasks.isActive, 1));

    return tasks.filter((task) => {
      const nextRun = calculateNextRun(task.scheduleCron || undefined, task.scheduleTime || undefined);
      return nextRun <= now;
    });
  } catch (error) {
    console.error("[Scheduling] Erro ao obter tarefas devidas:", error);
    return [];
  }
}
