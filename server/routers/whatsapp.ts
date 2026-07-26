import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router } from "../_core/trpc";
import { adminProcedure as protectedProcedure } from "../_core/rbac";
import { createChip, validateChipsLimit } from "../db";
import {
  initializeChipSession,
  sendMessage,
  sendReaction,
  getChipSession,
  getAllSessions,
  disconnectChip,
  markMessagesAsRead,
} from "../services/whatsappService";

export const whatsappRouter = router({
  createAndConnectChip: protectedProcedure
    .input(
      z.object({
        chipName: z.string().min(1, "Informe um nome para o chip"),
        maturationProfile: z.enum(["suave", "normal", "ultra"]).default("normal"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const limitValidation = await validateChipsLimit(ctx.user.id);
      if (!limitValidation.allowed) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Limite de chips atingido (${limitValidation.current}/${limitValidation.limit})`,
        });
      }

      const chip = await createChip({
        userId: ctx.user.id,
        chipName: input.chipName,
        maturationProfile: input.maturationProfile,
      });

      if (!chip) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Não foi possível criar o chip",
        });
      }

      try {
        await initializeChipSession(chip.id, chip.chipName);
        return {
          success: true,
          chipId: chip.id,
          chipName: chip.chipName,
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Erro ao iniciar conexão do chip: ${String(error)}`,
        });
      }
    }),

  connectChip: protectedProcedure
    .input(
      z.object({
        chipId: z.number(),
        chipName: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const result = await initializeChipSession(input.chipId, input.chipName);
        return result;
      } catch (error) {
        throw new Error(`Erro ao conectar chip: ${String(error)}`);
      }
    }),

  getQRCode: protectedProcedure
    .input(z.object({ chipId: z.number() }))
    .query(({ input }) => {
      const session = getChipSession(input.chipId);
      if (!session) {
        return { qrCode: null, isConnected: false };
      }
      return {
        qrCode: session.qrCode,
        isConnected: session.isConnected,
      };
    }),

  sendMessage: protectedProcedure
    .input(
      z.object({
        chipId: z.number(),
        phoneNumber: z.string(),
        message: z.string(),
        delay: z.number().optional(),
        showTyping: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const requestId = `send-${input.chipId}-${Date.now()}`;
      console.log(
        JSON.stringify({
          scope: "whatsapp_send_trpc",
          step: "[1] Request chegou",
          requestId,
          timestamp: new Date().toISOString(),
        })
      );
      console.log(
        JSON.stringify({
          scope: "whatsapp_send_trpc",
          step: "[2] Payload recebido",
          requestId,
          timestamp: new Date().toISOString(),
          payload: {
            chipId: input.chipId,
            phoneNumber: input.phoneNumber,
            messageLength: input.message?.length ?? 0,
            delay: input.delay ?? null,
            showTyping: input.showTyping ?? null,
          },
        })
      );
      try {
        console.log(
          JSON.stringify({
            scope: "whatsapp_send_trpc",
            step: "[3] sendMessage() chamado",
            requestId,
            timestamp: new Date().toISOString(),
          })
        );
        const result = await sendMessage(
          input.chipId,
          input.phoneNumber,
          input.message,
          {
            delay: input.delay,
            showTyping: input.showTyping,
          }
        );
        console.log(
          JSON.stringify({
            scope: "whatsapp_send_trpc",
            step: "[5] Resposta enviada ao tRPC",
            requestId,
            timestamp: new Date().toISOString(),
            resultType: typeof result,
            resultKeys: result && typeof result === "object" ? Object.keys(result) : [],
          })
        );
        console.log("[5] RAW RESPONSE");
        console.dir(result, { depth: null });
        return result;
      } catch (error) {
        console.log(
          JSON.stringify({
            scope: "whatsapp_send_trpc",
            step: "TRPC_SEND_ERROR",
            requestId,
            timestamp: new Date().toISOString(),
            errorName: error instanceof Error ? error.name : typeof error,
            errorMessage: error instanceof Error ? error.message : String(error),
            errorStack: error instanceof Error ? error.stack : null,
          })
        );
        console.log("RAW ERROR");
        console.dir(error, { depth: null });
        throw new Error(`Erro ao enviar mensagem: ${String(error)}`);
      }
    }),

  sendReaction: protectedProcedure
    .input(
      z.object({
        chipId: z.number(),
        targetNumber: z.string(),
        emoji: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const result = await sendReaction(
          input.chipId,
          input.targetNumber,
          input.emoji
        );
        return result;
      } catch (error) {
        throw new Error(`Erro ao enviar reação: ${String(error)}`);
      }
    }),

  markMessagesAsRead: protectedProcedure
    .input(
      z.object({
        chipId: z.number(),
        keys: z
          .array(
            z.object({
              remoteJid: z.string().min(1),
              id: z.string().min(1),
              fromMe: z.boolean().optional(),
              participant: z.string().optional(),
            })
          )
          .min(1),
      })
    )
    .mutation(async ({ input }) => {
      try {
        return await markMessagesAsRead(input.chipId, input.keys);
      } catch (error) {
        throw new Error(`Erro ao marcar mensagens como lidas: ${String(error)}`);
      }
    }),

  getSessionStatus: protectedProcedure
    .input(z.object({ chipId: z.number() }))
    .query(({ input }) => {
      const session = getChipSession(input.chipId);
      if (!session) {
        return null;
      }
      return {
        chipId: input.chipId,
        isConnected: session.isConnected,
        lastActivity: session.lastActivity,
        hasQR: !!session.qrCode,
      };
    }),

  getAllSessions: protectedProcedure.query(() => {
    return getAllSessions();
  }),

  disconnectChip: protectedProcedure
    .input(z.object({ chipId: z.number() }))
    .mutation(async ({ input }) => {
      try {
        await disconnectChip(input.chipId);
        return { success: true };
      } catch (error) {
        throw new Error(`Erro ao desconectar chip: ${String(error)}`);
      }
    }),
});
