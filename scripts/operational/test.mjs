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
const testCacheRoot = path.join(runtimeCacheRoot, "test");
const testTmpRoot = path.join(testCacheRoot, "tmp");

fs.mkdirSync(testTmpRoot, { recursive: true });

const env = {
  ...process.env,
  NODE_ENV: process.env.NODE_ENV ?? "test",
  VITEST_CACHE_DIR: process.env.VITEST_CACHE_DIR ?? path.join(testCacheRoot, "vitest"),
  VITE_CACHE_DIR: process.env.VITE_CACHE_DIR ?? path.join(testCacheRoot, "vite"),
  TMP: testTmpRoot,
  TEMP: testTmpRoot,
};

const child = spawn("npx vitest run", {
  cwd: projectRoot,
  env,
  stdio: "inherit",
  shell: true,
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});

child.on("error", (error) => {
  console.error("[test script] Falha ao iniciar:", error);
  process.exit(1);
});
