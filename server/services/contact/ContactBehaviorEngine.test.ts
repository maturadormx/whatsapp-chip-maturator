import { describe, expect, it, vi } from "vitest";
import { pickContactTargetForPersona } from "./ContactBehaviorEngine";
import type { ChipPersonaRecord } from "../persona/PersonaRepository";

const persona: ChipPersonaRecord = {
  id: 1,
  chipId: 1,
  displayName: "Ana Clara",
  homeState: "MG",
  homeCity: "Belo Horizonte",
  primaryDDD: "31",
  secondaryDDDs: ["32", "33"],
  profession: "Analista comercial",
  ageRange: "28-34",
  socialProfile: "sociável",
  wakeHour: 8,
  sleepHour: 22,
  weekendProfile: "social",
  interests: ["café", "corrida", "tecnologia"],
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("ContactBehaviorEngine", () => {
  it("prioriza alvos do DDD principal da persona", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const target = pickContactTargetForPersona(
      persona,
      [
        { targetName: "BH A", targetValue: "5531999990001", isActive: 1 },
        { targetName: "Interior", targetValue: "5532999990002", isActive: 1 },
        { targetName: "Capital vizinha", targetValue: "5533999990003", isActive: 1 },
      ],
      []
    );

    expect(target?.ddd).toBe("31");
    expect(target?.targetName).toBe("BH A");

    vi.restoreAllMocks();
  });

  it("evita repetir contato recém-adicionado", () => {
    const target = pickContactTargetForPersona(
      persona,
      [
        { targetName: "BH A", targetValue: "5531999990001", isActive: 1 },
        { targetName: "Interior", targetValue: "5532999990002", isActive: 1 },
      ],
      [{ remoteJid: "5531999990001@s.whatsapp.net" }]
    );

    expect(target?.targetName).toBe("Interior");
  });
});
