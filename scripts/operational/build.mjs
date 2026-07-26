import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const runtimeCacheRoot =
  process.env.WCM_CACHE_ROOT ??
  (process.platform === "win32"
    ? path.join(os.homedir(), ".trae", "work", "whatsapp-chip-maturator-cache")
    : path.join(projectRoot, ".cache"));
const buildCacheRoot = path.join(runtimeCacheRoot, "build");
const buildTmpRoot = path.join(buildCacheRoot, "tmp");
const forensicDir = path.join(projectRoot, "forensics");
const forensicLogPath = path.join(forensicDir, "e02-build-forensics.log");

fs.mkdirSync(buildTmpRoot, { recursive: true });
fs.mkdirSync(forensicDir, { recursive: true });

const env = {
  ...process.env,
  NODE_ENV: process.env.NODE_ENV ?? "production",
  VITE_CACHE_DIR: process.env.VITE_CACHE_DIR ?? path.join(buildCacheRoot, "vite"),
  TMP: buildTmpRoot,
  TEMP: buildTmpRoot,
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nowIso() {
  return new Date().toISOString();
}

function appendForensicLog(message) {
  fs.appendFileSync(forensicLogPath, `${nowIso()} ${message}\n`, "utf8");
}

function detectDeniedOperation(output) {
  const patterns = [
    { operation: "remove", regex: /remove\s+(.+?): Access is denied\./i },
    { operation: "open", regex: /open\s+(.+?): Access is denied\./i },
    { operation: "mkdir", regex: /mkdir\s+(.+?): Access is denied\./i },
    { operation: "rename", regex: /rename\s+(.+?): Access is denied\./i },
  ];

  for (const pattern of patterns) {
    const match = output.match(pattern.regex);
    if (match?.[1]) {
      return {
        operation: pattern.operation,
        targetPath: match[1].trim(),
      };
    }
  }

  return null;
}

appendForensicLog("=== INICIO E0.2 BUILD FORENSE ===");
appendForensicLog(`projectRoot=${projectRoot}`);
appendForensicLog(`runtimeCacheRoot=${runtimeCacheRoot}`);
appendForensicLog(`buildCacheRoot=${buildCacheRoot}`);
appendForensicLog(`buildTmpRoot=${buildTmpRoot}`);
appendForensicLog(`VITE_CACHE_DIR=${env.VITE_CACHE_DIR}`);
appendForensicLog(`TEMP=${env.TEMP}`);
appendForensicLog(`TMP=${env.TMP}`);
appendForensicLog(`cwd_length=${projectRoot.length}`);
appendForensicLog(`temp_length=${buildTmpRoot.length}`);

function run(command) {
  return new Promise((resolve, reject) => {
    appendForensicLog(`spawn command="${command}"`);
    const child = spawn(command, {
      cwd: projectRoot,
      env,
      stdio: ["inherit", "pipe", "pipe"],
      shell: true,
    });
    let output = "";

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      output += text;
      process.stdout.write(text);
    });

    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      output += text;
      process.stderr.write(text);
    });

    child.on("exit", (code) => {
      if (code === 0) {
        appendForensicLog(`command_ok command="${command}" code=${code}`);
        resolve();
        return;
      }
      appendForensicLog(`command_fail command="${command}" code=${code ?? 1}`);
      reject(
        Object.assign(new Error(`${command} exited with code ${code ?? 1}`), {
          output,
        })
      );
    });

    child.on("error", reject);
  });
}

async function runViteBuildWithRetry() {
  try {
    await run("npx vite build");
  } catch (error) {
    const output = error && typeof error === "object" && "output" in error ? String(error.output) : String(error);
    const denied = detectDeniedOperation(output);
    appendForensicLog(`vite_build_error=${JSON.stringify({
      message: error instanceof Error ? error.message : String(error),
      denied,
    })}`);
    const isTransientAccessDenied =
      output.includes("[vite:esbuild-transpile]") &&
      output.includes("Access is denied") &&
      output.includes(`${path.sep}esbuild-`);

    if (!isTransientAccessDenied) {
      throw error;
    }

    console.warn("[build script] Falha transitória do esbuild ao limpar diretório temporário. Repetindo build em 2s...");
    appendForensicLog("retry_due_to_access_denied=true");
    await sleep(2000);
    await run("npx vite build");
  }
}

try {
  await runViteBuildWithRetry();
await run(
  "npx esbuild server/_core/index.ts --platform=node --packages=external --bundle --format=esm --splitting --chunk-names=chunks/[name]-[hash] --outdir=dist"
);
  appendForensicLog("=== BUILD FORENSE CONCLUIDO COM SUCESSO ===");
} catch (error) {
  const output = error && typeof error === "object" && "output" in error ? String(error.output) : String(error);
  const denied = detectDeniedOperation(output);
  appendForensicLog(`final_error=${JSON.stringify({
    message: error instanceof Error ? error.message : String(error),
    denied,
  })}`);
  appendForensicLog("=== BUILD FORENSE FALHOU ===");
  throw error;
}
