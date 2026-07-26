type EventHandler<T = unknown> = (event: InternalEvent<T>) => Promise<void> | void;

export type InternalEvent<T = unknown> = {
  type: string;
  emittedAt: string;
  source: string;
  payload: T;
};

class InternalEventBus {
  private handlers = new Map<string, Set<EventHandler>>();

  subscribe<T = unknown>(eventType: string, handler: EventHandler<T>) {
    const bucket = this.handlers.get(eventType) ?? new Set<EventHandler>();
    bucket.add(handler as EventHandler);
    this.handlers.set(eventType, bucket);

    return () => {
      bucket.delete(handler as EventHandler);
      if (bucket.size === 0) {
        this.handlers.delete(eventType);
      }
    };
  }

  async publish<T = unknown>(input: {
    type: string;
    source: string;
    payload: T;
  }) {
    const event: InternalEvent<T> = {
      type: input.type,
      source: input.source,
      payload: input.payload,
      emittedAt: new Date().toISOString(),
    };

    const directHandlers = this.handlers.get(input.type) ?? new Set<EventHandler>();
    const wildcardHandlers = this.handlers.get("*") ?? new Set<EventHandler>();

    for (const handler of [...directHandlers, ...wildcardHandlers]) {
      await handler(event);
    }

    return event;
  }
}

const globalEventBus = new InternalEventBus();

export function getInternalEventBus() {
  return globalEventBus;
}
