import type { Observation } from "../domain/observation";

/**
 * Porta neutra: recebe uma Observation e executa o pipeline interno.
 * O Inbound (HTTP) deve depender apenas desta porta.
 *
 * Garantias:
 * 1. Observation é persistida antes de qualquer transformação.
 * 2. Fact só existe se a persistência tiver sucesso.
 * 3. Não existem efeitos colaterais antes do save().
 * 4. Em caso de falha no save(), o erro é propagado ao chamador.
 */
export interface ObservationPipelinePort {
  process(observation: Observation): Promise<void>;
}
