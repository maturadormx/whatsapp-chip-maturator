import { promises as fs } from "node:fs";
import path from "node:path";
import { getChipIdentityEvolution, listBehaviorTimelineEvents, upsertChipIdentityEvolution } from "../../db";
import type { BehaviorPlan } from "../planner/BehaviorPlanner";
import { buildPersonaAbout } from "../persona/PersonaFactory";
import { loadPersona, updatePersona } from "../persona/PersonaService";
import { updateChipAbout, updateChipProfileName, updateChipProfilePhoto } from "../whatsappService";

function deriveNextDisplayName(currentDisplayName: string) {
  const parts = currentDisplayName.trim().split(/\s+/);
  if (parts.length >= 2 && parts[parts.length - 1].endsWith(".")) {
    return currentDisplayName;
  }
  const surnameSeed = parts[parts.length - 1]?.[0] ?? "S";
  return `${parts[0]} ${surnameSeed.toUpperCase()}.`;
}

function deriveNextAbout(currentAbout: string | null | undefined, baseAbout: string) {
  const variants = [
    `${baseAbout}`,
    `${baseAbout} Trabalhando por aqui.`,
    `${baseAbout} 🙏`,
    `${baseAbout} Offline às vezes, mas sempre por perto.`,
  ];

  const current = String(currentAbout ?? "").trim();
  const next = variants.find((item) => item !== current);
  return next ?? variants[0];
}

async function loadPhotoCandidates() {
  const root = process.cwd();
  const folders = [
    path.join(root, "assets", "identity-photos"),
    path.join(root, "assets", "profile-photos"),
  ];

  const files: string[] = [];
  for (const folder of folders) {
    try {
      const entries = await fs.readdir(folder);
      for (const entry of entries) {
        if (/\.(png|jpg|jpeg|webp)$/i.test(entry)) {
          files.push(path.join(folder, entry));
        }
      }
    } catch {}
  }
  return files;
}

export async function executeIdentityEvolutionPlan(params: {
  chipId: number;
  userId: number;
  plan: BehaviorPlan;
}) {
  const { chipId, userId, plan } = params;
  const persona = await loadPersona(chipId);
  if (!persona) {
    return {
      success: false,
      skipped: true,
      reason: "Persona indisponível para evolução de identidade.",
    };
  }

  const evolution = await getChipIdentityEvolution(userId, chipId);
  const recentEvents = await listBehaviorTimelineEvents({
    userId,
    chipId,
    limit: 200,
  });
  const generation = Number(evolution?.generation ?? 1);

  switch (plan.action) {
    case "identity_name_refresh": {
      const nextDisplayName = deriveNextDisplayName(persona.displayName);
      await updateChipProfileName(chipId, nextDisplayName);
      await updatePersona(chipId, {
        displayName: nextDisplayName,
      });
      await upsertChipIdentityEvolution({
        userId,
        chipId,
        generation: generation + 1,
        lastNameChangeAt: new Date(),
        lastAboutChangeAt: evolution?.lastAboutChangeAt ?? null,
        lastPhotoChangeAt: evolution?.lastPhotoChangeAt ?? null,
        currentDisplayName: nextDisplayName,
        currentAbout: evolution?.currentAbout ?? null,
        currentPhotoAsset: evolution?.currentPhotoAsset ?? null,
        payload: {
          plannerReason: plan.reason,
          timelineSize: recentEvents.length,
        },
      });
      return { success: true, action: plan.action, displayName: nextDisplayName };
    }
    case "identity_about_refresh": {
      const nextAbout = deriveNextAbout(evolution?.currentAbout, buildPersonaAbout(persona));
      await updateChipAbout(chipId, nextAbout);
      await upsertChipIdentityEvolution({
        userId,
        chipId,
        generation: generation + 1,
        lastNameChangeAt: evolution?.lastNameChangeAt ?? null,
        lastAboutChangeAt: new Date(),
        lastPhotoChangeAt: evolution?.lastPhotoChangeAt ?? null,
        currentDisplayName: evolution?.currentDisplayName ?? persona.displayName,
        currentAbout: nextAbout,
        currentPhotoAsset: evolution?.currentPhotoAsset ?? null,
        payload: {
          plannerReason: plan.reason,
          timelineSize: recentEvents.length,
        },
      });
      return { success: true, action: plan.action, about: nextAbout };
    }
    case "identity_photo_refresh": {
      const files = await loadPhotoCandidates();
      if (files.length === 0) {
        return {
          success: false,
          skipped: true,
          reason: "Nenhum asset de foto disponível em assets/identity-photos ou assets/profile-photos.",
        };
      }

      const nextAsset = files[(generation - 1) % files.length];
      const imageBuffer = await fs.readFile(nextAsset);
      await updateChipProfilePhoto(chipId, imageBuffer);
      await upsertChipIdentityEvolution({
        userId,
        chipId,
        generation: generation + 1,
        lastNameChangeAt: evolution?.lastNameChangeAt ?? null,
        lastAboutChangeAt: evolution?.lastAboutChangeAt ?? null,
        lastPhotoChangeAt: new Date(),
        currentDisplayName: evolution?.currentDisplayName ?? persona.displayName,
        currentAbout: evolution?.currentAbout ?? null,
        currentPhotoAsset: nextAsset,
        payload: {
          plannerReason: plan.reason,
          timelineSize: recentEvents.length,
        },
      });
      return { success: true, action: plan.action, photoAsset: nextAsset };
    }
    default:
      return {
        success: false,
        skipped: true,
        reason: `Plano ${plan.action} não pertence ao IdentityEvolutionEngine.`,
      };
  }
}
