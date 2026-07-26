import { describe, expect, it } from "vitest";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import {
  BehaviorReplayDataset,
  compareBehaviorReplayResults,
  runBehaviorReplay,
  serializeBehaviorReplayResult,
  simulateOpportunityInSandbox,
} from "./behaviorSandboxService";

async function loadGoldenDatasets() {
  const datasetsDir = path.resolve(import.meta.dirname, "..", "..", "datasets", "golden");
  const files = (await readdir(datasetsDir)).filter((file) => file.endsWith(".json")).sort();

  return Promise.all(
    files.map(async (file) => {
      const content = await readFile(path.join(datasetsDir, file), "utf8");
      return JSON.parse(content) as BehaviorReplayDataset;
    })
  );
}

describe("Behavior Sandbox Service", () => {
  it("reexecuta todos os golden datasets de forma determinística", async () => {
    const datasets = await loadGoldenDatasets();

    expect(datasets.length).toBeGreaterThanOrEqual(5);

    for (const dataset of datasets) {
      const replayA = runBehaviorReplay(dataset);
      const replayB = runBehaviorReplay(dataset);

      expect(serializeBehaviorReplayResult(replayA)).toEqual(serializeBehaviorReplayResult(replayB));

      const diff = compareBehaviorReplayResults(replayA, replayB);
      expect(diff.changed).toBe(false);
      expect(diff.confidence.delta).toBe(0);
      expect(diff.episodes.delta).toBe(0);
      expect(diff.coverage.delta).toBe(0);
      expect(diff.pipelineHealth.delta).toBe(0);
      expect(diff.identity.confidence.delta).toBe(0);
      expect(diff.identity.stability.delta).toBe(0);
      expect(diff.identity.maturity.delta).toBe(0);
      expect(diff.identity.drift.delta).toBe(0);
      expect(diff.observability.behaviorVariance.delta).toBe(0);
      expect(replayA.snapshot.observability.personaDiversity.score).toBeGreaterThanOrEqual(0);
      expect(replayA.snapshot.credibilityTrend).toHaveLength(4);
      expect(replayA.snapshot.validation.unknownState.state).toMatch(/KNOWN|UNKNOWN/);
      expect(replayA.snapshot.longitudinal.relationshipMemory.length).toBeGreaterThanOrEqual(0);
      expect(replayA.snapshot.longitudinal.cognitive.counterfactualSimulator.scenarios).toHaveLength(4);
      expect(replayA.snapshot.adaptiveIntelligence.hypotheses.length).toBeGreaterThan(0);
      expect(replayA.snapshot.pipelineCounters.rawEvents).toBe(dataset.rawEvents.length);
    }
  });

  it("simula oportunidade sem executar comportamento", () => {
    const simulation = simulateOpportunityInSandbox({
      intent: "reply_if_prompted",
      opportunity: {
        signalId: "reply:contact-a",
        hasUnreadReply: true,
        lastInteractionAt: new Date("2026-07-16T14:00:00.000Z"),
      },
      identitySummary: "identidade observável com alta responsividade e baixo risco",
      evidenceReferences: ["episode-1", "episode-3"],
    });

    expect(simulation.appeared).toBe(true);
    expect(simulation.plan.simulation.mode).toBe("simulation");
    expect(simulation.plan.simulation.wouldExecute).toBe(false);
    expect(simulation.whyAppeared.length).toBeGreaterThan(0);
    expect(simulation.whyNotAppeared).toEqual([]);
  });
});
