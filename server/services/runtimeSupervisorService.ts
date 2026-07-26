import {
  getUserChips,
  getUserScheduledTasks,
  listExecutionAttemptsByJob,
  listUserExecutionJobs,
  searchUserActivityLogs,
} from "../db";
import { getBehaviorMemoryContext } from "./behaviorMemoryService";
import {
  getChipHealth,
  getChipSocketDiagnostics,
  restoreChipSessionsOnStartup,
} from "./whatsappService";
import { runBehaviorMemoryShadowForConnectedChips } from "./behaviorMemoryShadowService";
import {
  getRuntimeControlState,
  RuntimeControlState,
} from "../utils/runtimeControl";
import { startPassiveBehaviorEngine } from "./passiveBehaviorEngine";

export type RuntimeAlertSeverity = "info" | "warning" | "critical";
export type RuntimeAlertType =
  | "chip_disconnected"
  | "low_health"
  | "low_coverage"
  | "identity_drift"
  | "stale_snapshot"
  | "pipeline_unhealthy"
  | "job_failures"
  | "missing_shadow";

export type RuntimeAlert = {
  chipId: number;
  chipName: string;
  type: RuntimeAlertType;
  severity: RuntimeAlertSeverity;
  title: string;
  detail: string;
  observedAt: string;
};

export type RuntimeChipConsole = {
  chipId: number;
  chipName: string;
  phoneNumber: string | null;
  status: string;
  isPaused: boolean;
  health: Awaited<ReturnType<typeof getChipHealth>>;
  socket: ReturnType<typeof getChipSocketDiagnostics>;
  memory: {
    source: string;
    snapshotAgeMinutes: number | null;
    pipelineHealthScore: number | null;
    evidenceCoverage: number | null;
    averageConfidence: number | null;
  };
  identity: {
    confidence: number | null;
    maturityScore: number | null;
    stability: number | null;
    drift: number | null;
  };
  experience: {
    journalStage: string | null;
    trustLevel: number | null;
    relationshipCount: number;
    experienceCount: number;
  };
  fleet: {
    percentile: number | null;
    rank: number | null;
    bestCohortKey: string | null;
    recommendations: Array<{ label: string; confidence: number }>;
  };
  runtime: {
    pendingJobs: number;
    recentFailures: number;
    scheduledTasks: number;
    lastActivityAt: string | null;
  };
  alerts: RuntimeAlert[];
};

export type RuntimeSupervisorOverview = {
  generatedAt: string;
  control: RuntimeControlState;
  summary: {
    totalChips: number;
    connectedChips: number;
    pausedChips: number;
    chipsWithSnapshots: number;
    chipsWithFleetLearning: number;
    pendingJobs: number;
    failedAttemptsLastWindow: number;
    scheduledTasksActive: number;
    criticalAlerts: number;
    warningAlerts: number;
  };
  infra: {
    uptimeSeconds: number;
    rssMb: number;
    heapUsedMb: number;
    heapTotalMb: number;
    externalMb: number;
    cpuLoad: number | null;
  };
  schedules: Array<{
    id: number;
    chipId: number;
    chipName: string;
    taskName: string;
    targetType: string;
    isActive: boolean;
    scheduleLabel: string;
    intervalSeconds: number;
  }>;
  recentJobs: Array<{
    id: number;
    chipId: number;
    chipName: string;
    executionType: string;
    status: string;
    plannedMessages: number;
    totalMessagesSent: number;
    failureCount: number;
    createdAt: string;
  }>;
  chips: RuntimeChipConsole[];
  alerts: RuntimeAlert[];
};

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function scalePercent(value: unknown) {
  if (typeof value !== "number") return null;
  return value <= 1 ? round(value * 100) : round(value);
}

function getSnapshotAgeMinutes(value?: string | Date | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
}

function pushAlert(bucket: RuntimeAlert[], alert: RuntimeAlert | null) {
  if (alert) bucket.push(alert);
}

function buildChipAlerts(params: {
  chipId: number;
  chipName: string;
  health: Awaited<ReturnType<typeof getChipHealth>>;
  context: Awaited<ReturnType<typeof getBehaviorMemoryContext>>;
  failedAttempts: number;
  control: RuntimeControlState;
}): RuntimeAlert[] {
  const alerts: RuntimeAlert[] = [];
  const observedAt = new Date().toISOString();
  const snapshotAgeMinutes = getSnapshotAgeMinutes(params.context.windowEnd ?? null);
  const evidenceCoverage =
    typeof params.context.evidenceCoverage?.evidenceCoverage === "number"
      ? params.context.evidenceCoverage.evidenceCoverage
      : null;
  const latestDrift = params.context.identityDriftTimeline?.[0]?.drift ?? null;
  const pipelineHealthScore = params.context.pipelineHealth?.score ?? null;

  pushAlert(
    alerts,
    !params.health.connected
      ? {
          chipId: params.chipId,
          chipName: params.chipName,
          type: "chip_disconnected",
          severity: "critical",
          title: "chip desconectado",
          detail: "A sessão do WhatsApp não está conectada e precisa de atenção operacional.",
          observedAt,
        }
      : null
  );

  pushAlert(
    alerts,
    params.health.healthScore < params.control.supervisor.alertHealthThreshold
      ? {
          chipId: params.chipId,
          chipName: params.chipName,
          type: "low_health",
          severity: params.health.healthScore < 40 ? "critical" : "warning",
          title: "health baixo",
          detail: `O chip está com health ${params.health.healthScore}, abaixo do limiar operacional.`,
          observedAt,
        }
      : null
  );

  pushAlert(
    alerts,
    evidenceCoverage != null && evidenceCoverage < params.control.supervisor.alertCoverageThreshold
      ? {
          chipId: params.chipId,
          chipName: params.chipName,
          type: "low_coverage",
          severity: "warning",
          title: "coverage baixo",
          detail: `A cobertura de evidências caiu para ${round(evidenceCoverage)}%.`,
          observedAt,
        }
      : null
  );

  pushAlert(
    alerts,
    latestDrift != null && latestDrift > params.control.supervisor.alertIdentityDriftThreshold
      ? {
          chipId: params.chipId,
          chipName: params.chipName,
          type: "identity_drift",
          severity: "warning",
          title: "identity drift elevado",
          detail: `O drift observado chegou a ${round(latestDrift)} e merece revisão.`,
          observedAt,
        }
      : null
  );

  pushAlert(
    alerts,
    snapshotAgeMinutes != null && snapshotAgeMinutes > params.control.supervisor.alertSnapshotMaxAgeMinutes
      ? {
          chipId: params.chipId,
          chipName: params.chipName,
          type: "stale_snapshot",
          severity: "warning",
          title: "snapshot envelhecido",
          detail: `O snapshot mais recente tem ${snapshotAgeMinutes} minutos.`,
          observedAt,
        }
      : params.context.source === "empty"
        ? {
            chipId: params.chipId,
            chipName: params.chipName,
            type: "missing_shadow",
            severity: "warning",
            title: "shadow ausente",
            detail: "Ainda não existe snapshot materializado para este chip.",
            observedAt,
          }
        : null
  );

  pushAlert(
    alerts,
    pipelineHealthScore != null && pipelineHealthScore < 60
      ? {
          chipId: params.chipId,
          chipName: params.chipName,
          type: "pipeline_unhealthy",
          severity: "warning",
          title: "pipeline frágil",
          detail: `O pipeline health caiu para ${round(pipelineHealthScore)}.`,
          observedAt,
        }
      : null
  );

  pushAlert(
    alerts,
    params.failedAttempts > 0
      ? {
          chipId: params.chipId,
          chipName: params.chipName,
          type: "job_failures",
          severity: params.failedAttempts >= 3 ? "critical" : "info",
          title: "falhas recentes",
          detail: `${params.failedAttempts} tentativas falharam recentemente neste chip.`,
          observedAt,
        }
      : null
  );

  return alerts;
}

function buildInfraSummary() {
  const memory = process.memoryUsage();
  const cpuUsage = process.cpuUsage();
  return {
    uptimeSeconds: round(process.uptime()),
    rssMb: round(memory.rss / 1024 / 1024),
    heapUsedMb: round(memory.heapUsed / 1024 / 1024),
    heapTotalMb: round(memory.heapTotal / 1024 / 1024),
    externalMb: round(memory.external / 1024 / 1024),
    cpuLoad: round((cpuUsage.user + cpuUsage.system) / 1000),
  };
}

export async function buildRuntimeSupervisorOverview(userId: number): Promise<RuntimeSupervisorOverview> {
  const control = getRuntimeControlState();
  const [chips, jobs, scheduledTasks, activityLogs] = await Promise.all([
    getUserChips(userId),
    listUserExecutionJobs(userId, 120),
    getUserScheduledTasks(userId),
    searchUserActivityLogs({ userId, limit: 300 }),
  ]);

  const jobAttempts = await Promise.all(
    jobs.slice(0, 60).map(async (job) => ({
      jobId: job.id,
      attempts: await listExecutionAttemptsByJob(job.id, 50),
    }))
  );

  const chipsConsole = await Promise.all(
    chips.map(async (chip) => {
      const [health, context] = await Promise.all([
        getChipHealth(chip.id, chip.userId, chip.phoneNumber),
        getBehaviorMemoryContext(userId, chip.id),
      ]);
      const failedAttempts = jobAttempts
        .flatMap((item) => item.attempts)
        .filter((attempt) => attempt.chipId === chip.id && attempt.status === "failed").length;
      const chipAlerts = buildChipAlerts({
        chipId: chip.id,
        chipName: chip.chipName,
        health,
        context,
        failedAttempts,
        control,
      });

      const recentActivitySource =
        activityLogs.find((log) => log.chipId === chip.id)?.createdAt ??
        health.lastReceive ??
        health.lastSend ??
        null;
      const recentActivityAt =
        recentActivitySource instanceof Date
          ? recentActivitySource.toISOString()
          : typeof recentActivitySource === "string"
            ? recentActivitySource
            : null;

      return {
        chipId: chip.id,
        chipName: chip.chipName,
        phoneNumber: chip.phoneNumber ?? null,
        status: chip.status,
        isPaused: Boolean(chip.isPaused),
        health,
        socket: getChipSocketDiagnostics(chip.id),
        memory: {
          source: context.source,
          snapshotAgeMinutes: getSnapshotAgeMinutes(context.windowEnd ?? null),
          pipelineHealthScore: context.pipelineHealth?.score ?? null,
          evidenceCoverage: context.evidenceCoverage?.evidenceCoverage ?? null,
          averageConfidence: scalePercent(context.averageConfidence),
        },
        identity: {
          confidence: scalePercent((context.identitySnapshot as any)?.confidence ?? null),
          maturityScore: scalePercent((context.identitySnapshot as any)?.maturityScore ?? null),
          stability: scalePercent((context.identitySnapshot as any)?.stability ?? null),
          drift: context.identityDriftTimeline?.[0]?.drift ?? null,
        },
        experience: {
          journalStage: (context.longitudinal as any)?.experienceJournalCandidate?.stage ?? null,
          trustLevel: (context.longitudinal as any)?.experienceJournalCandidate?.context?.trustLevel ?? null,
          relationshipCount: Array.isArray((context.longitudinal as any)?.relationshipMemory)
            ? (context.longitudinal as any).relationshipMemory.length
            : 0,
          experienceCount: Array.isArray((context.longitudinal as any)?.experienceRetrieval?.matches)
            ? (context.longitudinal as any).experienceRetrieval.matches.length
            : 0,
        },
        fleet: {
          percentile: (context.fleetLearning as any)?.benchmark?.currentChipPercentile ?? null,
          rank: (context.fleetLearning as any)?.benchmark?.currentChipRank ?? null,
          bestCohortKey: (context.fleetLearning as any)?.benchmark?.bestCohortKey ?? null,
          recommendations: Array.isArray((context.fleetLearning as any)?.recommendations)
            ? (context.fleetLearning as any).recommendations.slice(0, 3).map((item: any) => ({
                label: String(item.label ?? "recomendação"),
                confidence: Number(item.confidence ?? 0),
              }))
            : [],
        },
        runtime: {
          pendingJobs: jobs.filter((job) => job.chipId === chip.id && (job.status === "pending" || job.status === "running")).length,
          recentFailures: failedAttempts,
          scheduledTasks: scheduledTasks.filter((task) => task.chipId === chip.id && Boolean(task.isActive)).length,
          lastActivityAt: recentActivityAt,
        },
        alerts: chipAlerts,
      } satisfies RuntimeChipConsole;
    })
  );

  const alerts = chipsConsole.flatMap((chip) => chip.alerts).sort((a, b) => {
    const weight = { critical: 3, warning: 2, info: 1 };
    return weight[b.severity] - weight[a.severity];
  });

  const schedules = scheduledTasks
    .map((task) => {
      const chip = chips.find((item) => item.id === task.chipId);
      return {
        id: task.id,
        chipId: task.chipId,
        chipName: chip?.chipName ?? `Chip #${task.chipId}`,
        taskName: task.taskName,
        targetType: task.targetType,
        isActive: Boolean(task.isActive),
        scheduleLabel: task.scheduleCron || task.scheduleTime || "sem agenda",
        intervalSeconds: task.intervalSeconds,
      };
    })
    .sort((a, b) => Number(b.isActive) - Number(a.isActive));

  const recentJobs = jobs.slice(0, 10).map((job) => {
    const chip = chips.find((item) => item.id === job.chipId);
    return {
      id: job.id,
      chipId: job.chipId,
      chipName: chip?.chipName ?? `Chip #${job.chipId}`,
      executionType: job.executionType,
      status: job.status,
      plannedMessages: job.plannedMessages,
      totalMessagesSent: job.totalMessagesSent,
      failureCount: job.failureCount,
      createdAt: String(job.createdAt),
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    control,
    summary: {
      totalChips: chips.length,
      connectedChips: chipsConsole.filter((chip) => chip.health.connected).length,
      pausedChips: chipsConsole.filter((chip) => chip.isPaused).length,
      chipsWithSnapshots: chipsConsole.filter((chip) => chip.memory.source === "snapshot").length,
      chipsWithFleetLearning: chipsConsole.filter((chip) => chip.fleet.rank != null || chip.fleet.percentile != null).length,
      pendingJobs: chipsConsole.reduce((sum, chip) => sum + chip.runtime.pendingJobs, 0),
      failedAttemptsLastWindow: chipsConsole.reduce((sum, chip) => sum + chip.runtime.recentFailures, 0),
      scheduledTasksActive: scheduledTasks.filter((task) => Boolean(task.isActive)).length,
      criticalAlerts: alerts.filter((alert) => alert.severity === "critical").length,
      warningAlerts: alerts.filter((alert) => alert.severity === "warning").length,
    },
    infra: buildInfraSummary(),
    schedules,
    recentJobs,
    chips: chipsConsole.sort((a, b) => a.chipName.localeCompare(b.chipName, "pt-BR")),
    alerts,
  };
}

export async function getRuntimeChipConsole(userId: number, chipId: number) {
  const overview = await buildRuntimeSupervisorOverview(userId);
  return overview.chips.find((chip) => chip.chipId === chipId) ?? null;
}

export async function triggerShadowRuntimeCycle(windowHours?: number) {
  const control = getRuntimeControlState();
  const effectiveWindowHours = Math.max(1, Math.floor(windowHours ?? control.supervisor.shadowWindowHours));
  return runBehaviorMemoryShadowForConnectedChips(effectiveWindowHours);
}

export async function restartRuntimeServices() {
  const control = getRuntimeControlState();
  if (control.supervisor.autoRestoreSessions) {
    await restoreChipSessionsOnStartup();
  }
  if (control.supervisor.autoStartPassiveEngine) {
    await startPassiveBehaviorEngine();
  }
  return {
    ok: true,
    restoredSessions: control.supervisor.autoRestoreSessions,
    passiveEngineStarted: control.supervisor.autoStartPassiveEngine,
    timestamp: new Date().toISOString(),
  };
}

export async function renderRuntimeMetrics(userId: number) {
  const overview = await buildRuntimeSupervisorOverview(userId);
  const lines = [
    "# HELP wmse_runtime_total_chips Total de chips conhecidos pelo runtime",
    "# TYPE wmse_runtime_total_chips gauge",
    `wmse_runtime_total_chips ${overview.summary.totalChips}`,
    "# HELP wmse_runtime_connected_chips Chips conectados",
    "# TYPE wmse_runtime_connected_chips gauge",
    `wmse_runtime_connected_chips ${overview.summary.connectedChips}`,
    "# HELP wmse_runtime_pending_jobs Jobs pendentes ou rodando",
    "# TYPE wmse_runtime_pending_jobs gauge",
    `wmse_runtime_pending_jobs ${overview.summary.pendingJobs}`,
    "# HELP wmse_runtime_critical_alerts Alertas críticos",
    "# TYPE wmse_runtime_critical_alerts gauge",
    `wmse_runtime_critical_alerts ${overview.summary.criticalAlerts}`,
    "# HELP wmse_runtime_warning_alerts Alertas de warning",
    "# TYPE wmse_runtime_warning_alerts gauge",
    `wmse_runtime_warning_alerts ${overview.summary.warningAlerts}`,
  ];

  for (const chip of overview.chips) {
    const labels = `chip_id="${chip.chipId}",chip_name="${chip.chipName.replace(/"/g, "'")}"`;
    lines.push(`# TYPE wmse_chip_health_score gauge`);
    lines.push(`wmse_chip_health_score{${labels}} ${chip.health.healthScore}`);
    lines.push(`# TYPE wmse_chip_pipeline_health_score gauge`);
    lines.push(`wmse_chip_pipeline_health_score{${labels}} ${chip.memory.pipelineHealthScore ?? 0}`);
    lines.push(`# TYPE wmse_chip_evidence_coverage gauge`);
    lines.push(`wmse_chip_evidence_coverage{${labels}} ${chip.memory.evidenceCoverage ?? 0}`);
    lines.push(`# TYPE wmse_chip_pending_jobs gauge`);
    lines.push(`wmse_chip_pending_jobs{${labels}} ${chip.runtime.pendingJobs}`);
  }

  return lines.join("\n");
}
