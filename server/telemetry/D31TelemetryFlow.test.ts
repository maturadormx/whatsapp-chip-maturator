import { context, trace, TraceFlags } from "@opentelemetry/api";
import { describe, expect, it, vi } from "vitest";
import { BullMQAdapter } from "../infrastructure/queue/BullMQAdapter";
import { telemetry } from "./TelemetryService";

describe("D31TelemetryFlow", () => {
  it("injeta e extrai o traceparent via carrier", () => {
    const sourceContext = trace.setSpan(context.active(), {
      spanContext: () => ({
        traceId: "0123456789abcdef0123456789abcdef",
        spanId: "0123456789abcdef",
        traceFlags: TraceFlags.SAMPLED,
      }),
    } as any);

    const carrier = telemetry.injectContext(sourceContext);
    const extracted = telemetry.extractContext(carrier);
    const extractedSpan = trace.getSpan(extracted);

    expect(carrier.traceparent).toBe("00-0123456789abcdef0123456789abcdef-0123456789abcdef-01");
    expect(extractedSpan?.spanContext().traceId).toBe("0123456789abcdef0123456789abcdef");
    expect(extractedSpan?.spanContext().spanId).toBe("0123456789abcdef");
  });

  it("propaga o traceparent para o job publicado pelo BullMQAdapter", async () => {
    const queue = {
      add: vi.fn().mockResolvedValue(undefined),
      getJobCounts: vi.fn().mockResolvedValue({}),
      getJobs: vi.fn().mockResolvedValue([]),
      close: vi.fn(),
    };
    const dlq = {
      add: vi.fn().mockResolvedValue(undefined),
      getJobCounts: vi.fn().mockResolvedValue({}),
      getJobs: vi.fn().mockResolvedValue([]),
      close: vi.fn(),
    };
    const logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    const adapter = new BullMQAdapter("redis://localhost:6379", "observation", logger as any, {
      queue: queue as any,
      dlq: dlq as any,
      createWorker: vi.fn(),
    });

    const sourceContext = trace.setSpan(context.active(), {
      spanContext: () => ({
        traceId: "fedcba9876543210fedcba9876543210",
        spanId: "89abcdef01234567",
        traceFlags: TraceFlags.SAMPLED,
      }),
    } as any);

    await context.with(sourceContext, async () => {
      await adapter.publish({
        id: "job-trace-1",
        type: "PROCESS_PENDING_BATCH",
        payload: { batchSize: 1 },
        metadata: { source: "test" },
        createdAt: "2026-07-21T19:00:00.000Z",
      });
    });

    const publishedJob = queue.add.mock.calls[0]?.[1] as { metadata?: Record<string, any> };
    expect(publishedJob.metadata?.__otelContext?.traceparent).toMatch(
      /^00-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/i,
    );
  });
});
