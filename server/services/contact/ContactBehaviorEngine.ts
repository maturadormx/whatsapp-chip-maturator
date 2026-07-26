import { getUserMaturationTargets } from "../../db";
import { normalizeNumberTarget } from "../../utils/targets";
import { addChipContact, syncChipContacts } from "../whatsappService";
import type { BehaviorPlan } from "../planner/BehaviorPlanner";
import type { ChipPersonaRecord } from "../persona/PersonaRepository";

type ContactTargetCandidate = {
  targetName: string;
  targetValue: string;
  normalizedValue: string;
  ddd: string | null;
  weight: number;
};

function extractDDD(phoneNumber: string) {
  const digits = phoneNumber.replace(/\D/g, "");
  if (digits.length >= 12 && digits.startsWith("55")) {
    return digits.slice(2, 4);
  }
  if (digits.length >= 10) {
    return digits.slice(0, 2);
  }
  return null;
}

function extractDigitsFromJid(rawJid?: string | null) {
  return String(rawJid ?? "").replace(/\D/g, "");
}

function weightTargetForPersona(persona: ChipPersonaRecord, ddd: string | null) {
  if (!ddd) return 0.05;
  if (ddd === persona.primaryDDD) return 0.65;
  if (ddd === persona.secondaryDDDs[0]) return 0.2;
  if (ddd === persona.secondaryDDDs[1]) return 0.1;
  return 0.05;
}

export function pickContactTargetForPersona(
  persona: ChipPersonaRecord,
  rawTargets: Array<{ targetName: string; targetValue: string; isActive?: number | boolean | null }>,
  recentEvents: Array<{ remoteJid?: string | null }>
) {
  const recentlyAdded = new Set(
    recentEvents
      .map((event) => extractDigitsFromJid(event.remoteJid))
      .filter(Boolean)
      .map((digits) => digits.slice(-13))
  );

  const candidates: ContactTargetCandidate[] = rawTargets
    .filter((target) => target.isActive !== 0)
    .map((target) => {
      try {
        const normalized = normalizeNumberTarget(target.targetValue).normalizedValue;
        return {
          targetName: target.targetName,
          targetValue: target.targetValue,
          normalizedValue: normalized,
          ddd: extractDDD(normalized),
          weight: weightTargetForPersona(persona, extractDDD(normalized)),
        } satisfies ContactTargetCandidate;
      } catch {
        return null;
      }
    })
    .filter((target): target is ContactTargetCandidate => Boolean(target))
    .filter((target) => !recentlyAdded.has(target.normalizedValue.replace(/\D/g, "").slice(-13)));

  if (candidates.length === 0) {
    return null;
  }

  const totalWeight = candidates.reduce((sum, target) => sum + target.weight, 0);
  let cursor = Math.random() * Math.max(totalWeight, 0.01);

  for (const candidate of candidates) {
    cursor -= candidate.weight;
    if (cursor <= 0) {
      return candidate;
    }
  }

  return candidates[0];
}

export async function executeContactBehaviorPlan(params: {
  chipId: number;
  userId: number;
  persona: ChipPersonaRecord;
  plan: BehaviorPlan;
  recentEvents: Array<{ eventType: string; remoteJid?: string | null }>;
}) {
  const { chipId, userId, persona, plan, recentEvents } = params;

  if (plan.action === "contacts_synced") {
    return syncChipContacts(chipId);
  }

  if (plan.action !== "contact_added") {
    return {
      success: false,
      skipped: true,
      reason: `Plano ${plan.action} não pertence ao ContactBehaviorEngine.`,
    };
  }

  const targets = await getUserMaturationTargets(userId, "number");
  const target = pickContactTargetForPersona(
    persona,
    targets.map((item) => ({
      targetName: item.targetName,
      targetValue: item.targetValue,
      isActive: item.isActive,
    })),
    recentEvents
      .filter((event) => event.eventType === "contact_added")
      .map((event) => ({ remoteJid: event.remoteJid }))
  );

  if (!target) {
    return {
      success: false,
      skipped: true,
      reason: "Nenhum target elegível para a persona neste momento.",
    };
  }

  const displayName = target.targetName?.trim() || `Contato ${target.normalizedValue.slice(-4)}`;
  const result = await addChipContact(chipId, target.normalizedValue, displayName);

  return {
    ...result,
    target: {
      displayName,
      phoneNumber: target.normalizedValue,
      ddd: target.ddd,
      weight: target.weight,
    },
  };
}
