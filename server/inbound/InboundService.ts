import type { InboundEventDto } from "./dto/InboundEventDto";
import type { ObservationPipelinePort } from "../ports/ObservationPipelinePort";
import type { Observation } from "../domain/observation";
import { ObservationFactory } from "./ObservationFactory";

export type InboundAcceptedResult = {
  status: "accepted";
  id: string;
};

/**
 * Placeholder do módulo Inbound.
 * Nesta task ele apenas aceita e normaliza a entrada HTTP sem regra de negócio.
 */
export class InboundService {
  constructor(private readonly pipeline: ObservationPipelinePort) {}

  async processEvent(event: InboundEventDto): Promise<InboundAcceptedResult> {
    const observation = ObservationFactory.create(event);
    await this.pipeline.process(observation);
    return {
      status: "accepted",
      id: observation.id,
    };
  }
}
