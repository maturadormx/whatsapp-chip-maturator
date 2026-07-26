import { notifyOwner } from "../../_core/notification";
import { recordAuditEvent } from "../audit/AuditEngine";
import { getConfigurationCenter } from "../config/ConfigurationCenter";
import { getInternalEventBus, type InternalEvent } from "../events/InternalEventBus";
import { CircuitBreaker } from "../hardening/CircuitBreaker";
import { TokenBucketRateLimiter } from "../hardening/RateLimiter";
import { withRetry } from "../hardening/RetryPolicy";

type NotificationChannel = "owner" | "webhook" | "telegram" | "discord" | "email";

const limiter = new TokenBucketRateLimiter({
  capacity: 10,
  refillPerSecond: 1,
});

const breaker = new CircuitBreaker({
  failureThreshold: 3,
  resetTimeoutMs: 60_000,
});

async function postJson(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`notification_http_${response.status}`);
  }
}

async function dispatchToChannel(channel: NotificationChannel, title: string, content: string) {
  const config = getConfigurationCenter();

  if (channel === "owner" || channel === "email") {
    return notifyOwner({ title, content });
  }

  const key =
    channel === "webhook"
      ? "notifications.webhook_url"
      : channel === "telegram"
        ? "notifications.telegram_webhook_url"
        : "notifications.discord_webhook_url";
  const url = await config.get<string | null>(key, null);
  if (!url) {
    return false;
  }

  await postJson(url, {
    title,
    content,
  });
  return true;
}

export async function sendOperationalNotification(input: {
  title: string;
  content: string;
  channels?: NotificationChannel[];
  severity?: "info" | "warning" | "critical";
}) {
  if (!limiter.allow()) {
    return { delivered: false, reason: "rate_limited" as const };
  }

  const channels =
    input.channels ??
    (await getConfigurationCenter().get<NotificationChannel[]>("notifications.default_channels", [
      "owner",
      "webhook",
    ]));

  const delivery = await breaker.execute(async () =>
    withRetry({
      attempts: 2,
      backoffMs: 750,
      operation: async () => {
        const results = await Promise.allSettled(
          channels.map((channel) => dispatchToChannel(channel, input.title, input.content)),
        );
        const delivered = results.some(
          (result) => result.status === "fulfilled" && result.value === true,
        );
        await recordAuditEvent({
          engine: "NotificationCenter",
          action: "notification_dispatched",
          result: delivered ? "success" : "failed",
          payload: {
            channels,
            severity: input.severity ?? "info",
            results: results.map((result) =>
              result.status === "fulfilled"
                ? { status: "fulfilled", value: result.value }
                : { status: "rejected", reason: String(result.reason) },
            ),
          },
        }).catch(() => null);
        return delivered;
      },
    }),
  );

  return {
    delivered: delivery,
    channels,
  };
}

function formatEventContent(event: InternalEvent<any>) {
  return JSON.stringify(event.payload, null, 2).slice(0, 5000);
}

let notificationCenterStarted = false;

export function startNotificationCenter() {
  if (notificationCenterStarted) return;
  notificationCenterStarted = true;

  const bus = getInternalEventBus();
  const subscribe = (eventType: string, severity: "info" | "warning" | "critical") => {
    bus.subscribe(eventType, async (event) => {
      await sendOperationalNotification({
        title: `[${severity.toUpperCase()}] ${event.type}`,
        content: formatEventContent(event),
        severity,
      }).catch(() => null);
    });
  };

  subscribe("worker.batch_failed", "warning");
  subscribe("runtime.alert", "critical");
  subscribe("auto_recovery.failed", "critical");
  subscribe("scheduled_task.failed", "warning");
}
