import { randomUUID } from "crypto";
import type { Observation } from "../domain/observation";
import type { InboundEventDto } from "./dto/InboundEventDto";

export class ObservationFactory {
  static create(dto: InboundEventDto): Observation {
    return {
      id: randomUUID(),
      source: dto.source,
      eventType: dto.eventType || "generic.event",
      payload: dto.payload ?? {},
      timestamp: dto.timestamp ?? new Date().toISOString(),
      correlationId: dto.correlationId,
    };
  }
}

