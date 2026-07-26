import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { appRouter } from "../routers";
import type { TrpcContext } from "../_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "test",
      role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };

  return { ctx };
}

describe("Chips Router", () => {
  it("should list chips for authenticated user", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.chips.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("should handle maturation profiles", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const profiles = await caller.maturation.listProfiles();
    expect(Array.isArray(profiles)).toBe(true);
  });

  it("should handle scheduled tasks", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const tasks = await caller.scheduling.listTasks();
    expect(Array.isArray(tasks)).toBe(true);
  });
});
