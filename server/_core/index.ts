import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { ENV } from "./env";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic } from "./vite";
import { ensureMaturationHeartbeatJob, maturationHeartbeatHandler } from "../scheduled/maturationHeartbeat";
import { ensureMarketingHeartbeatJob, marketingHeartbeatHandler } from "../scheduled/marketingHeartbeat";
import { registerQueueMetricsRoute } from "../metrics/QueueMetricsRoute";
import {
  behaviorMemoryShadowHeartbeatHandler,
  ensureBehaviorMemoryShadowHeartbeatJob,
} from "../scheduled/behaviorMemoryShadowHeartbeat";
import {
  chipProjectionHeartbeatHandler,
  ensureChipProjectionHeartbeatJob,
} from "../scheduled/chipProjectionHeartbeat";
import { getChipById } from "../db";
import { registerInboundRoutes } from "../inbound";
import { createObservationRuntime } from "../runtime/observationRuntime";
import { getCertifiedChipPool } from "../services/maturatorOperational";
import { inspectBehaviorMemoryShadow } from "../services/behaviorMemoryShadowService";
import { renderRuntimeMetrics } from "../services/runtimeSupervisorService";
import { getChipHealth } from "../services/whatsappService";
import { createScheduledTaskRunnerService } from "../services/scheduledTaskRunnerService";
import { startNotificationCenter } from "../services/notifications/NotificationCenter";
import { runAutoRecoveryCycle } from "../services/recovery/AutoRecoveryService";
import { getDistributedPlatformRuntime } from "../services/distributed/DistributedPlatformRuntime";
import { sdk } from "./sdk";
import { startTracing } from "../telemetry";
import { initMetrics } from "../metrics";
import { createInternalMetricsRouter } from "../routes/internal/metrics";
import {
  dispatchWebhookTest,
  generateOpenApiDocument,
  generateSdkArtifact,
  listWebhookRegistrations,
  simulatePlannerViaPublicApi,
} from "../services/platform/PublicApiService";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  if (ENV.telemetryEnabled) {
    await startTracing();
  }
  initMetrics();
  const app = express();
  const observationRuntime = createObservationRuntime();
  const scheduledTaskRunner = createScheduledTaskRunnerService(ENV.scheduledTaskRunnerIntervalMs);
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  startNotificationCenter();
  registerInboundRoutes(app, { service: observationRuntime.inboundService });
  app.use("/internal", createInternalMetricsRouter(observationRuntime.queue));
  if (observationRuntime.queueEnabled && observationRuntime.workerManager) {
    await observationRuntime.workerManager.start();
  }
  if (ENV.observationSchedulerEnabled) {
    observationRuntime.scheduler.start();
  }
  if (ENV.scheduledTaskRunnerEnabled) {
    scheduledTaskRunner.start();
  }
  registerQueueMetricsRoute(app, observationRuntime.queue);
  app.get("/live", (_req, res) => {
    return res.status(200).json({
      ok: true,
      status: "live",
      pid: process.pid,
    });
  });
  app.get("/ready", async (_req, res) => {
    const status = await observationRuntime.checkReady();
    return res.status(status.ok ? 200 : 503).json(status);
  });
  app.get("/health", async (_req, res) => {
    const status = await observationRuntime.checkReady();
    return res.status(status.ok ? 200 : 503).json({
      ok: status.ok,
      status: status.ok ? "healthy" : "degraded",
      checks: status,
      timestamp: new Date().toISOString(),
    });
  });
  
  // Heartbeat endpoint para maturação automática
  app.post("/api/scheduled/maturation", maturationHeartbeatHandler);
  app.post("/api/scheduled/marketing", marketingHeartbeatHandler);
  app.post("/api/scheduled/behavior-memory-shadow", behaviorMemoryShadowHeartbeatHandler);
  app.post("/api/scheduled/chip-projection", chipProjectionHeartbeatHandler);

  app.get("/api/chips/:id/health", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      const chipId = Number(req.params.id);

      if (Number.isNaN(chipId) || chipId <= 0) {
        return res.status(400).json({ error: "invalid_chip_id" });
      }

      const chip = await getChipById(chipId);
      if (!chip || chip.userId !== user.id) {
        return res.status(404).json({ error: "chip_not_found" });
      }

      const health = await getChipHealth(chip.id, chip.userId, chip.phoneNumber);
      return res.json(health);
    } catch (error) {
      return res.status(401).json({
        error: "unauthorized",
        detail: String(error),
      });
    }
  });

  app.get("/certified-chips", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      const pool = await getCertifiedChipPool(user.id);
      return res.json(
        pool.map((chip) => ({
          chipId: chip.chipId,
          health: chip.health,
          human: chip.human,
          risk: chip.risk,
          usable: chip.usable,
        }))
      );
    } catch (error) {
      return res.status(401).json({
        error: "unauthorized",
        detail: String(error),
      });
    }
  });

  app.get("/api/debug/chips/:id/shadow", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      const chipId = Number(req.params.id);
      const windowHours = Number(req.query.windowHours ?? 48);

      if (Number.isNaN(chipId) || chipId <= 0) {
        return res.status(400).json({ error: "invalid_chip_id" });
      }

      const shadow = await inspectBehaviorMemoryShadow({
        userId: user.id,
        chipId,
        windowHours: Number.isFinite(windowHours) && windowHours > 0 ? windowHours : 48,
      });

      return res.json(shadow);
    } catch (error) {
      return res.status(401).json({
        error: "unauthorized_or_invalid_shadow_request",
        detail: String(error),
      });
    }
  });

  app.get("/api/runtime/metrics", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      const metrics = await renderRuntimeMetrics(user.id);
      res.setHeader("content-type", "text/plain; version=0.0.4; charset=utf-8");
      return res.send(metrics);
    } catch (error) {
      return res.status(401).json({
        error: "unauthorized",
        detail: String(error),
      });
    }
  });

  app.get("/api/public/openapi.json", (_req, res) => {
    return res.json(generateOpenApiDocument());
  });

  app.get("/api/public/sdk", (_req, res) => {
    return res.json(generateSdkArtifact());
  });

  app.get("/api/public/webhooks", async (req, res) => {
    try {
      await sdk.authenticateRequest(req);
      return res.json(await listWebhookRegistrations());
    } catch (error) {
      return res.status(401).json({
        error: "unauthorized",
        detail: String(error),
      });
    }
  });

  app.post("/api/public/planner/simulate", async (req, res) => {
    try {
      await sdk.authenticateRequest(req);
      const payload = simulatePlannerViaPublicApi(req.body as any);
      return res.json(payload);
    } catch (error) {
      return res.status(401).json({
        error: "unauthorized_or_invalid_payload",
        detail: String(error),
      });
    }
  });

  app.post("/api/public/webhooks/test", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      const key = String(req.body?.key ?? "");
      if (!key) {
        return res.status(400).json({ error: "missing_webhook_key" });
      }
      return res.json(
        await dispatchWebhookTest({
          key,
          userId: user.id,
        }),
      );
    } catch (error) {
      return res.status(401).json({
        error: "unauthorized_or_invalid_webhook",
        detail: String(error),
      });
    }
  });
  
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    const { setupVite } = await import("./viteDev");
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  
  // Log para confirmar que o endpoint está registrado
  console.log("[Heartbeat] Maturation endpoint registered at /api/scheduled/maturation");
  console.log("[Heartbeat] Marketing endpoint registered at /api/scheduled/marketing");
  console.log("[Heartbeat] Shadow endpoint registered at /api/scheduled/behavior-memory-shadow");
  console.log("[Heartbeat] Chip projection endpoint registered at /api/scheduled/chip-projection");
  await getDistributedPlatformRuntime().start().catch((error) => {
    console.warn("[Startup] Falha ao iniciar runtime distribuído:", error);
  });
  try {
    if (!process.env.DATABASE_URL) {
      console.warn("[Startup] Restauração de chips ignorada: DATABASE_URL ausente.");
    } else {
      await runAutoRecoveryCycle();
    }
  } catch (error) {
    console.warn("[Startup] Falha ao restaurar chips no boot:", error);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }
  
  await ensureMaturationHeartbeatJob("");
  await ensureMarketingHeartbeatJob("");
  await ensureBehaviorMemoryShadowHeartbeatJob("");
  await ensureChipProjectionHeartbeatJob("");

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });

  server.on("close", () => {
    scheduledTaskRunner.stop();
  });
}

startServer().catch(console.error);
