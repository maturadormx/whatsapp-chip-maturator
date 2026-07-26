import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const safeDevMode = process.env.DEV_USE_PERSISTENT_SERVICES !== "true";
const runtimeCacheRoot =
  process.env.WCM_CACHE_ROOT ??
  (process.platform === "win32"
    ? path.join(os.homedir(), ".trae", "work", "whatsapp-chip-maturator-cache")
    : path.join(projectRoot, ".cache"));
const devCacheRoot = path.join(runtimeCacheRoot, "dev");
const devTmpRoot = path.join(devCacheRoot, "tmp");

fs.mkdirSync(devTmpRoot, { recursive: true });

const env = {
  ...process.env,
  NODE_ENV: "development",
  VITE_CACHE_DIR: process.env.VITE_CACHE_DIR ?? path.join(devCacheRoot, "vite"),
  VITEST_CACHE_DIR: process.env.VITEST_CACHE_DIR ?? path.join(devCacheRoot, "vitest"),
  TMP: devTmpRoot,
  TEMP: devTmpRoot,
  ...(safeDevMode
    ? {
        DATABASE_URL: "",
        OBSERVATION_RUNTIME_DRIVER: "memory",
        OBSERVATION_QUEUE_ENABLED: "false",
        OBSERVATION_SCHEDULER_ENABLED: "false",
        REDIS_URL: "",
        TELEMETRY_ENABLED: "false",
      }
    : {}),
};

const command = process.platform === "win32" ? "npx tsx watch server/_core/index.ts" : "npx tsx watch server/_core/index.ts";

const child = spawn(command, {
  cwd: projectRoot,
  stdio: "inherit",
  env,
  shell: true,
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});

child.on("error", (error) => {
  console.error("[dev script] Falha ao iniciar:", error);
  process.exit(1);
});
