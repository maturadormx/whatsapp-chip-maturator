import { describe, expect, it } from "vitest";
import { DefaultRuleEngine } from "./DefaultRuleEngine";

describe("DefaultRuleEngine", () => {
  it("gera ação de alerta para fact crítico", async () => {
    const engine = new DefaultRuleEngine();
    const actions = await engine.evaluate({
      id: "fact-1",
      observationId: "obs-1",
      type: "incident.detected",
      data: {
        severity: "critical",
      },
      timestamp: "2026-07-20T10:00:00.000Z",
    });

    expect(actions).toEqual([
      {
        type: "alert",
        payload: {
          severity: "critical",
          factId: "fact-1",
        },
      },
    ]);
  });

  it("retorna vazio quando nenhuma regra dispara", async () => {
    const engine = new DefaultRuleEngine();
    const actions = await engine.evaluate({
      id: "fact-1",
      observationId: "obs-1",
      type: "incident.detected",
      data: {
        severity: "low",
      },
      timestamp: "2026-07-20T10:00:00.000Z",
    });

    expect(actions).toEqual([]);
  });
});

