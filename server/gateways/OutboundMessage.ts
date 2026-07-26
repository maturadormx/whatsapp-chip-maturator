export interface OutboundMessage {
  executionId: string;
  recipient: string;
  content: string;
  metadata?: Record<string, unknown>;
}
