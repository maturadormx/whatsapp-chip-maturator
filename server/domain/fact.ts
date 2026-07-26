export interface Fact {
  id: string;
  observationId: string;
  type: string;
  data: Record<string, unknown>;
  timestamp: string;
}

