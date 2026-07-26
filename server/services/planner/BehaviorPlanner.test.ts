import { describe, expect, it } from "vitest";
import { planBehavior } from "./BehaviorPlanner";
import type { ChipPersonaRecord } from "../persona/PersonaRepository";

const basePersona: ChipPersonaRecord = {
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
  weekendProfile: "misturado",
  interests: ["café", "corrida", "tecnologia"],
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("BehaviorPlanner", () => {
  it("prioriza sincronização de contatos antes de qualquer outro comportamento", () => {
    const plan = planBehavior({
      persona: basePersona,
      phase: "NOVO",
      runtimeState: {
        isPaused: false,
        isConnected: true,
      },
      recentEvents: [],
      availableContactTargetsCount: 3,
      now: new Date("2026-07-25T12:00:00.000Z"),
    });

    expect(plan.action).toBe("contacts_synced");
    expect(plan.engine).toBe("contact_behavior");
  });

  it("planeja adição de contato quando identidade já foi aplicada e existe janela comercial", () => {
    const plan = planBehavior({
      persona: basePersona,
      phase: "EM_MATURACAO",
      runtimeState: {
        isPaused: false,
        isConnected: true,
      },
      recentEvents: [
        { eventType: "about_updated" },
        { eventType: "profile_name_updated" },
        { eventType: "contacts_synced" },
      ],
      availableContactTargetsCount: 5,
      joinedGroupsCount: 1,
      now: new Date("2026-07-25T14:30:00.000Z"),
    });

    expect(plan.action).toBe("contact_added");
    expect(plan.reason).toContain("DDD");
  });

  it("segura a mão quando o chip está pausado", () => {
    const plan = planBehavior({
      persona: basePersona,
      phase: "EM_MATURACAO",
      runtimeState: {
        isPaused: true,
        isConnected: true,
      },
      recentEvents: [],
      now: new Date("2026-07-25T14:30:00.000Z"),
    });

    expect(plan.action).toBe("paused");
    expect(plan.engine).toBe("none");
  });
});
