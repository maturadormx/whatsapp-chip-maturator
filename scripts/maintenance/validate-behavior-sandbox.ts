import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  BehaviorReplayDataset,
  compareBehaviorReplayResults,
  runBehaviorReplay,
  serializeBehaviorReplayResult,
} from "../../server/services/behaviorSandboxService";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

async function main() {
  const datasetsDir = path.join(rootDir, "datasets", "golden");
  const files = (await readdir(datasetsDir)).filter((file) => file.endsWith(".json")).sort();

  assert.ok(files.length >= 5, "esperado pelo menos 5 golden datasets");

  for (const file of files) {
    const dataset = JSON.parse(
      await readFile(path.join(datasetsDir, file), "utf8")
    ) as BehaviorReplayDataset;

    const replayA = runBehaviorReplay(dataset);
    const replayB = runBehaviorReplay(dataset);

    assert.deepStrictEqual(
      serializeBehaviorReplayResult(replayA),
      serializeBehaviorReplayResult(replayB),
      `dataset ${dataset.datasetId} não é determinístico`
    );

    const diff = compareBehaviorReplayResults(replayA, replayB);
    assert.equal(diff.changed, false, `dataset ${dataset.datasetId} apresentou diff contra si mesmo`);
    assert.equal(replayA.snapshot.credibilityTrend.length, 4, `dataset ${dataset.datasetId} sem tendência completa`);
    assert.ok(replayA.snapshot.validation.unknownState.state === "KNOWN" || replayA.snapshot.validation.unknownState.state === "UNKNOWN");
    assert.ok(Array.isArray(replayA.snapshot.longitudinal.relationshipMemory), `dataset ${dataset.datasetId} sem camada longitudinal`);
    assert.equal(replayA.snapshot.longitudinal.cognitive.counterfactualSimulator.scenarios.length, 4, `dataset ${dataset.datasetId} sem contrafactual observacional`);
    assert.ok(replayA.snapshot.adaptiveIntelligence.hypotheses.length > 0, `dataset ${dataset.datasetId} sem hipóteses adaptativas`);
    assert.ok(
      replayA.snapshot.observability.behaviorVariance.score >= 0 &&
        replayA.snapshot.observability.behaviorVariance.score <= 100,
      `dataset ${dataset.datasetId} com variance score inválido`
    );

    console.log(`Sandbox OK: ${dataset.datasetId}`);
  }

  console.log("Behavior Sandbox Validation: OK");
}

void main();
