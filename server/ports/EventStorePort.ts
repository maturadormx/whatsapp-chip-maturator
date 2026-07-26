export interface EventEnvelope<T = unknown> {
  type: string;
  version?: number;
  occurredAt: string;
  payload: T;
}

export interface EventStorePort {
  append(stream: string, event: EventEnvelope, expectedVersion?: number): Promise<number>;
  get(stream: string): Promise<EventEnvelope[]>;
  clear?(): Promise<void> | void;
}
