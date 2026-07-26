import { ENV } from "../../_core/env";
import { recordAuditEvent } from "../audit/AuditEngine";
import { getInternalEventBus, type InternalEvent } from "../events/InternalEventBus";
import { getRedisCommandClient, getRedisSubscriberClient } from "./RedisClient";

type DistributedEnvelope = {
  nodeId: string;
  event: InternalEvent;
};

class RedisPubSubEventBus {
  private started = false;

  async start() {
    if (this.started || !ENV.redisUrl) return;
    this.started = true;

    const subscriber = await getRedisSubscriberClient();
    if (!subscriber) return;

    await subscriber.subscribe(ENV.redisEventBusChannel);
    subscriber.on("message", async (channel: string, message: string) => {
      if (channel !== ENV.redisEventBusChannel) return;
      const parsed = JSON.parse(message) as DistributedEnvelope;
      if (parsed.nodeId === ENV.clusterNodeId) return;
      await getInternalEventBus().publish({
        type: parsed.event.type,
        source: `redis:${parsed.event.source}`,
        payload: parsed.event.payload,
      }).catch(() => null);
    });

    getInternalEventBus().subscribe("*", async (event) => {
      if (event.source.startsWith("redis:")) return;
      const client = await getRedisCommandClient();
      if (!client) return;
      await client.publish(
        ENV.redisEventBusChannel,
        JSON.stringify({
          nodeId: ENV.clusterNodeId,
          event,
        } satisfies DistributedEnvelope),
      );
    });

    await recordAuditEvent({
      engine: "RedisPubSubEventBus",
      action: "started",
      payload: {
        channel: ENV.redisEventBusChannel,
        nodeId: ENV.clusterNodeId,
      },
    }).catch(() => null);
  }
}

const globalRedisPubSubEventBus = new RedisPubSubEventBus();

export function getRedisPubSubEventBus() {
  return globalRedisPubSubEventBus;
}
