import { TRPCError } from "@trpc/server";
import { protectedProcedure } from "./trpc";

/**
 * Admin-only procedure
 * Throws FORBIDDEN error if user is not admin
 */
export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user?.role !== "admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "This action requires admin privileges",
    });
  }

  return next({ ctx });
});

/**
 * User procedure
 * Ensures user is authenticated and not admin
 * Used for regular user operations
 */
export const userProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "User must be authenticated",
    });
  }

  return next({ ctx });
});

/**
 * Owner-only procedure
 * Only the app owner (from ENV.OWNER_OPEN_ID) can access
 */
export const ownerProcedure = protectedProcedure.use(({ ctx, next }) => {
  const { OWNER_OPEN_ID } = process.env;

  if (ctx.user?.openId !== OWNER_OPEN_ID) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "This action is restricted to the app owner",
    });
  }

  return next({ ctx });
});
