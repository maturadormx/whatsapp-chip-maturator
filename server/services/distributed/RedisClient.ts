import { ENV } from "../../_core/env";

let commandClient: any | null = null;
let subscriberClient: any | null = null;

async function createClient() {
  const url = ENV.redisUrl;

  if (!ENV.redisEnabled) {
    console.warn("[Redis] Redis desabilitado. REDIS_URL inválida:", url ?? "");
    return null;
  }

  const { default: IORedis } = await import("ioredis");
  const client = new IORedis(url, {
    maxRetriesPerRequest: 1,
    lazyConnect: true,
    enableOfflineQueue: false,
    retryStrategy: () => null,
    reconnectOnError: () => false,
  });
  client.on("error", (err: Error) => {
    console.warn("[Redis] Evento de erro:", err.message);
  });

  try {
    await client.connect();
  } catch (error) {
    console.warn("[Redis] Falha ao conectar. Redis desabilitado:", error);
    client.disconnect();
    return null;
  }

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
