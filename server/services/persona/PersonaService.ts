import { createPersonaRecord, loadPersonaRecord, updatePersonaRecord, type ChipPersonaUpdate } from "./PersonaRepository";
import { generateRandomPersonaDraft } from "./PersonaFactory";

export function generateRandomPersona(seed?: {
  chipId?: number;
  chipName?: string;
  phoneNumber?: string | null;
}) {
  return generateRandomPersonaDraft(seed);
}

export async function createPersona(
  chipId: number,
  seed?: {
    chipName?: string;
    phoneNumber?: string | null;
  }
) {
  const existing = await loadPersonaRecord(chipId);
  if (existing) {
    return existing;
  }

  const persona = generateRandomPersonaDraft({
    chipId,
    chipName: seed?.chipName,
    phoneNumber: seed?.phoneNumber ?? null,
  });
  return createPersonaRecord(chipId, persona);
}

export async function loadPersona(chipId: number) {
  return loadPersonaRecord(chipId);
}

export async function updatePersona(chipId: number, update: ChipPersonaUpdate) {
  return updatePersonaRecord(chipId, update);
}
