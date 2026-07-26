import { Request, Response } from "express";
import { sdk } from "../_core/sdk";
import { listUserExecutionJobs } from "../db";
import { executeBulkDispatchMultiChip } from "../services/bulkDispatchService";
import { listAllMarketingCampaigns, updateMarketingCampaignRuntime } from "../utils/marketingCampaigns";
import { listMarketingSuppressionEntries } from "../utils/marketingSuppression";

function isCampaignDue(scheduleTime?: string, lastExecutedAt?: string) {
  if (!scheduleTime) return false;
  const [hourRaw, minuteRaw] = scheduleTime.split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return false;

  const now = new Date();
  const dueToday = new Date(now);
  dueToday.setHours(hour, minute, 0, 0);

  if (now.getTime() < dueToday.getTime()) return false;
  if (!lastExecutedAt) return true;

  const last = new Date(lastExecutedAt);
  return last.toDateString() !== now.toDateString();
}

function isWithinTimeWindow(start?: string, end?: string) {
  if (!start || !end) return true;
  const now = new Date();
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  if ([startHour, startMinute, endHour, endMinute].some(Number.isNaN)) return true;

  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;
  if (startMinutes <= endMinutes) {
    return minutesNow >= startMinutes && minutesNow <= endMinutes;
  }
  return minutesNow >= startMinutes || minutesNow <= endMinutes;
}

function isRetryDue(nextRetryAt?: string) {
  if (!nextRetryAt) return false;
  return new Date(nextRetryAt).getTime() <= Date.now();
}

async function calculateChipRiskMap(userId: number) {
  const jobs = await listUserExecutionJobs(userId, 120);
  const riskMap = new Map<number, number>();
  const suspicionRegex = /(bloque|block|ban|forbidden|not[- ]authorized|401|403|429|rate)/i;

  for (const job of jobs) {
    if (job.executionType !== "dispatch" || !job.chipId) continue;
    const current = riskMap.get(job.chipId) ?? 0;
    const payload = typeof job.payload === "string" ? job.payload : "";
    const suspicionBoost = suspicionRegex.test(payload) ? 12 : 0;
    riskMap.set(
      job.chipId,
      Math.min(100, current + (job.failureCount ?? 0) * 4 + suspicionBoost + 2)
    );
  }

  return riskMap;
}

export async function marketingHeartbeatHandler(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) {
      return res.status(403).json({ error: "cron-only" });
    }

    const campaigns = listAllMarketingCampaigns().filter(
      (campaign) => campaign.scheduleEnabled || campaign.queueStatus === "pending" || campaign.queueStatus === "executing"
    );
    const results: Array<{ campaignId: string; name: string; status: string; detail?: string }> = [];

    for (const campaign of campaigns) {
      const dueBySchedule = campaign.scheduleEnabled && isCampaignDue(campaign.scheduleTime, campaign.lastExecutedAt);
      const dueByRetry = isRetryDue(campaign.nextRetryAt);
      if (!dueBySchedule && !dueByRetry) continue;
      if (!isWithinTimeWindow(campaign.timeWindowStart, campaign.timeWindowEnd)) {
        results.push({
          campaignId: campaign.id,
          name: campaign.name,
          status: "pending",
          detail: "Fora da faixa horária permitida.",
        });
        continue;
      }

      const riskMap = await calculateChipRiskMap(campaign.userId);
      const riskyChips = campaign.selectedChipIds.filter((chipId) => (riskMap.get(chipId) ?? 0) >= 70);

      if (riskyChips.length > 0) {
        updateMarketingCampaignRuntime(campaign.id, {
          scheduleEnabled: false,
          lastExecutionStatus: "paused_risk",
          queueStatus: "paused",
          autoPausedAt: new Date().toISOString(),
          autoPauseReason: `Risco alto nos chips: ${riskyChips.join(", ")}`,
          lastQueueEventAt: new Date().toISOString(),
        });
        results.push({
          campaignId: campaign.id,
          name: campaign.name,
          status: "paused_risk",
          detail: `Chips com risco alto: ${riskyChips.join(", ")}`,
        });
        continue;
      }

      updateMarketingCampaignRuntime(campaign.id, {
        queueStatus: "executing",
        lastQueueEventAt: new Date().toISOString(),
        autoPauseReason: undefined,
        autoPausedAt: undefined,
      });

      const suppressionSet = new Set(listMarketingSuppressionEntries(campaign.userId).map((entry) => entry.value));
      const baseTargets =
        campaign.selectedTagFilter && campaign.targetEntries.length
          ? campaign.targetEntries
              .filter((entry) => entry.tag === campaign.selectedTagFilter)
              .map((entry) => entry.value)
          : campaign.targetEntries.length
            ? campaign.targetEntries.map((entry) => entry.value)
            : campaign.targetsText.split(/\r?\n|,|;/).map((item) => item.trim()).filter(Boolean);

      const filteredTargets =
        campaign.targetType === "group"
          ? baseTargets
          : baseTargets
              .map((value) => value.replace(/\D/g, ""))
              .filter((value) => value && !suppressionSet.has(value));

      if (!filteredTargets.length) {
        updateMarketingCampaignRuntime(campaign.id, {
          lastExecutedAt: new Date().toISOString(),
          lastExecutionStatus: "skipped",
          queueStatus: campaign.scheduleEnabled ? "pending" : "finalized",
          lastQueueEventAt: new Date().toISOString(),
        });
        results.push({
          campaignId: campaign.id,
          name: campaign.name,
          status: "skipped",
          detail: "Nenhum alvo restante após filtros/supressão.",
        });
        continue;
      }

      try {
        await executeBulkDispatchMultiChip(
          campaign.selectedChipIds,
          campaign.targetType,
          filteredTargets,
          campaign.messageTemplate,
          campaign.profile,
          campaign.intervalSeconds,
          campaign.maxMessagesPerTarget,
          campaign.templateId ?? undefined,
          campaign.rotationStrategy,
          campaign.rotationLookbackHours,
          {
            campaignId: campaign.id,
            campaignName: campaign.name,
          }
        );

        updateMarketingCampaignRuntime(campaign.id, {
          lastExecutedAt: new Date().toISOString(),
          lastExecutionStatus: "success",
          queueStatus: campaign.scheduleEnabled ? "pending" : "finalized",
          retryCount: 0,
          nextRetryAt: undefined,
          lastQueueEventAt: new Date().toISOString(),
          autoPausedAt: undefined,
          autoPauseReason: undefined,
        });
        results.push({
          campaignId: campaign.id,
          name: campaign.name,
          status: "success",
        });
      } catch (error) {
        const nextRetryCount = (campaign.retryCount ?? 0) + 1;
        const canRetry = nextRetryCount <= (campaign.maxRetries ?? 2);
        const nextRetryAt = canRetry
          ? new Date(Date.now() + (campaign.retryDelayMinutes ?? 30) * 60 * 1000).toISOString()
          : undefined;
        updateMarketingCampaignRuntime(campaign.id, {
          lastExecutedAt: new Date().toISOString(),
          lastExecutionStatus: "failed",
          queueStatus: canRetry ? "pending" : "paused",
          retryCount: nextRetryCount,
          nextRetryAt,
          lastQueueEventAt: new Date().toISOString(),
          autoPausedAt: canRetry ? undefined : new Date().toISOString(),
          autoPauseReason: canRetry
            ? `Retry agendado para ${nextRetryAt}`
            : "Campanha pausada após atingir o limite de retries.",
        });
        results.push({
          campaignId: campaign.id,
          name: campaign.name,
          status: canRetry ? "retry_pending" : "failed",
          detail: canRetry ? `Retry #${nextRetryCount} agendado.` : String(error),
        });
      }
    }

    return res.json({
      ok: true,
      processed: results.length,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[MarketingHeartbeat] Erro fatal:", error);
    return res.status(500).json({
      error: String(error),
      timestamp: new Date().toISOString(),
    });
  }
}

export async function ensureMarketingHeartbeatJob(sessionToken = "") {
  const { ENV } = await import("../_core/env");
  if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
    console.log("[Heartbeat] Forge/Heartbeat não configurado; bootstrap automático do marketing será ignorado.");
    return { action: "skipped" as const, reason: "forge_not_configured" as const };
  }

  const { createHeartbeatJob, listHeartbeatJobs, updateHeartbeatJob } = await import("../_core/heartbeat");
  const jobName = "whatsapp-marketing-cycle";
  const desiredCron = "0 */10 * * * *";
  const desiredPath = "/api/scheduled/marketing";

  const { jobs } = await listHeartbeatJobs(sessionToken, { page: 1, pageSize: 100 });
  const existingJob = jobs.find((job) => job.name === jobName);

  if (!existingJob) {
    return createHeartbeatJob(
      {
        name: jobName,
        cron: desiredCron,
        path: desiredPath,
        method: "POST",
        description: "Automatic marketing campaign execution - runs every 10 minutes",
        payload: { type: "marketing_cycle" },
      },
      sessionToken
    );
  }

  const needsUpdate =
    existingJob.cronExpression !== desiredCron ||
    existingJob.callbackPath !== desiredPath ||
    existingJob.callbackMethod !== "POST" ||
    !existingJob.isEnable;

  if (needsUpdate) {
    return updateHeartbeatJob(
      existingJob.taskUid,
      {
        cron: desiredCron,
        path: desiredPath,
        method: "POST",
        description: "Automatic marketing campaign execution - runs every 10 minutes",
        payload: { type: "marketing_cycle" },
        enable: true,
      },
      sessionToken
    );
  }

  return { action: "unchanged" as const, taskUid: existingJob.taskUid };
}
