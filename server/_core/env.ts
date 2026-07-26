import "dotenv/config";

export const ENV = {
  get appId() {
    return process.env.VITE_APP_ID ?? "";
  },
  get cookieSecret() {
    return process.env.JWT_SECRET ?? "";
  },
  get databaseUrl() {
    return process.env.DATABASE_URL ?? "";
  },
  get observationRuntimeDriver() {
    return process.env.OBSERVATION_RUNTIME_DRIVER ?? "memory";
  },
  get observationSchedulerEnabled() {
    return process.env.OBSERVATION_SCHEDULER_ENABLED === "true";
  },
  get observationSchedulerIntervalMs() {
    return parseInt(process.env.OBSERVATION_SCHEDULER_INTERVAL_MS ?? "300000");
  },
  get observationSchedulerBatchSize() {
    return parseInt(process.env.OBSERVATION_SCHEDULER_BATCH_SIZE ?? "25");
  },
  get observationQueueEnabled() {
    return process.env.OBSERVATION_QUEUE_ENABLED === "true";
  },
  get redisUrl() {
    return process.env.REDIS_URL ?? "";
  },
  get observationQueueName() {
    return process.env.OBSERVATION_QUEUE_NAME ?? "observation-runtime";
  },
  get observationQueueAttempts() {
    return parseInt(process.env.OBSERVATION_QUEUE_ATTEMPTS ?? "5");
  },
  get observationQueueBackoffMs() {
    return parseInt(process.env.OBSERVATION_QUEUE_BACKOFF_MS ?? "2000");
  },
  get observationWorkerCount() {
    return parseInt(process.env.OBSERVATION_WORKER_COUNT ?? "1");
  },
  get observationWorkerHeartbeatMs() {
    return parseInt(process.env.OBSERVATION_WORKER_HEARTBEAT_MS ?? "30000");
  },
  get clusterNodeId() {
    return process.env.CLUSTER_NODE_ID ?? `${process.env.COMPUTERNAME ?? "node"}:${process.pid}`;
  },
  get clusterNodeRole() {
    return process.env.CLUSTER_NODE_ROLE ?? "worker";
  },
  get clusterHeartbeatMs() {
    return parseInt(process.env.CLUSTER_HEARTBEAT_MS ?? "15000");
  },
  get leaderLeaseMs() {
    return parseInt(process.env.LEADER_LEASE_MS ?? "30000");
  },
  get redisEventBusChannel() {
    return process.env.REDIS_EVENT_BUS_CHANNEL ?? "maturator:cluster:events";
  },
  get distributedRuntimeEnabled() {
    return process.env.DISTRIBUTED_RUNTIME_ENABLED !== "false";
  },
  get globalHealthIntervalMs() {
    return parseInt(process.env.GLOBAL_HEALTH_INTERVAL_MS ?? "30000");
  },
  get scheduledTaskRunnerEnabled() {
    return process.env.SCHEDULED_TASK_RUNNER_ENABLED === "true";
  },
  get scheduledTaskRunnerIntervalMs() {
    return parseInt(process.env.SCHEDULED_TASK_RUNNER_INTERVAL_MS ?? "10000");
  },
  get runtimeDebugLogsEnabled() {
    return process.env.RUNTIME_DEBUG_LOGS === "true";
  },
  get telemetryEnabled() {
    return process.env.TELEMETRY_ENABLED === "true";
  },
  get oAuthServerUrl() {
    return process.env.OAUTH_SERVER_URL ?? "";
  },
  get ownerOpenId() {
    return process.env.OWNER_OPEN_ID ?? "";
  },
  get localAuthEnabled() {
    return process.env.LOCAL_AUTH_ENABLED === "true";
  },
  get localAuthOpenId() {
    return process.env.LOCAL_AUTH_OPEN_ID ?? "local-admin";
  },
  get localAuthName() {
    return process.env.LOCAL_AUTH_NAME ?? "Administrador Local";
  },
  get isProduction() {
    return process.env.NODE_ENV === "production";
  },
  get forgeApiUrl() {
    return process.env.BUILT_IN_FORGE_API_URL ?? "";
  },
  get forgeApiKey() {
    return process.env.BUILT_IN_FORGE_API_KEY ?? "";
  },
  get secretsMasterKey() {
    return process.env.SECRETS_MASTER_KEY ?? "";
  },
};
