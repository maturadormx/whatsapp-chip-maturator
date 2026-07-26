import { eq } from "drizzle-orm";
import { chipPersona } from "../../../drizzle/schema";
import { ensureChipPersonaStorage, getDb } from "../../db";
import type { PersonaDraft } from "./PersonaFactory";

export interface ChipPersonaRecord extends PersonaDraft {
  id: number;
  chipId: number;
  createdAt: Date;
  updatedAt: Date;
}

export type ChipPersonaUpdate = Partial<PersonaDraft>;

function parseJsonArray(value?: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
  } catch {
    return [];
  }
}

function mapRow(row: typeof chipPersona.$inferSelect): ChipPersonaRecord {
  return {
    id: row.id,
    chipId: row.chipId,
    displayName: row.displayName,
    homeState: row.homeState,
    homeCity: row.homeCity,
    primaryDDD: row.primaryDDD,
    secondaryDDDs: parseJsonArray(row.secondaryDDDs),
    profession: row.profession,
    ageRange: row.ageRange,
    socialProfile: row.socialProfile,
    wakeHour: row.wakeHour,
    sleepHour: row.sleepHour,
    weekendProfile: row.weekendProfile,
    interests: parseJsonArray(row.interests),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function createPersonaRecord(chipId: number, persona: PersonaDraft) {
  const db = await getDb();
  if (!db) return null;

  await ensureChipPersonaStorage();
  await db.insert(chipPersona).values({
    chipId,
    displayName: persona.displayName,
    homeState: persona.homeState,
    homeCity: persona.homeCity,
    primaryDDD: persona.primaryDDD,
    secondaryDDDs: JSON.stringify(persona.secondaryDDDs ?? []),
    profession: persona.profession,
    ageRange: persona.ageRange,
    socialProfile: persona.socialProfile,
    wakeHour: persona.wakeHour,
    sleepHour: persona.sleepHour,
    weekendProfile: persona.weekendProfile,
    interests: JSON.stringify(persona.interests ?? []),
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return loadPersonaRecord(chipId);
}

export async function loadPersonaRecord(chipId: number) {
  const db = await getDb();
  if (!db) return null;

  await ensureChipPersonaStorage();
  const rows = await db.select().from(chipPersona).where(eq(chipPersona.chipId, chipId)).limit(1);
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function updatePersonaRecord(chipId: number, update: ChipPersonaUpdate) {
  const db = await getDb();
  if (!db) return null;

  await ensureChipPersonaStorage();

  const payload: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (update.displayName !== undefined) payload.displayName = update.displayName;
  if (update.homeState !== undefined) payload.homeState = update.homeState;
  if (update.homeCity !== undefined) payload.homeCity = update.homeCity;
  if (update.primaryDDD !== undefined) payload.primaryDDD = update.primaryDDD;
  if (update.secondaryDDDs !== undefined) payload.secondaryDDDs = JSON.stringify(update.secondaryDDDs);
  if (update.profession !== undefined) payload.profession = update.profession;
  if (update.ageRange !== undefined) payload.ageRange = update.ageRange;
  if (update.socialProfile !== undefined) payload.socialProfile = update.socialProfile;
  if (update.wakeHour !== undefined) payload.wakeHour = update.wakeHour;
  if (update.sleepHour !== undefined) payload.sleepHour = update.sleepHour;
  if (update.weekendProfile !== undefined) payload.weekendProfile = update.weekendProfile;
  if (update.interests !== undefined) payload.interests = JSON.stringify(update.interests);

  await db.update(chipPersona).set(payload).where(eq(chipPersona.chipId, chipId));
  return loadPersonaRecord(chipId);
}
