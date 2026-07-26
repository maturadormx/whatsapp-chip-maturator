import { context, propagation, SpanStatusCode, TraceFlags, trace, type Context, type Span } from "@opentelemetry/api";

type TelemetryAttributes = Record<string, string | number | boolean>;
type TelemetryCarrier = Record<string, string>;
type WithSpanOptions = {
  attributes?: TelemetryAttributes;
  parentContext?: Context;
};

export class TelemetryService {
  private readonly tracer = trace.getTracer("whatsapp-chip-maturator");

  startSpan(name: string, attributes?: TelemetryAttributes, parentContext?: Context): Span {
    return this.tracer.startSpan(name, { attributes }, parentContext ?? context.active());
  }

  addEvent(span: Span, name: string, attributes?: TelemetryAttributes): void {
    span.addEvent(name, attributes);
  }

  setStatus(span: Span, code: SpanStatusCode, message?: string): void {
    span.setStatus({ code, message });
  }

  endSpan(span: Span): void {
    span.end();
  }

  injectContext(sourceContext?: Context): TelemetryCarrier {
    const carrier: TelemetryCarrier = {};
    const activeContext = sourceContext ?? context.active();
    propagation.inject(activeContext, carrier);

    if (!carrier.traceparent) {
      const activeSpan = trace.getSpan(activeContext);
      const spanContext = activeSpan?.spanContext();
      if (spanContext) {
        const flags = (spanContext.traceFlags ?? TraceFlags.NONE).toString(16).padStart(2, "0");
        carrier.traceparent = `00-${spanContext.traceId}-${spanContext.spanId}-${flags}`;
      }
    }

    return carrier;
  }

  extractContext(carrier?: Record<string, unknown> | null): Context {
    if (!carrier) return context.active();

    const normalized = Object.entries(carrier).reduce<TelemetryCarrier>((acc, [key, value]) => {
      if (typeof value === "string") {
        acc[key] = value;
      }
      return acc;
    }, {});

    const extracted = propagation.extract(context.active(), normalized);
    if (trace.getSpan(extracted) || !normalized.traceparent) {
      return extracted;
    }

    const match = /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/i.exec(normalized.traceparent);
    if (!match) return extracted;

    const [, traceId, spanId, flagsHex] = match;
    return trace.setSpan(
      context.active(),
      trace.wrapSpanContext({
        traceId,
        spanId,
        traceFlags: parseInt(flagsHex, 16) as TraceFlags,
        isRemote: true,
      }),
    );
  }

  async withSpan<T>(name: string, fn: (span: Span) => Promise<T>, options: WithSpanOptions = {}): Promise<T> {
    const parentContext = options.parentContext ?? context.active();
    const span = this.startSpan(name, options.attributes, parentContext);
    const activeContext = trace.setSpan(parentContext, span);

    return context.with(activeContext, async () => {
      try {
        const result = await fn(span);
        this.setStatus(span, SpanStatusCode.OK);
        return result;
      } catch (error) {
        this.setStatus(span, SpanStatusCode.ERROR, error instanceof Error ? error.message : String(error));
        throw error;
      } finally {
        this.endSpan(span);
      }
    });
  }
}

export const telemetry = new TelemetryService();
