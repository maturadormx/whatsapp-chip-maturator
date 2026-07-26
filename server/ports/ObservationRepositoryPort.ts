import type { Observation } from "../domain/observation";

/**
 * Persistência mínima de Observation.
 * Observation é o registro canônico da entrada e deve ser persistida antes de qualquer transformação.
 */
export interface ObservationRepositoryPort {
  save(observation: Observation): Promise<void>;
  findById(id: string): Promise<Observation | null>;
  claimPending(limit: number, workerId: string): Promise<Observation[]>;
  completeProcessing(id: string, success: boolean, error?: string): Promise<void>;
  clear?(): Promise<void> | void;
}
