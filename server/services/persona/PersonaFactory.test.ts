import { describe, expect, it } from "vitest";
import { buildPersonaAbout, generateRandomPersonaDraft } from "./PersonaFactory";

describe("PersonaFactory", () => {
  it("gera uma persona com campos essenciais e horários válidos", () => {
    const persona = generateRandomPersonaDraft({
      chipId: 1,
      chipName: "mx1",
      phoneNumber: "5531999991111",
    });

    expect(persona.displayName.length).toBeGreaterThan(2);
    expect(persona.primaryDDD).toBe("31");
    expect(persona.secondaryDDDs.length).toBeGreaterThan(0);
    expect(persona.wakeHour).toBeGreaterThanOrEqual(6);
    expect(persona.sleepHour).toBeGreaterThan(persona.wakeHour);
    expect(persona.interests.length).toBe(3);
  });

  it("monta uma bio curta a partir da persona", () => {
    const about = buildPersonaAbout(
      generateRandomPersonaDraft({
        chipId: 2,
      })
    );

    expect(about.length).toBeGreaterThan(10);
    expect(about).toContain("Perfil");
  });
});
