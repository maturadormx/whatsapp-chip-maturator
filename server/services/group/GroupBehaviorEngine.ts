import { getUserChips, getUserMaturationTargets, listChipGroupsForChip } from "../../db";
import { createChipGroup, joinGroupByInvite, leaveChipGroup, listChipGroups, openChipGroupConversation } from "../whatsappService";
import type { BehaviorPlan } from "../planner/BehaviorPlanner";
import type { ChipPersonaRecord } from "../persona/PersonaRepository";
import { chooseGroupCandidate } from "./GroupPolicy";
import { saveChipGroup } from "./GroupRepository";

function normalizePhone(raw?: string | null) {
  return String(raw ?? "").replace(/\D/g, "");
}

export async function executeGroupBehaviorPlan(params: {
  chipId: number;
  userId: number;
  persona: ChipPersonaRecord;
  plan: BehaviorPlan;
}) {
  const { chipId, userId, persona, plan } = params;

  const [joinedGroups, liveGroups, groupTargets, allChips] = await Promise.all([
    listChipGroupsForChip(chipId, userId),
    listChipGroups(chipId).catch(() => []),
    getUserMaturationTargets(userId, "group"),
    getUserChips(userId),
  ]);

  const catalogGroups = joinedGroups
    .filter((group) => group.origin === "catalog" && group.inviteLink)
    .map((group) => ({
      link: group.inviteLink,
      category: group.category ?? "catalog",
      risk: group.risk ?? 0,
    }));

  const siblingChipNumbers = allChips
    .filter((chip) => chip.id !== chipId)
    .map((chip) => normalizePhone(chip.phoneNumber))
    .filter((phone) => phone.length >= 10);

  const candidate = chooseGroupCandidate({
    persona,
    joinedGroups: joinedGroups.map((group) => ({
      groupJid: group.groupJid,
      status: group.status,
      risk: group.risk,
      inviteLink: group.inviteLink,
      category: group.category,
    })),
    manualGroupTargets: groupTargets.map((target) => ({
      targetValue: target.targetValue,
      targetName: target.targetName,
    })),
    catalogGroups,
    siblingChipNumbers,
    availableLiveGroups: liveGroups,
  });

  switch (plan.action) {
    case "join_group": {
      if (candidate.action !== "join_group") {
        return { success: false, skipped: true, reason: candidate.reason };
      }

      const joined = await joinGroupByInvite(chipId, candidate.inviteLink);
      await saveChipGroup({
        userId,
        chipId,
        groupJid: joined.id,
        groupName: joined.subject,
        origin: candidate.origin,
        category: candidate.category ?? null,
        joinedAt: new Date(),
        lastInteraction: new Date(),
        status: "joined",
        inviteLink: candidate.inviteLink,
        risk: candidate.risk,
        payload: {
          plannerReason: plan.reason,
          plannerProbability: plan.probability,
        },
      });

      return {
        success: true,
        action: "join_group",
        group: joined,
      };
    }
    case "create_group": {
      if (candidate.action !== "create_group") {
        return { success: false, skipped: true, reason: candidate.reason };
      }

      const created = await createChipGroup(chipId, candidate.subject, candidate.participants);
      await saveChipGroup({
        userId,
        chipId,
        groupJid: created.id,
        groupName: created.subject,
        origin: "internal",
        category: candidate.subject,
        joinedAt: new Date(),
        lastInteraction: new Date(),
        status: "joined",
        risk: 5,
        payload: {
          plannerReason: plan.reason,
          participants: candidate.participants,
        },
      });

      return {
        success: true,
        action: "create_group",
        group: created,
      };
    }
    case "open_group":
    case "read_group_messages": {
      const groupJid = candidate.action === "open_group" ? candidate.groupJid : liveGroups[0]?.id;
      if (!groupJid) {
        return { success: false, skipped: true, reason: "Nenhum grupo elegível para observação." };
      }

      const opened = await openChipGroupConversation(chipId, groupJid);
      await saveChipGroup({
        userId,
        chipId,
        groupJid: opened.group.id,
        groupName: opened.group.subject,
        origin: "runtime_discovery",
        lastInteraction: new Date(),
        status: "joined",
        payload: {
          plannerReason: plan.reason,
          mode: plan.action,
        },
      });

      return {
        success: true,
        action: plan.action,
        group: opened.group,
      };
    }
    case "leave_group": {
      const groupJid = candidate.action === "leave_group" ? candidate.groupJid : joinedGroups.find((group) => group.status === "joined")?.groupJid;
      if (!groupJid) {
        return { success: false, skipped: true, reason: "Nenhum grupo ativo para saída controlada." };
      }

      const result = await leaveChipGroup(chipId, groupJid);
      await saveChipGroup({
        userId,
        chipId,
        groupJid,
        status: "left",
        leftAt: new Date(),
        lastInteraction: new Date(),
        payload: {
          plannerReason: plan.reason,
        },
      });

      return {
        success: true,
        action: "leave_group",
        result,
      };
    }
    default:
      return {
        success: false,
        skipped: true,
        reason: `Plano ${plan.action} não pertence ao GroupBehaviorEngine.`,
      };
  }
}
