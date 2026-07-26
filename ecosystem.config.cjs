module.exports = {
  apps: [
    {
      name: "whatsapp-chip-maturator",
      cwd: __dirname,
      script: "dist/index.js",
      interpreter: "node",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "700M",
      kill_timeout: 10000,
      listen_timeout: 10000,
      max_restarts: 10,
      min_uptime: "30s",
      time: true,
      merge_logs: true,
      out_file: "./logs/pm2-out.log",
      error_file: "./logs/pm2-error.log",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      env_file: ".env.production",
    },
  ],
};
