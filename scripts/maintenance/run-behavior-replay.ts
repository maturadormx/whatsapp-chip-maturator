import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  BehaviorReplayDataset,
  compareBehaviorReplayResults,
  explainIdentityDimension,
  explainReplayEpisode,
  runBehaviorReplay,
  serializeBehaviorReplayResult,
} from "../../server/services/behaviorSandboxService";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function resolvePath(inputPath: string) {
  return path.isAbsolute(inputPath) ? inputPath : path.join(rootDir, inputPath);
}

function readArg(name: string) {
  const prefix = `${name}=`;
  return process.argv.slice(2).find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

async function loadDataset(filePath: string) {
  const content = await readFile(resolvePath(filePath), "utf8");
  return JSON.parse(content) as BehaviorReplayDataset;
}

async function main() {
  const datasetPath = readArg("dataset");
  if (!datasetPath) {
    throw new Error("informe dataset=<caminho-do-json>");
  }

  const comparePath = readArg("compare");
  const episodeIndexArg = readArg("episode");
  const identityDimension = readArg("dimension");

  const dataset = await loadDataset(datasetPath);
  const replay = runBehaviorReplay(dataset);

  const result: Record<string, unknown> = {
    datasetId: dataset.datasetId,
    summary: {
      rawEvents: replay.snapshot.pipelineCounters.rawEvents,
      normalizedEvents: replay.snapshot.normalizedEvidenceCount,
      catalogedEvents: replay.snapshot.catalogedEvidenceCount,
      episodes: replay.snapshot.episodeCount,
      confidence: replay.snapshot.averageConfidence,
      coverage: replay.snapshot.evidenceCoverage.evidenceCoverage,
      stability: replay.snapshot.identitySnapshot.stability,
      maturity: replay.snapshot.identitySnapshot.maturity,
      pipelineHealth: replay.snapshot.pipelineHealth,
    },
    serialized: serializeBehaviorReplayResult(replay),
  };

  if (comparePath) {
    const baseline = runBehaviorReplay(await loadDataset(comparePath));
    result.diff = compareBehaviorReplayResults(baseline, replay);
  }

  if (episodeIndexArg) {
    result.episodeExplanation = explainReplayEpisode(replay, Number(episodeIndexArg));
  }

  if (identityDimension) {
    result.identityExplanation = explainIdentityDimension(replay, identityDimension as never);
  }

  console.log(JSON.stringify(result, null, 2));
}

void main();
