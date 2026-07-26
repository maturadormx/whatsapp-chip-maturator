import type { IdentitySnapshot } from "../services/behaviorMemoryService";
import type { OperationalStateSnapshot } from "../services/maturatorOperational";
import type { OpportunitySignal, PlannerRiskAssessment } from "../services/behaviorPlannerService";

export type PlatformContractWarning = {
  code: string;
  message: string;
  severity: "info" | "warn" | "critical";
};

export type PlatformContractMetadata = {
  layer: string;
  operation: string;
  schemaVersion: number;
  sourceKind: "observed" | "inferred" | "mixed";
  tags?: string[];
  extra?: Record<string, unknown>;
};

export type PlatformContractEnvelope<TPayload, TQuality = number | null> = {
  version: number;
  generatedAt: string;
  confidence: number | null;
  quality: TQuality;
  warnings: PlatformContractWarning[];
  metadata: PlatformContractMetadata;
  payload: TPayload;
};

export type ObservedStateNamespace = "sessions" | "activity_logs" | "behavior_timeline";
export type InferredStateNamespace = "episodes" | "identity" | "knowledge" | "strategy" | "risk";
export type EvidenceProvider = "whatsapp" | "contacts" | "calendar" | "agenda" | "crm" | "social" | (string & {});

export type ObservedStateReference = {
  namespace: ObservedStateNamespace;
  provider: EvidenceProvider;
  referenceId?: string | number;
};

export type InferredStateReference = {
  namespace: InferredStateNamespace;
  referenceId?: string | number;
  derivedFrom?: ObservedStateReference[];
};

export type DecisionConstraint = {
  code: string;
  description: string;
  severity: "soft" | "hard";
};

export type DecisionContext = {
  identitySnapshot: IdentitySnapshot | null;
  behaviorMemory: unknown;
  knowledge: unknown[];
  riskSnapshot: PlannerRiskAssessment | null;
  operationalSnapshot: OperationalStateSnapshot | null;
  opportunities: OpportunitySignal[];
  constraints: DecisionConstraint[];
  metadata?: Record<string, unknown>;
};

export type PlatformHealthSnapshot = {
  pipelineHealth: number | null;
  identityHealth: number | null;
  learningHealth: number | null;
  knowledgeHealth: number | null;
  strategyHealth: number | null;
};

export function createContractEnvelope<TPayload, TQuality = number | null>(params: {
  version: number;
  confidence: number | null;
  quality: TQuality;
  warnings?: PlatformContractWarning[];
  metadata: PlatformContractMetadata;
  payload: TPayload;
}): PlatformContractEnvelope<TPayload, TQuality> {
  return {
    version: params.version,
    generatedAt: new Date().toISOString(),
    confidence: params.confidence,
    quality: params.quality,
    warnings: params.warnings ?? [],
    metadata: params.metadata,
    payload: params.payload,
  };
}
