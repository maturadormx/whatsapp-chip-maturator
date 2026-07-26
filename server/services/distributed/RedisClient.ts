import { ENV } from "../../_core/env";

let commandClient: any | null = null;
let subscriberClient: any | null = null;

async function createClient() {
  if (!ENV.redisUrl) return null;
  const { default: IORedis } = await import("ioredis");
  const client = new IORedis(ENV.redisUrl, {
    maxRetriesPerRequest: 1,
    lazyConnect: true,
  });
  await client.connect().catch(() => null);
  return client;
}

export async function getRedisCommandClient() {
  if (commandClient) return commandClient;
  commandClient = await createClient();
  return commandClient;
}

export async function getRedisSubscriberClient() {
  if (subscriberClient) return subscriberClient;
  subscriberClient = await createClient();
  return subscriberClient;
}
