import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";

interface PlanLimits {
  canAddChip: boolean;
  canCreateTask: boolean;
  chipsRemaining: number;
  tasksRemaining: number;
  messagesRemaining: number;
  chipCount: number;
  taskCount: number;
  messageCount: number;
  maxChips: number;
  maxTasks: number;
  maxMessages: number;
}

export function usePlanLimits(): PlanLimits {
  const { user } = useAuth();

  const { data } = trpc.auth.getMyPlanLimits.useQuery(undefined, {
    enabled: !!user?.id,
  });

  const subscription = data?.subscription;
  const currentPlan = data?.plan;

  // Calculate remaining limits
  const chipsRemaining = currentPlan
    ? Math.max(0, currentPlan.maxChips - (subscription?.currentChipsCount || 0))
    : 0;

  const tasksRemaining = currentPlan
    ? Math.max(0, currentPlan.maxScheduledTasks - (subscription?.currentTasksCount || 0))
    : 0;

  const messagesRemaining = currentPlan
    ? currentPlan.maxMessagesPerMonth === -1
      ? -1 // Unlimited
      : Math.max(0, currentPlan.maxMessagesPerMonth - (subscription?.currentMessagesThisMonth || 0))
    : 0;

  return {
    canAddChip: chipsRemaining > 0,
    canCreateTask: tasksRemaining > 0,
    chipsRemaining,
    tasksRemaining,
    messagesRemaining,
    chipCount: subscription?.currentChipsCount || 0,
    taskCount: subscription?.currentTasksCount || 0,
    messageCount: subscription?.currentMessagesThisMonth || 0,
    maxChips: currentPlan?.maxChips || 0,
    maxTasks: currentPlan?.maxScheduledTasks || 0,
    maxMessages: currentPlan?.maxMessagesPerMonth || 0,
  };
}
