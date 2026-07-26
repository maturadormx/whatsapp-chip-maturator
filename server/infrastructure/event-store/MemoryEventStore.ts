import type { EventEnvelope, EventStorePort } from "../../ports/EventStorePort";

export class MemoryEventStore implements EventStorePort {
  private readonly store = new Map<string, EventEnvelope[]>();

  async append(stream: string, event: EventEnvelope, expectedVersion?: number): Promise<number> {
    const current = this.store.get(stream) ?? [];
    if (expectedVersion !== undefined && current.length !== expectedVersion) {
      throw new Error(`event_store_version_conflict:${stream}:${expectedVersion}:${current.length}`);
    }
    const version = current.length + 1;
    current.push({
      ...event,
      version,
    });
    this.store.set(stream, current);
    return version;
  }

  async get(stream: string): Promise<EventEnvelope[]> {
    return [...(this.store.get(stream) ?? [])];
  }

  clear(): void {
    this.store.clear();
  }
}
