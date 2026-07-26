import { z } from "zod";

export const inboundEventSchema = z.object({
  source: z.string().trim().min(1),
  eventType: z.string().trim().min(1).optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
  correlationId: z.string().trim().min(1).optional(),
  timestamp: z.string().trim().min(1).optional(),
});

export type InboundEventDto = z.infer<typeof inboundEventSchema>;
