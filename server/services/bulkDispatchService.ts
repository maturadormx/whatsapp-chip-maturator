import {
  createActivityLog,
  createExecutionAttempt,
  createExecutionJob,
  getMessageRotationContext,
  getChipById,
  getActiveMessageTemplateContents,
  getTargetOperationalSnapshot,
  listUserExecutionJobs,
  updateExecutionAttempt,
  updateExecutionJob,
} from "../db";
import { getRandomMessage, getRandomDelay, getTypingDuration, getRandomReaction } from "./maturationEngine";
import type { MaturationProfile } from "./maturationEngine";
import { getChipHealth, getChipSession, sendMessage, sendReaction } from "./whatsappService";
import { pickRotatingMessageAdvanced } from "../utils/messageLibrary";
import { evaluateOperationalRules } from "../utils/operationalRules";
import { evaluateChipAction } from "./maturityPolicy";
import { ENV } from "../_core/env";

export interface BulkDispatchConfig {
  chipId: number;
  targetType: "number" | "group" | "list";
  targets: string[]; // Números ou IDs de grupos
  messageTemplate?: string;
  templateId?: number;
  profile: MaturationProfile;
  intervalSeconds: number;
  maxMessagesPerTarget?: number;
  campaignId?: string;
  campaignName?: string;
  rotationStrategy?: BulkDispatchRotationStrategy;
  rotationLookbackHours?: number;
}

export interface BulkDispatchResult {
  success: boolean;
  dispatchId: string;
  executionJobId?: number;
  chipId: number;
  totalTargets: number;
  successCount: number;
  failureCount: number;
  skippedCount: number;
  totalMessagesSent: number;
  duration: number;
  results: Array<{
    target: string;
    success: boolean;
    skipped?: boolean;
    messagesSent?: number;
    error?: string;
  }>;
}

export type BulkDispatchRotationStrategy = "round_robin" | "random" | "least_usage";

export interface BulkDispatchDistributionEntry {
  chipId: number;
  targets: string[];
  targetCount: number;
  plannedMessages: number;
}

function buildSendSessionState(chipId: number) {
  const session = getChipSession(chipId);
  const socket = session?.socket as any;

  return {
    chipId,
    socketInstanceId: session?.socketInstanceId ?? null,
    connectionState: session?.connectionState ?? "missing",
    wsReadyState: typeof socket?.ws?.readyState === "number" ? socket.ws.readyState : null,
    socketUserId: socket?.user?.id ?? null,
    lastDisconnectAt: session?.lastDisconnectAt?.toISOString?.() ?? null,
    lastDisconnectReason: session?.lastDisconnectReason ?? null,
    isConnected: Boolean(session?.isConnected),
  };
}

function logBulkDispatchProbe(payload: Record<string, unknown>) {
  if (!ENV.runtimeDebugLogsEnabled) return;
  console.log(JSON.stringify(payload));
}

async function buildLeastUsageOrder(chipIds: number[], lookbackHours = 24) {
  const firstChip = await getChipById(chipIds[0]);
  if (!firstChip) return chipIds;

  const recentJobs = await listUserExecutionJobs(firstChip.userId, 200);
  const threshold = Date.now() - lookbackHours * 60 * 60 * 1000;
  const chipLoad = new Map<number, number>();

  for (const chipId of chipIds) {
    chipLoad.set(chipId, 0);
  }

  for (const job of recentJobs) {
    if (!job.chipId || !chipLoad.has(job.chipId)) continue;
    if (job.executionType !== "dispatch") continue;
    if (new Date(job.createdAt).getTime() < threshold) continue;
    chipLoad.set(job.chipId, (chipLoad.get(job.chipId) ?? 0) + (job.totalMessagesSent ?? 0));
  }

  return [...chipIds].sort((a, b) => (chipLoad.get(a) ?? 0) - (chipLoad.get(b) ?? 0));
}

function extractInsertId(result: any): number | null {
  if (!result) return null;
  if (typeof result.insertId === "number") return result.insertId;
  if (Array.isArray(result) && typeof result[0]?.insertId === "number") return result[0].insertId;
  return null;
}

export async function buildBulkDispatchTargetDistribution(
  chipIds: number[],
  targets: string[],
  maxMessagesPerTarget = 1,
  rotationStrategy: BulkDispatchRotationStrategy = "round_robin",
  rotationLookbackHours = 24
): Promise<BulkDispatchDistributionEntry[]> {
  const chipsPool =
    rotationStrategy === "least_usage" ? await buildLeastUsageOrder(chipIds, rotationLookbackHours) : [...chipIds];
  const distributedTargets = new Map<number, string[]>();

  for (const chipId of chipIds) {
    distributedTargets.set(chipId, []);
  }

  const sourceTargets =
    rotationStrategy === "random" ? [...targets].sort(() => Math.random() - 0.5) : [...targets];

  sourceTargets.forEach((target, index) => {
    const chipId = chipsPool[index % chipsPool.length];
    distributedTargets.get(chipId)?.push(target);
  });

  return chipIds.map((chipId) => {
    const chipTargets = distributedTargets.get(chipId) ?? [];
    return {
      chipId,
      targets: chipTargets,
      targetCount: chipTargets.length,
      plannedMessages: chipTargets.length * maxMessagesPerTarget,
    };
  });
}

/**
 * Envia mensagens em massa para múltiplos números ou grupos
 */
export async function executeBulkDispatch(
  config: BulkDispatchConfig
): Promise<BulkDispatchResult> {
  const startTime = Date.now();
  const dispatchId = `dispatch_${Date.now()}`;
  const chip = await getChipById(config.chipId);
  if (!chip) {
    throw new Error(`Chip ${config.chipId} não encontrado`);
  }

  const maturityDecision = await evaluateChipAction(chip.userId, config.chipId, "send_campaign_message");
  if (!maturityDecision.allowed) {
    const chipHealth = await getChipHealth(config.chipId, chip.userId, chip.phoneNumber);
    const fallbackAllowed =
      config.targetType === "number" &&
      config.targets.length > 0 &&
      config.targets.length <= 20 &&
      chip.status === "conectado" &&
      chipHealth.connected &&
      chipHealth.healthScore >= 60 &&
      !chipHealth.lastSendError &&
      Boolean(chipHealth.phoneNumber) &&
      Boolean(chipHealth.lastReceive);

    if (!fallbackAllowed) {
      throw new Error(maturityDecision.reason);
    }

    console.warn(
      `[BulkDispatch] Fallback operacional aplicado para chip ${config.chipId}: ${maturityDecision.reason}`
    );
  }

  const plannedMessages = config.targets.length * (config.maxMessagesPerTarget || 1);
  const executionJobInsert = await createExecutionJob({
    userId: chip.userId,
    chipId: config.chipId,
    executionType: "dispatch",
    targetType: config.targetType,
    templateId: config.templateId,
    profileName: config.profile,
    totalTargets: config.targets.length,
    plannedMessages,
    payload: JSON.stringify({
      campaignId: config.campaignId,
      campaignName: config.campaignName,
      rotationStrategy: config.rotationStrategy,
      rotationLookbackHours: config.rotationLookbackHours,
      targets: config.targets,
      intervalSeconds: config.intervalSeconds,
      maxMessagesPerTarget: config.maxMessagesPerTarget || 1,
    }),
  });
  const executionJobId = extractInsertId(executionJobInsert);
  const results = [];
  let successCount = 0;
  let failureCount = 0;
  let skippedCount = 0;
  let totalMessagesSent = 0;
  let fatalErrorMessage: string | null = null;
  const templatePool = config.messageTemplate
    ? []
    : await getActiveMessageTemplateContents(chip.userId, "dispatch");

  try {
    for (const target of config.targets) {
      try {
        const operationalSnapshot = await getTargetOperationalSnapshot(chip.userId, config.chipId, target, 60);
        const operationalDecision = evaluateOperationalRules("dispatch", config.profile, config.targetType, operationalSnapshot);
        if (!operationalDecision.allowed) {
          if (executionJobId) {
            const skippedAttemptInsert = await createExecutionAttempt({
              jobId: executionJobId,
              userId: chip.userId,
              chipId: config.chipId,
              targetType: config.targetType,
              targetValue: target,
              actionType: "message",
              attemptOrder: 1,
            });
            const skippedAttemptId = extractInsertId(skippedAttemptInsert);
            if (skippedAttemptId) {
              await updateExecutionAttempt(skippedAttemptId, {
                status: "failed",
                errorMessage: `SKIPPED_RULE:${operationalDecision.reason || "Target pulado por regra operacional"}`,
                executedAt: new Date(),
              });
            }
          }
          results.push({
            target,
            success: false,
            skipped: true,
            error: operationalDecision.reason || "Target pulado por regra operacional",
          });
          skippedCount++;
          continue;
        }

        const messagesPerTarget = config.maxMessagesPerTarget || 1;
        let targetMessageCount = 0;

        for (let i = 0; i < messagesPerTarget; i++) {
          // Simular digitação
          const typingDuration = getTypingDuration(config.profile);
          await new Promise((resolve) => setTimeout(resolve, typingDuration));

          // Gerar mensagem
          const rotationContext = executionJobId
            ? await getMessageRotationContext(chip.userId, config.chipId, "dispatch", target, 24)
            : {
                recentMessages: [],
                recentMessagesForTarget: [],
                recentUsageCounts: {},
              };
          const message =
            config.messageTemplate ||
            (templatePool.length > 0
              ? pickRotatingMessageAdvanced(templatePool, {
                  recentMessages: rotationContext.recentMessages,
                  recentMessagesForTarget: rotationContext.recentMessagesForTarget,
                  usageCounts: rotationContext.recentUsageCounts,
                })
              : getRandomMessage(config.profile, undefined, rotationContext.recentMessages));

          const attemptInsert = executionJobId
            ? await createExecutionAttempt({
                jobId: executionJobId,
                userId: chip.userId,
                chipId: config.chipId,
                targetType: config.targetType,
                targetValue: target,
                actionType: "message",
                attemptOrder: i + 1,
                messageContent: message,
              })
            : null;
          const attemptId = extractInsertId(attemptInsert);

          try {
            // Delay antes de enviar
            const delay = getRandomDelay(config.profile);
            const sendStartedAt = Date.now();
            const sendTraceId = `bulk-send-${config.chipId}-${attemptId ?? i + 1}-${sendStartedAt}`;
            const sessionStateBeforeSend = buildSendSessionState(config.chipId);

            logBulkDispatchProbe({
              scope: "bulk_dispatch_send_probe",
              step: "[SEND] before",
              sendTraceId,
              timestamp: new Date(sendStartedAt).toISOString(),
              chipId: config.chipId,
              target,
              attemptId: attemptId ?? null,
              executionJobId: executionJobId ?? null,
              delay,
              session: sessionStateBeforeSend,
            });

            let sendSettled = false;
            const sendResult = await Promise.race([
              (async () => {
                logBulkDispatchProbe({
                  scope: "bulk_dispatch_send_probe",
                  step: "[SEND] entered_sendMessage",
                  sendTraceId,
                  timestamp: new Date().toISOString(),
                  chipId: config.chipId,
                });

                const result = await sendMessage(config.chipId, target, message, {
                  delay,
                  showTyping: false,
                });

                sendSettled = true;
                logBulkDispatchProbe({
                  scope: "bulk_dispatch_send_probe",
                  step: "[SEND] promise_resolved",
                  sendTraceId,
                  timestamp: new Date().toISOString(),
                  chipId: config.chipId,
                  durationMs: Date.now() - sendStartedAt,
                  resultType: typeof result,
                  resultKeys: result && typeof result === "object" ? Object.keys(result) : [],
                });

                return result;
              })(),
              new Promise<never>((_, reject) => {
                setTimeout(() => {
                  if (!sendSettled) {
                    logBulkDispatchProbe({
                      scope: "bulk_dispatch_send_probe",
                      step: "[SEND] timeout",
                      sendTraceId,
                      timestamp: new Date().toISOString(),
                      chipId: config.chipId,
                      durationMs: Date.now() - sendStartedAt,
                      session: buildSendSessionState(config.chipId),
                    });
                  }

                  reject(new Error("SEND_TIMEOUT"));
                }, 30000);
              }),
            ]);

            logBulkDispatchProbe({
              scope: "bulk_dispatch_send_probe",
              step: "[SEND] success",
              sendTraceId,
              timestamp: new Date().toISOString(),
              chipId: config.chipId,
              durationMs: Date.now() - sendStartedAt,
              session: buildSendSessionState(config.chipId),
            });

            if (attemptId) {
              await updateExecutionAttempt(attemptId, {
                status: "success",
                providerMessageId: sendResult.messageId || null,
                executedAt: new Date(),
              });
            }
          } catch (sendError) {
            logBulkDispatchProbe({
              scope: "bulk_dispatch_send_probe",
              step: "[SEND] failed",
              timestamp: new Date().toISOString(),
              chipId: config.chipId,
              target,
              attemptId: attemptId ?? null,
              executionJobId: executionJobId ?? null,
              errorName: sendError instanceof Error ? sendError.name : typeof sendError,
              errorMessage: sendError instanceof Error ? sendError.message : String(sendError),
              errorStack: sendError instanceof Error ? sendError.stack : null,
              session: buildSendSessionState(config.chipId),
            });

            if (attemptId) {
              await updateExecutionAttempt(attemptId, {
                status: "failed",
                errorMessage: String(sendError),
                executedAt: new Date(),
              });
            }
            throw sendError;
          }

          targetMessageCount++;
          totalMessagesSent++;

          // Aleatoriamente enviar reação
          if (Math.random() < 0.3) {
            const reaction = getRandomReaction(config.profile);
            const reactionAttemptInsert = executionJobId
              ? await createExecutionAttempt({
                  jobId: executionJobId,
                  userId: chip.userId,
                  chipId: config.chipId,
                  targetType: config.targetType,
                  targetValue: target,
                  actionType: "reaction",
                  attemptOrder: i + 1,
                  messageContent: reaction,
                })
              : null;
            const reactionAttemptId = extractInsertId(reactionAttemptInsert);
            await new Promise((resolve) => setTimeout(resolve, getRandomDelay(config.profile)));
            try {
              await sendReaction(config.chipId, target, reaction);
              if (reactionAttemptId) {
                await updateExecutionAttempt(reactionAttemptId, {
                  status: "success",
                  executedAt: new Date(),
                });
              }
            } catch (reactionError) {
              if (reactionAttemptId) {
                await updateExecutionAttempt(reactionAttemptId, {
                  status: "failed",
                  errorMessage: String(reactionError),
                  executedAt: new Date(),
                });
              }
            }
          }

          // Delay entre mensagens do mesmo alvo
          if (i < messagesPerTarget - 1) {
            await new Promise((resolve) =>
              setTimeout(resolve, config.intervalSeconds * 1000)
            );
          }
        }

        results.push({
          target,
          success: true,
          messagesSent: targetMessageCount,
        });
        successCount++;
      } catch (error) {
        console.error(`[Bulk Dispatch] Erro ao enviar para ${target}:`, error);
        await createActivityLog({
          chipId: config.chipId,
          actionType: "error",
          targetNumber: config.targetType === "number" || config.targetType === "list" ? target : undefined,
          targetGroup: config.targetType === "group" ? target : undefined,
          errorMessage: String(error),
          status: "failed",
        });
        results.push({
          target,
          success: false,
          error: String(error),
        });
        failureCount++;
      }

      // Delay entre alvos
      if (config.targets.indexOf(target) < config.targets.length - 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, config.intervalSeconds * 1000)
        );
      }
    }

    const finalStatus =
      failureCount === 0 ? "completed" : successCount > 0 || totalMessagesSent > 0 ? "partial" : "failed";

    if (executionJobId) {
      await updateExecutionJob(executionJobId, {
        status: finalStatus,
        totalMessagesSent,
        successCount,
        failureCount,
        finishedAt: new Date(),
      });
    }

    return {
      success: failureCount === 0,
      dispatchId,
      executionJobId: executionJobId ?? undefined,
      chipId: config.chipId,
      totalTargets: config.targets.length,
      successCount,
      failureCount,
      skippedCount,
      totalMessagesSent,
      duration: Date.now() - startTime,
      results,
    };
  } catch (error) {
    console.error(`[Bulk Dispatch] Erro fatal:`, error);
    fatalErrorMessage = String(error);
    if (executionJobId) {
      await updateExecutionJob(executionJobId, {
        status: "failed",
        totalMessagesSent,
        successCount,
        failureCount,
        errorMessage: fatalErrorMessage,
        finishedAt: new Date(),
      });
    }
    throw error;
  }
}

/**
 * Envia mensagens em lotes para múltiplos chips
 */
export async function executeBulkDispatchMultiChip(
  chipIds: number[],
  targetType: "number" | "group" | "list",
  targets: string[],
  messageTemplate: string,
  profile: MaturationProfile,
  intervalSeconds: number,
  maxMessagesPerTarget: number = 1,
  templateId?: number,
  rotationStrategy: BulkDispatchRotationStrategy = "round_robin",
  rotationLookbackHours = 24,
  campaignMeta?: { campaignId?: string; campaignName?: string }
): Promise<Array<BulkDispatchResult>> {
  const results = [];
  const distribution = await buildBulkDispatchTargetDistribution(
    chipIds,
    targets,
    maxMessagesPerTarget,
    rotationStrategy,
    rotationLookbackHours
  );
  const distributedTargets = new Map(distribution.map((entry) => [entry.chipId, entry.targets]));

  for (const chipId of chipIds) {
    const chipTargets = distributedTargets.get(chipId) ?? [];
    if (chipTargets.length === 0) {
      results.push({
        success: true,
        dispatchId: `dispatch_${Date.now()}`,
        chipId,
        totalTargets: 0,
        successCount: 0,
        failureCount: 0,
        skippedCount: 0,
        totalMessagesSent: 0,
        duration: 0,
        results: [],
      });
      continue;
    }

    try {
      const result = await executeBulkDispatch({
        chipId,
        targetType,
        targets: chipTargets,
        messageTemplate,
        templateId,
        profile,
        intervalSeconds,
        maxMessagesPerTarget,
        campaignId: campaignMeta?.campaignId,
        campaignName: campaignMeta?.campaignName,
        rotationStrategy,
        rotationLookbackHours,
      });

      results.push(result);
    } catch (error) {
      console.error(`[Bulk Dispatch] Erro ao processar chip ${chipId}:`, error);
      results.push({
        success: false,
        dispatchId: `dispatch_${Date.now()}`,
        chipId,
          totalTargets: chipTargets.length,
        successCount: 0,
          failureCount: chipTargets.length,
        skippedCount: 0,
        totalMessagesSent: 0,
        duration: 0,
          results: chipTargets.map((target) => ({
          target,
          success: false,
          error: String(error),
        })),
      });
    }
  }

  return results;
}

/**
 * Simula disparo em massa com validação de limites
 */
export async function validateBulkDispatch(
  targets: string[],
  maxMessagesPerTarget: number,
  chipsSelected: number,
  userMessagesLimit: number,
  currentMessagesCount: number,
  options?: {
    hasConnectedChip?: boolean;
    hasAnyTemplateLibrary?: boolean;
    targetType?: "number" | "group" | "list";
    messageTemplate?: string;
    intervalSeconds?: number;
  }
): Promise<{
  valid: boolean;
  error?: string;
  estimatedMessages: number;
  estimatedDuration: number;
  checks: Array<{ key: string; label: string; passed: boolean; detail: string }>;
  warnings: string[];
}> {
  const estimatedMessages = targets.length * maxMessagesPerTarget * chipsSelected;
  const estimatedDuration = estimatedMessages * 5000; // ~5 segundos por mensagem
  const checks: Array<{ key: string; label: string; passed: boolean; detail: string }> = [];
  const warnings: string[] = [];

  checks.push({
    key: "chips_selected",
    label: "Chips selecionados",
    passed: chipsSelected > 0,
    detail: chipsSelected > 0 ? `${chipsSelected} chip(s) selecionado(s)` : "Nenhum chip selecionado",
  });

  checks.push({
    key: "chip_connected",
    label: "Chips conectados",
    passed: options?.hasConnectedChip !== false,
    detail: options?.hasConnectedChip === false ? "Nenhum chip conectado disponível" : "Há chip conectado para execução",
  });

  checks.push({
    key: "targets",
    label: "Targets válidos",
    passed: targets.length > 0,
    detail: targets.length > 0 ? `${targets.length} target(s) válido(s)` : "Nenhum target válido",
  });

  checks.push({
    key: "message_source",
    label: "Fonte de mensagem",
    passed: Boolean(options?.messageTemplate?.trim()) || options?.hasAnyTemplateLibrary !== false,
    detail:
      Boolean(options?.messageTemplate?.trim()) || options?.hasAnyTemplateLibrary !== false
        ? "Mensagem manual ou biblioteca ativa disponível"
        : "Sem mensagem manual e sem biblioteca ativa",
  });

  checks.push({
    key: "interval",
    label: "Intervalo operacional",
    passed: (options?.intervalSeconds ?? 1) >= 3,
    detail:
      (options?.intervalSeconds ?? 1) >= 3
        ? `Intervalo atual: ${options?.intervalSeconds ?? 0}s`
        : `Intervalo muito baixo: ${options?.intervalSeconds ?? 0}s`,
  });

  if (chipsSelected <= 0) {
    return {
      valid: false,
      error: "Selecione pelo menos um chip para disparo",
      estimatedMessages,
      estimatedDuration,
      checks,
      warnings,
    };
  }

  if (options?.hasConnectedChip === false) {
    return {
      valid: false,
      error: "Nenhum chip conectado disponível para disparo",
      estimatedMessages,
      estimatedDuration,
      checks,
      warnings,
    };
  }

  if (targets.length <= 0) {
    return {
      valid: false,
      error: "Nenhum target válido para disparo",
      estimatedMessages,
      estimatedDuration,
      checks,
      warnings,
    };
  }

  if (!options?.messageTemplate?.trim() && options?.hasAnyTemplateLibrary === false) {
    return {
      valid: false,
      error: "Escreva uma mensagem ou cadastre uma biblioteca ativa antes de executar",
      estimatedMessages,
      estimatedDuration,
      checks,
      warnings,
    };
  }

  if ((options?.intervalSeconds ?? 1) < 3) {
    return {
      valid: false,
      error: "Intervalo entre alvos muito baixo. Use pelo menos 3 segundos.",
      estimatedMessages,
      estimatedDuration,
      checks,
      warnings,
    };
  }

  // Validar limites de mensagens
  if (userMessagesLimit !== -1 && currentMessagesCount + estimatedMessages > userMessagesLimit) {
    return {
      valid: false,
      error: `Limite de mensagens será excedido (${currentMessagesCount + estimatedMessages}/${userMessagesLimit})`,
      estimatedMessages,
      estimatedDuration,
      checks,
      warnings,
    };
  }

  if (options?.targetType === "group" && targets.length > 30) {
    warnings.push("Você está tentando disparar para muitos grupos ao mesmo tempo. Considere dividir em lotes menores.");
  }

  if (maxMessagesPerTarget > 3) {
    warnings.push("Mensagens por target acima de 3 podem aumentar a pressão operacional.");
  }

  return {
    valid: true,
    estimatedMessages,
    estimatedDuration,
    checks,
    warnings,
  };
}
