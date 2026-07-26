import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { ChipCoreApiError, createChipCoreApiService, getChipCoreApiService, type ChipCoreApiService } from "../services/chipCoreApiService";

function mapChipCoreApiError(error: unknown): never {
  if (error instanceof ChipCoreApiError) {
    const code =
      error.code === "CONFLICT"
        ? "CONFLICT"
        : error.code === "NOT_FOUND"
          ? "NOT_FOUND"
          : error.code === "FAILED_PRECONDITION"
            ? "PRECONDITION_FAILED"
            : "BAD_REQUEST";

    throw new TRPCError({
      code,
      message: error.message,
    });
  }

  throw error;
}

export function buildChipCoreRouter(service: ChipCoreApiService) {
  return router({
    createChip: protectedProcedure
      .input(
        z.object({
          chipId: z.string().uuid().optional(),
          createdBy: z.string().trim().min(1),
          sprint: z.number().int().min(0),
          occurredAt: z.string().datetime().optional(),
        })
      )
      .mutation(async ({ input }) => {
        try {
          return await service.createChip(input);
        } catch (error) {
          mapChipCoreApiError(error);
        }
      }),

    pairChip: protectedProcedure
      .input(
        z.object({
          chipId: z.string().min(1),
          pairedWith: z.string().trim().min(1),
          deviceId: z.string().trim().min(1).optional(),
          occurredAt: z.string().datetime().optional(),
        })
      )
      .mutation(async ({ input }) => {
        try {
          return await service.pairChip(input);
        } catch (error) {
          mapChipCoreApiError(error);
        }
      }),

    appendEvent: protectedProcedure
      .input(
        z.object({
          chip_id: z.string().min(1),
          event_type: z.string().min(1),
          event_version: z.number().int().min(1).default(1),
          payload: z.record(z.string(), z.unknown()),
          metadata: z.record(z.string(), z.unknown()).optional(),
          eventId: z.string().uuid().optional(),
          occurredAt: z.string().datetime().optional(),
        })
      )
      .mutation(async ({ input }) => {
        try {
          return await service.appendEvent(input);
        } catch (error) {
          mapChipCoreApiError(error);
        }
      }),

    getChipHistory: protectedProcedure
      .input(
        z.object({
          chipId: z.string().min(1),
          fromSequence: z.number().int().min(1).optional(),
          toSequence: z.number().int().min(1).optional(),
          limit: z.number().int().min(1).max(500).optional(),
        })
      )
      .query(async ({ input }) => {
        try {
          return await service.getChipHistory(input);
        } catch (error) {
          mapChipCoreApiError(error);
        }
      }),

    getCurrentState: protectedProcedure
      .input(
        z.object({
          chipId: z.string().min(1),
        })
      )
      .query(async ({ input }) => {
        try {
          return await service.getCurrentState(input);
        } catch (error) {
          mapChipCoreApiError(error);
        }
      }),

    replayHistory: protectedProcedure
      .input(
        z.object({
          chipId: z.string().min(1),
          fromSequence: z.number().int().min(1).optional(),
          toSequence: z.number().int().min(1).optional(),
          limit: z.number().int().min(1).max(500).optional(),
        })
      )
      .query(async ({ input }) => {
        try {
          return await service.replayHistory(input);
        } catch (error) {
          mapChipCoreApiError(error);
        }
      }),

    closeChip: protectedProcedure
      .input(
        z.object({
          chipId: z.string().min(1),
          reason: z.string().trim().min(1),
          closedBy: z.string().trim().min(1),
          finalState: z.string().trim().min(1).optional(),
          occurredAt: z.string().datetime().optional(),
        })
      )
      .mutation(async ({ input }) => {
        try {
          return await service.closeChip(input);
        } catch (error) {
          mapChipCoreApiError(error);
        }
      }),
  });
}

export const chipCoreRouter = buildChipCoreRouter(getChipCoreApiService());
