import {
  createActivityLog,
  createExecutionAttempt,
  createExecutionJob,
  getChipBehaviorScore,
  getMessageRotationContext,
  getChipById,
  getChipCertification,
  getChipPolicyStats,
  getTargetOperationalSnapshot,
  updateChipStatus,
  updateExecutionAttempt,
  updateExecutionJob,
} from "../db";
import { sendReaction } from "./whatsappService";
import { pickRotatingMessage, pickRotatingMessageAdvanced } from "../utils/messageLibrary";
import { evaluateOperationalRules } from "../utils/operationalRules";
import { evaluateChipAction } from "./maturityPolicy";
import { evaluateBehaviorPolicy } from "./behavior/behaviorPolicyEngine";
import { loadBehaviorPolicyConfig } from "./behavior/behaviorPolicyConfig";
import { executeBehaviorAction } from "./behavior/executionService";
import { generateInterActionDelaySeconds } from "./behavior/jitterEngine";
import { logPolicyDecision } from "./behavior/logger";

export type MaturationProfile = "suave" | "normal" | "ultra";

interface MaturationConfig {
  minDelay: number;
  maxDelay: number;
  messageVariations: string[];
  reactionEmojis: string[];
  typingDuration: number;
  audioSimulationChance: number;
  imageSimulationChance: number;
  reactionChance: number;
}

const profileConfigs: Record<MaturationProfile, MaturationConfig> = {
  suave: {
    minDelay: 30000, // 30 segundos
    maxDelay: 120000, // 2 minutos
    messageVariations: [
      "Opa, tudo bem?",
      "E aí, como vai?",
      "Oi, tudo certo?",
      "Opa, blz?",
      "Tudo tranquilo?",
      "E aí, beleza?",
      "Opa, e aí?",
      "Tudo bem sim!",
      "Tudo certo por aqui",
      "Tudo tranquilo por aqui",
      "Que legal!",
      "Verdade mesmo",
      "Concordo total",
      "Exatamente!",
      "Que show!",
      "Haha, verdade!",
      "Muito bom!",
      "Adorei!",
      "Perfeito!",
      "Demais!",
    ],
    reactionEmojis: ["👍", "❤️", "😂", "😮", "😢", "🔥", "👏"],
    typingDuration: 2000,
    audioSimulationChance: 0.05, // 5%
    imageSimulationChance: 0.03, // 3%
    reactionChance: 0.2, // 20%
  },
  normal: {
    minDelay: 10000, // 10 segundos
    maxDelay: 60000, // 1 minuto
    messageVariations: [
      "Opa, tudo bem?",
      "E aí, como vai?",
      "Oi, tudo certo?",
      "Opa, blz?",
      "Tudo tranquilo?",
      "E aí, beleza?",
      "Opa, e aí?",
      "Tudo bem sim!",
      "Tudo certo por aqui",
      "Tudo tranquilo por aqui",
      "Que legal!",
      "Verdade mesmo",
      "Concordo total",
      "Exatamente!",
      "Que show!",
      "Haha, verdade!",
      "Muito bom!",
      "Adorei!",
      "Perfeito!",
      "Demais!",
      "Sensacional!",
      "Incrível!",
      "Fantástico!",
      "Magnífico!",
      "Espetacular!",
      "Ótimo!",
      "Maravilhoso!",
      "Bacana!",
      "Maneiro!",
      "Interessante!",
    ],
    reactionEmojis: ["👍", "❤️", "😂", "😮", "😢", "🔥", "👏", "🎉", "💯"],
    typingDuration: 1500,
    audioSimulationChance: 0.1, // 10%
    imageSimulationChance: 0.08, // 8%
    reactionChance: 0.35, // 35%
  },
  ultra: {
    minDelay: 2000, // 2 segundos
    maxDelay: 30000, // 30 segundos
    messageVariations: [
      "Opa, tudo bem?",
      "E aí, como vai?",
      "Oi, tudo certo?",
      "Opa, blz?",
      "Tudo tranquilo?",
      "E aí, beleza?",
      "Opa, e aí?",
      "Tudo bem sim!",
      "Tudo certo por aqui",
      "Tudo tranquilo por aqui",
      "Que legal!",
      "Verdade mesmo",
      "Concordo total",
      "Exatamente!",
      "Que show!",
      "Haha, verdade!",
      "Muito bom!",
      "Adorei!",
      "Perfeito!",
      "Demais!",
      "Sensacional!",
      "Incrível!",
      "Fantástico!",
      "Magnífico!",
      "Espetacular!",
      "Ótimo!",
      "Maravilhoso!",
      "Bacana!",
      "Maneiro!",
      "Interessante!",
      "Muito legal!",
      "Que top!",
      "Sensacional demais!",
      "Melhor impossível!",
      "Que coisa boa!",
      "Tá muito bom!",
      "Que bomba!",
      "Tá ligado!",
      "Tranquilão!",
      "Blz demais!",
    ],
    reactionEmojis: ["👍", "❤️", "😂", "😮", "😢", "🔥", "👏", "🎉", "💯", "🚀", "⭐", "✨"],
    typingDuration: 800,
    audioSimulationChance: 0.2, // 20%
    imageSimulationChance: 0.15, // 15%
    reactionChance: 0.5, // 50%
  },
};

export function getRandomDelay(profile: MaturationProfile): number {
  const config = profileConfigs[profile];
  return Math.random() * (config.maxDelay - config.minDelay) + config.minDelay;
}

export function getRandomMessage(
  profile: MaturationProfile,
  customMessages?: string[],
  recentMessages: string[] = []
): string {
  const config = profileConfigs[profile];
  const source = customMessages && customMessages.length > 0 ? customMessages : config.messageVariations;
  return pickRotatingMessage(source, recentMessages);
}

export function getRandomReaction(profile: MaturationProfile): string {
  const config = profileConfigs[profile];
  return config.reactionEmojis[
    Math.floor(Math.random() * config.reactionEmojis.length)
  ];
}

export function getTypingDuration(profile: MaturationProfile): number {
  return profileConfigs[profile].typingDuration;
}

export function getProfileConfig(profile: MaturationProfile): MaturationConfig {
  return profileConfigs[profile];
}

function extractInsertId(result: any): number | null {
  if (!result) return null;
  if (typeof result.insertId === "number") return result.insertId;
  if (Array.isArray(result) && typeof result[0]?.insertId === "number") return result[0].insertId;
  return null;
}

function inferMaturationTargetType(targetValue: string): "number" | "group" {
  return targetValue.includes("@g.us") ? "group" : "number";
}

function getChipAgeDays(createdAt: Date | string | null | undefined) {
  if (!createdAt) return 0;
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - created.getTime()) / (24 * 60 * 60 * 1000)));
}

async function evaluateMaturationExecutionPolicy(params: {
  userId: number;
  chipId: number;
  chipCreatedAt: Date | string | null | undefined;
  targetCooldownUntil?: Date | null;
}) {
  const [policyStats, behaviorScore, certification] = await Promise.all([
    getChipPolicyStats(params.userId, params.chipId),
    getChipBehaviorScore(params.userId, params.chipId),
    getChipCertification(params.userId, params.chipId),
  ]);

  const trustScore = behaviorScore?.humanScore ?? 0;
  const riskScore = Math.max(behaviorScore?.riskScore ?? 0, certification?.usable === 0 ? 85 : 0);

  return evaluateBehaviorPolicy({
    chipId: params.chipId,
    action: "message_sent",
    chipAgeDays: getChipAgeDays(params.chipCreatedAt),
    trustScore,
    riskScore,
    stats: policyStats,
    cooldownUntil: params.targetCooldownUntil ?? null,
  });
}

export async function simulateTyping(
  chipId: number,
  profile: MaturationProfile,
  targetNumber: string
): Promise<void> {
  const typingDuration = getTypingDuration(profile);
  await new Promise((resolve) => setTimeout(resolve, typingDuration));
}

export async function simulateAudioRecording(
  chipId: number,
  profile: MaturationProfile,
  targetNumber: string
): Promise<void> {
  const config = profileConfigs[profile];
  const recordingDuration = Math.random() * 3000 + 2000; // 2-5 segundos
  await new Promise((resolve) => setTimeout(resolve, recordingDuration));

  await createActivityLog({
    chipId,
    actionType: "audio_sent",
    targetNumber,
    messageContent: `[áudio: ${Math.round(recordingDuration / 1000)}s]`,
    status: "success",
  });
}

export async function simulateImageSend(
  chipId: number,
  profile: MaturationProfile,
  targetNumber: string
): Promise<void> {
  const imageDescriptions = [
    "[Foto de paisagem]",
    "[Selfie]",
    "[Print de tela]",
    "[Meme]",
    "[Foto de comida]",
    "[Foto de animal]",
    "[Foto de viagem]",
    "[Foto de evento]",
  ];

  const description = imageDescriptions[
    Math.floor(Math.random() * imageDescriptions.length)
  ];

  await createActivityLog({
    chipId,
    actionType: "image_sent",
    targetNumber,
    messageContent: description,
    status: "success",
  });
}

export async function simulateMaturation(
  chipId: number,
  profile: MaturationProfile,
  targetNumbers: string[],
  customMessages?: string[],
  existingJobId?: number
) {
  try {
    const chip = await getChipById(chipId);
    if (!chip) {
      throw new Error(`Chip ${chipId} não encontrado`);
    }

    const config = profileConfigs[profile];
    const targetEvaluations = await Promise.all(
      targetNumbers.map(async (targetNumber) => {
        const snapshot = await getTargetOperationalSnapshot(chip.userId, chipId, targetNumber, 60);
        const targetType = inferMaturationTargetType(targetNumber) === "group" ? "group" : "number";
        return {
          targetNumber,
          snapshot,
          decision: evaluateOperationalRules("maturation", profile, targetType, snapshot),
        };
      })
    );
    const eligibleTargets = targetEvaluations
      .filter((item) => item.decision.allowed)
      .sort((a, b) => {
        const aTime = a.snapshot.lastSentAt ? new Date(a.snapshot.lastSentAt).getTime() : 0;
        const bTime = b.snapshot.lastSentAt ? new Date(b.snapshot.lastSentAt).getTime() : 0;
        return aTime - bTime;
      });
    if (eligibleTargets.length === 0) {
      if (existingJobId) {
        const primaryTarget = targetEvaluations[0]?.targetNumber ?? "target_indisponivel";
        const skippedAttemptInsert = await createExecutionAttempt({
          jobId: existingJobId,
          userId: chip.userId,
          chipId,
          targetType: inferMaturationTargetType(primaryTarget),
          targetValue: primaryTarget,
          actionType: "message",
          attemptOrder: 1,
        });
        const skippedAttemptId = extractInsertId(skippedAttemptInsert);
        if (skippedAttemptId) {
          await updateExecutionAttempt(skippedAttemptId, {
            status: "failed",
            errorMessage: `SKIPPED_RULE:${targetEvaluations[0]?.decision.reason || "Todos os targets estão em cooldown ou limite operacional."}`,
            executedAt: new Date(),
          });
        }
      }
      return {
        success: false,
        skipped: true,
        error: targetEvaluations[0]?.decision.reason || "Todos os targets estão em cooldown ou limite operacional.",
      };
    }

    const prioritizedTargets = eligibleTargets.slice(0, Math.min(3, eligibleTargets.length));
    const selectedTarget = prioritizedTargets[Math.floor(Math.random() * prioritizedTargets.length)];
    const targetNumber = selectedTarget.targetNumber;
    const targetType = inferMaturationTargetType(targetNumber);
    const maturityDecision = await evaluateChipAction(chip.userId, chipId, "send_behavior_message");
    if (!maturityDecision.allowed) {
      if (existingJobId) {
        const blockedAttemptInsert = await createExecutionAttempt({
          jobId: existingJobId,
          userId: chip.userId,
          chipId,
          targetType,
          targetValue: targetNumber,
          actionType: "message",
          attemptOrder: 1,
        });
        const blockedAttemptId = extractInsertId(blockedAttemptInsert);
        if (blockedAttemptId) {
          await updateExecutionAttempt(blockedAttemptId, {
            status: "failed",
            errorMessage: `BLOCKED_MATURITY:${maturityDecision.reason}`,
            executedAt: new Date(),
          });
        }
      }

      return {
        success: false,
        skipped: true,
        error: maturityDecision.reason,
      };
    }

    const executionPolicy = await evaluateMaturationExecutionPolicy({
      userId: chip.userId,
      chipId,
      chipCreatedAt: chip.createdAt,
      targetCooldownUntil: null,
    });

    await logPolicyDecision(executionPolicy, {
      userId: chip.userId,
      chipId,
      requestedAction: "message_sent",
    });

    if (!executionPolicy.allowed) {
      if (existingJobId) {
        const blockedAttemptInsert = await createExecutionAttempt({
          jobId: existingJobId,
          userId: chip.userId,
          chipId,
          targetType,
          targetValue: targetNumber,
          actionType: "message",
          attemptOrder: 1,
        });
        const blockedAttemptId = extractInsertId(blockedAttemptInsert);
        if (blockedAttemptId) {
          await updateExecutionAttempt(blockedAttemptId, {
            status: "failed",
            errorMessage: `BLOCKED_POLICY:${executionPolicy.reason}`,
            executedAt: new Date(),
          });
        }
      }

      return {
        success: false,
        skipped: true,
        error: executionPolicy.reason,
      };
    }

    // Simular digitação
    await simulateTyping(chipId, profile, targetNumber);

    // Gerar e enviar mensagem
    const rotationContext = existingJobId
      ? await getMessageRotationContext(chip.userId, chipId, "maturation", targetNumber, 28)
      : {
          recentMessages: [],
          recentMessagesForTarget: [],
          recentUsageCounts: {},
        };
    const message =
      customMessages && customMessages.length > 0
        ? pickRotatingMessageAdvanced(customMessages, {
            recentMessages: rotationContext.recentMessages,
            recentMessagesForTarget: rotationContext.recentMessagesForTarget,
            usageCounts: rotationContext.recentUsageCounts,
          })
        : getRandomMessage(profile, undefined, rotationContext.recentMessages);
    const delay = Math.max(getRandomDelay(profile), executionPolicy.delayMs);
    const messageAttemptInsert = existingJobId
      ? await createExecutionAttempt({
          jobId: existingJobId,
          userId: chip.userId,
          chipId,
          targetType,
          targetValue: targetNumber,
          actionType: "message",
          attemptOrder: 1,
          messageContent: message,
        })
      : null;
    const messageAttemptId = extractInsertId(messageAttemptInsert);

    try {
      const sendResult = await executeBehaviorAction({
        userId: chip.userId,
        chipId,
        targetType,
        targetValue: targetNumber,
        requestedAction: "message_sent",
        message,
        policyDecision: executionPolicy,
      });

      if (messageAttemptId) {
        await updateExecutionAttempt(messageAttemptId, {
          status: "success",
          providerMessageId: sendResult.messageId || null,
          executedAt: new Date(),
        });
      }
    } catch (messageError) {
      if (messageAttemptId) {
        await updateExecutionAttempt(messageAttemptId, {
          status: "failed",
          errorMessage: String(messageError),
          executedAt: new Date(),
        });
      }
      throw messageError;
    }

    // Aleatoriamente enviar uma reação
    let reactionSent = false;
    if (Math.random() < config.reactionChance) {
      const reaction = getRandomReaction(profile);
      await new Promise((resolve) => setTimeout(resolve, getRandomDelay(profile)));
      const reactionAttemptInsert = existingJobId
        ? await createExecutionAttempt({
            jobId: existingJobId,
            userId: chip.userId,
            chipId,
            targetType,
            targetValue: targetNumber,
            actionType: "reaction",
            attemptOrder: 1,
            messageContent: reaction,
          })
        : null;
      const reactionAttemptId = extractInsertId(reactionAttemptInsert);

      try {
        await sendReaction(chipId, targetNumber, reaction);
        reactionSent = true;
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

    return {
      success: true,
      message,
      targetNumber,
      delay,
      reactionSent,
    };
  } catch (error) {
    console.error(`[Maturation Engine] Erro ao executar maturação real:`, error);
    await createActivityLog({
      chipId,
      actionType: "error",
      messageContent: "Falha na execução da maturação real",
      errorMessage: String(error),
      status: "failed",
    });
    throw error;
  }
}

export async function startMaturationCycle(
  chipId: number,
  profile: MaturationProfile,
  targetNumbers: string[],
  messagesPerCycle: number = 2,
  customMessages?: string[]
) {
  let executionJobId: number | null = null;
  try {
    const chip = await getChipById(chipId);
    if (!chip) {
      throw new Error(`Chip ${chipId} não encontrado`);
    }

    const executionJobInsert = await createExecutionJob({
      userId: chip.userId,
      chipId,
      executionType: "maturation",
      targetType: targetNumbers.some((target) => inferMaturationTargetType(target) === "group") ? "group" : "number",
      profileName: profile,
      totalTargets: targetNumbers.length,
      plannedMessages: messagesPerCycle,
      payload: JSON.stringify({
        targetNumbers,
        customMessagesCount: customMessages?.length || 0,
        mode: "cycle",
      }),
    });
    executionJobId = extractInsertId(executionJobInsert);
    const results = [];
    let successCount = 0;
    let failureCount = 0;
    let skippedCount = 0;
    let totalMessagesSent = 0;
    let lastErrorMessage: string | null = null;

    for (let i = 0; i < messagesPerCycle; i++) {
      try {
        const result = await simulateMaturation(chipId, profile, targetNumbers, customMessages, executionJobId ?? undefined);
        if ((result as any).skipped) {
          results.push(result);
          skippedCount++;
          continue;
        }
        results.push(result);
        successCount++;
        totalMessagesSent++;
      } catch (error) {
        lastErrorMessage = String(error);
        results.push({
          success: false,
          error: lastErrorMessage,
        });
        failureCount++;
      }

      // Delay entre mensagens
      if (i < messagesPerCycle - 1) {
        const nextDelay = generateInterActionDelaySeconds(loadBehaviorPolicyConfig()) * 1000;
        await new Promise((resolve) => setTimeout(resolve, nextDelay));
      }
    }

    if (successCount > 0) {
      await updateChipStatus(chipId, "maturando");
    }

    if (executionJobId) {
      await updateExecutionJob(executionJobId, {
        status:
          failureCount === 0 ? "completed" : successCount > 0 || totalMessagesSent > 0 ? "partial" : "failed",
        totalMessagesSent,
        successCount,
        failureCount,
        errorMessage: lastErrorMessage,
        finishedAt: new Date(),
      });
    }

    return {
      success: failureCount === 0,
      cycleId: `cycle_${Date.now()}`,
      executionJobId: executionJobId ?? undefined,
      messagesCount: totalMessagesSent,
      successCount,
      failureCount,
      skippedCount,
      results,
    };
  } catch (error) {
    if (executionJobId) {
      await updateExecutionJob(executionJobId, {
        status: "failed",
        errorMessage: String(error),
        finishedAt: new Date(),
      });
    }
    console.error(`[Maturation Engine] Erro ao iniciar ciclo:`, error);
    throw error;
  }
}

export async function startContinuousMaturation(
  chipId: number,
  profile: MaturationProfile,
  targetNumbers: string[],
  durationMinutes: number = 60,
  customMessages?: string[]
) {
  const startTime = Date.now();
  const durationMs = durationMinutes * 60 * 1000;
  const results = [];
  let messageCount = 0;
  let failureCount = 0;
  let successCount = 0;
  let skippedCount = 0;
  let executionJobId: number | null = null;
  let lastErrorMessage: string | null = null;

  try {
    const chip = await getChipById(chipId);
    if (!chip) {
      throw new Error(`Chip ${chipId} não encontrado`);
    }

    const estimatedMessages = Math.max(1, Math.floor(durationMs / Math.max(getProfileConfig(profile).minDelay, 1000)));
    const executionJobInsert = await createExecutionJob({
      userId: chip.userId,
      chipId,
      executionType: "maturation",
      targetType: targetNumbers.some((target) => inferMaturationTargetType(target) === "group") ? "group" : "number",
      profileName: profile,
      totalTargets: targetNumbers.length,
      plannedMessages: estimatedMessages,
      payload: JSON.stringify({
        targetNumbers,
        customMessagesCount: customMessages?.length || 0,
        mode: "continuous",
        durationMinutes,
      }),
    });
    executionJobId = extractInsertId(executionJobInsert);

    while (Date.now() - startTime < durationMs) {
      try {
        const result = await simulateMaturation(chipId, profile, targetNumbers, customMessages, executionJobId ?? undefined);
        if ((result as any).skipped) {
          results.push(result);
          skippedCount++;
          const delay = getRandomDelay(profile);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        results.push(result);
        messageCount++;
        successCount++;
      } catch (error) {
        lastErrorMessage = String(error);
        results.push({
          success: false,
          error: lastErrorMessage,
        });
        failureCount++;
      }

      // Delay entre ciclos
      const delay = Math.max(getRandomDelay(profile), 30_000);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    if (executionJobId) {
      await updateExecutionJob(executionJobId, {
        status:
          failureCount === 0 ? "completed" : successCount > 0 || messageCount > 0 ? "partial" : "failed",
        totalMessagesSent: messageCount,
        successCount,
        failureCount,
        errorMessage: lastErrorMessage,
        finishedAt: new Date(),
      });
    }

    return {
      success: failureCount === 0,
      sessionId: `session_${Date.now()}`,
      executionJobId: executionJobId ?? undefined,
      durationMinutes,
      messagesCount: messageCount,
      successCount,
      failureCount,
      skippedCount,
      results,
    };
  } catch (error) {
    if (executionJobId) {
      await updateExecutionJob(executionJobId, {
        status: "failed",
        totalMessagesSent: messageCount,
        successCount,
        failureCount,
        errorMessage: String(error),
        finishedAt: new Date(),
      });
    }
    console.error(`[Maturation Engine] Erro na maturação contínua:`, error);
    throw error;
  }
}
