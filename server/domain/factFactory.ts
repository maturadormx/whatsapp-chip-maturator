import { randomUUID } from "crypto";
import type { Fact } from "./fact";
import type { Observation } from "./observation";

export class FactFactory {
  static create(observation: Observation): Fact {
    return {
      id: randomUUID(),
      observationId: observation.id,
      type: observation.eventType,
      data: observation.payload,
      timestamp: observation.timestamp,
    };
  }
}

