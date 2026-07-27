import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { ENV } from "./_core/env";
import { sdk } from "./_core/sdk";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { chipsRouter, maturationRouter, schedulingRouter } from "./routers/chips";
import { chipCoreRouter } from "./routers/chipCore";
import { whatsappRouter } from "./routers/whatsapp";
import { adminRouter } from "./routers/admin";
import { operationsRouter } from "./routers/operations";
import { runtimeRouter } from "./routers/runtime";
import { controlCenterRouter } from "./routers/controlCenter";
import { ensureUserSubscriptionPlan, getUserByOpenId, getUserChips, getUserPlan, getUserSubscription, listUserExecutionJobs, updateOwnUserProfile, upsertUser } from "./db";
import { z } from "zod";

export const appRouter = router({
  system: systemRouter,
  admin: adminRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    localStatus: publicProcedure.query(() => ({
      enabled: ENV.localAuthEnabled,
      name: ENV.localAuthName,
      debug: {
        LOCAL_AUTH_ENABLED: process.env.LOCAL_AUTH_ENABLED,
        LOCAL_AUTH_NAME: process.env.LOCAL_AUTH_NAME,
        LOCAL_AUTH_OPEN_ID: process.env.LOCAL_AUTH_OPEN_ID,
        NODE_ENV: process.env.NODE_ENV,
      },
    })),
    localLogin: publicProcedure
      .input(
        z.object({
          name: z.string().trim().min(2).max(120).optional(),
        }).optional()
      )
      .mutation(async ({ ctx, input }) => {
        if (!ENV.localAuthEnabled) {
          throw new Error("Login local não está habilitado.");
        }

        const openId = ENV.localAuthOpenId;
        const name = input?.name?.trim() || ENV.localAuthName;

        await upsertUser({
          openId,
          name,
          email: null,
          loginMethod: "local",
          role: openId === ENV.ownerOpenId ? "admin" : "user",
          lastSignedIn: new Date(),
        });

        const user = await getUserByOpenId(openId);
        if (!user) {
          throw new Error("Não foi possível criar o usuário local.");
        }

        await ensureUserSubscriptionPlan(user.id, "Local");

        const sessionToken = await sdk.createSessionToken(openId, { name });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, {
          ...cookieOptions,
          maxAge: 1000 * 60 * 60 * 24 * 365,
        });

        return {
          success: true,
          user,
        } as const;
      }),
    getMyPlanLimits: protectedProcedure.query(async ({ ctx }) => {
      const subscription = await getUserSubscription(ctx.user.id);
      const plan = await getUserPlan(ctx.user.id);

      return {
        subscription,
        plan,
      };
    }),
    updateMyProfile: protectedProcedure
      .input(
        z.object({
          name: z.string().trim().min(2).max(120),
          email: z
            .string()
            .trim()
            .max(320)
            .refine((value) => value === "" || z.string().email().safeParse(value).success, "Email inválido"),
          profileImageUrl: z.string().trim().max(2_500_000).nullable().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await updateOwnUserProfile(ctx.user.id, {
          name: input.name,
          email: input.email || null,
          profileImageUrl: input.profileImageUrl ?? null,
        });

        const user = await getUserByOpenId(ctx.user.openId);
        if (!user) {
          throw new Error("Não foi possível atualizar o perfil.");
        }

        return user;
      }),
    workspaceSummary: protectedProcedure.query(async ({ ctx }) => {
      const [subscription, plan, chips, jobs] = await Promise.all([
        getUserSubscription(ctx.user.id),
        getUserPlan(ctx.user.id),
        getUserChips(ctx.user.id),
        listUserExecutionJobs(ctx.user.id, 20),
      ]);

      const dispatchJobs = jobs.filter((job) => job.executionType === "dispatch");
      const recentDispatchJobs = dispatchJobs.slice(0, 6);
      const rotationActiveChipIds = new Set(
        recentDispatchJobs
          .filter((job) => job.status === "running" || job.status === "pending")
          .map((job) => job.chipId)
          .filter((value): value is number => typeof value === "number")
      );

      return {
        subscription,
        plan,
        chips: chips.map((chip) => ({
          id: chip.id,
          chipName: chip.chipName,
          status: chip.status,
          isPaused: chip.isPaused,
          rotationActive: rotationActiveChipIds.has(chip.id),
        })),
        recentDispatchJobs: recentDispatchJobs.map((job) => ({
          id: job.id,
          chipId: job.chipId,
          executionType: job.executionType,
          status: job.status,
          totalMessagesSent: job.totalMessagesSent,
          totalTargets: job.totalTargets,
          successCount: job.successCount,
          failureCount: job.failureCount,
          createdAt: job.createdAt,
        })),
      };
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  chips: chipsRouter,
  chipCore: chipCoreRouter,
  maturation: maturationRouter,
  scheduling: schedulingRouter,
  whatsapp: whatsappRouter,
  operations: operationsRouter,
  runtime: runtimeRouter,
  controlCenter: controlCenterRouter,
});

export type AppRouter = typeof appRouter;
