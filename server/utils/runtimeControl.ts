import fs from "node:fs";
import path from "node:path";

export type RuntimeFeatureFlags = {
  venomRuntime: boolean;
  shadowMode: boolean;
  adaptiveLearning: boolean;
  fleetLearning: boolean;
  replayInspector: boolean;
  alerting: boolean;
  metricsApi: boolean;
  adminConsole: boolean;
};

export type RuntimeSupervisorConfig = {
  autoRestoreSessions: boolean;
  autoStartPassiveEngine: boolean;
  autoEnsureHeartbeats: boolean;
  shadowWindowHours: number;
  schedulerLookaheadHours: number;
  maxRetryAttempts: number;
  retryBackoffSeconds: number;
  alertHealthThreshold: number;
  alertCoverageThreshold: number;
  alertIdentityDriftThreshold: number;
  alertSnapshotMaxAgeMinutes: number;
};

export type RuntimeControlState = {
  featureFlags: RuntimeFeatureFlags;
  supervisor: RuntimeSupervisorConfig;
  updatedAt: string;
};

const runtimeControlFilePath = path.resolve(process.cwd(), "server", "runtime-control.json");

const defaultRuntimeControlState: RuntimeControlState = {
  featureFlags: {
    venomRuntime: true,
    shadowMode: true,
    adaptiveLearning: true,
    fleetLearning: true,
    replayInspector: true,
    alerting: true,
    metricsApi: true,
    adminConsole: true,
  },
  supervisor: {
    autoRestoreSessions: true,
    autoStartPassiveEngine: true,
    autoEnsureHeartbeats: true,
    shadowWindowHours: 48,
    schedulerLookaheadHours: 24,
    maxRetryAttempts: 3,
    retryBackoffSeconds: 30,
    alertHealthThreshold: 60,
    alertCoverageThreshold: 55,
    alertIdentityDriftThreshold: 35,
    alertSnapshotMaxAgeMinutes: 120,
  },
  updatedAt: new Date(0).toISOString(),
};

let cachedRuntimeControlState: RuntimeControlState | null = null;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function sanitizeFeatureFlags(value?: Partial<RuntimeFeatureFlags> | null): RuntimeFeatureFlags {
  return {
    venomRuntime: value?.venomRuntime ?? defaultRuntimeControlState.featureFlags.venomRuntime,
    shadowMode: value?.shadowMode ?? defaultRuntimeControlState.featureFlags.shadowMode,
    adaptiveLearning: value?.adaptiveLearning ?? defaultRuntimeControlState.featureFlags.adaptiveLearning,
    fleetLearning: value?.fleetLearning ?? defaultRuntimeControlState.featureFlags.fleetLearning,
    replayInspector: value?.replayInspector ?? defaultRuntimeControlState.featureFlags.replayInspector,
    alerting: value?.alerting ?? defaultRuntimeControlState.featureFlags.alerting,
    metricsApi: value?.metricsApi ?? defaultRuntimeControlState.featureFlags.metricsApi,
    adminConsole: value?.adminConsole ?? defaultRuntimeControlState.featureFlags.adminConsole,
  };
}

function sanitizeSupervisor(value?: Partial<RuntimeSupervisorConfig> | null): RuntimeSupervisorConfig {
  return {
    autoRestoreSessions: value?.autoRestoreSessions ?? defaultRuntimeControlState.supervisor.autoRestoreSessions,
    autoStartPassiveEngine: value?.autoStartPassiveEngine ?? defaultRuntimeControlState.supervisor.autoStartPassiveEngine,
    autoEnsureHeartbeats: value?.autoEnsureHeartbeats ?? defaultRuntimeControlState.supervisor.autoEnsureHeartbeats,
    shadowWindowHours: clamp(Math.floor(value?.shadowWindowHours ?? defaultRuntimeControlState.supervisor.shadowWindowHours), 1, 168),
    schedulerLookaheadHours: clamp(
      Math.floor(value?.schedulerLookaheadHours ?? defaultRuntimeControlState.supervisor.schedulerLookaheadHours),
      1,
      168
    ),
    maxRetryAttempts: clamp(Math.floor(value?.maxRetryAttempts ?? defaultRuntimeControlState.supervisor.maxRetryAttempts), 0, 10),
    retryBackoffSeconds: clamp(
      Math.floor(value?.retryBackoffSeconds ?? defaultRuntimeControlState.supervisor.retryBackoffSeconds),
      5,
      3600
    ),
    alertHealthThreshold: clamp(
      Math.floor(value?.alertHealthThreshold ?? defaultRuntimeControlState.supervisor.alertHealthThreshold),
      0,
      100
    ),
    alertCoverageThreshold: clamp(
      Math.floor(value?.alertCoverageThreshold ?? defaultRuntimeControlState.supervisor.alertCoverageThreshold),
      0,
      100
    ),
    alertIdentityDriftThreshold: clamp(
      Math.floor(value?.alertIdentityDriftThreshold ?? defaultRuntimeControlState.supervisor.alertIdentityDriftThreshold),
      0,
      100
    ),
    alertSnapshotMaxAgeMinutes: clamp(
      Math.floor(value?.alertSnapshotMaxAgeMinutes ?? defaultRuntimeControlState.supervisor.alertSnapshotMaxAgeMinutes),
      5,
      24 * 60
    ),
  };
}

function sanitizeRuntimeControlState(value?: Partial<RuntimeControlState> | null): RuntimeControlState {
  return {
    featureFlags: sanitizeFeatureFlags(value?.featureFlags),
    supervisor: sanitizeSupervisor(value?.supervisor),
    updatedAt: value?.updatedAt ?? new Date().toISOString(),
  };
}

export function getRuntimeControlState() {
  if (cachedRuntimeControlState) return cachedRuntimeControlState;

  try {
    if (fs.existsSync(runtimeControlFilePath)) {
      const parsed = JSON.parse(fs.readFileSync(runtimeControlFilePath, "utf-8")) as Partial<RuntimeControlState>;
      cachedRuntimeControlState = sanitizeRuntimeControlState(parsed);
      return cachedRuntimeControlState;
    }
  } catch (error) {
    console.error("[RuntimeControl] Falha ao ler configuração de runtime, usando default.", error);
  }

  cachedRuntimeControlState = sanitizeRuntimeControlState(defaultRuntimeControlState);
  return cachedRuntimeControlState;
}

function persistRuntimeControlState(nextState: RuntimeControlState) {
  fs.writeFileSync(runtimeControlFilePath, JSON.stringify(nextState, null, 2), "utf-8");
  cachedRuntimeControlState = nextState;
  return nextState;
}

export function updateRuntimeFeatureFlags(nextFlags: Partial<RuntimeFeatureFlags>) {
  const current = getRuntimeControlState();
  return persistRuntimeControlState({
    ...current,
    featureFlags: sanitizeFeatureFlags({
      ...current.featureFlags,
      ...nextFlags,
    }),
    updatedAt: new Date().toISOString(),
  });
}

export function updateRuntimeSupervisorConfig(nextSupervisor: Partial<RuntimeSupervisorConfig>) {
  const current = getRuntimeControlState();
  return persistRuntimeControlState({
    ...current,
    supervisor: sanitizeSupervisor({
      ...current.supervisor,
      ...nextSupervisor,
    }),
    updatedAt: new Date().toISOString(),
  });
}
