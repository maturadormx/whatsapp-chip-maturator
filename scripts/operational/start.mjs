import { spawn } from "node:child_process";
import { runDatabaseBootstrap } from "./bootstrap-db.mjs";

const env = {
  ...process.env,
  NODE_ENV: "production",
};

const command =
  process.platform === "win32"
    ? "node dist/index.js"
    : "node dist/index.js";

async function main() {
  try {
    await runDatabaseBootstrap();
  } catch (error) {
    console.error("[start script] Falha ao preparar banco:", error);
    process.exit(1);
  }

  const child = spawn(command, {
    stdio: "inherit",
    env,
    shell: true,
  });

  child.on("exit", (code) => {
    process.exit(code ?? 0);
  });

  child.on("error", (error) => {
    console.error("[start script] Falha ao iniciar:", error);
    process.exit(1);
  });
}

main();
