import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function exists(filePath: string) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const results = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (["node_modules", "dist", "build"].includes(entry.name)) return [];
        return walk(fullPath);
      }
      return entry.isFile() ? [fullPath] : [];
    })
  );
  return results.flat();
}

async function main() {
  const contractsDir = path.join(rootDir, "server", "contracts");
  const publicLayerApiPath = path.join(contractsDir, "public-layer-api.ts");
  const platformContractsPath = path.join(contractsDir, "platform-contracts.ts");
  const docsDir = path.join(rootDir, "docs", "architecture");
  const materializationPath = path.join(rootDir, "server", "services", "maturatorOperational.ts");
  const dbAdapterPath = path.join(rootDir, "server", "db.ts");

  assert.equal(await exists(publicLayerApiPath), true, "public-layer-api.ts não encontrado");
  assert.equal(await exists(platformContractsPath), true, "platform-contracts.ts não encontrado");
  assert.equal(await exists(path.join(docsDir, "platform-vocabulary-and-invariants.md")), true, "documento de vocabulário/invariantes não encontrado");
  assert.equal(await exists(path.join(docsDir, "platform-health-metrics.md")), true, "documento de métricas da plataforma não encontrado");

  const publicLayerApi = await readFile(publicLayerApiPath, "utf8");
  const platformContracts = await readFile(platformContractsPath, "utf8");

  for (const symbol of [
    "EvidenceLayerPublicApi",
    "BehaviorMemoryLayerPublicApi",
    "IdentityLayerPublicApi",
    "PlannerLayerPublicApi",
    "LearningLayerPublicContract",
    "StrategyLayerPublicContract",
    "ExecutorLayerPublicContract",
  ]) {
    assert.match(publicLayerApi, new RegExp(`\\b${symbol}\\b`), `símbolo público ausente: ${symbol}`);
  }

  for (const symbol of ["PlatformContractEnvelope", "DecisionContext", "createContractEnvelope", "PlatformHealthSnapshot"]) {
    assert.match(platformContracts, new RegExp(`\\b${symbol}\\b`), `contrato ausente: ${symbol}`);
  }

  const serverFiles = (await walk(path.join(rootDir, "server"))).filter((file) => file.endsWith(".ts"));
  const forbiddenMaterializationWrites: string[] = [];

  for (const file of serverFiles) {
    const relativePath = path.relative(rootDir, file).replaceAll("\\", "/");
    const content = await readFile(file, "utf8");
    const writesMaterializedState =
      /\bupsertChipHealth\b|\bupsertChipBehaviorScore\b|\bupsertChipCertification\b/.test(content);

    const isAllowedPersistenceFile =
      path.resolve(file) === path.resolve(materializationPath) || path.resolve(file) === path.resolve(dbAdapterPath);

    if (writesMaterializedState && !isAllowedPersistenceFile) {
      forbiddenMaterializationWrites.push(relativePath);
    }
  }

  assert.deepStrictEqual(
    forbiddenMaterializationWrites,
    [],
    `somente maturatorOperational.ts pode escrever estado materializado, mas encontrei: ${forbiddenMaterializationWrites.join(", ")}`
  );

  console.log("Architecture Fitness Test: OK");
}

void main();
