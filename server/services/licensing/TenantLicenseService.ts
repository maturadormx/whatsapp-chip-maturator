import {
  getUserPlan,
  getUserScheduledTasks,
  getUserSubscription,
  getUserChips,
  validateChipsLimit,
  validateTasksLimit,
} from "../../db";

export async function getTenantLicenseSummary(userId: number) {
  const [subscription, plan, chips, tasks, chipLimit, taskLimit] = await Promise.all([
    getUserSubscription(userId),
    getUserPlan(userId),
    getUserChips(userId),
    getUserScheduledTasks(userId),
    validateChipsLimit(userId),
    validateTasksLimit(userId),
  ]);

  return {
    userId,
    subscription,
    plan,
    usage: {
      chips: chips.length,
      scheduledTasks: tasks.length,
    },
    limits: {
      chips: chipLimit,
      tasks: taskLimit,
    },
    tenant: {
      isolatedByUserId: true,
      tenantKey: `tenant:${userId}`,
    },
  };
}

export async function assertTenantCapacity(params: {
  userId: number;
  resource: "chip" | "task";
}) {
  const summary = await getTenantLicenseSummary(params.userId);
  const allowed =
    params.resource === "chip"
      ? summary.limits.chips.allowed
      : summary.limits.tasks.allowed;

  return {
    allowed,
    summary,
  };
}
