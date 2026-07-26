import { router } from "../_core/trpc";
import { adminProcedure } from "../_core/rbac";
import { z } from "zod";
import {
  getAllUsers,
  getAllSubscriptionPlans,
  getUserSubscription,
  createDefaultSubscription,
  updateUserAdminAccount,
  updateUserAdminSubscription,
  getAllChips,
  createAdminAuditLog,
  getAdminAuditLogs,
  updateSubscriptionPlan,
} from "../db";
import { TRPCError } from "@trpc/server";

export const adminRouter = router({
  // Get all users with their subscription info
  getAllUsers: adminProcedure.query(async () => {
    try {
      const allUsers = await getAllUsers();
      
      const usersWithSubscriptions = await Promise.all(
        allUsers.map(async (user) => {
          const subscription = await getUserSubscription(user.id);
          return {
            ...user,
            subscription,
          };
        })
      );

      return usersWithSubscriptions;
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch users",
      });
    }
  }),

  // Get all subscription plans
  getAllPlans: adminProcedure.query(async () => {
    try {
      return await getAllSubscriptionPlans();
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch subscription plans",
      });
    }
  }),

  // Get user subscription details
  getUserSubscription: adminProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      try {
        const subscription = await getUserSubscription(input.userId);
        
        if (!subscription) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "User subscription not found",
          });
        }

        return subscription;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch user subscription",
        });
      }
    }),

  // Create default subscription for new user
  createUserSubscription: adminProcedure
    .input(
      z.object({
        userId: z.number(),
        planId: z.number(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const existingSubscription = await getUserSubscription(input.userId);
        
        if (existingSubscription) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "User already has a subscription",
          });
        }

        await createDefaultSubscription(input.userId, input.planId);
        await createAdminAuditLog({
          adminUserId: ctx.user.id,
          targetUserId: input.userId,
          entity: "subscription",
          action: "create",
          payload: { planId: input.planId },
        });

        return {
          success: true,
          message: "Subscription created successfully",
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create subscription",
        });
      }
    }),

  updateUserAccount: adminProcedure
    .input(
      z.object({
        userId: z.number(),
        role: z.enum(["user", "admin"]).optional(),
        isActive: z.number().min(0).max(1).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        await updateUserAdminAccount(input.userId, {
          role: input.role,
          isActive: input.isActive,
        });
        await createAdminAuditLog({
          adminUserId: ctx.user.id,
          targetUserId: input.userId,
          entity: "user",
          action: "update_account",
          payload: { role: input.role, isActive: input.isActive },
        });

        return {
          success: true,
          message: "User updated successfully",
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update user account",
        });
      }
    }),

  updateUserSubscription: adminProcedure
    .input(
      z.object({
        userId: z.number(),
        planId: z.number().optional(),
        status: z.enum(["active", "cancelled", "expired", "trial"]).optional(),
        autoRenew: z.number().min(0).max(1).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const existingSubscription = await getUserSubscription(input.userId);

        if (!existingSubscription) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "User subscription not found",
          });
        }

        await updateUserAdminSubscription(input.userId, {
          planId: input.planId,
          status: input.status,
          autoRenew: input.autoRenew,
          subscriptionEndDate: input.status === "cancelled" || input.status === "expired" ? new Date() : undefined,
        });
        await createAdminAuditLog({
          adminUserId: ctx.user.id,
          targetUserId: input.userId,
          entity: "subscription",
          action: "update",
          payload: { planId: input.planId, status: input.status, autoRenew: input.autoRenew },
        });

        return {
          success: true,
          message: "Subscription updated successfully",
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update subscription",
        });
      }
    }),

  getCompanyOverview: adminProcedure.query(async () => {
    try {
      const chips = await getAllChips();
      const allUsers = await getAllUsers();

      const chipsByStatus = {
        connected: chips.filter((chip) => chip.status === "conectado").length,
        maturing: chips.filter((chip) => chip.status === "maturando").length,
        disconnected: chips.filter((chip) => chip.status === "desconectado").length,
        paused: chips.filter((chip) => Boolean(chip.isPaused)).length,
      };

      const userChipLoad = allUsers
        .map((user) => ({
          userId: user.id,
          userName: user.name || user.email || `Usuário #${user.id}`,
          chipCount: chips.filter((chip) => chip.userId === user.id).length,
        }))
        .filter((item) => item.chipCount > 0)
        .sort((a, b) => b.chipCount - a.chipCount)
        .slice(0, 6);

      return {
        totalChips: chips.length,
        chipsByStatus,
        activeOwners: userChipLoad.length,
        userChipLoad,
      };
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch company overview",
      });
    }
  }),

  getCompanyChips: adminProcedure.query(async () => {
    try {
      const chips = await getAllChips();
      const allUsers = await getAllUsers();

      return chips
        .map((chip) => {
          const owner = allUsers.find((user) => user.id === chip.userId);
          return {
            ...chip,
            ownerName: owner?.name || owner?.email || `Usuário #${chip.userId}`,
          };
        })
        .sort((a, b) => {
          const statusRank = (status?: string) => {
            if (status === "conectado") return 0;
            if (status === "maturando") return 1;
            if (status === "desconectado") return 2;
            return 3;
          };
          return statusRank(a.status) - statusRank(b.status);
        })
        .slice(0, 500);
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch company chips",
      });
    }
  }),

  getAuditLogs: adminProcedure
    .input(z.object({ limit: z.number().min(10).max(500).default(120) }).optional())
    .query(async ({ input }) => {
      const limit = input?.limit ?? 120;
      return getAdminAuditLogs(limit);
    }),

  updatePlan: adminProcedure
    .input(
      z.object({
        planId: z.number(),
        planName: z.string().min(2).optional(),
        description: z.string().optional(),
        maxChips: z.number().min(0).optional(),
        maxMessagesPerMonth: z.number().optional(),
        maxScheduledTasks: z.number().min(0).optional(),
        priceMonthly: z.number().min(0).optional(),
        isActive: z.number().min(0).max(1).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        await updateSubscriptionPlan(input.planId, {
          planName: input.planName,
          description: input.description,
          maxChips: input.maxChips,
          maxMessagesPerMonth: input.maxMessagesPerMonth,
          maxScheduledTasks: input.maxScheduledTasks,
          priceMonthly: input.priceMonthly,
          isActive: input.isActive,
        });

        await createAdminAuditLog({
          adminUserId: ctx.user.id,
          entity: "plan",
          action: "update",
          payload: input,
        });

        return { success: true };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update plan",
        });
      }
    }),

  // Get dashboard statistics
  getDashboardStats: adminProcedure.query(async () => {
    try {
      const allUsers = await getAllUsers();
      const plans = await getAllSubscriptionPlans();

      const stats = {
        totalUsers: allUsers.length,
        activeUsers: allUsers.filter((u) => u.isActive === 1).length,
        adminUsers: allUsers.filter((u) => u.role === "admin").length,
        totalPlans: plans.length,
        createdToday: allUsers.filter((u) => {
          const today = new Date();
          const userDate = new Date(u.createdAt);
          return (
            userDate.getDate() === today.getDate() &&
            userDate.getMonth() === today.getMonth() &&
            userDate.getFullYear() === today.getFullYear()
          );
        }).length,
      };

      return stats;
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch dashboard statistics",
      });
    }
  }),
});
