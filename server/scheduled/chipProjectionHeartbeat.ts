import { Request, Response } from "express";
import { ENV } from "../_core/env";
import { sdk } from "../_core/sdk";
import { createHeartbeatJob, listHeartbeatJobs, updateHeartbeatJob } from "../_core/heartbeat";
import { getChipProjectionWorkerService } from "../services/chipProjectionWorkerService";

export async function chipProjectionHeartbeatHandler(req: Request, res: Response) {
  const startTime = Date.now();

  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) {
      return res.status(403).json({ error: "cron-only" });
    }

    const limitRaw = Number(req.body?.limit ?? 200);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 1000) : 200;
    const result = await getChipProjectionWorkerService().processPersistedEvents({ limit });

    return res.json({
      ok: true,
      mode: "chip_projection",
      limit,
      ...result,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[ChipProjectionHeartbeat] Erro fatal:", error);
    return res.status(500).json({
      error: String(error),
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });
  }
}

export async function ensureChipProjectionHeartbeatJob(sessionToken = "") {
  if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
    console.log("[ChipProjectionHeartbeat] Forge/Heartbeat não configurado; bootstrap automático será ignorado.");
    return { action: "skipped" as const, reason: "forge_not_configured" as const };
  }

  const jobName = "chip-state-projection-cycle";
  const desiredCron = "0 */10 * * * *";
  const desiredPath = "/api/scheduled/chip-projection";
  const desiredDescription = "Chip state projection worker - projeções derivadas a cada 10 minutos";

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
            type: "chip_projection",
            limit: 200,
          },
        },
        sessionToken
      );

      console.log("[ChipProjectionHeartbeat] Job criado automaticamente:", created);
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
            type: "chip_projection",
            limit: 200,
          },
          enable: true,
        },
        sessionToken
      );

      console.log("[ChipProjectionHeartbeat] Job atualizado automaticamente:", {
        taskUid: existingJob.taskUid,
        ...updated,
      });
      return { action: "updated" as const, taskUid: existingJob.taskUid, ...updated };
    }

    console.log("[ChipProjectionHeartbeat] Job já estava configurado:", existingJob.taskUid);
    return {
      action: "unchanged" as const,
      taskUid: existingJob.taskUid,
      nextExecutionAt: existingJob.nextExecutionAt,
    };
  } catch (error) {
    console.error("[ChipProjectionHeartbeat] Falha ao garantir job:", error);
    throw error;
  }
}
