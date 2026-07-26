import type { ExecutionPlan } from "../domain/executionPlan";

/**
 * Porta estável: recebe ExecutionPlan já derivado e o executa.
 * Nesta fase, a execução ainda é mínima e devolve o próprio plano.
 */
export interface ExecutionServicePort {
  execute(plan: ExecutionPlan): Promise<ExecutionPlan>;
}
