import { setChipPresenceState } from "../whatsappService";
import type { BehaviorPlan } from "../planner/BehaviorPlanner";

const PLAN_TO_PRESENCE = {
  presence_online: "online",
  presence_offline: "offline",
  presence_reading: "reading",
  presence_typing: "typing",
  presence_recording: "recording",
  presence_away: "away",
} as const;

export async function executePresenceBehaviorPlan(params: {
  chipId: number;
  plan: BehaviorPlan;
}) {
  const { chipId, plan } = params;
  const mapped = PLAN_TO_PRESENCE[plan.action as keyof typeof PLAN_TO_PRESENCE];
  if (!mapped) {
    return {
      success: false,
      skipped: true,
      reason: `Plano ${plan.action} não pertence ao PresenceBehaviorEngine.`,
    };
  }

  const targetJid =
    typeof plan.metadata?.targetJid === "string" && plan.metadata.targetJid.trim()
      ? plan.metadata.targetJid
      : null;

  return setChipPresenceState(chipId, mapped, targetJid);
}
