import { Request, Response } from "express";
import { ENV } from "../_core/env";
import { sdk } from "../_core/sdk";
import { createHeartbeatJob, listHeartbeatJobs, updateHeartbeatJob } from "../_core/heartbeat";
import { runBehaviorMemoryShadowForConnectedChips } from "../services/behaviorMemoryShadowService";

export async function behaviorMemoryShadowHeartbeatHandler(req: Request, res: Response) {
  const startTime = Date.now();

  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) {
      return res.status(403).json({ error: "cron-only" });
    }

    const windowHoursRaw = Number(req.body?.windowHours ?? 48);
    const windowHours = Number.isFinite(windowHoursRaw) && windowHoursRaw > 0 ? windowHoursRaw : 48;
    const result = await runBehaviorMemoryShadowForConnectedChips(windowHours);

    return res.json({
      ok: true,
      mode: "shadow",
      windowHours,
      ...result,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[ShadowHeartbeat] Erro fatal:", error);
    return res.status(500).json({
      error: String(error),
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });
  }
}

export async function ensureBehaviorMemoryShadowHeartbeatJob(sessionToken = "") {
  if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
    console.log("[ShadowHeartbeat] Forge/Heartbeat não configurado; bootstrap automático será ignorado.");
    return { action: "skipped" as const, reason: "forge_not_configured" as const };
  }

  const jobName = "behavior-memory-shadow-cycle";
  const desiredCron = "0 */30 * * * *";
  const desiredPath = "/api/scheduled/behavior-memory-shadow";
  const desiredDescription = "Behavior Memory Shadow Mode - snapshots auditáveis a cada 30 minutos";

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
            type: "behavior_memory_shadow",
            mode: "shadow",
            windowHours: 48,
          },
        },
        sessionToken
      );

      console.log("[ShadowHeartbeat] Job criado automaticamente:", created);
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
          payload: {
            type: "behavior_memory_shadow",
            mode: "shadow",
            windowHours: 48,
          },
          enable: true,
        },
        sessionToken
      );

      console.log("[ShadowHeartbeat] Job atualizado automaticamente:", {
        taskUid: existingJob.taskUid,
        ...updated,
      });
      return { action: "updated" as const, taskUid: existingJob.taskUid, ...updated };
    }

    console.log("[ShadowHeartbeat] Job já estava configurado:", existingJob.taskUid);
    return {
      action: "unchanged" as const,
      taskUid: existingJob.taskUid,
      nextExecutionAt: existingJob.nextExecutionAt,
    };
  } catch (error) {
    console.error("[ShadowHeartbeat] Falha ao garantir job:", error);
    throw error;
  }
}
