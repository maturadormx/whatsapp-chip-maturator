export type OptimizationRecommendation = {
  key: string;
  title: string;
  summary: string;
  impact: "low" | "medium" | "high";
  suggestedConfigKey?: string;
  suggestedValue?: unknown;
};

export type ExperimentDefinition = {
  key: string;
  name: string;
  description?: string | null;
  strategyA: string;
  strategyB: string;
  enabled: boolean;
  autoPromoteWinner: boolean;
  cohortChipIds?: number[];
  metric: "ack_rate" | "failure_rate" | "decision_confidence";
  updatedAt: string;
};

export type PluginManifest = {
  key: string;
  name: string;
  version: string;
  description?: string | null;
  hooks: string[];
  apiVersion: string;
  enabled: boolean;
  config?: Record<string, unknown>;
  updatedAt: string;
};

export type RuleDesignerDocument = {
  name: string;
  version: string;
  workflows: unknown[];
  policies: unknown[];
  canvas?: {
    nodes: Array<Record<string, unknown>>;
    edges: Array<Record<string, unknown>>;
  };
  exportedAt: string;
};

export type WebhookRegistration = {
  key: string;
  url: string;
  eventTypes: string[];
  enabled: boolean;
  secretName?: string | null;
  updatedAt: string;
};

export type OpenApiDocument = {
  openapi: "3.1.0";
  info: {
    title: string;
    version: string;
    description: string;
  };
  paths: Record<string, unknown>;
  components: {
    schemas: Record<string, unknown>;
  };
};
