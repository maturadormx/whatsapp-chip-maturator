import type { Express, Request, Response } from "express";
import { InboundService } from "./InboundService";
import { inboundEventSchema } from "./dto/InboundEventDto";
import { ObservationPipeline } from "../application/observation/ObservationPipeline";

export type InboundRouterDeps = {
  service?: InboundService;
};

export function registerInboundRoutes(app: Express, deps: InboundRouterDeps = {}) {
  const service = deps.service ?? new InboundService(new ObservationPipeline());

  app.post("/api/inbound/events", async (req: Request, res: Response) => {
    const parsed = inboundEventSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: "invalid_inbound_event",
        issues: parsed.error.flatten(),
      });
    }

    try {
      const result = await service.processEvent(parsed.data);
      return res.status(202).json(result);
    } catch (error) {
      return res.status(500).json({
        error: "inbound_processing_failed",
        message: error instanceof Error ? error.message : "unknown_error",
      });
    }
  });
}
