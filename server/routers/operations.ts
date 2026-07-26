import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router } from "../_core/trpc";
import { adminProcedure as protectedProcedure } from "../_core/rbac";
import {
  createMaturationTarget,
  createMessageTemplate,
  deleteMaturationTarget,
  deleteMessageTemplate,
  getChipById,
  getUserChips,
  getMaturationTargetById,
  getMessageTemplateById,
  getUserMaturationTargets,
  getUserMessageTemplates,
  updateMaturationTarget,
  updateMessageTemplate,
} from "../db";
import { normalizeTargetValue } from "../utils/targets";
import { joinGroupByInvite, listChipGroups, previewGroupInvite } from "../services/whatsappService";
import { splitMessageLibraryInput } from "../utils/messageLibrary";
import { getOperationalRulesConfig, updateOperationalRulesConfig } from "../utils/operationalRules";

const templateCategorySchema = z.enum(["dispatch", "maturation", "general"]);
const targetTypeSchema = z.enum(["number", "group", "chip"]);
const operationalRuleLeafSchema = z.object({
  cooldownMinutes: z.number().int().min(1).max(1440),
  maxPerHour: z.number().int().min(1).max(200),
  maxPerDay: z.number().int().min(1).max(1000),
});
const operationalRulesSchema = z.object({
  dispatch: z.object({
    suave: z.object({ number: operationalRuleLeafSchema, group: operationalRuleLeafSchema }),
    normal: z.object({ number: operationalRuleLeafSchema, group: operationalRuleLeafSchema }),
    ultra: z.object({ number: operationalRuleLeafSchema, group: operationalRuleLeafSchema }),
  }),
  maturation: z.object({
    suave: z.object({ number: operationalRuleLeafSchema, group: operationalRuleLeafSchema }),
    normal: z.object({ number: operationalRuleLeafSchema, group: operationalRuleLeafSchema }),
    ultra: z.object({ number: operationalRuleLeafSchema, group: operationalRuleLeafSchema }),
  }),
});

export const operationsRouter = router({
  listTemplates: protectedProcedure
    .input(z.object({ category: templateCategorySchema.optional() }).optional())
    .query(async ({ ctx, input }) => {
      return await getUserMessageTemplates(ctx.user.id, input?.category);
    }),

  getOperationalRules: protectedProcedure.query(() => {
    return getOperationalRulesConfig();
  }),

  updateOperationalRules: protectedProcedure
    .input(operationalRulesSchema)
    .mutation(({ input }) => {
      return updateOperationalRulesConfig(input);
    }),

  createTemplate: protectedProcedure
    .input(
      z.object({
        templateName: z.string().trim().min(2).max(150),
        category: templateCategorySchema.default("general"),
        content: z.string().trim().min(2).max(5000),
        isActive: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await createMessageTemplate({
        userId: ctx.user.id,
        templateName: input.templateName,
        category: input.category,
        content: input.content,
        isActive: input.isActive ? 1 : 0,
      });

      return { success: true };
    }),

  bulkCreateTemplates: protectedProcedure
    .input(
      z.object({
        templateNamePrefix: z.string().trim().min(2).max(120),
        category: templateCategorySchema.default("general"),
        content: z.string().trim().min(2).max(40000),
        isActive: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const messages = splitMessageLibraryInput(input.content);
      if (messages.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Nenhuma mensagem válida encontrada para importar" });
      }

      for (let index = 0; index < messages.length; index++) {
        await createMessageTemplate({
          userId: ctx.user.id,
          templateName: `${input.templateNamePrefix} ${String(index + 1).padStart(2, "0")}`,
          category: input.category,
          content: messages[index],
          isActive: input.isActive ? 1 : 0,
        });
      }

      return {
        success: true,
        createdCount: messages.length,
      };
    }),

  updateTemplate: protectedProcedure
    .input(
      z.object({
        templateId: z.number(),
        templateName: z.string().trim().min(2).max(150).optional(),
        category: templateCategorySchema.optional(),
        content: z.string().trim().min(2).max(5000).optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const template = await getMessageTemplateById(input.templateId);
      if (!template || template.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Template não encontrado" });
      }

      await updateMessageTemplate(input.templateId, {
        templateName: input.templateName,
        category: input.category,
        content: input.content,
        isActive: input.isActive === undefined ? undefined : input.isActive ? 1 : 0,
      });

      return { success: true };
    }),

  deleteTemplate: protectedProcedure
    .input(z.object({ templateId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const template = await getMessageTemplateById(input.templateId);
      if (!template || template.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Template não encontrado" });
      }

      await deleteMessageTemplate(input.templateId);
      return { success: true };
    }),

  listTargets: protectedProcedure
    .input(z.object({ targetType: targetTypeSchema.optional() }).optional())
    .query(async ({ ctx, input }) => {
      return await getUserMaturationTargets(ctx.user.id, input?.targetType);
    }),

  listGroupCatalog: protectedProcedure
    .input(z.object({ chipId: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const chips = input?.chipId
        ? (await getChipById(input.chipId))?.userId === ctx.user.id
          ? [await getChipById(input.chipId)].filter(Boolean)
          : []
        : await getUserChips(ctx.user.id);

      if (!chips || chips.length === 0) {
        return { groups: [], unavailableChips: [] };
      }

      const groupTargets = await getUserMaturationTargets(ctx.user.id, "group");
      const targetByValue = new Map(groupTargets.map((target) => [target.targetValue, target]));
      const groups: Array<{
        id: string;
        subject: string;
        size: number;
        announce: boolean;
        chipId: number;
        chipName: string;
        importedAsTarget: boolean;
        targetId: number | null;
        targetName: string | null;
      }> = [];
      const unavailableChips: Array<{ chipId: number; chipName: string; reason: string }> = [];

      for (const chip of chips) {
        if (!chip) continue;
        try {
          const chipGroups = await listChipGroups(chip.id);
          for (const group of chipGroups) {
            const normalizedGroupId = normalizeTargetValue(group.id, "group").normalizedValue;
            const existingTarget = targetByValue.get(normalizedGroupId);
            groups.push({
              ...group,
              chipId: chip.id,
              chipName: chip.chipName,
              importedAsTarget: Boolean(existingTarget),
              targetId: existingTarget?.id ?? null,
              targetName: existingTarget?.targetName ?? null,
            });
          }
        } catch (error) {
          unavailableChips.push({
            chipId: chip.id,
            chipName: chip.chipName,
            reason: error instanceof Error ? error.message : "Chip indisponível para leitura de grupos",
          });
        }
      }

      return {
        groups: groups.sort((a, b) => a.subject.localeCompare(b.subject, "pt-BR")),
        unavailableChips,
      };
    }),

  listChipGroups: protectedProcedure
    .input(z.object({ chipId: z.number() }))
    .query(async ({ ctx, input }) => {
      const chip = await getChipById(input.chipId);
      if (!chip || chip.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Chip não encontrado" });
      }

      try {
        return await listChipGroups(input.chipId);
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error instanceof Error ? error.message : "Falha ao listar grupos do chip",
        });
      }
    }),

  previewGroupInvite: protectedProcedure
    .input(
      z.object({
        chipId: z.number(),
        inviteLinkOrCode: z.string().trim().min(6).max(500),
      })
    )
    .query(async ({ ctx, input }) => {
      const chip = await getChipById(input.chipId);
      if (!chip || chip.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Chip não encontrado" });
      }

      try {
        return await previewGroupInvite(input.chipId, input.inviteLinkOrCode);
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error instanceof Error ? error.message : "Falha ao ler convite do grupo",
        });
      }
    }),

  importChipGroups: protectedProcedure
    .input(
      z.object({
        chipId: z.number(),
        groupIds: z.array(z.string().trim().min(1)).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const chip = await getChipById(input.chipId);
      if (!chip || chip.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Chip não encontrado" });
      }

      let chipGroups: Array<{ id: string; subject: string }>;
      try {
        chipGroups = await listChipGroups(input.chipId);
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error instanceof Error ? error.message : "Falha ao listar grupos do chip",
        });
      }

      const selectedIds = new Set(input.groupIds);
      const selectedGroups = chipGroups.filter((group) => selectedIds.has(group.id));
      if (selectedGroups.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Nenhum grupo válido selecionado" });
      }

      const existingTargets = await getUserMaturationTargets(ctx.user.id, "group");
      const existingValues = new Set(existingTargets.map((target) => target.targetValue));

      let importedCount = 0;
      for (const group of selectedGroups) {
        const normalizedGroupId = normalizeTargetValue(group.id, "group").normalizedValue;
        if (existingValues.has(normalizedGroupId)) {
          continue;
        }

        await createMaturationTarget({
          userId: ctx.user.id,
          targetName: group.subject,
          targetType: "group",
          targetValue: normalizedGroupId,
          notes: `Importado do chip ${chip.chipName}`,
          isActive: 1,
        });
        existingValues.add(normalizedGroupId);
        importedCount++;
      }

      return {
        success: true,
        importedCount,
        skippedCount: selectedGroups.length - importedCount,
      };
    }),

  joinGroupByInvite: protectedProcedure
    .input(
      z.object({
        chipId: z.number(),
        inviteLinkOrCode: z.string().trim().min(6).max(500),
        importAsTarget: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const chip = await getChipById(input.chipId);
      if (!chip || chip.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Chip não encontrado" });
      }

      let joinedGroup: { id: string; subject: string; size: number };
      try {
        joinedGroup = await joinGroupByInvite(input.chipId, input.inviteLinkOrCode);
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error instanceof Error ? error.message : "Falha ao entrar no grupo",
        });
      }

      let imported = false;
      if (input.importAsTarget) {
        const normalizedGroupId = normalizeTargetValue(joinedGroup.id, "group").normalizedValue;
        const existingTargets = await getUserMaturationTargets(ctx.user.id, "group");
        const exists = existingTargets.some((target) => target.targetValue === normalizedGroupId);
        if (!exists) {
          await createMaturationTarget({
            userId: ctx.user.id,
            targetName: joinedGroup.subject,
            targetType: "group",
            targetValue: normalizedGroupId,
            notes: `Entrou via convite com o chip ${chip.chipName}`,
            isActive: 1,
          });
          imported = true;
        }
      }

      return {
        success: true,
        imported,
        group: joinedGroup,
      };
    }),

  createTarget: protectedProcedure
    .input(
      z.object({
        targetName: z.string().trim().min(2).max(150),
        targetType: targetTypeSchema,
        targetValue: z.string().trim().min(1).max(255),
        notes: z.string().trim().max(1000).optional(),
        isActive: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      let normalizedTargetValue = input.targetValue.trim();

      if (input.targetType === "chip") {
        const chip = await getChipById(Number(normalizedTargetValue));
        if (!chip || chip.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Chip alvo inválido" });
        }
      } else {
        try {
          normalizedTargetValue = normalizeTargetValue(input.targetValue, input.targetType).normalizedValue;
        } catch (error) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: error instanceof Error ? error.message : "Target inválido",
          });
        }
      }

      await createMaturationTarget({
        userId: ctx.user.id,
        targetName: input.targetName,
        targetType: input.targetType,
        targetValue: normalizedTargetValue,
        notes: input.notes,
        isActive: input.isActive ? 1 : 0,
      });

      return { success: true };
    }),

  updateTarget: protectedProcedure
    .input(
      z.object({
        targetId: z.number(),
        targetName: z.string().trim().min(2).max(150).optional(),
        targetType: targetTypeSchema.optional(),
        targetValue: z.string().trim().min(1).max(255).optional(),
        notes: z.string().trim().max(1000).optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const target = await getMaturationTargetById(input.targetId);
      if (!target || target.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Target não encontrado" });
      }

      const nextType = input.targetType ?? target.targetType;
      let nextValue = (input.targetValue ?? target.targetValue).trim();

      if (nextType === "chip") {
        const chip = await getChipById(Number(nextValue));
        if (!chip || chip.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Chip alvo inválido" });
        }
      } else {
        try {
          nextValue = normalizeTargetValue(nextValue, nextType).normalizedValue;
        } catch (error) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: error instanceof Error ? error.message : "Target inválido",
          });
        }
      }

      await updateMaturationTarget(input.targetId, {
        targetName: input.targetName,
        targetType: input.targetType,
        targetValue: input.targetValue === undefined ? undefined : nextValue,
        notes: input.notes,
        isActive: input.isActive === undefined ? undefined : input.isActive ? 1 : 0,
      });

      return { success: true };
    }),

  deleteTarget: protectedProcedure
    .input(z.object({ targetId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const target = await getMaturationTargetById(input.targetId);
      if (!target || target.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Target não encontrado" });
      }

      await deleteMaturationTarget(input.targetId);
      return { success: true };
    }),
});
