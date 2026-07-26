import { spawn } from "node:child_process";

const env = {
  ...process.env,
  NODE_ENV: "production",
};

const command =
  process.platform === "win32"
    ? "node dist/index.js"
    : "node dist/index.js";

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
