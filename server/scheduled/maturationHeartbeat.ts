import { Request, Response } from "express";
import { ENV } from "../_core/env";
import { sdk } from "../_core/sdk";
import {
  createActivityLog,
  getActiveMessageTemplateContents,
  getChipBehaviorScore,
  getChipPolicyStats,
  getDb,
  resolveUserMaturationTargets,
} from "../db";
import { eq, and } from "drizzle-orm";
import { whatsappChips, userSubscriptions } from "../../drizzle/schema";
import { startMaturationCycle, startContinuousMaturation } from "../services/maturationEngine";
import { evaluateBehaviorPolicy } from "../services/behavior/behaviorPolicyEngine";
import { logPolicyDecision } from "../services/behavior/logger";

function getChipAgeDays(createdAt: Date | string | null | undefined) {
  if (!createdAt) return 0;
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - created.getTime()) / (24 * 60 * 60 * 1000)));
}

interface HeartbeatResult {
  chipId: number;
  chipName: string;
  userId: number;
  success: boolean;
  messagesCount?: number;
  error?: string;
  duration?: number;
}

/**
 * Heartbeat handler para maturação automática 24/7
 * Suporta até 50+ chips simultâneos com processamento paralelo
 */
export async function maturationHeartbeatHandler(req: Request, res: Response) {
  const startTime = Date.now();
  
  try {
    // Autenticar como cron
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) {
      return res.status(403).json({ error: "cron-only" });
    }

    const db = await getDb();
    if (!db) {
      return res.status(500).json({
        error: "Database not available",
        timestamp: new Date().toISOString(),
      });
    }

    // Buscar todos os chips que estão ativos e não pausados
    const activeChips = await db
      .select()
      .from(whatsappChips)
      .where(and(
        eq(whatsappChips.isPaused, 0),
        eq(whatsappChips.status, "conectado")
      ));

    if (activeChips.length === 0) {
      return res.json({
        ok: true,
        message: "No active chips to mature",
        processedChips: 0,
        duration: Date.now() - startTime,
      });
    }

    console.log(`[Heartbeat] Processando ${activeChips.length} chips ativos...`);

    // Processar chips em lotes (máximo 10 por vez para evitar sobrecarga)
    const batchSize = 10;
    const results: HeartbeatResult[] = [];

    for (let i = 0; i < activeChips.length; i += batchSize) {
      const batch = activeChips.slice(i, i + batchSize);
      
      // Processar lote em paralelo
      const batchPromises = batch.map(async (chip) => {
        const chipStartTime = Date.now();
        try {
          const targetNumbers = await resolveUserMaturationTargets(chip.userId, {
            excludeChipId: chip.id,
          });
          const templateMessages = await getActiveMessageTemplateContents(chip.userId, "maturation");
          const [behaviorScore, policyStats] = await Promise.all([
            getChipBehaviorScore(chip.userId, chip.id),
            getChipPolicyStats(chip.userId, chip.id),
          ]);

          if (targetNumbers.length === 0) {
            await createActivityLog({
              chipId: chip.id,
              actionType: "error",
              status: "failed",
              errorMessage: "Nenhum target de maturação ativo configurado para este usuário.",
            });

            return {
              chipId: chip.id,
              chipName: chip.chipName || "Chip",
              userId: chip.userId,
              success: false,
              error: "Nenhum target de maturação ativo configurado",
              duration: Date.now() - chipStartTime,
            };
          }

          const policyDecision = evaluateBehaviorPolicy({
            chipId: chip.id,
            action: "message_sent",
            chipAgeDays: getChipAgeDays(chip.createdAt),
            trustScore: behaviorScore?.humanScore ?? 0,
            riskScore: behaviorScore?.riskScore ?? 0,
            stats: policyStats,
          });

          if (!policyDecision.allowed) {
            await logPolicyDecision(policyDecision, {
              userId: chip.userId,
              chipId: chip.id,
              requestedAction: "message_sent",
            });

            await createActivityLog({
              chipId: chip.id,
              actionType: "error",
              status: "failed",
              errorMessage: `Heartbeat pulou ciclo: ${policyDecision.reason}`,
            });

            return {
              chipId: chip.id,
              chipName: chip.chipName || "Chip",
              userId: chip.userId,
              success: false,
              error: `Ciclo adiado pela política: ${policyDecision.reason}`,
              duration: Date.now() - chipStartTime,
            };
          }

          const phaseMessages =
            policyDecision.phase === "birth" || policyDecision.phase === "reactive"
              ? 1
              : Math.floor(Math.random() * 2) + 1;

          // Executar ciclo de maturação
          const result = await startMaturationCycle(
            chip.id,
            chip.maturationProfile,
            targetNumbers,
            phaseMessages,
            templateMessages
          );

          return {
            chipId: chip.id,
            chipName: chip.chipName || "Chip",
            userId: chip.userId,
            success: true,
            messagesCount: result.messagesCount,
            duration: Date.now() - chipStartTime,
          };
        } catch (error) {
          console.error(`[Heartbeat] Erro ao processar chip ${chip.id}:`, error);
          return {
            chipId: chip.id,
            chipName: chip.chipName || "Chip",
            userId: chip.userId,
            success: false,
            error: String(error),
            duration: Date.now() - chipStartTime,
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    // Calcular estatísticas
    const successCount = results.filter(r => r.success).length;
    const totalMessages = results.reduce((sum, r) => sum + (r.messagesCount || 0), 0);
    const avgDuration = results.reduce((sum, r) => sum + (r.duration || 0), 0) / results.length;

    console.log(`[Heartbeat] Processamento concluído: ${successCount}/${activeChips.length} sucesso, ${totalMessages} mensagens`);

    return res.json({
      ok: true,
      processedChips: activeChips.length,
      successCount,
      failureCount: activeChips.length - successCount,
      totalMessages,
      averageDuration: Math.round(avgDuration),
      results,
      timestamp: new Date().toISOString(),
      totalDuration: Date.now() - startTime,
    });
  } catch (error) {
    console.error("[Heartbeat] Erro fatal:", error);
    return res.status(500).json({
      error: String(error),
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime,
    });
  }
}

/**
 * Handler para maturação contínua de longa duração
 * Executa maturação por X minutos sem parar
 */
export async function continuousMaturationHandler(req: Request, res: Response) {
  const startTime = Date.now();
  
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) {
      return res.status(403).json({ error: "cron-only" });
    }

    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: "Database not available" });
    }

    const { chipId, durationMinutes = 60 } = req.body;

    if (!chipId) {
      return res.status(400).json({ error: "chipId is required" });
    }

    const chip = await db
      .select()
      .from(whatsappChips)
      .where(eq(whatsappChips.id, chipId))
      .limit(1);

    if (chip.length === 0) {
      return res.status(404).json({ error: "Chip not found" });
    }

    const targetNumbers = await resolveUserMaturationTargets(chip[0].userId, {
      excludeChipId: chipId,
    });
    const templateMessages = await getActiveMessageTemplateContents(chip[0].userId, "maturation");

    if (targetNumbers.length === 0) {
      return res.status(400).json({ error: "Nenhum target de maturação ativo configurado" });
    }

    const result = await startContinuousMaturation(
      chipId,
      chip[0].maturationProfile,
      targetNumbers,
      durationMinutes,
      templateMessages
    );

    return res.json({
      ok: true,
      ...result,
      duration: Date.now() - startTime,
    });
  } catch (error) {
    console.error("[Continuous Maturation] Erro:", error);
    return res.status(500).json({
      error: String(error),
      duration: Date.now() - startTime,
    });
  }
}

/**
 * Função para criar o Heartbeat job (deve ser chamada uma vez)
 * Executa a cada 4 horas
 */
export async function createMaturationHeartbeatJob(sessionToken: string) {
  const { createHeartbeatJob } = await import("../_core/heartbeat");

  try {
    const job = await createHeartbeatJob(
      {
        name: "whatsapp-maturation-cycle",
        cron: "0 0 */4 * * *", // A cada 4 horas
        path: "/api/scheduled/maturation",
        method: "POST",
        description: "Automatic WhatsApp chip maturation cycle - runs every 4 hours",
        payload: {
          type: "maturation_cycle",
        },
      },
      sessionToken
    );

    console.log("[Heartbeat] Maturation job criado:", job);
    return job;
  } catch (error) {
    console.error("[Heartbeat] Erro ao criar job:", error);
    throw error;
  }
}

/**
 * Garante que o heartbeat job principal de maturação exista e esteja ativo.
 * Usa a identidade do owner do projeto quando `sessionToken` vier vazio.
 */
export async function ensureMaturationHeartbeatJob(sessionToken = "") {
  if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
    console.log("[Heartbeat] Forge/Heartbeat não configurado no ambiente atual; bootstrap automático de maturação será ignorado.");
    return { action: "skipped" as const, reason: "forge_not_configured" as const };
  }

  const { createHeartbeatJob, listHeartbeatJobs, updateHeartbeatJob } = await import("../_core/heartbeat");

  const jobName = "whatsapp-maturation-cycle";
  const desiredCron = "0 0 */4 * * *";
  const desiredPath = "/api/scheduled/maturation";
  const desiredDescription = "Automatic WhatsApp chip maturation cycle - runs every 4 hours";

  try {
    const { jobs } = await listHeartbeatJobs(sessionToken, { page: 1, pageSize: 100 });
    const existingJob = jobs.find((job) => job.name === jobName);

    if (!existingJob) {
      const created = await createHeartbeatJob(
        {
          name: jobName,
          cron: desiredCron,
          path: desiredPath,
          method: "POST",
          description: desiredDescription,
          payload: {
            type: "maturation_cycle",
          },
        },
        sessionToken
      );

      console.log("[Heartbeat] Maturation job criado automaticamente:", created);
      return { action: "created" as const, ...created };
    }

    const needsUpdate =
      existingJob.cronExpression !== desiredCron ||
      existingJob.callbackPath !== desiredPath ||
      existingJob.callbackMethod !== "POST" ||
      !existingJob.isEnable;

    if (needsUpdate) {
      const updated = await updateHeartbeatJob(
        existingJob.taskUid,
        {
          cron: desiredCron,
          path: desiredPath,
          method: "POST",
          description: desiredDescription,
          payload: { type: "maturation_cycle" },
          enable: true,
        },
        sessionToken
      );

      console.log("[Heartbeat] Maturation job atualizado automaticamente:", {
        taskUid: existingJob.taskUid,
        ...updated,
      });
      return { action: "updated" as const, taskUid: existingJob.taskUid, ...updated };
    }

    console.log("[Heartbeat] Maturation job já estava configurado:", existingJob.taskUid);
    return {
      action: "unchanged" as const,
      taskUid: existingJob.taskUid,
      nextExecutionAt: existingJob.nextExecutionAt,
    };
  } catch (error) {
    console.error("[Heartbeat] Falha ao garantir heartbeat job de maturação:", error);
    throw error;
  }
}

/**
 * Função para criar job de maturação contínua
 * Executa maturação contínua por X minutos
 */
export async function createContinuousMaturationJob(
  chipId: number,
  durationMinutes: number,
  sessionToken: string
) {
  const { createHeartbeatJob } = await import("../_core/heartbeat");

  try {
    const job = await createHeartbeatJob(
      {
        name: `continuous-maturation-chip-${chipId}`,
        cron: "0 0 * * * *", // A cada hora
        path: "/api/scheduled/continuous-maturation",
        method: "POST",
        description: `Continuous maturation for chip ${chipId}`,
        payload: {
          type: "continuous_maturation",
          chipId,
          durationMinutes,
        },
      },
      sessionToken
    );

    console.log(`[Heartbeat] Continuous maturation job criado para chip ${chipId}:`, job);
    return job;
  } catch (error) {
    console.error("[Heartbeat] Erro ao criar continuous job:", error);
    throw error;
  }
}
