import { ConsoleSpanExporter, SimpleSpanProcessor, type SpanExporter } from "@opentelemetry/sdk-trace-base";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { NodeSDK } from "@opentelemetry/sdk-node";

type StartTracingOptions = {
  exporter?: SpanExporter;
  autoInstrumentations?: boolean;
};

let sdk: NodeSDK | null = null;

export async function startTracing(options: StartTracingOptions = {}): Promise<void> {
  if (sdk) return;

  sdk = new NodeSDK({
    spanProcessors: [new SimpleSpanProcessor(options.exporter ?? new ConsoleSpanExporter())],
    instrumentations: options.autoInstrumentations === false ? [] : [getNodeAutoInstrumentations()],
  });

  await Promise.resolve(sdk.start());
  console.log("[Telemetry] Tracing iniciado");
}

export async function shutdownTracing(): Promise<void> {
  if (!sdk) return;
  const activeSdk = sdk;
  sdk = null;
  await Promise.resolve(activeSdk.shutdown());
}

export function isTracingStarted(): boolean {
  return sdk !== null;
}
