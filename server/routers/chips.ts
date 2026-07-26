import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router } from "../_core/trpc";
import { adminProcedure as protectedProcedure } from "../_core/rbac";
import {
  getUserChips,
  getChipById,
  createChip,
  updateChipStatus,
  updateChipPauseState,
  getUserMaturationProfiles,
  getMaturationProfile,
  createMaturationProfile,
  updateMaturationProfile,
  getChipActivityLogs,
  searchUserActivityLogs,
  createActivityLog,
  getUserScheduledTasks,
  getScheduledTaskById,
  createScheduledTask,
  updateScheduledTask,
  getUserPlan,
  getUserSubscription,
  deleteChip,
  getActiveMessageTemplateContents,
  getUserMessageTemplates,
  getUserMaturationTargets,
  getExecutionJobById,
  resolveUserMaturationTargets,
  listExecutionAttemptsByJob,
  listUserExecutionJobs,
  listBehaviorTimelineEvents,
} from "../db";
import { buildBulkDispatchTargetDistribution, executeBulkDispatchMultiChip, validateBulkDispatch } from "../services/bulkDispatchService";
import {
  ensureFreshCertifiedPool,
  ensureFreshChipOperationalSummary,
  ensureFreshFleet,
} from "../services/operationalMaterializationService";
import { getPassiveBehaviorScheduleState } from "../services/passiveBehaviorEngine";
import { disconnectChip, getChipHealth } from "../services/whatsappService";
import { startMaturationCycle } from "../services/maturationEngine";
import { normalizeTargetList } from "../utils/targets";
import { getOperationalRulesConfig } from "../utils/operationalRules";
import { deleteMarketingCampaign, listMarketingCampaigns, saveMarketingCampaign } from "../utils/marketingCampaigns";
import { addMarketingSuppressionEntry, listMarketingSuppressionEntries, removeMarketingSuppressionEntry } from "../utils/marketingSuppression";

function parseExecutionPayload(payload?: string | null) {
  try {
    return payload ? JSON.parse(payload) : {};
  } catch {
    return {};
  }
}

function calculateNextCampaignRun(scheduleTime?: string) {
  if (!scheduleTime) return null;
  const [hourRaw, minuteRaw] = scheduleTime.split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;

  const next = new Date();
  next.setSeconds(0, 0);
  next.setHours(hour, minute, 0, 0);
  if (next.getTime() <= Date.now()) {
    next.setDate(next.getDate() + 1);
  }
  return next.toISOString();
}

const defaultMaturationProfiles = {
  suave: {
    minMessageDelay: 30000,
    maxMessageDelay: 120000,
    messageFrequencyPerDay: 8,
    typingIndicatorDuration: 2000,
    audioSimulationDuration: 2500,
    reactionProbability: 20,
    imageSendProbability: 3,
  },
  normal: {
    minMessageDelay: 10000,
    maxMessageDelay: 60000,
    messageFrequencyPerDay: 16,
    typingIndicatorDuration: 1500,
    audioSimulationDuration: 3000,
    reactionProbability: 35,
    imageSendProbability: 8,
  },
  ultra: {
    minMessageDelay: 2000,
    maxMessageDelay: 30000,
    messageFrequencyPerDay: 30,
    typingIndicatorDuration: 800,
    audioSimulationDuration: 4000,
    reactionProbability: 50,
    imageSendProbability: 15,
  },
} as const;

async function buildBulkDispatchPreview(
  userId: number,
  chipIds: number[],
  targets: string[],
  maxMessagesPerTarget: number,
  options?: {
    targetType?: "number" | "group" | "list";
    messageTemplate?: string;
    intervalSeconds?: number;
    rotationStrategy?: "round_robin" | "random" | "least_usage";
    rotationLookbackHours?: number;
  }
) {
  const chips = await Promise.all(chipIds.map((chipId) => getChipById(chipId)));
  const invalidChip = chips.find((chip) => !chip || chip.userId !== userId);
  if (invalidChip !== undefined) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Um ou mais chips não pertencem ao usuário" });
  }

  const subscription = await getUserSubscription(userId);
  const plan = await getUserPlan(userId);
  if (!subscription || !plan) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Plano do usuário não encontrado" });
  }

  const activeTemplates = await getUserMessageTemplates(userId, "dispatch");
  const hasConnectedChip = chips.some((chip) => chip && (chip.status === "conectado" || chip.status === "maturando"));
  const hasAnyTemplateLibrary = activeTemplates.some((template) => Boolean(template.isActive));

  const validation = await validateBulkDispatch(
    targets,
    maxMessagesPerTarget,
    chipIds.length,
    plan.maxMessagesPerMonth,
    subscription.currentMessagesThisMonth,
    {
      hasConnectedChip,
      hasAnyTemplateLibrary,
      targetType: options?.targetType,
      messageTemplate: options?.messageTemplate,
      intervalSeconds: options?.intervalSeconds,
    }
  );

  const distribution = await buildBulkDispatchTargetDistribution(
    chipIds,
    targets,
    maxMessagesPerTarget,
    options?.rotationStrategy || "round_robin",
    options?.rotationLookbackHours || 24
  );

  return {
    ...validation,
    distributionPreview: distribution.map((entry) => ({
      chipId: entry.chipId,
      targetCount: entry.targetCount,
      plannedMessages: entry.plannedMessages,
      sampleTargets: entry.targets.slice(0, 5),
    })),
  };
}

export const chipsRouter = router({
  // Get all chips for the authenticated user
  list: protectedProcedure.query(async ({ ctx }) => {
    return await getUserChips(ctx.user.id);
  }),

  getHealth: protectedProcedure
    .input(
      z.object({
        chipId: z.number(),
      })
    )
    .query(async ({ ctx, input }) => {
      const chip = await getChipById(input.chipId);
      if (!chip || chip.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Chip not found" });
      }

      return getChipHealth(chip.id, chip.userId, chip.phoneNumber);
    }),

  getTimelineWindowSummary: protectedProcedure
    .input(
      z.object({
        chipId: z.number(),
        windowHours: z.number().min(1).max(96).default(48),
      })
    )
    .query(async ({ ctx, input }) => {
      const chip = await getChipById(input.chipId);
      if (!chip || chip.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Chip not found" });
      }

      return ensureFreshChipOperationalSummary(ctx.user.id, input.chipId, { windowHours: input.windowHours });
    }),

  listCertifiedPool: protectedProcedure.query(async ({ ctx }) => {
    return ensureFreshCertifiedPool(ctx.user.id);
  }),

  getMissionControl: protectedProcedure
    .input(
      z.object({
        windowHours: z.number().min(1).max(96).default(48),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      return ensureFreshFleet(ctx.user.id, { windowHours: input?.windowHours ?? 48 });
    }),

  getDashboardData: protectedProcedure.query(async ({ ctx }) => {
    const chips = await getUserChips(ctx.user.id);
    const templates = await getUserMessageTemplates(ctx.user.id);
    const targets = await getUserMaturationTargets(ctx.user.id);
    const logs = await searchUserActivityLogs({
      userId: ctx.user.id,
      limit: 500,
    });
    const executionJobs = await listUserExecutionJobs(ctx.user.id, 8);
    const attemptsByJob = await Promise.all(
      executionJobs.map(async (job) => ({
        jobId: job.id,
        attempts: await listExecutionAttemptsByJob(job.id, 10),
      }))
    );
    const missionControl = await ensureFreshFleet(ctx.user.id, { windowHours: 48 });
    const operationalByChipId = new Map(missionControl.map((item) => [item.chipId, item]));

    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const outgoingActionTypes = new Set(["message_sent", "image_sent", "audio_sent", "reaction_sent"]);
    const maturationTargets = {
      suave: 40,
      normal: 80,
      ultra: 120,
    } as const;

    const chipMetricsMap = new Map<number, {
      totalMessages: number;
      messagesToday: number;
      totalErrors: number;
      lastActivity: Date | null;
      lastAction: string | null;
    }>();

    for (const chip of chips) {
      chipMetricsMap.set(chip.id, {
        totalMessages: 0,
        messagesToday: 0,
        totalErrors: 0,
        lastActivity: null,
        lastAction: null,
      });
    }

    for (const log of logs) {
      const metrics = chipMetricsMap.get(log.chipId);
      if (!metrics) continue;

      const createdAt = new Date(log.createdAt);
      const createdAtTime = createdAt.getTime();

      if (!metrics.lastActivity || createdAtTime > metrics.lastActivity.getTime()) {
        metrics.lastActivity = createdAt;
        metrics.lastAction = log.actionType;
      }

      if (outgoingActionTypes.has(log.actionType)) {
        metrics.totalMessages += 1;
        if (createdAtTime >= oneDayAgo) {
          metrics.messagesToday += 1;
        }
      }

      if (log.status === "failed" || log.actionType === "error") {
        metrics.totalErrors += 1;
      }
    }

    const enrichedChips = chips.map((chip) => {
      const metrics = chipMetricsMap.get(chip.id)!;
      const target = maturationTargets[chip.maturationProfile];
      const maturationProgress = Math.min(
        100,
        Math.round((metrics.totalMessages / target) * 100)
      );
      const operational = operationalByChipId.get(chip.id);
      const passiveSchedule = getPassiveBehaviorScheduleState(chip.id);

      return {
        ...chip,
        messagesCount: metrics.totalMessages,
        messagesToday: metrics.messagesToday,
        errorCount: metrics.totalErrors,
        lastActivity: metrics.lastActivity,
        lastAction: metrics.lastAction,
        maturationProgress,
        healthScore: operational?.health.healthScore ?? 0,
        humanScore: operational?.scores.humanScore ?? 0,
        riskScore: operational?.scores.riskScore ?? 100,
        certificationStatus: operational?.certification.status ?? "NOVO",
        certificationUsable: operational?.certification.usable ?? false,
        certificationReason: operational?.certification.reason ?? null,
        phaseStartedAt: operational?.phaseStartedAt ?? null,
        connectedMinutes: operational?.connectedMinutes ?? 0,
        lastEventAt: operational?.lastEventAt ?? null,
        lastEventType: operational?.lastEventType ?? null,
        lastPassiveAction: passiveSchedule?.lastActionType ?? null,
        lastPassiveActionAt: passiveSchedule?.lastActionAt ?? null,
        nextScheduledAction: passiveSchedule?.nextActionType ?? null,
        nextScheduledAt: passiveSchedule?.nextActionAt ?? null,
        activeMinutes: operational?.metrics.activeMinutes ?? 0,
        idleMinutes: operational?.metrics.idleMinutes ?? 0,
        distinctConversations: operational?.metrics.distinctConversations ?? 0,
        groupsJoined: operational?.metrics.groupJoinCount ?? 0,
        timelineSentCount: operational?.metrics.sentCount ?? 0,
        timelineReceivedCount: operational?.metrics.receivedCount ?? 0,
      };
    });

    const recentActivity = logs.slice(0, 8).map((log) => {
      const chip = chips.find((item) => item.id === log.chipId);
      return {
        id: log.id,
        chipId: log.chipId,
        chipName: chip?.chipName || `Chip #${log.chipId}`,
        actionType: log.actionType,
        status: log.status,
        createdAt: log.createdAt,
        description: log.errorMessage || log.messageContent || log.targetNumber || log.targetGroup || "Sem detalhes",
      };
    });

    const recentExecutionJobs = executionJobs.map((job) => {
      const chip = chips.find((item) => item.id === job.chipId);
      const jobAttempts = attemptsByJob.find((item) => item.jobId === job.id)?.attempts ?? [];
      const skippedCount = jobAttempts.filter((attempt) => attempt.errorMessage?.startsWith("SKIPPED_RULE:")).length;
      return {
        id: job.id,
        chipId: job.chipId,
        chipName: chip?.chipName || `Chip #${job.chipId}`,
        executionType: job.executionType,
        status: job.status,
        profileName: job.profileName,
        successCount: job.successCount,
        failureCount: job.failureCount,
        totalMessagesSent: job.totalMessagesSent,
        plannedMessages: job.plannedMessages,
        createdAt: job.createdAt,
        errorMessage: job.errorMessage,
        skippedCount,
      };
    });

    const recentFailedAttempts = attemptsByJob
      .flatMap(({ jobId, attempts }) =>
        attempts
          .filter((attempt) => attempt.status === "failed")
          .map((attempt) => {
            const chip = chips.find((item) => item.id === attempt.chipId);
            return {
              id: attempt.id,
              jobId,
              chipId: attempt.chipId,
              chipName: chip?.chipName || `Chip #${attempt.chipId}`,
              actionType: attempt.actionType,
              targetType: attempt.targetType,
              targetValue: attempt.targetValue,
              errorMessage: attempt.errorMessage,
              createdAt: attempt.createdAt,
            };
          })
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 6);

    const recentSkippedAttempts = attemptsByJob
      .flatMap(({ jobId, attempts }) =>
        attempts
          .filter((attempt) => attempt.errorMessage?.startsWith("SKIPPED_RULE:"))
          .map((attempt) => {
            const chip = chips.find((item) => item.id === attempt.chipId);
            return {
              id: attempt.id,
              jobId,
              chipId: attempt.chipId,
              chipName: chip?.chipName || `Chip #${attempt.chipId}`,
              targetType: attempt.targetType,
              targetValue: attempt.targetValue,
              reason: attempt.errorMessage?.replace(/^SKIPPED_RULE:/, "").trim() || "Pulado por regra operacional",
              createdAt: attempt.createdAt,
            };
          })
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 8);

    const chipOperationalHotspots = Array.from(
      attemptsByJob
        .flatMap(({ attempts }) => attempts)
        .reduce(
          (map, attempt) => {
            const chip = chips.find((item) => item.id === attempt.chipId);
            const key = String(attempt.chipId);
            const entry = map.get(key) ?? {
              chipId: attempt.chipId,
              chipName: chip?.chipName || `Chip #${attempt.chipId}`,
              skippedCount: 0,
              failedCount: 0,
            };
            if (attempt.errorMessage?.startsWith("SKIPPED_RULE:")) entry.skippedCount += 1;
            else if (attempt.status === "failed") entry.failedCount += 1;
            map.set(key, entry);
            return map;
          },
          new Map<string, { chipId: number; chipName: string; skippedCount: number; failedCount: number }>()
        )
        .values()
    )
      .sort((a, b) => b.skippedCount + b.failedCount - (a.skippedCount + a.failedCount))
      .filter((item) => item.skippedCount + item.failedCount > 0)
      .slice(0, 5);

    const targetOperationalHotspots = Array.from(
      recentSkippedAttempts.reduce(
        (map, attempt) => {
          const key = `${attempt.targetType}:${attempt.targetValue}`;
          const entry = map.get(key) ?? {
            targetType: attempt.targetType,
            targetValue: attempt.targetValue,
            skippedCount: 0,
            lastReason: attempt.reason,
          };
          entry.skippedCount += 1;
          entry.lastReason = attempt.reason;
          map.set(key, entry);
          return map;
        },
        new Map<string, { targetType: string; targetValue: string; skippedCount: number; lastReason: string }>()
      ).values()
    )
      .sort((a, b) => b.skippedCount - a.skippedCount)
      .slice(0, 5);

    const summary = {
      totalChips: enrichedChips.length,
      connectedCount: enrichedChips.filter((chip) => chip.status === "conectado").length,
      maturingCount: enrichedChips.filter((chip) => chip.status === "maturando").length,
      pausedCount: enrichedChips.filter((chip) => Boolean(chip.isPaused)).length,
      activeTodayCount: enrichedChips.filter((chip) => (chip.messagesToday || 0) > 0).length,
      totalMessages: enrichedChips.reduce((sum, chip) => sum + (chip.messagesCount || 0), 0),
      messagesToday: enrichedChips.reduce((sum, chip) => sum + (chip.messagesToday || 0), 0),
      errorCount: enrichedChips.reduce((sum, chip) => sum + (chip.errorCount || 0), 0),
      recentJobsCount: recentExecutionJobs.length,
      failedJobsCount: recentExecutionJobs.filter((job) => job.status === "failed" || job.status === "partial").length,
      skippedAttemptsCount: recentSkippedAttempts.length,
      successRate:
        logs.length > 0
          ? Math.round((logs.filter((log) => log.status === "success").length / logs.length) * 100)
          : 100,
    };

    const readiness = {
      connectedChips: chips.filter((chip) => chip.status === "conectado" || chip.status === "maturando").length,
      activeTemplates: templates.filter((template) => Boolean(template.isActive)).length,
      totalTargets: targets.length,
      groupTargets: targets.filter((target) => target.targetType === "group").length,
      numberTargets: targets.filter((target) => target.targetType === "number").length,
      readyForDispatch:
        enrichedChips.some((chip) => chip.certificationUsable) &&
        templates.some((template) => Boolean(template.isActive)) &&
        targets.length > 0,
    };

    return {
      summary,
      readiness,
      chips: enrichedChips,
      missionControl,
      recentActivity,
      recentExecutionJobs,
      recentFailedAttempts,
      recentSkippedAttempts,
      chipOperationalHotspots,
      targetOperationalHotspots,
      operationalRules: getOperationalRulesConfig(),
    };
  }),

  // Get a specific chip by ID
  getById: protectedProcedure.input(z.object({ chipId: z.number() })).query(async ({ input, ctx }) => {
    const chip = await getChipById(input.chipId);
    if (!chip || chip.userId !== ctx.user.id) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Chip not found" });
    }
    return chip;
  }),

  // Create a new chip
  create: protectedProcedure
    .input(
      z.object({
        chipName: z.string().min(1),
        phoneNumber: z.string().optional(),
        maturationProfile: z.enum(["suave", "normal", "ultra"]).default("normal"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const chip = await createChip({
        userId: ctx.user.id,
        chipName: input.chipName,
        phoneNumber: input.phoneNumber,
        maturationProfile: input.maturationProfile,
        status: "desconectado",
      });
      return chip;
    }),

  // Update chip status
  updateStatus: protectedProcedure
    .input(
      z.object({
        chipId: z.number(),
        status: z.enum(["conectado", "maturando", "desconectado"]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const chip = await getChipById(input.chipId);
      if (!chip || chip.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Chip not found" });
      }
      await updateChipStatus(input.chipId, input.status);
      return { success: true };
    }),

  setPaused: protectedProcedure
    .input(
      z.object({
        chipId: z.number(),
        isPaused: z.boolean(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const chip = await getChipById(input.chipId);
      if (!chip || chip.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Chip not found" });
      }

      await updateChipPauseState(input.chipId, input.isPaused ? 1 : 0);
      await createActivityLog({
        chipId: input.chipId,
        actionType: input.isPaused ? "disconnection" : "connection",
        messageContent: input.isPaused ? "Chip pausado pelo usuário" : "Chip retomado pelo usuário",
        status: "success",
      });

      return { success: true };
    }),

  remove: protectedProcedure
    .input(z.object({ chipId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const chip = await getChipById(input.chipId);
      if (!chip || chip.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Chip not found" });
      }

      try {
        await disconnectChip(input.chipId);
      } catch {
        // Ignore disconnection failures during cleanup.
      }

      await deleteChip(input.chipId);
      return { success: true };
    }),

  // Get activity logs for a chip
  getActivityLogs: protectedProcedure
    .input(z.object({ chipId: z.number(), limit: z.number().default(100) }))
    .query(async ({ input, ctx }) => {
      const chip = await getChipById(input.chipId);
      if (!chip || chip.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Chip not found" });
      }
      return await getChipActivityLogs(input.chipId, input.limit);
    }),

  listLogs: protectedProcedure
    .input(
      z.object({
        chipId: z.number().optional(),
        actionType: z
          .enum([
            "message_sent",
            "image_sent",
            "audio_sent",
            "reaction_sent",
            "message_received",
            "connection",
            "disconnection",
            "error",
          ])
          .optional(),
        status: z.enum(["success", "failed", "pending"]).optional(),
        search: z.string().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        limit: z.number().min(1).max(300).default(100),
      })
    )
    .query(async ({ input, ctx }) => {
      if (input.chipId) {
        const chip = await getChipById(input.chipId);
        if (!chip || chip.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Chip not found" });
        }
      }

      return await searchUserActivityLogs({
        userId: ctx.user.id,
        chipId: input.chipId,
        actionType: input.actionType,
        status: input.status,
        search: input.search,
        dateFrom: input.dateFrom ? new Date(input.dateFrom) : undefined,
        dateTo: input.dateTo ? new Date(input.dateTo) : undefined,
        limit: input.limit,
      });
    }),

  listBehaviorTimeline: protectedProcedure
    .input(
      z.object({
        chipId: z.number().optional(),
        eventType: z
          .enum([
            "session_connected",
            "contacts_synced",
            "contact_added",
            "profile_name_updated",
            "profile_photo_updated",
            "about_updated",
            "wake_up",
            "idle",
            "status_viewed",
            "chat_list_opened",
            "sleep",
            "message_sent",
            "message_acknowledged",
            "message_received",
            "group_joined",
            "group_opened",
            "participants_loaded",
            "messages_read",
          ])
          .optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        limit: z.number().min(1).max(500).default(200),
      })
    )
    .query(async ({ input, ctx }) => {
      if (input.chipId) {
        const chip = await getChipById(input.chipId);
        if (!chip || chip.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Chip not found" });
        }
      }

      const events = await listBehaviorTimelineEvents({
        userId: ctx.user.id,
        chipId: input.chipId,
        eventType: input.eventType,
        dateFrom: input.dateFrom ? new Date(input.dateFrom) : undefined,
        dateTo: input.dateTo ? new Date(input.dateTo) : undefined,
        limit: input.limit,
      });

      return {
        events,
        summary: {
          total: events.length,
          sessionConnected: events.filter((event) => event.eventType === "session_connected").length,
          contactsSynced: events.filter((event) => event.eventType === "contacts_synced").length,
          contactAdded: events.filter((event) => event.eventType === "contact_added").length,
          statusViewed: events.filter((event) => event.eventType === "status_viewed").length,
          sent: events.filter((event) => event.eventType === "message_sent").length,
          acknowledged: events.filter((event) => event.eventType === "message_acknowledged").length,
          received: events.filter((event) => event.eventType === "message_received").length,
          groupsJoined: events.filter((event) => event.eventType === "group_joined").length,
          groupsOpened: events.filter((event) => event.eventType === "group_opened").length,
          participantsLoaded: events.filter((event) => event.eventType === "participants_loaded").length,
          reads: events.filter((event) => event.eventType === "messages_read").length,
        },
      };
    }),

  getReportData: protectedProcedure
    .input(
      z.object({
        chipId: z.number().optional(),
        actionType: z
          .enum([
            "message_sent",
            "image_sent",
            "audio_sent",
            "reaction_sent",
            "message_received",
            "connection",
            "disconnection",
            "error",
          ])
          .optional(),
        status: z.enum(["success", "failed", "pending"]).optional(),
        search: z.string().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        limit: z.number().min(1).max(2000).default(1000),
      })
    )
    .query(async ({ input, ctx }) => {
      if (input.chipId) {
        const chip = await getChipById(input.chipId);
        if (!chip || chip.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Chip not found" });
        }
      }

      const logs = await searchUserActivityLogs({
        userId: ctx.user.id,
        chipId: input.chipId,
        actionType: input.actionType,
        status: input.status,
        search: input.search,
        dateFrom: input.dateFrom ? new Date(input.dateFrom) : undefined,
        dateTo: input.dateTo ? new Date(input.dateTo) : undefined,
        limit: input.limit,
      });

      const statusCounts = logs.reduce(
        (acc, log) => {
          acc[log.status] += 1;
          return acc;
        },
        { success: 0, failed: 0, pending: 0 }
      );

      const actionCountsMap = new Map<string, number>();
      const chipCountsMap = new Map<number, number>();

      for (const log of logs) {
        actionCountsMap.set(log.actionType, (actionCountsMap.get(log.actionType) || 0) + 1);
        chipCountsMap.set(log.chipId, (chipCountsMap.get(log.chipId) || 0) + 1);
      }

      return {
        logs,
        summary: {
          totalLogs: logs.length,
          successCount: statusCounts.success,
          failedCount: statusCounts.failed,
          pendingCount: statusCounts.pending,
          distinctChips: chipCountsMap.size,
          messageSentCount: actionCountsMap.get("message_sent") || 0,
          errorCount: actionCountsMap.get("error") || 0,
          actionBreakdown: Array.from(actionCountsMap.entries())
            .map(([actionType, count]) => ({ actionType, count }))
            .sort((a, b) => b.count - a.count),
          chipBreakdown: Array.from(chipCountsMap.entries())
            .map(([chipId, count]) => ({ chipId, count }))
            .sort((a, b) => b.count - a.count),
        },
      };
    }),

  previewBulkDispatch: protectedProcedure
    .input(
      z.object({
        chipIds: z.array(z.number()).min(1),
        targetType: z.enum(["number", "group", "list"]).default("number"),
        targets: z.array(z.string().min(1)).min(1),
        maxMessagesPerTarget: z.number().min(1).max(20).default(1),
        messageTemplate: z.string().optional(),
        intervalSeconds: z.number().min(1).max(300).default(5),
        rotationStrategy: z.enum(["round_robin", "random", "least_usage"]).default("round_robin"),
        rotationLookbackHours: z.number().min(1).max(24 * 30).default(24),
      })
    )
    .query(async ({ input, ctx }) => {
      let normalizedTargets: string[];
      try {
        normalizedTargets = normalizeTargetList(input.targets, input.targetType).map((item) => item.normalizedValue);
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error instanceof Error ? error.message : "Alvo inválido",
        });
      }

      const suppressionSet = new Set(listMarketingSuppressionEntries(ctx.user.id).map((entry) => entry.value));
      const filteredTargets =
        input.targetType === "group"
          ? normalizedTargets
          : normalizedTargets.filter((target) => !suppressionSet.has(target.replace(/\D/g, "")));

      const preview = await buildBulkDispatchPreview(ctx.user.id, input.chipIds, filteredTargets, input.maxMessagesPerTarget, {
        targetType: input.targetType,
        messageTemplate: input.messageTemplate,
        intervalSeconds: input.intervalSeconds,
        rotationStrategy: input.rotationStrategy,
        rotationLookbackHours: input.rotationLookbackHours,
      });

      return {
        ...preview,
        warnings:
          normalizedTargets.length !== filteredTargets.length
            ? [...preview.warnings, `${normalizedTargets.length - filteredTargets.length} alvo(s) foram suprimidos pela blacklist.`]
            : preview.warnings,
      };
    }),

  executeBulkDispatch: protectedProcedure
    .input(
      z.object({
        chipIds: z.array(z.number()).min(1),
        targetType: z.enum(["number", "group", "list"]),
        targets: z.array(z.string().min(1)).min(1),
        messageTemplate: z.string().min(1),
        templateId: z.number().optional(),
        profile: z.enum(["suave", "normal", "ultra"]),
        intervalSeconds: z.number().min(1).max(300).default(5),
        maxMessagesPerTarget: z.number().min(1).max(20).default(1),
        rotationStrategy: z.enum(["round_robin", "random", "least_usage"]).default("round_robin"),
        rotationLookbackHours: z.number().min(1).max(24 * 30).default(24),
        campaignId: z.string().optional(),
        campaignName: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      let normalizedTargets: string[];
      try {
        normalizedTargets = normalizeTargetList(input.targets, input.targetType).map((item) => item.normalizedValue);
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error instanceof Error ? error.message : "Alvo inválido",
        });
      }

      const suppressionSet = new Set(listMarketingSuppressionEntries(ctx.user.id).map((entry) => entry.value));
      const filteredTargets =
        input.targetType === "group"
          ? normalizedTargets
          : normalizedTargets.filter((target) => !suppressionSet.has(target.replace(/\D/g, "")));

      const preview = await buildBulkDispatchPreview(
        ctx.user.id,
        input.chipIds,
        filteredTargets,
        input.maxMessagesPerTarget,
        {
          targetType: input.targetType,
          messageTemplate: input.messageTemplate,
          intervalSeconds: input.intervalSeconds,
          rotationStrategy: input.rotationStrategy,
          rotationLookbackHours: input.rotationLookbackHours,
        }
      );

      if (!preview.valid) {
        throw new TRPCError({ code: "FORBIDDEN", message: preview.error || "Disparo bloqueado pelos limites do plano" });
      }

      return await executeBulkDispatchMultiChip(
        input.chipIds,
        input.targetType,
        filteredTargets,
        input.messageTemplate,
        input.profile,
        input.intervalSeconds,
        input.maxMessagesPerTarget,
        input.templateId,
        input.rotationStrategy,
        input.rotationLookbackHours,
        {
          campaignId: input.campaignId,
          campaignName: input.campaignName,
        }
      );
    }),

  listMarketingCampaigns: protectedProcedure.query(async ({ ctx }) => {
    return listMarketingCampaigns(ctx.user.id).map((campaign) => ({
      ...campaign,
      nextRunAt: campaign.scheduleEnabled ? calculateNextCampaignRun(campaign.scheduleTime) : null,
    }));
  }),

  saveMarketingCampaign: protectedProcedure
    .input(
      z.object({
        id: z.string().optional(),
        name: z.string().trim().min(2).max(120),
        targetType: z.enum(["number", "group", "list"]),
        targetsText: z.string(),
        targetEntries: z.array(
          z.object({
            value: z.string().min(1),
            name: z.string().optional(),
            tag: z.string().optional(),
          })
        ).default([]),
        selectedChipIds: z.array(z.number()).min(1),
        messageTemplate: z.string().default(""),
        templateId: z.number().nullable().optional(),
        profile: z.enum(["suave", "normal", "ultra"]),
        intervalSeconds: z.number().min(1).max(300),
        maxMessagesPerTarget: z.number().min(1).max(20),
        rotationStrategy: z.enum(["round_robin", "random", "least_usage"]),
        rotationLookbackHours: z.number().min(1).max(24 * 30).default(24),
        selectedTagFilter: z.string().optional(),
        scheduleEnabled: z.boolean().optional(),
        scheduleTime: z.string().optional(),
        maxRetries: z.number().min(0).max(10).optional(),
        retryDelayMinutes: z.number().min(5).max(24 * 60).optional(),
        timeWindowStart: z.string().optional(),
        timeWindowEnd: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return saveMarketingCampaign(ctx.user.id, input);
    }),

  deleteMarketingCampaign: protectedProcedure
    .input(z.object({ campaignId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      return deleteMarketingCampaign(ctx.user.id, input.campaignId);
    }),

  getMarketingAnalytics: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(200).default(60) }).optional())
    .query(async ({ ctx, input }) => {
      const jobs = await listUserExecutionJobs(ctx.user.id, input?.limit ?? 60);
      const dispatchJobs = jobs.filter((job) => job.executionType === "dispatch");
      const attemptsByJob = await Promise.all(
        dispatchJobs.map(async (job) => ({
          job,
          attempts: await listExecutionAttemptsByJob(job.id, 300),
          payload: parseExecutionPayload(job.payload),
        }))
      );

      const byCampaign = new Map<string, {
        campaignId: string;
        campaignName: string;
        totalJobs: number;
        totalMessagesSent: number;
        totalTargets: number;
        successCount: number;
        failureCount: number;
        suspicionCount: number;
      }>();
      const byChip = new Map<number, {
        chipId: number;
        totalJobs: number;
        totalMessagesSent: number;
        successCount: number;
        failureCount: number;
        suspicionCount: number;
        riskScore: number;
      }>();
      const suspicionRegex = /(bloque|block|ban|forbidden|not[- ]authorized|401|403|429|rate)/i;

      for (const entry of attemptsByJob) {
        const { job, attempts, payload } = entry;
        const campaignId = payload.campaignId || `job_${job.id}`;
        const campaignName = payload.campaignName || `Campanha #${job.id}`;
        const suspicionCount = attempts.filter((attempt) => suspicionRegex.test(String(attempt.errorMessage || ""))).length;

        const campaignStats = byCampaign.get(campaignId) ?? {
          campaignId,
          campaignName,
          totalJobs: 0,
          totalMessagesSent: 0,
          totalTargets: 0,
          successCount: 0,
          failureCount: 0,
          suspicionCount: 0,
        };
        campaignStats.totalJobs += 1;
        campaignStats.totalMessagesSent += job.totalMessagesSent ?? 0;
        campaignStats.totalTargets += job.totalTargets ?? 0;
        campaignStats.successCount += job.successCount ?? 0;
        campaignStats.failureCount += job.failureCount ?? 0;
        campaignStats.suspicionCount += suspicionCount;
        byCampaign.set(campaignId, campaignStats);

        const chipStats = byChip.get(job.chipId) ?? {
          chipId: job.chipId,
          totalJobs: 0,
          totalMessagesSent: 0,
          successCount: 0,
          failureCount: 0,
          suspicionCount: 0,
          riskScore: 0,
        };
        chipStats.totalJobs += 1;
        chipStats.totalMessagesSent += job.totalMessagesSent ?? 0;
        chipStats.successCount += job.successCount ?? 0;
        chipStats.failureCount += job.failureCount ?? 0;
        chipStats.suspicionCount += suspicionCount;
        chipStats.riskScore = Math.min(
          100,
          Math.round(chipStats.failureCount * 4 + chipStats.suspicionCount * 12 + chipStats.totalJobs * 1.5)
        );
        byChip.set(job.chipId, chipStats);
      }

      return {
        campaigns: Array.from(byCampaign.values()).sort((a, b) => b.totalMessagesSent - a.totalMessagesSent),
        chips: Array.from(byChip.values()).sort((a, b) => b.totalMessagesSent - a.totalMessagesSent),
      };
    }),

  listMarketingSuppression: protectedProcedure.query(async ({ ctx }) => {
    return listMarketingSuppressionEntries(ctx.user.id);
  }),

  addMarketingSuppression: protectedProcedure
    .input(
      z.object({
        value: z.string().min(5),
        reason: z.string().optional(),
        tag: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return addMarketingSuppressionEntry(ctx.user.id, input);
    }),

  removeMarketingSuppression: protectedProcedure
    .input(z.object({ suppressionId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      return removeMarketingSuppressionEntry(ctx.user.id, input.suppressionId);
    }),

  getMarketingCampaignHistory: protectedProcedure
    .input(
      z.object({
        campaignId: z.string().min(1),
        limit: z.number().min(1).max(100).default(30),
      })
    )
    .query(async ({ ctx, input }) => {
      const jobs = await listUserExecutionJobs(ctx.user.id, Math.max(input.limit * 5, 100));
      const matchedJobs = jobs.filter((job) => {
        const payload = parseExecutionPayload(job.payload);
        return job.executionType === "dispatch" && payload.campaignId === input.campaignId;
      }).slice(0, input.limit);

      const detailedJobs = await Promise.all(
        matchedJobs.map(async (job) => ({
          job,
          payload: parseExecutionPayload(job.payload),
          attempts: await listExecutionAttemptsByJob(job.id, 300),
        }))
      );

      return {
        jobs: detailedJobs,
      };
    }),

  getMarketingExecutiveSummary: protectedProcedure.query(async ({ ctx }) => {
    const [jobs, campaigns] = await Promise.all([
      listUserExecutionJobs(ctx.user.id, 160),
      Promise.resolve(listMarketingCampaigns(ctx.user.id)),
    ]);

    const marketingJobs = jobs.filter((job) => job.executionType === "dispatch");
    const maturationJobs = jobs.filter((job) => job.executionType === "maturation");
    const riskyCampaigns = campaigns.filter((campaign) => campaign.queueStatus === "paused" || campaign.lastExecutionStatus === "paused_risk");

    return {
      marketing: {
        activeCampaigns: campaigns.filter((campaign) => campaign.scheduleEnabled).length,
        queuedCampaigns: campaigns.filter((campaign) => campaign.queueStatus === "pending").length,
        pausedCampaigns: campaigns.filter((campaign) => campaign.queueStatus === "paused").length,
        totalMessages: marketingJobs.reduce((acc, job) => acc + (job.totalMessagesSent ?? 0), 0),
      },
      maturation: {
        runs: maturationJobs.length,
        totalMessages: maturationJobs.reduce((acc, job) => acc + (job.totalMessagesSent ?? 0), 0),
      },
      risk: {
        highRiskCampaigns: riskyCampaigns.length,
      },
    };
  }),

  listExecutionJobs: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(20) }).optional())
    .query(async ({ ctx, input }) => {
      const jobs = await listUserExecutionJobs(ctx.user.id, input?.limit ?? 20);
      const jobsWithSkipped = await Promise.all(
        jobs.map(async (job) => {
          const attempts = await listExecutionAttemptsByJob(job.id, 200);
          const skippedCount = attempts.filter((attempt) => attempt.errorMessage?.startsWith("SKIPPED_RULE:")).length;
          return {
            ...job,
            skippedCount,
          };
        })
      );
      return jobsWithSkipped;
    }),

  getExecutionJob: protectedProcedure
    .input(z.object({ jobId: z.number() }))
    .query(async ({ ctx, input }) => {
      const job = await getExecutionJobById(input.jobId);
      if (!job || job.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Execução não encontrada" });
      }

      const attempts = await listExecutionAttemptsByJob(input.jobId);
      return { job, attempts };
    }),
});

export const maturationRouter = router({
  // Get all maturation profiles for the user
  listProfiles: protectedProcedure.query(async ({ ctx }) => {
    const existingProfiles = await getUserMaturationProfiles(ctx.user.id);
    const existingNames = new Set(existingProfiles.map((profile) => profile.profileName));

    for (const profileName of ["suave", "normal", "ultra"] as const) {
      if (!existingNames.has(profileName)) {
        await createMaturationProfile({
          userId: ctx.user.id,
          profileName,
          ...defaultMaturationProfiles[profileName],
        });
      }
    }

    return await getUserMaturationProfiles(ctx.user.id);
  }),

  // Get a specific maturation profile
  getProfile: protectedProcedure
    .input(z.object({ profileName: z.enum(["suave", "normal", "ultra"]) }))
    .query(async ({ input, ctx }) => {
      let profile = await getMaturationProfile(ctx.user.id, input.profileName);
      if (!profile) {
        await createMaturationProfile({
          userId: ctx.user.id,
          profileName: input.profileName,
          ...defaultMaturationProfiles[input.profileName],
        });
        profile = await getMaturationProfile(ctx.user.id, input.profileName);
      }
      if (!profile) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Profile not found" });
      }
      return profile;
    }),

  // Create or update maturation profile
  upsertProfile: protectedProcedure
    .input(
      z.object({
        profileName: z.enum(["suave", "normal", "ultra"]),
        minMessageDelay: z.number().default(5000),
        maxMessageDelay: z.number().default(15000),
        messageFrequencyPerDay: z.number().default(10),
        typingIndicatorDuration: z.number().default(2000),
        audioSimulationDuration: z.number().default(3000),
        reactionProbability: z.number().min(0).max(100).default(30),
        imageSendProbability: z.number().min(0).max(100).default(20),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const existing = await getMaturationProfile(ctx.user.id, input.profileName);
      if (existing) {
        await updateMaturationProfile(ctx.user.id, input.profileName, {
          minMessageDelay: input.minMessageDelay,
          maxMessageDelay: input.maxMessageDelay,
          messageFrequencyPerDay: input.messageFrequencyPerDay,
          typingIndicatorDuration: input.typingIndicatorDuration,
          audioSimulationDuration: input.audioSimulationDuration,
          reactionProbability: input.reactionProbability,
          imageSendProbability: input.imageSendProbability,
        });
        return { success: true, profileId: existing.id };
      }
      await createMaturationProfile({
        userId: ctx.user.id,
        profileName: input.profileName,
        minMessageDelay: input.minMessageDelay,
        maxMessageDelay: input.maxMessageDelay,
        messageFrequencyPerDay: input.messageFrequencyPerDay,
        typingIndicatorDuration: input.typingIndicatorDuration,
        audioSimulationDuration: input.audioSimulationDuration,
        reactionProbability: input.reactionProbability,
        imageSendProbability: input.imageSendProbability,
      });
      return { success: true }
    }),

  runCycle: protectedProcedure
    .input(
      z.object({
        chipId: z.number(),
        messagesPerCycle: z.number().min(1).max(20).default(3),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const chip = await getChipById(input.chipId);
      if (!chip || chip.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Chip not found" });
      }

      const targets = await resolveUserMaturationTargets(ctx.user.id, {
        excludeChipId: chip.id,
      });
      if (targets.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Nenhum target de maturação ativo configurado",
        });
      }

      const templates = await getActiveMessageTemplateContents(ctx.user.id, "maturation");
      return await startMaturationCycle(
        chip.id,
        chip.maturationProfile,
        targets,
        input.messagesPerCycle,
        templates
      );
    }),
});

export const schedulingRouter = router({
  // Get all scheduled tasks for the user
  listTasks: protectedProcedure.query(async ({ ctx }) => {
    return await getUserScheduledTasks(ctx.user.id);
  }),

  // Get a specific scheduled task
  getTask: protectedProcedure.input(z.object({ taskId: z.number() })).query(async ({ input, ctx }) => {
    const task = await getScheduledTaskById(input.taskId);
    if (!task || task.userId !== ctx.user.id) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
    }
    return task;
  }),

  // Create a new scheduled task
  createTask: protectedProcedure
    .input(
      z.object({
        chipId: z.number(),
        taskName: z.string().min(1),
        targetType: z.enum(["group", "number", "list"]),
        targetData: z.string(),
        messageTemplate: z.string().optional(),
        scheduleCron: z.string().optional(),
        scheduleTime: z.string().optional(),
        intervalSeconds: z.number().default(5),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const chip = await getChipById(input.chipId);
      if (!chip || chip.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Chip not found" });
      }
      await createScheduledTask({
        userId: ctx.user.id,
        chipId: input.chipId,
        taskName: input.taskName,
        targetType: input.targetType,
        targetData: input.targetData,
        messageTemplate: input.messageTemplate,
        scheduleCron: input.scheduleCron,
        scheduleTime: input.scheduleTime,
        intervalSeconds: input.intervalSeconds,
        isActive: 1,
      });
      return { success: true }
    }),

  // Update a scheduled task
  updateTask: protectedProcedure
    .input(
      z.object({
        taskId: z.number(),
        isActive: z.number().optional(),
        intervalSeconds: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const task = await getScheduledTaskById(input.taskId);
      if (!task || task.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
      }
      await updateScheduledTask(input.taskId, {
        isActive: input.isActive,
        intervalSeconds: input.intervalSeconds,
      });
      return { success: true };
    }),
});
