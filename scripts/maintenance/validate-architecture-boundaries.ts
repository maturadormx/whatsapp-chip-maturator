import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

type BoundaryRule = {
  name: string;
  match: (relativePath: string) => boolean;
  forbidden: Array<{
    pattern: RegExp;
    reason: string;
  }>;
};

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const serverServicesDir = path.join(rootDir, "server", "services");

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (["node_modules", "dist", "build"].includes(entry.name)) {
          return [];
        }
        return walk(fullPath);
      }
      return entry.isFile() && entry.name.endsWith(".ts") ? [fullPath] : [];
    })
  );

  return files.flat();
}

const rules: BoundaryRule[] = [
  {
    name: "Behavior Planner",
    match: (relativePath) => relativePath === "server/services/behaviorPlannerService.ts",
    forbidden: [
      {
        pattern: /from\s+["']\.\.\/db["']/,
        reason: "não pode depender de banco ou timeline diretamente",
      },
      {
        pattern: /from\s+["']\.\/whatsappService["']/,
        reason: "não pode chamar camada de execução",
      },
      {
        pattern: /from\s+["']\.\/(?:maturationEngine|passiveBehaviorEngine)["']/,
        reason: "não pode acoplar com engines operacionais",
      },
      {
        pattern: /\b(?:listBehaviorTimelineEvents|activityLogs?)\b/,
        reason: "não pode ler evidência crua nem logs operacionais",
      },
    ],
  },
  {
    name: "Identity Snapshot Generator",
    match: (relativePath) => relativePath === "server/services/identitySnapshotGeneratorService.ts",
    forbidden: [
      {
        pattern: /from\s+["']\.\.\/db["']/,
        reason: "não pode ler banco diretamente",
      },
      {
        pattern: /from\s+["']\.\/whatsappService["']/,
        reason: "não pode chamar provedor nem execução",
      },
      {
        pattern: /\b(?:listBehaviorTimelineEvents|activityLogs?)\b/,
        reason: "não pode consumir evidência crua",
      },
    ],
  },
  {
    name: "Strategy Layer",
    match: (relativePath) =>
      relativePath.startsWith("server/services/") &&
      /strategy/i.test(path.basename(relativePath)) &&
      !/spec/i.test(path.basename(relativePath)),
    forbidden: [
      {
        pattern: /from\s+["']\.\.\/db["']/,
        reason: "Strategy Engine só pode consumir contratos consolidados",
      },
      {
        pattern: /from\s+["']\.\/whatsappService["']/,
        reason: "Strategy Engine não executa comportamento",
      },
      {
        pattern: /\b(?:listBehaviorTimelineEvents|activityLogs?|behavior[_-]?timeline)\b/i,
        reason: "Strategy Engine não pode acessar evidência crua",
      },
    ],
  },
  {
    name: "Knowledge Base / Learning",
    match: (relativePath) =>
      relativePath.startsWith("server/services/") && /(knowledge|learning|hypothesis)/i.test(path.basename(relativePath)),
    forbidden: [
      {
        pattern: /from\s+["']\.\/whatsappService["']/,
        reason: "camada de aprendizado não executa ações",
      },
      {
        pattern: /\b(?:openChip|sendMessage|recordChipPassiveLifecycle|updateChip)/,
        reason: "camada de aprendizado não toca runtime operacional",
      },
    ],
  },
];

async function main() {
  const files = await walk(serverServicesDir);
  const violations: string[] = [];

  for (const file of files) {
    const relativePath = path.relative(rootDir, file).replaceAll("\\", "/");
    const content = await readFile(file, "utf8");

    for (const rule of rules) {
      if (!rule.match(relativePath)) continue;

      for (const forbidden of rule.forbidden) {
        if (forbidden.pattern.test(content)) {
          violations.push(`${relativePath}: ${rule.name} violou fronteira (${forbidden.reason})`);
        }
      }
    }
  }

  if (violations.length > 0) {
    console.error("Architecture Guard encontrou violações:");
    for (const violation of violations) {
      console.error(`- ${violation}`);
    }
    process.exit(1);
  }

  console.log("Architecture Guard: OK");
}

void main();
