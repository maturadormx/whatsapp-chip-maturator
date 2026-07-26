export interface Observation {
  id: string;
  source: string;
  eventType: string;
  payload: Record<string, unknown>;
  timestamp: string;
  correlationId?: string;
}

