import {
  DEFAULT_BEHAVIOR_MEMORY_RETENTION_POLICY,
  SNAPSHOT_SCHEMA_VERSION,
  getBehaviorMemoryContext,
  storeBehaviorMemorySnapshot,
} from "../services/behaviorMemoryService";
import { buildBehaviorEpisodes, EPISODE_BUILDER_VERSION } from "../services/episodeBuilderService";
import { catalogEvidenceBatch, EVIDENCE_CATALOG_VERSION } from "../services/evidenceCatalogService";
import { EVIDENCE_NORMALIZER_VERSION, normalizeBehaviorBatch } from "../services/evidenceNormalizerService";
import { buildBehaviorPlan, simulateBehaviorPlan } from "../services/behaviorPlannerService";
import { generateIdentitySnapshot } from "../services/identitySnapshotGeneratorService";
import {
  PlatformContractEnvelope,
  createContractEnvelope,
  type DecisionContext,
} from "./platform-contracts";

function buildWarnings(messages: string[]) {
  return messages.map((message) => ({
    code: message.toLowerCase().replace(/\s+/g, "_"),
    message,
    severity: "warn" as const,
  }));
}

export const EvidenceLayerPublicApi = {
  normalize(input: Parameters<typeof normalizeBehaviorBatch>[0]) {
    const payload = normalizeBehaviorBatch(input);
    return createContractEnvelope({
      version: EVIDENCE_NORMALIZER_VERSION,
      confidence: payload.length ? Number((payload.reduce((sum, item) => sum + item.confidence, 0) / payload.length).toFixed(2)) : null,
      quality: null,
      warnings: payload.length === 0 ? buildWarnings(["normalize recebeu lote vazio"]) : [],
      metadata: {
        layer: "evidence",
        operation: "normalize",
        schemaVersion: 1,
        sourceKind: "observed",
        tags: ["public-api"],
      },
      payload,
    });
  },

  catalog(input: Parameters<typeof catalogEvidenceBatch>[0]) {
    const payload = catalogEvidenceBatch(input);
    return createContractEnvelope({
      version: EVIDENCE_CATALOG_VERSION,
      confidence: payload.length ? Number((payload.reduce((sum, item) => sum + item.confidence, 0) / payload.length).toFixed(2)) : null,
      quality: null,
      warnings: payload.length === 0 ? buildWarnings(["catalog recebeu lote vazio"]) : [],
      metadata: {
        layer: "evidence",
        operation: "catalog",
        schemaVersion: 1,
        sourceKind: "inferred",
        tags: ["public-api"],
      },
      payload,
    });
  },

  buildEpisodes(input: Parameters<typeof buildBehaviorEpisodes>[0]) {
    const payload = buildBehaviorEpisodes(input);
    return createContractEnvelope({
      version: EPISODE_BUILDER_VERSION,
      confidence: payload.length ? Number((payload.reduce((sum, item) => sum + item.confidence, 0) / payload.length).toFixed(2)) : null,
      quality: null,
      warnings: payload.length === 0 ? buildWarnings(["buildEpisodes não encontrou evidência suficiente"]) : [],
      metadata: {
        layer: "evidence",
        operation: "buildEpisodes",
        schemaVersion: 1,
        sourceKind: "inferred",
        tags: ["public-api"],
      },
      payload,
    });
  },
};

export const BehaviorMemoryLayerPublicApi = {
  async storeSnapshot(input: Parameters<typeof storeBehaviorMemorySnapshot>[0]) {
    const payload = await storeBehaviorMemorySnapshot({
      ...input,
      snapshotSchemaVersion: input.snapshotSchemaVersion ?? SNAPSHOT_SCHEMA_VERSION,
      dataRetentionPolicy: input.dataRetentionPolicy ?? DEFAULT_BEHAVIOR_MEMORY_RETENTION_POLICY,
    });

    return createContractEnvelope({
      version: SNAPSHOT_SCHEMA_VERSION,
      confidence: input.averageConfidence ?? null,
      quality: input.pipelineHealth?.score ?? null,
      warnings: payload == null ? buildWarnings(["storeSnapshot não persistiu resultado"]) : [],
      metadata: {
        layer: "behavior-memory",
        operation: "storeSnapshot",
        schemaVersion: SNAPSHOT_SCHEMA_VERSION,
        sourceKind: "inferred",
        tags: ["public-api"],
      },
      payload,
    });
  },

  async getLatestSnapshot(userId: number, chipId: number) {
    const payload = await getBehaviorMemoryContext(userId, chipId);
    return createContractEnvelope({
      version: payload.snapshotSchemaVersion ?? SNAPSHOT_SCHEMA_VERSION,
      confidence: payload.averageConfidence ?? payload.identitySnapshot?.confidence ?? null,
      quality: payload.pipelineHealth?.score ?? null,
      warnings: payload.source === "empty" ? buildWarnings(["nenhum snapshot disponível para o chip"]) : [],
      metadata: {
        layer: "behavior-memory",
        operation: "getLatestSnapshot",
        schemaVersion: payload.snapshotSchemaVersion ?? SNAPSHOT_SCHEMA_VERSION,
        sourceKind: "inferred",
        tags: ["public-api"],
      },
      payload,
    });
  },
};

export const IdentityLayerPublicApi = {
  generateSnapshot(input: Parameters<typeof generateIdentitySnapshot>[0]) {
    const payload = generateIdentitySnapshot(input);
    return createContractEnvelope({
      version: payload.pipelineVersions?.memoryVersion ?? SNAPSHOT_SCHEMA_VERSION,
      confidence: payload.confidence,
      quality: payload.stability,
      warnings: payload.gating.readyForStrategy ? [] : buildWarnings(["snapshot de identidade ainda não atingiu gating para strategy"]),
      metadata: {
        layer: "identity",
        operation: "generateSnapshot",
        schemaVersion: SNAPSHOT_SCHEMA_VERSION,
        sourceKind: "inferred",
        tags: ["public-api"],
      },
      payload,
    });
  },
};

export const PlannerLayerPublicApi = {
  plan(input: Parameters<typeof buildBehaviorPlan>[0]) {
    const payload = buildBehaviorPlan(input);
    return createContractEnvelope({
      version: 1,
      confidence: payload.confidenceAssessment.confidence,
      quality: 1 - payload.risk.overallRisk,
      warnings: payload.simulation.blockedBy.map((block) => ({
        code: block,
        message: `plano bloqueado por ${block}`,
        severity: "warn" as const,
      })),
      metadata: {
        layer: "planner",
        operation: "plan",
        schemaVersion: 1,
        sourceKind: "inferred",
        tags: ["public-api"],
      },
      payload,
    });
  },

  simulate(input: Parameters<typeof simulateBehaviorPlan>[0]) {
    const payload = simulateBehaviorPlan(input);
    return createContractEnvelope({
      version: 1,
      confidence: payload.confidenceAssessment.confidence,
      quality: 1 - payload.risk.overallRisk,
      warnings: payload.simulation.blockedBy.map((block) => ({
        code: block,
        message: `simulação bloqueada por ${block}`,
        severity: "warn" as const,
      })),
      metadata: {
        layer: "planner",
        operation: "simulate",
        schemaVersion: 1,
        sourceKind: "inferred",
        tags: ["public-api", "simulation"],
      },
      payload,
    });
  },
};

export type LearningLayerPublicContract = {
  evaluateHypotheses(context: DecisionContext): Promise<PlatformContractEnvelope<unknown>>;
  promoteKnowledge(context: DecisionContext): Promise<PlatformContractEnvelope<unknown>>;
};

export type StrategyLayerPublicContract = {
  generateStrategy(context: DecisionContext): Promise<PlatformContractEnvelope<unknown>>;
};

export type ExecutorLayerPublicContract = {
  execute(context: DecisionContext): Promise<PlatformContractEnvelope<unknown>>;
  simulate(context: DecisionContext): Promise<PlatformContractEnvelope<unknown>>;
};
